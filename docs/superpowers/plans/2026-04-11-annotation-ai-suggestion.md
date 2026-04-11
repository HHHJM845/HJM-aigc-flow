# 批注驱动 AI 修改建议 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 甲方提交"需修改"批注后，AI 自动生成对应分镜的修改提示词草稿，展示在 BreakdownView，创作者可一键推送到画布生成新节点。

**Architecture:** 后端新增 `/api/agent/annotation-review` 路由，接收批量 revision 批注后一次 AI 调用返回所有建议。前端在 `handleAnnotationAdded` 中加 3s debounce，积累同项目批注后调用该路由。`annotationSuggestions` Map 以 props 传入 BreakdownView 渲染建议卡片，"导入画布"时在原节点右侧新建 ImageNode。

**Tech Stack:** TypeScript, Express, React, ReactFlow, Doubao API (`IMAGE_API_KEY`)

---

## File Map

| 文件 | 操作 | 职责 |
|------|------|------|
| `server/routes/agent-annotation-review.ts` | 新建 | 批量接收 revision 批注 → 一次 AI 调用 → 返回 suggestions |
| `server/index.ts` | 修改 | 注册新路由到 `/api/agent/annotation-review` |
| `src/App.tsx` | 修改 | debounce state/refs + `triggerAnnotationReview` + `annotationSuggestions` state + `onApplySuggestion` + props 传 BreakdownView |
| `src/components/BreakdownView.tsx` | 修改 | 接收 suggestions props，渲染 AI 建议卡片，"忽略"/"导入画布"按钮 |

---

## Task 1：后端路由 `agent-annotation-review.ts`

**Files:**
- Create: `server/routes/agent-annotation-review.ts`

- [ ] **Step 1: 新建路由文件**

```typescript
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
```

- [ ] **Step 2: 提交**

```bash
git add server/routes/agent-annotation-review.ts
git commit -m "feat(server): add agent-annotation-review route"
```

---

## Task 2：注册路由到 `server/index.ts`

**Files:**
- Modify: `server/index.ts`

- [ ] **Step 1: 在现有 import 块末尾加入新路由 import**

在 `server/index.ts` 中，找到：
```typescript
import reviewRouter from './routes/review.js';
import templatesRouter from './routes/templates.js';
```
改为：
```typescript
import reviewRouter from './routes/review.js';
import templatesRouter from './routes/templates.js';
import agentAnnotationReviewRouter from './routes/agent-annotation-review.js';
```

- [ ] **Step 2: 注册路由**

找到：
```typescript
app.use('/api/templates', templatesRouter);
app.use('/api', reviewRouter);
```
改为：
```typescript
app.use('/api/templates', templatesRouter);
app.use('/api/agent/annotation-review', agentAnnotationReviewRouter);
app.use('/api', reviewRouter);
```

- [ ] **Step 3: 手动验证路由可达**

启动后端后运行：
```bash
curl -s -X POST http://localhost:3001/api/agent/annotation-review \
  -H "Content-Type: application/json" \
  -d '{"rows":[{"rowId":"test-1","rowIndex":1,"shotType":"近景","description":"李明走向窗边，背光站立","comment":"这个镜头太暗了"}]}'
```
预期：返回 `{"suggestions":[{"rowId":"test-1","prompt":"...","reason":"..."}]}`（需要有效的 `IMAGE_API_KEY`）。若无 key 则返回 500，路由已注册成功。

- [ ] **Step 4: 提交**

```bash
git add server/index.ts
git commit -m "feat(server): register agent-annotation-review route"
```

---

## Task 3：App.tsx — debounce 逻辑 + `triggerAnnotationReview`

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1: 在 App 组件 state 块中新增 `annotationSuggestions` 及 debounce refs**

找到 `src/App.tsx` 中：
```typescript
const [notifications, setNotifications] = useState<NotificationItem[]>([]);
```
在其后插入：
```typescript
// ── Annotation AI suggestions ────────────────────────
type AnnotationSuggestion = {
  suggestedPrompt: string;
  reason: string;
  comment: string;
  status: 'pending' | 'dismissed';
};
const [annotationSuggestions, setAnnotationSuggestions] = useState<Map<string, AnnotationSuggestion>>(new Map());
const [annotationSuggestionsLoading, setAnnotationSuggestionsLoading] = useState(false);
const annotationDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
const pendingAnnotationsRef = useRef<{ rowId: string; rowIndex: number; comment: string }[]>([]);
```

- [ ] **Step 2: 在 App 组件中新增 `triggerAnnotationReview` 函数**

找到 `const handleAnnotationAdded` 函数定义之前，插入：

```typescript
const triggerAnnotationReview = async (
  pending: { rowId: string; rowIndex: number; comment: string }[]
) => {
  const project = currentProjectRef.current;
  if (!project) return;

  const rows = pending
    .map(p => {
      const row = project.storyboardRows?.find(r => r.id === p.rowId);
      if (!row) return null;
      return {
        rowId: p.rowId,
        rowIndex: p.rowIndex,
        shotType: row.shotType ?? '',
        description: row.description ?? '',
        comment: p.comment,
      };
    })
    .filter((r): r is NonNullable<typeof r> => r !== null);

  if (!rows.length) return;

  setAnnotationSuggestionsLoading(true);
  try {
    const res = await fetch('/api/agent/annotation-review', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rows }),
    });
    if (!res.ok) return;
    const data = await res.json() as {
      suggestions: { rowId: string; prompt: string; reason: string }[];
    };
    setAnnotationSuggestions(prev => {
      const next = new Map(prev);
      for (const s of data.suggestions) {
        const comment = pending.find(p => p.rowId === s.rowId)?.comment ?? '';
        next.set(s.rowId, { suggestedPrompt: s.prompt, reason: s.reason, comment, status: 'pending' });
      }
      return next;
    });
  } catch (err) {
    console.error('[annotation-review]', err);
  } finally {
    setAnnotationSuggestionsLoading(false);
  }
};
```

- [ ] **Step 3: 在 `handleAnnotationAdded` 中加 debounce 触发**

找到现有的 `handleAnnotationAdded` 函数，在函数末尾（`};` 之前）追加：

```typescript
    // Only trigger AI review for revision annotations on the current project
    if (msg.status === 'revision' && msg.projectId === currentProjectRef.current?.id) {
      pendingAnnotationsRef.current.push({
        rowId: msg.rowId,
        rowIndex: msg.rowIndex,
        comment: msg.comment,
      });
      if (annotationDebounceRef.current) clearTimeout(annotationDebounceRef.current);
      annotationDebounceRef.current = setTimeout(() => {
        triggerAnnotationReview(pendingAnnotationsRef.current);
        pendingAnnotationsRef.current = [];
      }, 3000);
    }
```

- [ ] **Step 4: 提交**

```bash
git add src/App.tsx
git commit -m "feat(app): add annotation AI suggestion debounce + triggerAnnotationReview"
```

---

## Task 4：App.tsx — `onApplySuggestion` + `onDismissSuggestion` + 传 props

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1: 新增 `onDismissSuggestion`**

在 `triggerAnnotationReview` 函数之后插入：

```typescript
const handleDismissSuggestion = (rowId: string) => {
  setAnnotationSuggestions(prev => {
    const next = new Map(prev);
    const s = next.get(rowId);
    if (s) next.set(rowId, { ...s, status: 'dismissed' });
    return next;
  });
};
```

- [ ] **Step 2: 新增 `onApplySuggestion`（导入画布）**

在 `handleDismissSuggestion` 之后插入：

```typescript
const handleApplySuggestion = (rowId: string, prompt: string, rowIndex: number) => {
  // 找到原节点位置
  // NOTE: setNodes 在 CanvasView 内部，需通过 externalCanvasUpdate 触发
  // 使用现有的 addNodeToCanvas 机制
  const newNodeId = `revision_${rowId}_${Date.now()}`;
  setExternalCanvasUpdate({
    type: 'add_revision_node',
    sourceNodeId: `storyboard-${rowId}`,
    newNodeId,
    prompt,
    rowIndex,
  });
  handleDismissSuggestion(rowId);
};
```

- [ ] **Step 3: 在 BreakdownView 挂载处传入新 props**

找到 `<BreakdownView` 的 JSX（在 App.tsx 中），加入三个新 props：

```tsx
<BreakdownView
  // ... 已有 props 保持不变 ...
  annotationSuggestions={annotationSuggestions}
  annotationSuggestionsLoading={annotationSuggestionsLoading}
  onDismissSuggestion={handleDismissSuggestion}
  onApplySuggestion={handleApplySuggestion}
/>
```

- [ ] **Step 4: 提交**

```bash
git add src/App.tsx
git commit -m "feat(app): add onApplySuggestion + onDismissSuggestion handlers"
```

---

## Task 5：CanvasView — 处理 `add_revision_node` 外部更新

**Files:**
- Modify: `src/App.tsx`（CanvasView 内的 `useEffect` for `externalCanvasUpdate`）

- [ ] **Step 1: 在处理 `externalCanvasUpdate` 的 useEffect 中新增分支**

找到 `src/App.tsx` 中处理 `externalCanvasUpdate` 的 `useEffect`，它包含：
```typescript
if (externalCanvasUpdate) {
```

在现有 if 块内部末尾，追加新分支：

```typescript
      if (externalCanvasUpdate?.type === 'add_revision_node') {
        const { sourceNodeId, newNodeId, prompt, rowIndex } = externalCanvasUpdate as {
          type: string; sourceNodeId: string; newNodeId: string; prompt: string; rowIndex: number;
        };
        const sourceNode = nodesRef.current.find(n => n.id === sourceNodeId);
        const baseX = sourceNode ? sourceNode.position.x + 420 : 200;
        const baseY = sourceNode ? sourceNode.position.y : 200;
        const revisionNode: Node = {
          id: newNodeId,
          type: 'imageNode',
          position: { x: baseX, y: baseY },
          width: 380,
          height: 214,
          data: {
            label: `修改版 · #${rowIndex}`,
            contentType: 'image',
            content: [],
            initialPrompt: prompt,
            onPlusClick: handlePlusClick,
            onUpdate: handleUpdateNode,
          },
        };
        setNodes(nds => [...nds, revisionNode]);
      }
```

- [ ] **Step 2: 确认 `ExternalCanvasUpdate` 类型**

检查 `externalCanvasUpdate` state 的类型定义（通常为 `Record<string, unknown> | null`），确保追加的字段不引起 TypeScript 类型报错。若类型严格，可用 `as unknown as ...` 做临时转换，或在类型定义中增加 `add_revision_node` 联合类型。

- [ ] **Step 3: 提交**

```bash
git add src/App.tsx
git commit -m "feat(canvas): handle add_revision_node external update"
```

---

## Task 6：BreakdownView — 接收 props + 渲染 AI 建议卡片

**Files:**
- Modify: `src/components/BreakdownView.tsx`

- [ ] **Step 1: 在 Props interface 中新增字段**

找到：
```typescript
interface Props {
  initialRows: StoryboardRow[];
  onImport: (rows: StoryboardRow[], ratio: string, cardW: number, cardH: number) => void;
  externalInitText?: string;
  projectId?: string;
  projectName?: string;
  annotations?: AnnotationData[];
  onSnapshotRestore?: (snapshotId: string) => Promise<void>;
  onSaveSnapshot?: (label: string) => Promise<void>;
}
```
改为：
```typescript
type AnnotationSuggestion = {
  suggestedPrompt: string;
  reason: string;
  comment: string;
  status: 'pending' | 'dismissed';
};

interface Props {
  initialRows: StoryboardRow[];
  onImport: (rows: StoryboardRow[], ratio: string, cardW: number, cardH: number) => void;
  externalInitText?: string;
  projectId?: string;
  projectName?: string;
  annotations?: AnnotationData[];
  onSnapshotRestore?: (snapshotId: string) => Promise<void>;
  onSaveSnapshot?: (label: string) => Promise<void>;
  annotationSuggestions?: Map<string, AnnotationSuggestion>;
  annotationSuggestionsLoading?: boolean;
  onDismissSuggestion?: (rowId: string) => void;
  onApplySuggestion?: (rowId: string, prompt: string, rowIndex: number) => void;
}
```

- [ ] **Step 2: 解构新 props**

找到函数签名：
```typescript
export default function BreakdownView({ initialRows, onImport, externalInitText, projectId, projectName, annotations = [], onSnapshotRestore, onSaveSnapshot }: Props) {
```
改为：
```typescript
export default function BreakdownView({ initialRows, onImport, externalInitText, projectId, projectName, annotations = [], onSnapshotRestore, onSaveSnapshot, annotationSuggestions, annotationSuggestionsLoading = false, onDismissSuggestion, onApplySuggestion }: Props) {
```

- [ ] **Step 3: 在顶部加进度条（loading 状态）**

找到 BreakdownView 的返回 JSX 顶层容器（包含 `<div` 或 fragment 的 return 语句），在内容最开头插入：

```tsx
{annotationSuggestionsLoading && (
  <div style={{
    position: 'absolute', top: 0, left: 0, right: 0, height: 3, zIndex: 50,
    background: 'linear-gradient(90deg, #7c3aed, #a78bfa)',
    animation: 'pulse 1.5s ease-in-out infinite',
  }} />
)}
```

- [ ] **Step 4: 在每条分镜行下方渲染 AI 建议卡片**

找到分镜行渲染处，现有代码含：
```tsx
annotation={annotations.find(a => a.rowId === row.id)}
```

在同一分镜行的末尾（行容器闭合标签之前），插入建议卡片：

```tsx
{(() => {
  const suggestion = annotationSuggestions?.get(row.id);
  if (!suggestion || suggestion.status === 'dismissed') return null;
  return (
    <div style={{
      margin: '8px 12px 12px',
      padding: '12px 14px',
      borderRadius: 8,
      background: 'rgba(124, 58, 237, 0.08)',
      border: '1px solid rgba(124, 58, 237, 0.25)',
      fontSize: 13,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6, color: '#7c3aed', fontWeight: 600 }}>
        <span>✦</span><span>AI 建议</span>
      </div>
      <div style={{ color: 'rgba(255,255,255,0.85)', lineHeight: 1.6, marginBottom: 4 }}>
        {suggestion.suggestedPrompt}
      </div>
      <div style={{ color: 'rgba(255,255,255,0.45)', fontSize: 12, marginBottom: 10 }}>
        改动：{suggestion.reason}
      </div>
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <button
          onClick={() => onDismissSuggestion?.(row.id)}
          style={{
            padding: '4px 12px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.15)',
            background: 'transparent', color: 'rgba(255,255,255,0.5)', cursor: 'pointer', fontSize: 12,
          }}
        >
          忽略
        </button>
        <button
          onClick={() => onApplySuggestion?.(row.id, suggestion.suggestedPrompt, row.index)}
          style={{
            padding: '4px 12px', borderRadius: 6, border: 'none',
            background: '#7c3aed', color: '#fff', cursor: 'pointer', fontSize: 12, fontWeight: 500,
          }}
        >
          导入画布
        </button>
      </div>
    </div>
  );
})()}
```

- [ ] **Step 5: 提交**

```bash
git add src/components/BreakdownView.tsx
git commit -m "feat(breakdown): render AI suggestion cards with dismiss/apply actions"
```

---

## Task 7：端到端验证

- [ ] **Step 1: 启动前后端**

```bash
npm run dev:all
```

- [ ] **Step 2: 创建项目并导入分镜**

打开 `http://localhost:3000`，新建项目，在剧本拆解页粘贴一段剧本拆解出 3+ 条分镜，点"导入画布"。

- [ ] **Step 3: 创建审片分享链接**

进入画布，通过分享功能获取审片链接（`/r/<token>`）。

- [ ] **Step 4: 提交一条"需修改"批注**

打开审片链接，对第一条分镜点"需修改"，填写批注（如"光线太暗"），提交。

- [ ] **Step 5: 观察 BreakdownView**

回到创作者界面，切换到"分镜管理"页。等待约 3-4 秒，验证：
- 顶部进度条出现后消失
- 对应分镜行出现紫色 AI 建议卡片，含修改提示词和改动说明

- [ ] **Step 6: 测试"忽略"**

点"忽略"，卡片消失，其余行不受影响。

- [ ] **Step 7: 测试"导入画布"**

切换回画布，验证原分镜节点右侧出现新节点，节点标题含"修改版"，`initialPrompt` 为 AI 建议的提示词。

- [ ] **Step 8: 测试多条批注 debounce**

快速连续提交 3 条批注（间隔 < 3s），确认后端只收到 1 次 `/api/agent/annotation-review` 请求（可在后端 console 或 Network 面板确认）。

- [ ] **Step 9: 最终提交**

```bash
git add -A
git commit -m "feat: annotation-driven AI suggestion — end-to-end complete"
```
