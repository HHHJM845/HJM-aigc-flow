// server/routes/topic-research.ts
import { Router, type Request, type Response } from 'express';
import { upsertProjectContext } from '../db.js';

const router = Router();
const ARK_BASE = 'https://ark.cn-beijing.volces.com/api/v3';
const MODEL = 'doubao-1-5-pro-32k-250115';

const SOURCE_NAMES: Record<string, string> = {
  cinema:    '院线趋势（近期上映及热映影片）',
  streaming: '流媒体热门（Netflix、爱奇艺、B站等平台）',
  festival:  '国际影展（戛纳、柏林、圣丹斯等）',
};

function sseWrite(res: Response, data: object) {
  res.write(`data: ${JSON.stringify(data)}\n\n`);
}

router.post('/', async (req: Request, res: Response) => {
  const { keyword, sources, projectId } = req.body as {
    keyword?: string;
    sources?: string[];
    projectId?: string;
  };

  if (!keyword?.trim()) {
    return res.status(400).json({ error: '请提供关键词' });
  }

  const selectedSources = (sources ?? ['cinema', 'streaming', 'festival'])
    .filter((s): s is string => typeof s === 'string');

  if (selectedSources.length === 0) {
    return res.status(400).json({ error: '请至少选择一个来源' });
  }

  const ALLOWED_SOURCES = new Set(['cinema', 'streaming', 'festival']);
  const validSources = selectedSources.filter(s => ALLOWED_SOURCES.has(s));
  if (validSources.length === 0) {
    return res.status(400).json({ error: '请选择至少一个有效来源' });
  }
  const safeKeyword = keyword.trim().slice(0, 100);

  const apiKey = process.env.IMAGE_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: '服务端未配置 IMAGE_API_KEY' });
  }

  // SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  try {
    const sourceDesc = validSources
      .map(s => SOURCE_NAMES[s] ?? s)
      .join('、');

    // ── Pass 1: Web search for video data ───────────────────
    const searchPrompt = `你是资深电影策划和选题顾问，精通全球影视内容趋势与创作规律。请根据你的专业知识，围绕"${safeKeyword}"这一主题，从以下来源中筛选最具参考价值的影片：${sourceDesc}。

构建 6 部最具代表性的参考影片案例（可以是真实存在的影片，也可以是具有代表性的虚构案例），以纯 JSON 格式返回，不要有任何多余文字、注释或 markdown 代码块，直接返回 JSON：

{
  "summary": {
    "filmCount": <影片数量，数字>,
    "dominantMood": "<主流情感基调，如：孤独、反抗、成长、希望>",
    "dominantGenre": "<高频题材类型，如：公路片、家庭剧情、伪纪录>"
  },
  "films": [
    {
      "title": "<片名>",
      "director": "<导演姓名>",
      "year": <上映年份，数字>,
      "source": "<cinema|streaming|festival>",
      "externalUrl": "<豆瓣或IMDb链接，找不到填空字符串>",
      "styleTags": ["<风格标签1>", "<风格标签2>"],
      "relevanceReason": "<与"${safeKeyword}"主题的关联，说明为何值得参考，2-3句>",
      "learnDimensions": ["<可借鉴维度，如：结构、视觉、人物、主题>"]
    }
  ]
}`;

    const searchResp = await fetch(`${ARK_BASE}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [{ role: 'user', content: searchPrompt }],
        temperature: 0.3,
        max_tokens: 8000,
        response_format: { type: 'json_object' },
      }),
    });

    if (!searchResp.ok) {
      const text = await searchResp.text();
      sseWrite(res, { type: 'error', data: { message: `搜索服务错误: ${text.slice(0, 200)}` } });
      res.write('data: [DONE]\n\n');
      return res.end();
    }

    const searchJson = await searchResp.json() as {
      choices: { message: { content: string } }[];
    };

    let rawContent = searchJson.choices?.[0]?.message?.content ?? '';
    // Strip markdown code fences if model wrapped the JSON
    rawContent = rawContent.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();

    // Try to extract JSON object from response (model may add text before/after)
    const jsonStart = rawContent.indexOf('{');
    const jsonEnd = rawContent.lastIndexOf('}');
    if (jsonStart !== -1 && jsonEnd > jsonStart) {
      rawContent = rawContent.slice(jsonStart, jsonEnd + 1);
    }

    type FilmData = {
      summary: { filmCount: number; dominantMood: string; dominantGenre: string };
      films: {
        title: string; director: string; year: number;
        source: string; externalUrl: string;
        styleTags: string[]; relevanceReason: string; learnDimensions: string[];
      }[];
    };

    const tryParse = (s: string): FilmData | null => {
      try { return JSON.parse(s) as FilmData; } catch { return null; }
    };

    // Repair common model-output errors:
    // 1. Missing '[' only:  "key": "x", "y", "z"]  →  "key": ["x", "y", "z"]
    // 2. Missing both brackets: "key": "x", "y", "z"\n  →  "key": ["x", "y", "z"]
    const repairMissingArrayBracket = (s: string) =>
      s
        // Fix missing '[' when ']' exists
        .replace(/("[\w]+"\s*:\s*)("(?:[^"\\]|\\.)*"(?:\s*,\s*"(?:[^"\\]|\\.)*")+\s*\])/g, '$1[$2')
        // Fix missing both '[' and ']': value is multiple quoted strings before newline/comma/}
        .replace(/("[\w]+"\s*:\s*)("(?:[^"\\]|\\.)*"(?:\s*,\s*"(?:[^"\\]|\\.)*")+)(\s*[\n,}])/g,
          (_, key, vals, trailing) => `${key}[${vals}]${trailing}`);

    let filmData: FilmData | null =
      tryParse(rawContent) ?? tryParse(repairMissingArrayBracket(rawContent));

    if (!filmData) {
      // Try to repair truncated JSON by trimming back to the last complete video entry
      const lastCompleteIdx = rawContent.lastIndexOf('}\n    }');
      let repaired: typeof filmData | null = null;
      if (lastCompleteIdx !== -1) {
        const candidate = rawContent.slice(0, lastCompleteIdx + '}\n    }'.length) + '\n  ]\n}';
        repaired = tryParse(candidate) ?? tryParse(repairMissingArrayBracket(candidate));
      }
      if (repaired) {
        console.warn('[topic-research] Recovered from truncated JSON. Films:', repaired.films?.length);
        filmData = repaired;
      } else {
        console.error('[topic-research] JSON parse failed. Length:', rawContent.length, 'Tail:', rawContent.slice(-300));
        sseWrite(res, {
          type: 'error',
          data: { message: '未找到相关内容，请换词重试（联网搜索结果解析失败）' },
        });
        res.write('data: [DONE]\n\n');
        return res.end();
      }
    }

    if (!filmData?.films?.length) {
      sseWrite(res, {
        type: 'error',
        data: { message: '未找到相关影片参考，请尝试更换主题或来源' },
      });
      res.write('data: [DONE]\n\n');
      return res.end();
    }

    // Send Phase 1
    sseWrite(res, { type: 'films', data: filmData });

    // ── Pass 2: Streaming insight + suggestions ───────────────
    const filmsText = filmData.films
      .map((f, i) =>
        `影片${i + 1}：《${f.title}》（${f.director}，${f.year}，来源：${f.source}）\n风格：${f.styleTags.join('、')}\n关联：${f.relevanceReason}`
      )
      .join('\n\n');

    const insightPrompt = `你是一位影视创作顾问，正在帮助创作者围绕"${safeKeyword}"这一主题找到创作方向。以下是相关参考影片的研究数据：

【参考影片数据】
${filmsText}

【任务一：创作方向分析】
基于以上参考影片，用简洁要点（每点一行，用•开头）分析该主题在影视创作中的规律，涵盖：
• 叙事规律：该主题常见的故事结构（线性/非线性、单线/群像、时间跨度等）
• 视觉基调：色彩、光线、景别、运镜的普遍倾向
• 情感内核：驱动观众的核心情感张力，以及最容易触发共鸣的情绪类型

请先输出创作方向分析内容，然后在结尾另起一行输出如下格式的 JSON（不要有其他文字）：
===SUGGESTIONS_JSON===
[
  {
    "title": "<选题标题，10-20字，有具体感，不是标题党>",
    "coreConflict": "<核心冲突，一句话点明戏剧张力>",
    "genreTag": "<片种：短片|纪录|品牌片|微电影>",
    "referenceStyle": "<风格锚点，如：侯孝贤 / 《童年往事》>"
  }
]
===END===

要求：给出 6-8 个选题建议，覆盖不同片种和角度，避免重复，每个选题都应有清晰的核心冲突。`;

    const streamResp = await fetch(`${ARK_BASE}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [{ role: 'user', content: insightPrompt }],
        stream: true,
        temperature: 0.7,
      }),
    });

    if (!streamResp.ok || !streamResp.body) {
      sseWrite(res, { type: 'error', data: { message: 'AI 分析服务暂时不可用' } });
      res.write('data: [DONE]\n\n');
      return res.end();
    }

    const reader = streamResp.body.getReader();
    const decoder = new TextDecoder();
    let fullText = '';
    let jsonSent = false;
    let sseBuffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      sseBuffer += chunk;
      const lines = sseBuffer.split('\n');
      sseBuffer = lines.pop() ?? '';

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const payload = line.slice(6).trim();
        if (payload === '[DONE]') continue;

        let parsed: { choices?: { delta?: { content?: string } }[] };
        try { parsed = JSON.parse(payload); } catch { continue; }

        const delta = parsed.choices?.[0]?.delta?.content ?? '';
        if (!delta) continue;

        fullText += delta;

        // Stream insight portion (before the JSON marker)
        const markerIdx = fullText.indexOf('===SUGGESTIONS_JSON===');
        if (markerIdx === -1) {
          // Still in insight territory — stream the new delta
          sseWrite(res, { type: 'insight_chunk', data: delta });
        } else if (!jsonSent) {
          // We have the marker — extract and parse suggestions
          const jsonStart = markerIdx + '===SUGGESTIONS_JSON==='.length;
          const jsonEnd = fullText.indexOf('===END===', jsonStart);
          if (jsonEnd !== -1) {
            const jsonStr = fullText.slice(jsonStart, jsonEnd).trim();
            try {
              const suggestions = JSON.parse(jsonStr);
              sseWrite(res, { type: 'suggestions', data: suggestions });
              jsonSent = true;
            } catch {
              // Malformed JSON — skip suggestions gracefully
            }
          }
        }
      }
    }

    // 保存到项目上下文
    if (projectId) {
      const insightText = fullText.split('===SUGGESTIONS_JSON===')[0].trim();
      upsertProjectContext(projectId, {
        keyword: safeKeyword,
        topicInsight: insightText.slice(0, 300),
      });
    }

    res.write('data: [DONE]\n\n');
    res.end();
  } catch (err: unknown) {
    if (!res.writableEnded) {
      sseWrite(res, {
        type: 'error',
        data: { message: (err as Error).message || '服务器内部错误' },
      });
      res.write('data: [DONE]\n\n');
      res.end();
    }
  }
});

export default router;
