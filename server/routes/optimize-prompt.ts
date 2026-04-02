import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';

const router = Router();
const ARK_BASE = 'https://ark.cn-beijing.volces.com/api/v3';
const TEXT_MODEL = 'doubao-pro-32k';

router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { description, style, label } = req.body as {
      description: string;
      style?: string;
      label?: string;
    };

    if (!description?.trim()) {
      return res.status(400).json({ error: '请提供画面描述' });
    }

    const apiKey = process.env.IMAGE_API_KEY;
    if (!apiKey) return res.status(500).json({ error: '服务端未配置 IMAGE_API_KEY' });

    const styleText = style?.trim() ? `画风：${style}` : '';
    const labelText = label?.trim() ? `镜头信息：${label}` : '';

    const userPrompt = `你是专业的AI图像生成提示词工程师。根据分镜画面描述和画风，生成一段优化的图像生成提示词。

要求：
- 语言：中文
- 长度：50-150字
- 包含：画面主体、构图、光线氛围、画风关键词
- 只输出提示词本身，不要加任何解释或标题

画面描述：${description}
${styleText}
${labelText}`.trim();

    const upstream = await fetch(`${ARK_BASE}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: TEXT_MODEL,
        messages: [{ role: 'user', content: userPrompt }],
        temperature: 0.7,
      }),
    });

    if (!upstream.ok) {
      const err = await upstream.text();
      console.error('[optimize-prompt] upstream error:', err);
      return res.status(502).json({ error: `AI API error: ${upstream.status}` });
    }

    const data = await upstream.json() as { choices: { message: { content: string } }[] };
    const optimized = data.choices?.[0]?.message?.content?.trim() ?? '';
    res.json({ prompt: optimized });
  } catch (err) {
    next(err);
  }
});

export default router;
