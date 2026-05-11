import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';

const router = Router();
const UPSTREAM_TIMEOUT = 45000;

router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { description, style, label, nodeType } = req.body as {
      description?: string;
      style?: string;
      label?: string;
      nodeType?: 'image' | 'video';
    };

    const hasDescription = !!description?.trim();
    const hasStyle = !!style?.trim();

    if (!hasDescription && !hasStyle) {
      return res.status(400).json({ error: '请提供画面描述或风格' });
    }

    const apiKey = process.env.DEEPSEEK_API_KEY;
    const baseUrl = process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com';
    if (!apiKey) return res.status(500).json({ error: '服务端未配置 DEEPSEEK_API_KEY' });

    const parts: string[] = [];
    if (hasDescription) parts.push(`画面描述：${description!.trim()}`);
    if (hasStyle) parts.push(`画风：${style!.trim()}`);
    if (label?.trim()) parts.push(`镜头信息：${label.trim()}`);

    const userPrompt = nodeType === 'video'
      ? `你是专业的AI视频生成提示词工程师。根据以下信息，生成一段优化的视频生成提示词。

要求：
- 语言：中文
- 长度：50-150字
- 包含：画面主体、运镜方式（如推镜/拉镜/平移/旋转/跟镜）、动态效果、光线氛围、画风关键词
- 强调运动感和时间变化
- 只输出提示词本身，不要加任何解释或标题

${parts.join('\n')}`.trim()
      : `你是专业的AI图像生成提示词工程师。根据以下信息，生成一段优化的图像生成提示词。

要求：
- 语言：中文
- 长度：50-150字
- 包含：画面主体、构图、光线氛围、画风关键词
- 只输出提示词本身，不要加任何解释或标题

${parts.join('\n')}`.trim();

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT);
    const upstream = await fetch(`${baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      signal: controller.signal,
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [{ role: 'user', content: userPrompt }],
        temperature: 0.7,
      }),
    }).finally(() => clearTimeout(timeout));

    if (!upstream.ok) {
      const err = await upstream.text();
      console.error('[optimize-prompt] upstream error:', err);
      return res.status(502).json({ error: `AI API error: ${upstream.status}` });
    }

    const data = await upstream.json() as { choices: { message: { content: string } }[] };
    const optimized = data.choices?.[0]?.message?.content?.trim() ?? '';
    res.json({ prompt: optimized });
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      return res.status(504).json({ error: 'AI 优化超时，请稍后重试' });
    }
    next(err);
  }
});

export default router;
