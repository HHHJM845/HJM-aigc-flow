import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { getProjectContext } from '../db.js';

const router = Router();
const ARK_BASE = 'https://ark.cn-beijing.volces.com/api/v3';
const TEXT_MODEL = 'doubao-1-5-pro-32k-250115';

router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { rows, assets, projectId } = req.body as {
      rows: { id: string; description: string }[];
      assets: { id: string; name: string; category?: string }[];
      projectId?: string;
    };

    if (!rows?.length || !assets?.length) {
      return res.json({ matches: [] });
    }

    const apiKey = process.env.IMAGE_API_KEY;
    if (!apiKey) return res.status(500).json({ error: '服务端未配置 IMAGE_API_KEY' });

    const assetList = assets
      .map(a => `- ID: ${a.id} | 名称: ${a.name} | 类别: ${a.category ?? '未分类'}`)
      .join('\n');
    const rowList = rows
      .map(r => `- ID: ${r.id} | 描述: ${r.description}`)
      .join('\n');

    let ctxNote = '';
    if (projectId) {
      const ctx = getProjectContext(projectId);
      if (ctx?.keyword) {
        ctxNote = `\n\n项目主题："${ctx.keyword}"${ctx.topicInsight ? `，风格方向：${ctx.topicInsight.slice(0, 80)}` : ''}。匹配时请优先选择与此主题相符的资产。`;
      }
    }

    const userPrompt = `你是分镜资产匹配专家。根据资产库和分镜描述，找出每个分镜最匹配的主要角色或场景资产。

资产库：
${assetList}

分镜描述：
${rowList}

匹配规则：
- 只匹配描述中明确出现的角色名或场景名（精确、部分或近义词匹配均可）
- 每个分镜最多匹配一个资产（选最突出的）
- 无法确定时不返回该分镜

只返回JSON，格式：{"matches": [{"rowId": "...", "assetId": "..."}]}${ctxNote}`;

    const upstream = await fetch(`${ARK_BASE}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: TEXT_MODEL,
        messages: [{ role: 'user', content: userPrompt }],
        temperature: 0,
      }),
    });

    if (!upstream.ok) {
      const err = await upstream.text();
      console.error('[match-assets] upstream error:', err);
      return res.status(502).json({ error: `AI API error: ${upstream.status}` });
    }

    const data = await upstream.json() as { choices: { message: { content: string } }[] };
    const content = data.choices?.[0]?.message?.content ?? '{"matches":[]}';

    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return res.json({ matches: [] });

    const result = JSON.parse(jsonMatch[0]) as { matches: { rowId: string; assetId: string }[] };
    res.json(result);
  } catch (err) {
    next(err);
  }
});

export default router;
