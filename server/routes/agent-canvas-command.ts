// server/routes/agent-canvas-command.ts
import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { getProjectContext } from '../db.js';

const router = Router();
const ARK_BASE = 'https://ark.cn-beijing.volces.com/api/v3';
const TEXT_MODEL = 'doubao-1-5-pro-32k-250115';

// ── Types ────────────────────────────────────────────────────
interface ReferencedNode {
  id: string;
  label: string;
  prompt: string;
  imageUrl?: string;
}

interface CanvasNode {
  id: string;
  label: string;
  index: number;
}

type Operation =
  | { op: 'update_prompt';  nodeId: string; newPrompt: string }
  | { op: 'update_label';   nodeId: string; newLabel: string }
  | { op: 'insert_node';    afterNodeId: string; label: string; prompt: string }
  | { op: 'delete_node';    nodeId: string }
  | { op: 'generate_image'; nodeId: string };

interface CommandRequest {
  message: string;
  referencedNodes: ReferencedNode[];
  canvasNodes: CanvasNode[];
  projectId?: string;
}

interface CommandResponse {
  reply: string;
  operations: Operation[];
}

// ── System prompt ────────────────────────────────────────────
function buildSystemPrompt(ctx?: { keyword?: string; topicInsight?: string; sceneCount?: number } | null): string {
  const ctxSection = ctx?.keyword
    ? `\n\n【项目背景】主题："${ctx.keyword}"${ctx.sceneCount ? `，共${ctx.sceneCount}个分镜` : ''}${ctx.topicInsight ? `，风格：${ctx.topicInsight.slice(0, 80)}` : ''}。操作时请与此背景保持一致。`
    : '';
  return `你是一个画布操作助手，帮助用户通过自然语言控制 AI 图片生成画布。

画布由若干"图片节点"组成，每个节点有唯一 id、label（镜头名）、prompt（生图提示词）。

你可以执行以下操作（operations 数组，按顺序执行）：
- { "op": "update_prompt",  "nodeId": "...", "newPrompt": "..." }   // 修改节点提示词
- { "op": "update_label",   "nodeId": "...", "newLabel": "..."  }   // 修改节点标题
- { "op": "insert_node",    "afterNodeId": "...", "label": "...", "prompt": "..." } // 在某节点右侧插入新节点
- { "op": "delete_node",    "nodeId": "..." }                       // 删除节点
- { "op": "generate_image", "nodeId": "..." }                       // 触发生图

规则：
1. 只返回合法 JSON，格式为 { "reply": "...", "operations": [...] }，不输出任何其他文字。
2. reply 是给用户的简短自然语言回复（中文，50字以内）。
3. 如果用户只是聊天不需要操作，operations 返回空数组 []。
4. 修改提示词后如果用户没有明确说不生图，默认附加 generate_image 操作。
5. insert_node 后默认附加 generate_image 操作（针对新节点的 id = "new_<afterNodeId>"，前端会用实际生成的 id 替换）。` + ctxSection;
}

function buildUserMessage(req: CommandRequest): string {
  const refSection = req.referencedNodes.length > 0
    ? `\n引用节点（完整信息）：\n${req.referencedNodes.map(n =>
        `- id: ${n.id} | label: ${n.label} | prompt: ${n.prompt}`
      ).join('\n')}`
    : '';

  const canvasSection = req.canvasNodes.length > 0
    ? `\n画布所有节点（序号 + 概览）：\n${req.canvasNodes.map(n =>
        `- #${n.index} id: ${n.id} | label: ${n.label}`
      ).join('\n')}`
    : '\n（画布当前无其他节点）';

  return `用户指令：${req.message}${refSection}${canvasSection}`;
}

// ── Route handler ────────────────────────────────────────────
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = req.body as CommandRequest;
    if (!body.message?.trim()) {
      return res.status(400).json({ error: '请提供指令' });
    }

    const apiKey = process.env.IMAGE_API_KEY;
    if (!apiKey) return res.status(500).json({ error: '服务端未配置 IMAGE_API_KEY' });

    const ctx = body.projectId ? getProjectContext(body.projectId) : null;

    const upstream = await fetch(`${ARK_BASE}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: TEXT_MODEL,
        messages: [
          { role: 'system', content: buildSystemPrompt(ctx) },
          { role: 'user',   content: buildUserMessage(body) },
        ],
        temperature: 0.4,
      }),
    });

    if (!upstream.ok) {
      const errText = await upstream.text();
      console.error('[agent-canvas-command] upstream error:', errText);
      return res.status(502).json({ error: `AI API error: ${upstream.status}` });
    }

    const data = await upstream.json() as { choices: { message: { content: string } }[] };
    const content = data.choices?.[0]?.message?.content ?? '{"reply":"操作完成","operations":[]}';

    // Extract JSON (AI may wrap in markdown fences)
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return res.json({ reply: content.trim(), operations: [] } as CommandResponse);
    }

    const result = JSON.parse(jsonMatch[0]) as CommandResponse;
    res.json(result);
  } catch (err) {
    next(err);
  }
});

export default router;
