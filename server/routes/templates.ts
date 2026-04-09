import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { getTemplates, createTemplate, updateTemplate, deleteTemplate } from '../db.js';

const router = Router();

const ARK_BASE = 'https://ark.cn-beijing.volces.com/api/v3';
const TEXT_MODEL = 'doubao-1-5-pro-32k-250115';

// GET /api/templates?nodeType=image&genre=古风武侠
router.get('/', (req: Request, res: Response) => {
  const { nodeType, genre } = req.query as { nodeType?: string; genre?: string };
  const list = getTemplates(nodeType, genre);
  res.json(list);
});

// POST /api/templates
router.post('/', (req: Request, res: Response) => {
  const body = req.body as {
    name: string; genre: string; nodeType: 'image' | 'video'; promptPreset: string;
    styleTag?: string; compositionTip?: string;
    cameraParams?: string; durationHint?: number; audioHint?: string;
  };
  if (!body.name?.trim() || !body.genre?.trim() || !body.nodeType || !body.promptPreset?.trim()) {
    return res.status(400).json({ error: '缺少必填字段' });
  }
  const id = `tpl_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  createTemplate({ id, ...body,
    styleTag: body.styleTag ?? null, compositionTip: body.compositionTip ?? null,
    cameraParams: body.cameraParams ?? null, durationHint: body.durationHint ?? null,
    audioHint: body.audioHint ?? null });
  res.json({ id });
});

// PUT /api/templates/:id
router.put('/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  updateTemplate(id, req.body);
  res.json({ ok: true });
});

// DELETE /api/templates/:id
router.delete('/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  deleteTemplate(id);
  res.json({ ok: true });
});

// POST /api/templates/merge-prompt
// IMPORTANT: this must be defined BEFORE PUT /:id in the file so Express matches it correctly
router.post('/merge-prompt', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { templatePrompt, userInput, nodeType, shotDescription } = req.body as {
      templatePrompt: string;
      userInput?: string;
      nodeType: 'image' | 'video';
      shotDescription?: string;
    };
    if (!templatePrompt?.trim()) {
      return res.status(400).json({ error: '缺少 templatePrompt' });
    }

    const apiKey = process.env.IMAGE_API_KEY;
    if (!apiKey) return res.status(500).json({ error: '未配置 IMAGE_API_KEY' });

    const typeLabel = nodeType === 'video' ? '视频' : '图像';
    const userPart = userInput?.trim() ? `\n用户补充描述：${userInput.trim()}` : '';
    const shotPart = shotDescription?.trim() ? `\n分镜描述：${shotDescription.trim()}` : '';

    const prompt = `你是专业的AI${typeLabel}生成提示词工程师。以模板提示词为风格基底，融入用户补充描述（如有），输出一段适合${typeLabel}生成的提示词。

要求：
- 语言：中文
- 长度：50-150字
- 包含：画面主体、氛围、光效、风格关键词${nodeType === 'video' ? '、运镜方式' : '、构图'}
- 只输出提示词本身，不要任何解释或标题

模板提示词：${templatePrompt.trim()}${userPart}${shotPart}`.trim();

    const upstream = await fetch(`${ARK_BASE}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ model: TEXT_MODEL, messages: [{ role: 'user', content: prompt }], temperature: 0.7 }),
    });

    if (!upstream.ok) {
      const err = await upstream.text();
      console.error('[merge-prompt] upstream error:', err);
      return res.status(502).json({ error: `AI API error: ${upstream.status}` });
    }

    const data = await upstream.json() as { choices: { message: { content: string } }[] };
    const mergedPrompt = data.choices?.[0]?.message?.content?.trim() ?? '';
    res.json({ mergedPrompt });
  } catch (err) {
    next(err);
  }
});

export default router;
