// server/routes/agent-annotation-review.ts
import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';

const router = Router();
const ARK_BASE = 'https://ark.cn-beijing.volces.com/api/v3';
const TEXT_MODEL = 'doubao-1-5-pro-32k-250115';

interface AnnotationRow {
  rowId: string;
  rowIndex: number;
  shotType: string;
  description: string;
  comment: string;
}

interface Suggestion {
  rowId: string;
  prompt: string;
  reason: string;
}

router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { rows } = req.body as { rows: AnnotationRow[] };

    if (!rows?.length) {
      return res.json({ suggestions: [] });
    }

    const apiKey = process.env.IMAGE_API_KEY;
    if (!apiKey) return res.status(500).json({ error: '服务端未配置 IMAGE_API_KEY' });

    const rowList = rows
      .map(r => `- rowId: ${r.rowId} | #${r.rowIndex} ${r.shotType} | 原描述: ${r.description} | 批注: ${r.comment}`)
      .join('\n');

    const userPrompt = `你是专业分镜修改顾问。根据甲方批注，为每个分镜生成修改后的 AI 图像生成提示词。

规则：
- 保留原分镜的核心构图和人物，只调整批注指出的问题
- 提示词用中文，50-100字
- 只返回 JSON：{"suggestions":[{"rowId":"...","prompt":"...","reason":"..."},...]}

分镜列表：
${rowList}`;

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
      console.error('[agent-annotation-review] upstream error:', err);
      return res.status(502).json({ error: `AI API error: ${upstream.status}` });
    }

    const data = await upstream.json() as { choices: { message: { content: string } }[] };
    const content = data.choices?.[0]?.message?.content ?? '{"suggestions":[]}';

    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return res.json({ suggestions: [] });

    const result = JSON.parse(jsonMatch[0]) as { suggestions: Suggestion[] };
    res.json(result);
  } catch (err) {
    next(err);
  }
});

export default router;
