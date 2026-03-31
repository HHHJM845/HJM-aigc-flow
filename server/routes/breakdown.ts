import { Router } from 'express';

const router = Router();

const BREAKDOWN_SYSTEM_PROMPT = `你是专业分镜师。将剧本拆解为分镜列表，只返回 JSON，格式：
{"scenes":[{"shot_type":"景别","description":"镜头内容","source_segment":"对应的原文段落原文"},...]}

规则：
1. "场X 地点"行是场景标题，不是分镜，跳过
2. "△"开头的每一行 = 一个独立分镜
3. 对白行（人名：台词）= 一个独立分镜
4. shot_type 只填景别词，如：特写、近景、中近景、中景、全景、远景、大全景、航拍
5. description 用一句话描述画面动作，不超过60字
6. source_segment 填写该分镜对应的原文段落内容（可以是多行，保持原文）
7. 禁止输出 JSON 以外的任何文字`;

router.post('/', async (req, res, next) => {
  try {
    const { script } = req.body as { script: string };
    if (!script?.trim()) {
      return res.status(400).json({ error: '请提供剧本内容' });
    }

    const apiKey = process.env.DEEPSEEK_API_KEY;
    const baseUrl = process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com';
    if (!apiKey) return res.status(500).json({ error: '服务端未配置 DEEPSEEK_API_KEY' });

    const upstream = await fetch(`${baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [
          { role: 'system', content: BREAKDOWN_SYSTEM_PROMPT },
          { role: 'user', content: script },
        ],
      }),
    });

    if (!upstream.ok) {
      const text = await upstream.text();
      return res.status(upstream.status).json({ error: `上游 API 错误: ${text}` });
    }

    const json = await upstream.json() as { choices: { message: { content: string } }[] };
    const raw = json.choices?.[0]?.message?.content || '{"scenes":[]}';

    let cleaned = raw
      .replace(/<think>[\s\S]*?<\/think>/gi, '')
      .replace(/<think>[\s\S]*/gi, '')
      .replace(/```[a-zA-Z]*\n?/g, '')
      .replace(/```/g, '');

    const objStart = cleaned.indexOf('{');
    const arrStart = cleaned.indexOf('[');
    const useObj = objStart !== -1 && (arrStart === -1 || objStart < arrStart);
    if (useObj) {
      const end = cleaned.lastIndexOf('}');
      if (end > objStart) cleaned = cleaned.slice(objStart, end + 1);
    } else if (arrStart !== -1) {
      const end = cleaned.lastIndexOf(']');
      if (end > arrStart) cleaned = cleaned.slice(arrStart, end + 1);
    }

    const parsed = JSON.parse(cleaned) as Record<string, unknown>;
    const rawArr: unknown[] = Array.isArray(parsed) ? parsed
      : Array.isArray(parsed.scenes) ? (parsed.scenes as unknown[])
      : Array.isArray(parsed.shots) ? (parsed.shots as unknown[])
      : [];

    const scenes = rawArr.map((item, i) => {
      const o = item as Record<string, unknown>;
      return {
        id: `row-${Date.now()}-${i}`,
        index: i + 1,
        shotType: String(o.shot_type ?? o.shotType ?? o['景别'] ?? ''),
        description: String(o.description ?? o.content ?? o['镜头内容'] ?? o['描述'] ?? ''),
        sourceSegment: String(o.source_segment ?? o.sourceSegment ?? ''),
      };
    });

    res.json({ scenes });
  } catch (err) {
    next(err);
  }
});

export default router;
