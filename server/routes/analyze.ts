import { Router } from 'express';

const router = Router();
const ARK_BASE = 'https://ark.cn-beijing.volces.com/api/v3';
// 使用 Doubao 最新视觉理解模型
const VISION_MODEL = 'doubao-1.5-vision-pro-250328';

router.post('/', async (req, res, next) => {
  try {
    const { image } = req.body as { image: string };
    if (!image) return res.status(400).json({ error: '请提供图片' });

    const apiKey = process.env.IMAGE_API_KEY;
    if (!apiKey) return res.status(500).json({ error: '服务端未配置 IMAGE_API_KEY' });

    console.log('[analyze] analyzing image with vision model:', VISION_MODEL);

    const upstream = await fetch(`${ARK_BASE}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: VISION_MODEL,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'image_url', image_url: { url: image } },
              {
                type: 'text',
                text: '请分析这张图片，为AI图片生成模型输出一段精准的英文提示词（prompt）。要求：\n1. 描述主体、场景、风格、光线、色调、构图\n2. 使用Stable Diffusion / Midjourney风格的专业词汇\n3. 只输出提示词本身，不加任何解释或标题',
              },
            ],
          },
        ],
        max_tokens: 512,
      }),
    });

    if (!upstream.ok) {
      const text = await upstream.text();
      console.error('[analyze] upstream error:', upstream.status, text);
      return res.status(upstream.status).json({ error: `图片分析失败(${upstream.status}): ${text.slice(0, 300)}` });
    }

    const json = await upstream.json() as { choices?: { message?: { content?: string } }[] };
    const prompt = json.choices?.[0]?.message?.content?.trim() || '';
    if (!prompt) return res.status(502).json({ error: '模型未返回内容' });

    res.json({ prompt });
  } catch (err) {
    next(err);
  }
});

export default router;
