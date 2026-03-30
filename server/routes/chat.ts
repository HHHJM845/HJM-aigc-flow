import { Router } from 'express';

const router = Router();

router.post('/', async (req, res, next) => {
  try {
    const { messages, systemPrompt } = req.body as {
      messages: { role: string; content: string }[];
      systemPrompt?: string;
    };

    if (!messages?.length) {
      return res.status(400).json({ error: '请提供消息内容' });
    }

    const apiKey = process.env.DEEPSEEK_API_KEY;
    const baseUrl = process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com';
    if (!apiKey) return res.status(500).json({ error: '服务端未配置 DEEPSEEK_API_KEY' });

    const allMessages = systemPrompt
      ? [{ role: 'system', content: systemPrompt }, ...messages]
      : messages;

    const upstream = await fetch(`${baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: allMessages,
      }),
    });

    if (!upstream.ok) {
      const text = await upstream.text();
      return res.status(upstream.status).json({ error: `上游 API 错误: ${text}` });
    }

    const json = await upstream.json() as { choices: { message: { content: string } }[] };
    const raw = json.choices?.[0]?.message?.content || '';
    const content = raw.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();

    res.json({ content });
  } catch (err) {
    next(err);
  }
});

export default router;
