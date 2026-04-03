// server/routes/topic-research.ts
import { Router, type Request, type Response } from 'express';

const router = Router();
const ARK_BASE = 'https://ark.cn-beijing.volces.com/api/v3';
const MODEL = 'doubao-1-5-pro-32k-250115';

const PLATFORM_NAMES: Record<string, string> = {
  bilibili: 'B站（bilibili.com）',
  xiaohongshu: '小红书（xiaohongshu.com）',
  douyin: '抖音（douyin.com）',
};

function sseWrite(res: Response, data: object) {
  res.write(`data: ${JSON.stringify(data)}\n\n`);
}

router.post('/', async (req: Request, res: Response) => {
  const { keyword, platforms } = req.body as {
    keyword?: string;
    platforms?: string[];
  };

  if (!keyword?.trim()) {
    return res.status(400).json({ error: '请提供关键词' });
  }

  const selectedPlatforms = (platforms ?? ['bilibili', 'xiaohongshu', 'douyin'])
    .filter((p): p is string => typeof p === 'string');

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
    const platformDesc = selectedPlatforms
      .map(p => PLATFORM_NAMES[p] ?? p)
      .join('、');

    // ── Pass 1: Web search for video data ───────────────────
    const searchPrompt = `你是内容研究助手。请搜索"${keyword}"这个题材在${platformDesc}上的热门视频内容。

分析搜索结果，选取 8-12 条最有代表性的视频（优先选播放量、点赞量高的），以纯 JSON 格式返回，不要有任何多余文字、注释或 markdown 代码块，直接返回 JSON：

{
  "summary": {
    "avgViews": <平均播放量数字>,
    "avgLikes": <平均点赞量数字>,
    "avgFavorites": <平均收藏量数字>
  },
  "videos": [
    {
      "title": "<视频标题>",
      "platform": "<bilibili|xiaohongshu|douyin>",
      "url": "<视频链接，如找不到填空字符串>",
      "thumbnail": "<封面图URL，如找不到填空字符串>",
      "views": <播放量数字，估算即可>,
      "likes": <点赞量数字，估算即可>,
      "favorites": <收藏量数字，估算即可>,
      "brief": "<视频内容简介，2-3句>",
      "topComments": ["<评论1>", "<评论2>", "<评论3>"],
      "analysis": "<这条视频爆火的核心原因，重点分析内容切入角度、情绪触发点、标题技巧，2-4句>"
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
        tools: [{ type: 'web_search', web_search: { enable: true, search_prompt_enabled: true } }],
        temperature: 0.3,
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

    let videoData: {
      summary: { avgViews: number; avgLikes: number; avgFavorites: number };
      videos: {
        title: string; platform: string; url: string; thumbnail: string;
        views: number; likes: number; favorites: number;
        brief: string; topComments: string[]; analysis: string;
      }[];
    };

    try {
      videoData = JSON.parse(rawContent);
    } catch {
      // Model didn't return clean JSON — extract what we can
      sseWrite(res, {
        type: 'error',
        data: { message: '未找到相关内容，请换词重试（联网搜索结果解析失败）' },
      });
      res.write('data: [DONE]\n\n');
      return res.end();
    }

    if (!videoData.videos?.length) {
      sseWrite(res, {
        type: 'error',
        data: { message: '未找到相关视频内容，请尝试更换关键词或平台' },
      });
      res.write('data: [DONE]\n\n');
      return res.end();
    }

    // Send Phase 1
    sseWrite(res, { type: 'videos', data: videoData });

    // ── Pass 2: Streaming insight + suggestions ───────────────
    const videosText = videoData.videos
      .map((v, i) =>
        `视频${i + 1}：${v.title}（${v.platform}，播放${v.views}，点赞${v.likes}）\n分析：${v.analysis}\n代表评论：${v.topComments.join(' / ')}`
      )
      .join('\n\n');

    const insightPrompt = `根据以下关于"${keyword}"题材的视频研究数据，请完成两个任务：

【视频研究数据】
${videosText}

【任务一：爆款配方】
用简洁要点（每点一行，用•开头）总结该题材爆款内容的共同规律，涵盖：
• 内容切入角度（观众最感兴趣的切入点）
• 情绪钩子类型（触发共鸣/好奇/感动的方式）
• 标题结构规律（高点击标题的写法特征）
• 高频评论诉求（观众在评论区最常表达的需求或情感）

请先输出爆款配方内容，然后在结尾另起一行输出如下格式的 JSON（不要有其他文字）：
===SUGGESTIONS_JSON===
[
  {
    "title": "<建议选题标题，10-20字，有吸引力>",
    "reason": "<为什么这个角度容易引发共鸣，1-2句>",
    "emotionTag": "<单个情绪标签，如：共鸣|感动|涨知识|好奇|争议>"
  }
]
===END===

要求：给出 6-8 个选题建议，覆盖不同角度，避免重复。`;

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

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split('\n');

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
