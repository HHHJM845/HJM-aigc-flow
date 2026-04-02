// server/routes/asset-chat.ts
import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';

const router = Router();
const ARK_BASE = 'https://ark.cn-beijing.volces.com/api/v3';
const TEXT_MODEL = 'doubao-pro-32k';

const CATEGORY_LABELS: Record<string, string> = {
  character: '人物',
  scene: '场景',
  other: '其他',
};

const CHAT_SYSTEM = (category: string) =>
  `你是一个专业的AI影视素材设计顾问。用户正在为影视项目生成${CATEGORY_LABELS[category] ?? ''}素材。` +
  `你的任务是通过对话帮助用户明确素材需求。每次只问一个关键问题，逐步了解：外观特征、风格、情绪、参考等。` +
  `不要直接生成图片描述，专注于沟通需求。回复简洁，不超过100字。`;

const EXTRACT_SYSTEM =
  `根据以下对话历史，提取并优化出一段用于AI图像生成的提示词。` +
  `要求：详细描述外观、风格、光线、构图；适合图像生成模型；中文输出；100-200字以内。` +
  `只输出提示词本身，不要任何前缀说明。`;

router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { messages, category, mode } = req.body as {
      messages: { role: 'user' | 'assistant'; content: string }[];
      category: string;
      mode: 'chat' | 'extract-prompt';
    };

    const apiKey = process.env.IMAGE_API_KEY;
    if (!apiKey) return res.status(500).json({ error: '服务端未配置 IMAGE_API_KEY' });

    const systemContent = mode === 'extract-prompt' ? EXTRACT_SYSTEM : CHAT_SYSTEM(category);

    const upstream = await fetch(`${ARK_BASE}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: TEXT_MODEL,
        messages: [
          { role: 'system', content: systemContent },
          ...messages,
        ],
        temperature: mode === 'extract-prompt' ? 0.3 : 0.7,
      }),
    });

    if (!upstream.ok) {
      const err = await upstream.text();
      console.error('[asset-chat] upstream error:', err);
      return res.status(502).json({ error: `AI API error: ${upstream.status}` });
    }

    const data = await upstream.json() as { choices: { message: { content: string } }[] };
    const reply = data.choices?.[0]?.message?.content ?? '';
    res.json({ reply });
  } catch (err) {
    next(err);
  }
});

export default router;
