import { Router } from 'express';

const router = Router();
const ARK_BASE = 'https://ark.cn-beijing.volces.com/api/v3';
const VISION_MODEL = 'doubao-1.5-vision-pro-250328';

router.post('/', async (req, res, next) => {
  try {
    const { frames, storyboardText } = req.body as { frames: string[]; storyboardText: string };
    if (!frames || !Array.isArray(frames)) {
      return res.status(400).json({ error: '请提供视频关键帧' });
    }

    const apiKey = process.env.IMAGE_API_KEY;
    if (!apiKey) return res.status(500).json({ error: '服务端未配置 IMAGE_API_KEY' });

    console.log('[subtitle-generate] calling vision model with', frames.length, 'frames');

    const content: unknown[] = [
      ...frames.map(f => ({ type: 'image_url', image_url: { url: f } })),
      {
        type: 'text',
        text: `以下是视频关键帧和对应剧本内容：\n${storyboardText || ''}\n\n请根据画面和剧本生成人物对话字幕。每行一句，格式严格为"角色名：台词"，不含序号、时间码或其他内容。`,
      },
    ];

    const upstream = await fetch(`${ARK_BASE}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: VISION_MODEL,
        messages: [{ role: 'user', content }],
        max_tokens: 1024,
      }),
    });

    if (!upstream.ok) {
      const text = await upstream.text();
      console.error('[subtitle-generate] upstream error:', upstream.status, text);
      return res.status(upstream.status).json({ error: `生成字幕失败(${upstream.status}): ${text.slice(0, 300)}` });
    }

    const json = await upstream.json() as { choices?: { message?: { content?: string } }[] };
    const raw = json.choices?.[0]?.message?.content?.trim() || '';
    if (!raw) return res.status(502).json({ error: '模型未返回内容' });

    const subtitles = raw
      .split('\n')
      .map(l => l.trim())
      .filter(l => l.length > 0);

    res.json({ subtitles });
  } catch (err) {
    next(err);
  }
});

export default router;
