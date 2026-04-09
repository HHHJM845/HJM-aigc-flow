# 甲乙方审片协作流 Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 乙方一键生成审片链接，甲方无需注册即可逐帧批注，工作室实时收到通知并在分镜行旁看到批注内容。

**Architecture:** 后端在 `server/db.ts` 新增 4 张 SQLite 表（snapshots/shares/annotations/notifications），在 `server/routes/review.ts` 统一放置所有审片相关路由，`broadcast()` 从 `ws.ts` 导出后供路由调用。前端 `main.tsx` 根据 URL 路径决定渲染 `ReviewPage`（甲方页）还是 `App`（乙方页），不使用 react-router。

**Tech Stack:** Express, better-sqlite3, WebSocket (ws), React 19, TypeScript, Tailwind CSS v4

---

## 文件变更清单

| 操作 | 文件 | 职责 |
|------|------|------|
| Modify | `server/db.ts` | 新增 4 张表 + CRUD 函数 |
| Modify | `server/ws.ts` | 导出 `broadcast` 函数 |
| Create | `server/routes/review.ts` | 所有审片相关路由（快照/分享/批注/通知） |
| Modify | `server/index.ts` | 挂载 review 路由 |
| Modify | `src/main.tsx` | `/r/` 路径渲染 ReviewPage |
| Create | `src/pages/ReviewPage.tsx` | 甲方审片页（左网格+右详情） |
| Create | `src/components/ShareDialog.tsx` | 生成链接弹窗 |
| Create | `src/components/AnnotationBubble.tsx` | 分镜行批注气泡 |
| Create | `src/components/NotificationBell.tsx` | 通知铃铛 + 下拉列表 |
| Modify | `src/components/BreakdownView.tsx` | 新增 projectId/annotations/onShareCreated props + 提交审片按钮 + 批注气泡 |
| Modify | `src/hooks/useSync.ts` | 新增 onAnnotationAdded 回调处理 annotation_added 消息 |
| Modify | `src/App.tsx` | 传 projectId 和 annotations 给 BreakdownView，接入 NotificationBell |

---

## Task 1: 新增 SQLite 表和 DB 函数

**Files:**
- Modify: `server/db.ts`

- [ ] **Step 1: 在 `server/db.ts` 的 `db.exec(...)` 中追加 4 张新表**

在现有的 `db.exec(...)` 调用之后（`CREATE TABLE IF NOT EXISTS projects` 那段），追加以下内容：

```typescript
db.exec(`
  CREATE TABLE IF NOT EXISTS project_snapshots (
    id          TEXT PRIMARY KEY,
    project_id  TEXT NOT NULL,
    data        TEXT NOT NULL,
    label       TEXT,
    auto        INTEGER DEFAULT 0,
    created_at  INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS project_shares (
    id          TEXT PRIMARY KEY,
    project_id  TEXT NOT NULL,
    snapshot_id TEXT NOT NULL,
    token       TEXT UNIQUE NOT NULL,
    expires_at  INTEGER NOT NULL,
    created_at  INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS annotations (
    id          TEXT PRIMARY KEY,
    share_id    TEXT NOT NULL,
    row_index   INTEGER NOT NULL,
    row_id      TEXT NOT NULL,
    status      TEXT NOT NULL,
    comment     TEXT DEFAULT '',
    created_at  INTEGER NOT NULL,
    UNIQUE(share_id, row_index)
  );

  CREATE TABLE IF NOT EXISTS notifications (
    id          TEXT PRIMARY KEY,
    project_id  TEXT NOT NULL,
    share_id    TEXT NOT NULL,
    row_index   INTEGER NOT NULL,
    row_id      TEXT NOT NULL,
    status      TEXT NOT NULL,
    comment     TEXT DEFAULT '',
    created_at  INTEGER NOT NULL,
    read        INTEGER DEFAULT 0
  );
`);
```

- [ ] **Step 2: 在 `server/db.ts` 末尾追加类型定义和 CRUD 函数**

```typescript
// ── Review collaboration types ──────────────────────────

export interface SnapshotData {
  storyboardOrder: string[];
  storyboardRows: Array<{
    id: string;
    index: number;
    shotType: string;
    description: string;
    sourceSegment?: string;
  }>;
  imageNodes: Array<{
    rowId: string;
    imageUrl: string | null;
  }>;
}

export interface ProjectSnapshot {
  id: string;
  project_id: string;
  data: string; // JSON string of SnapshotData
  label: string | null;
  auto: number;
  created_at: number;
}

export interface ProjectShare {
  id: string;
  project_id: string;
  snapshot_id: string;
  token: string;
  expires_at: number;
  created_at: number;
}

export interface Annotation {
  id: string;
  share_id: string;
  row_index: number;
  row_id: string;
  status: 'pending' | 'approved' | 'revision';
  comment: string;
  created_at: number;
}

export interface Notification {
  id: string;
  project_id: string;
  share_id: string;
  row_index: number;
  row_id: string;
  status: string;
  comment: string;
  created_at: number;
  read: number;
}

// ── Snapshot functions ───────────────────────────────────

export function createSnapshot(
  id: string,
  projectId: string,
  data: SnapshotData,
  label: string | null,
  auto: boolean
): void {
  db.prepare(
    'INSERT INTO project_snapshots (id, project_id, data, label, auto, created_at) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(id, projectId, JSON.stringify(data), label, auto ? 1 : 0, Date.now());
}

export function getSnapshotById(id: string): ProjectSnapshot | null {
  return (db.prepare('SELECT * FROM project_snapshots WHERE id = ?').get(id) as ProjectSnapshot) ?? null;
}

// ── Share functions ──────────────────────────────────────

export function createShare(
  id: string,
  projectId: string,
  snapshotId: string,
  token: string,
  expiresAt: number
): void {
  db.prepare(
    'INSERT INTO project_shares (id, project_id, snapshot_id, token, expires_at, created_at) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(id, projectId, snapshotId, token, expiresAt, Date.now());
}

export function getShareByToken(token: string): ProjectShare | null {
  return (db.prepare('SELECT * FROM project_shares WHERE token = ?').get(token) as ProjectShare) ?? null;
}

// ── Annotation functions ─────────────────────────────────

export function upsertAnnotation(
  id: string,
  shareId: string,
  rowIndex: number,
  rowId: string,
  status: string,
  comment: string
): void {
  db.prepare(`
    INSERT INTO annotations (id, share_id, row_index, row_id, status, comment, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(share_id, row_index) DO UPDATE SET
      id = excluded.id,
      status = excluded.status,
      comment = excluded.comment,
      created_at = excluded.created_at
  `).run(id, shareId, rowIndex, rowId, status, comment, Date.now());
}

export function getAnnotationsByShareId(shareId: string): Annotation[] {
  return db.prepare('SELECT * FROM annotations WHERE share_id = ? ORDER BY row_index').all(shareId) as Annotation[];
}

// ── Notification functions ───────────────────────────────

export function createNotification(
  id: string,
  projectId: string,
  shareId: string,
  rowIndex: number,
  rowId: string,
  status: string,
  comment: string
): void {
  db.prepare(
    'INSERT INTO notifications (id, project_id, share_id, row_index, row_id, status, comment, created_at, read) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)'
  ).run(id, projectId, shareId, rowIndex, rowId, status, comment, Date.now());
}

export function getNotificationsByProjectId(projectId: string): Notification[] {
  return db.prepare(
    'SELECT * FROM notifications WHERE project_id = ? ORDER BY created_at DESC'
  ).all(projectId) as Notification[];
}

export function markNotificationRead(id: string): void {
  db.prepare('UPDATE notifications SET read = 1 WHERE id = ?').run(id);
}

export function markAllNotificationsRead(projectId: string): void {
  db.prepare('UPDATE notifications SET read = 1 WHERE project_id = ?').run(projectId);
}
```

- [ ] **Step 3: 运行 TypeScript 检查**

```bash
npx tsc --noEmit
```

无新增错误即可（现有的 `key` prop 错误是已知问题，不计入）。

- [ ] **Step 4: Commit**

```bash
git add server/db.ts
git commit -m "feat(db): 新增审片协作 4 张表和 CRUD 函数"
```

---

## Task 2: 导出 broadcast 函数

**Files:**
- Modify: `server/ws.ts`

- [ ] **Step 1: 将 `broadcast` 函数改为 export**

找到：
```typescript
function broadcast(data: object, excludeClientId?: string): void {
```

替换为：
```typescript
export function broadcast(data: object, excludeClientId?: string): void {
```

- [ ] **Step 2: 运行 TypeScript 检查**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add server/ws.ts
git commit -m "feat(ws): 导出 broadcast 函数供路由调用"
```

---

## Task 3: 创建 review 路由文件（快照 + 分享 + 批注 + 通知）

**Files:**
- Create: `server/routes/review.ts`
- Modify: `server/index.ts`

- [ ] **Step 1: 创建 `server/routes/review.ts`**

```typescript
// server/routes/review.ts
import { Router } from 'express';
import { randomBytes } from 'crypto';
import {
  getAllProjects,
  createSnapshot,
  getSnapshotById,
  createShare,
  getShareByToken,
  upsertAnnotation,
  getAnnotationsByShareId,
  createNotification,
  getNotificationsByProjectId,
  markNotificationRead,
  markAllNotificationsRead,
  type SnapshotData,
} from '../db.js';
import { broadcast } from '../ws.js';
import type { Project } from '../../src/lib/storage.js';

const router = Router();

// ── Helpers ──────────────────────────────────────────────

function genId(): string {
  return randomBytes(12).toString('base64url');
}

function genToken(): string {
  return randomBytes(9).toString('base64url'); // 12 URL-safe chars
}

function buildSnapshotData(project: Project): SnapshotData {
  const order = project.storyboardOrder ?? [];
  const rows = project.storyboardRows ?? [];
  const nodes = project.nodes ?? [];
  return {
    storyboardOrder: order,
    storyboardRows: rows,
    imageNodes: order.map(rowId => {
      const node = nodes.find(n => n.id === `storyboard-${rowId}`);
      const data = node?.data as Record<string, unknown> | undefined;
      const imageUrl = (data?.contents as string[] | undefined)?.[0]
        ?? (data?.content as string | undefined)
        ?? null;
      return { rowId, imageUrl };
    }),
  };
}

// ── POST /api/projects/:id/snapshot ──────────────────────

router.post('/projects/:id/snapshot', (req, res) => {
  const { id } = req.params;
  const { label } = req.body as { label?: string };

  const projects = getAllProjects();
  const project = projects.find(p => p.id === id);
  if (!project) return res.status(404).json({ error: 'project not found' });

  const snapshotId = genId();
  const snapshotLabel = label?.trim() || null;
  const data = buildSnapshotData(project);

  createSnapshot(snapshotId, id, data, snapshotLabel, false);
  res.json({ snapshotId, label: snapshotLabel, createdAt: Date.now() });
});

// ── POST /api/projects/:id/share ─────────────────────────

router.post('/projects/:id/share', (req, res) => {
  const { id } = req.params;

  const projects = getAllProjects();
  const project = projects.find(p => p.id === id);
  if (!project) return res.status(404).json({ error: 'project not found' });

  // Auto-create snapshot labeled with date
  const snapshotId = genId();
  const now = new Date();
  const label = `提交审片 · ${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  const data = buildSnapshotData(project);
  createSnapshot(snapshotId, id, data, label, true);

  const shareId = genId();
  const token = genToken();
  const expiresAt = Date.now() + 7 * 24 * 60 * 60 * 1000;
  createShare(shareId, id, snapshotId, token, expiresAt);

  const url = `/r/${token}`;
  res.json({ shareId, token, url, expiresAt });
});

// ── GET /api/review/:token ────────────────────────────────

router.get('/review/:token', (req, res) => {
  const share = getShareByToken(req.params.token);
  if (!share) return res.status(410).json({ error: 'link expired or not found' });
  if (Date.now() > share.expires_at) return res.status(410).json({ error: 'link expired' });

  const snapshot = getSnapshotById(share.snapshot_id);
  if (!snapshot) return res.status(410).json({ error: 'snapshot not found' });

  const snapshotData: SnapshotData = JSON.parse(snapshot.data);

  // Fetch project name
  const projects = getAllProjects();
  const project = projects.find(p => p.id === share.project_id);
  const projectName = project?.name ?? '分镜提案';

  res.json({
    shareId: share.id,
    projectId: share.project_id,
    projectName,
    snapshotData,
    expiresAt: share.expires_at,
  });
});

// ── GET /api/review/:token/annotations ───────────────────

router.get('/review/:token/annotations', (req, res) => {
  const share = getShareByToken(req.params.token);
  if (!share) return res.status(410).json({ error: 'link expired or not found' });
  res.json(getAnnotationsByShareId(share.id));
});

// ── POST /api/review/:token/annotate ─────────────────────

router.post('/review/:token/annotate', (req, res) => {
  const share = getShareByToken(req.params.token);
  if (!share) return res.status(410).json({ error: 'link expired or not found' });
  if (Date.now() > share.expires_at) return res.status(410).json({ error: 'link expired' });

  const { rowIndex, rowId, status, comment } = req.body as {
    rowIndex: number;
    rowId: string;
    status: 'approved' | 'revision';
    comment?: string;
  };
  if (typeof rowIndex !== 'number' || !rowId || !status) {
    return res.status(400).json({ error: 'rowIndex, rowId and status are required' });
  }

  const annotationId = genId();
  upsertAnnotation(annotationId, share.id, rowIndex, rowId, status, comment ?? '');

  const notifId = genId();
  createNotification(notifId, share.project_id, share.id, rowIndex, rowId, status, comment ?? '');

  broadcast({
    type: 'annotation_added',
    projectId: share.project_id,
    shareId: share.id,
    rowIndex,
    rowId,
    status,
    comment: comment ?? '',
    createdAt: Date.now(),
  });

  res.json({ annotationId });
});

// ── GET /api/projects/:id/notifications ──────────────────

router.get('/projects/:id/notifications', (req, res) => {
  res.json(getNotificationsByProjectId(req.params.id));
});

// ── POST /api/notifications/:id/read ─────────────────────

router.post('/notifications/:id/read', (req, res) => {
  markNotificationRead(req.params.id);
  res.json({ ok: true });
});

// ── POST /api/projects/:id/notifications/read-all ────────

router.post('/projects/:id/notifications/read-all', (req, res) => {
  markAllNotificationsRead(req.params.id);
  res.json({ ok: true });
});

export default router;
```

- [ ] **Step 2: 在 `server/index.ts` 中挂载 review 路由**

在现有 `import uploadRouter` 之后添加 import，在路由挂载区域添加挂载：

```typescript
import reviewRouter from './routes/review.js';
```

在 `app.use('/api/upload', uploadRouter);` 之后添加：

```typescript
app.use('/api', reviewRouter);
```

- [ ] **Step 3: 运行 TypeScript 检查**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: 手动验证接口（启动开发服务器）**

```bash
npm run dev:server
```

在另一个终端测试（替换 `proj_xxx` 为实际存在的项目 ID，从 localStorage 取）：

```bash
# 创建分享链接
curl -X POST http://localhost:3001/api/projects/proj_xxx/share
# 期望：{ shareId, token, url, expiresAt }

# 用返回的 token 读取审片数据
curl http://localhost:3001/api/review/<token>
# 期望：{ shareId, projectId, projectName, snapshotData, expiresAt }
```

- [ ] **Step 5: Commit**

```bash
git add server/routes/review.ts server/index.ts
git commit -m "feat(api): 新增审片协作路由（快照/分享/批注/通知）"
```

---

## Task 4: main.tsx 路径路由 + ReviewPage 骨架

**Files:**
- Modify: `src/main.tsx`
- Create: `src/pages/ReviewPage.tsx`

- [ ] **Step 1: 修改 `src/main.tsx`，根据路径渲染不同组件**

将 `src/main.tsx` 替换为：

```tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';

const root = createRoot(document.getElementById('root')!);

if (window.location.pathname.startsWith('/r/')) {
  import('./pages/ReviewPage').then(({ default: ReviewPage }) => {
    root.render(
      <StrictMode>
        <ReviewPage />
      </StrictMode>
    );
  });
} else {
  import('./App').then(({ default: App }) => {
    root.render(
      <StrictMode>
        <App />
      </StrictMode>
    );
  });
}
```

- [ ] **Step 2: 新建 `src/pages/ReviewPage.tsx` 骨架（仅做数据加载）**

```tsx
import React, { useEffect, useState } from 'react';

interface ImageNodeItem {
  rowId: string;
  imageUrl: string | null;
}

interface StoryboardRowItem {
  id: string;
  index: number;
  shotType: string;
  description: string;
}

interface SnapshotData {
  storyboardOrder: string[];
  storyboardRows: StoryboardRowItem[];
  imageNodes: ImageNodeItem[];
}

interface ReviewData {
  shareId: string;
  projectId: string;
  projectName: string;
  snapshotData: SnapshotData;
  expiresAt: number;
}

interface AnnotationItem {
  id: string;
  share_id: string;
  row_index: number;
  row_id: string;
  status: 'pending' | 'approved' | 'revision';
  comment: string;
  created_at: number;
}

export default function ReviewPage() {
  const token = window.location.pathname.split('/r/')[1]?.split('/')[0] ?? '';
  const [data, setData] = useState<ReviewData | null>(null);
  const [annotations, setAnnotations] = useState<AnnotationItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) { setError('无效链接'); setLoading(false); return; }
    Promise.all([
      fetch(`/api/review/${token}`).then(r => r.ok ? r.json() : Promise.reject(r.status)),
      fetch(`/api/review/${token}/annotations`).then(r => r.ok ? r.json() : []),
    ])
      .then(([reviewData, anns]) => {
        setData(reviewData as ReviewData);
        setAnnotations(anns as AnnotationItem[]);
      })
      .catch(err => {
        setError(err === 410 ? 'link_expired' : '加载失败，请稍后重试');
      })
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) return (
    <div className="min-h-screen bg-black flex items-center justify-center">
      <p className="text-white/40 text-sm">加载中...</p>
    </div>
  );

  if (error === 'link_expired') return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center gap-4">
      <p className="text-white/60 text-base">此审片链接已过期</p>
      <p className="text-white/30 text-sm">请联系工作室获取新链接</p>
    </div>
  );

  if (error || !data) return (
    <div className="min-h-screen bg-black flex items-center justify-center">
      <p className="text-white/40 text-sm">{error ?? '加载失败'}</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      <p className="p-8 text-white/50">ReviewPage loaded — {data.projectName} — {data.snapshotData.storyboardOrder.length} 镜</p>
    </div>
  );
}
```

- [ ] **Step 3: TypeScript 检查**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: 手动验证路由**

启动开发服务器：
```bash
npm run dev:all
```

在浏览器访问 `http://localhost:3000/r/testtoken`，应看到"加载失败"（因为 token 不存在），而不是主应用界面。访问 `http://localhost:3000` 应正常显示主应用。

- [ ] **Step 5: Commit**

```bash
git add src/main.tsx src/pages/ReviewPage.tsx
git commit -m "feat(frontend): 新增路径路由和 ReviewPage 骨架"
```

---

## Task 5: ReviewPage 完整 UI

**Files:**
- Modify: `src/pages/ReviewPage.tsx`

- [ ] **Step 1: 将 `src/pages/ReviewPage.tsx` 替换为完整实现**

```tsx
import React, { useEffect, useState, useCallback } from 'react';

interface ImageNodeItem {
  rowId: string;
  imageUrl: string | null;
}

interface StoryboardRowItem {
  id: string;
  index: number;
  shotType: string;
  description: string;
}

interface SnapshotData {
  storyboardOrder: string[];
  storyboardRows: StoryboardRowItem[];
  imageNodes: ImageNodeItem[];
}

interface ReviewData {
  shareId: string;
  projectId: string;
  projectName: string;
  snapshotData: SnapshotData;
  expiresAt: number;
}

interface AnnotationItem {
  id: string;
  share_id: string;
  row_index: number;
  row_id: string;
  status: 'pending' | 'approved' | 'revision';
  comment: string;
  created_at: number;
}

interface FrameItem {
  rowIndex: number;
  rowId: string;
  shotType: string;
  description: string;
  imageUrl: string | null;
}

const STATUS_COLORS: Record<string, string> = {
  approved: 'rgba(80, 200, 120, 0.8)',
  revision: 'rgba(255, 140, 60, 0.8)',
  pending: 'rgba(255, 255, 255, 0.2)',
};

const STATUS_LABELS: Record<string, string> = {
  approved: '✓ 已通过',
  revision: '↩ 需修改',
  pending: '待审核',
};

export default function ReviewPage() {
  const token = window.location.pathname.split('/r/')[1]?.split('/')[0] ?? '';
  const [data, setData] = useState<ReviewData | null>(null);
  const [annotations, setAnnotations] = useState<Map<string, AnnotationItem>>(new Map());
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [commentInput, setCommentInput] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!token) { setError('无效链接'); setLoading(false); return; }
    Promise.all([
      fetch(`/api/review/${token}`).then(r => r.ok ? r.json() : Promise.reject(r.status)),
      fetch(`/api/review/${token}/annotations`).then(r => r.ok ? r.json() : []),
    ])
      .then(([reviewData, anns]: [ReviewData, AnnotationItem[]]) => {
        setData(reviewData);
        const map = new Map<string, AnnotationItem>();
        anns.forEach(a => map.set(a.row_id, a));
        setAnnotations(map);
      })
      .catch(err => setError(err === 410 ? 'link_expired' : '加载失败'))
      .finally(() => setLoading(false));
  }, [token]);

  const frames: FrameItem[] = data
    ? data.snapshotData.storyboardOrder.map((rowId, i) => {
        const row = data.snapshotData.storyboardRows.find(r => r.id === rowId);
        const imgNode = data.snapshotData.imageNodes.find(n => n.rowId === rowId);
        return {
          rowIndex: i,
          rowId,
          shotType: row?.shotType ?? '',
          description: row?.description ?? '',
          imageUrl: imgNode?.imageUrl ?? null,
        };
      })
    : [];

  const selectedFrame = frames[selectedIndex] ?? null;
  const selectedAnnotation = selectedFrame ? annotations.get(selectedFrame.rowId) : undefined;

  const handleAnnotate = useCallback(async (status: 'approved' | 'revision') => {
    if (!selectedFrame || submitting) return;
    setSubmitting(true);
    try {
      await fetch(`/api/review/${token}/annotate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rowIndex: selectedFrame.rowIndex,
          rowId: selectedFrame.rowId,
          status,
          comment: commentInput.trim(),
        }),
      });
      setAnnotations(prev => {
        const next = new Map(prev);
        next.set(selectedFrame.rowId, {
          id: '',
          share_id: data!.shareId,
          row_index: selectedFrame.rowIndex,
          row_id: selectedFrame.rowId,
          status,
          comment: commentInput.trim(),
          created_at: Date.now(),
        });
        return next;
      });
      setCommentInput('');
    } finally {
      setSubmitting(false);
    }
  }, [selectedFrame, commentInput, token, data, submitting]);

  // ── Error states ──
  if (loading) return (
    <div className="min-h-screen bg-black flex items-center justify-center">
      <p className="text-white/30 text-sm" style={{ fontFamily: 'Inter' }}>加载中...</p>
    </div>
  );
  if (error === 'link_expired') return (
    <div className="min-h-screen bg-[#0a0a0a] flex flex-col items-center justify-center gap-3">
      <p className="text-white/50 text-base" style={{ fontFamily: 'Manrope' }}>此审片链接已过期</p>
      <p className="text-white/25 text-sm" style={{ fontFamily: 'Inter' }}>请联系工作室获取新链接</p>
    </div>
  );
  if (error || !data) return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
      <p className="text-white/30 text-sm">{error ?? '加载失败'}</p>
    </div>
  );

  const totalFrames = frames.length;
  const approvedCount = frames.filter(f => annotations.get(f.rowId)?.status === 'approved').length;
  const revisionCount = frames.filter(f => annotations.get(f.rowId)?.status === 'revision').length;

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex flex-col" style={{ fontFamily: 'Inter' }}>

      {/* Header */}
      <div className="flex items-center justify-between px-8 py-4 border-b border-white/8">
        <h1 className="text-sm font-bold text-white/70" style={{ fontFamily: 'Manrope' }}>
          {data.projectName}
        </h1>
        <div className="flex items-center gap-4 text-xs text-white/25">
          <span>共 {totalFrames} 镜</span>
          {approvedCount > 0 && <span style={{ color: STATUS_COLORS.approved }}>{approvedCount} 通过</span>}
          {revisionCount > 0 && <span style={{ color: STATUS_COLORS.revision }}>{revisionCount} 需修改</span>}
          <span>7天内有效</span>
        </div>
      </div>

      {/* Main: left grid + right detail */}
      <div className="flex flex-1 overflow-hidden" style={{ height: 'calc(100vh - 57px - 40px)' }}>

        {/* Left: thumbnail grid */}
        <div className="w-72 flex-shrink-0 overflow-y-auto p-4 border-r border-white/8">
          <div className="grid grid-cols-3 gap-2">
            {frames.map((frame, i) => {
              const ann = annotations.get(frame.rowId);
              const isSelected = i === selectedIndex;
              return (
                <button
                  key={frame.rowId}
                  onClick={() => { setSelectedIndex(i); setCommentInput(''); }}
                  className="relative aspect-[4/3] rounded-lg overflow-hidden border transition-all"
                  style={{
                    borderColor: isSelected ? 'rgba(200,190,220,0.6)' : 'rgba(255,255,255,0.08)',
                    background: 'rgba(255,255,255,0.04)',
                  }}
                >
                  {frame.imageUrl ? (
                    <img src={frame.imageUrl} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <span className="material-symbols-outlined text-white/15 text-xl">image</span>
                    </div>
                  )}
                  {/* Status badge */}
                  <div
                    className="absolute top-1 right-1 w-2 h-2 rounded-full"
                    style={{ background: STATUS_COLORS[ann?.status ?? 'pending'] }}
                  />
                  {/* Index */}
                  <div className="absolute bottom-1 left-1 text-[8px] text-white/40 bg-black/50 px-1 rounded">
                    {String(frame.rowIndex + 1).padStart(2, '0')}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Right: detail */}
        {selectedFrame ? (
          <div className="flex-1 overflow-y-auto p-8 flex flex-col gap-6 max-w-2xl">
            {/* Big image */}
            <div className="w-full aspect-video bg-black/40 rounded-xl overflow-hidden border border-white/8 flex items-center justify-center">
              {selectedFrame.imageUrl ? (
                <img src={selectedFrame.imageUrl} alt="" className="w-full h-full object-contain" />
              ) : (
                <span className="material-symbols-outlined text-white/15 text-5xl">image</span>
              )}
            </div>

            {/* Shot info */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs bg-white/8 border border-white/10 rounded-full px-2 py-0.5 text-white/45">
                  {selectedFrame.shotType || '镜头'}
                </span>
                <span className="text-xs text-white/30">
                  镜头 {String(selectedFrame.rowIndex + 1).padStart(2, '0')}
                </span>
              </div>
              <p className="text-sm text-white/60 leading-relaxed">{selectedFrame.description}</p>
            </div>

            {/* Current status */}
            {selectedAnnotation && (
              <div className="flex items-center gap-2 text-xs">
                <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: STATUS_COLORS[selectedAnnotation.status] }} />
                <span style={{ color: STATUS_COLORS[selectedAnnotation.status] }}>
                  {STATUS_LABELS[selectedAnnotation.status]}
                </span>
                {selectedAnnotation.comment && (
                  <span className="text-white/35 ml-2">"{selectedAnnotation.comment}"</span>
                )}
              </div>
            )}

            {/* Annotation input */}
            <div className="border border-white/8 rounded-xl p-4 bg-white/3">
              <p className="text-xs text-white/30 mb-3">批注（可选）</p>
              <textarea
                value={commentInput}
                onChange={e => setCommentInput(e.target.value)}
                placeholder="输入对此镜头的意见..."
                rows={3}
                className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm text-white/70 placeholder:text-white/20 focus:outline-none focus:border-white/25 resize-none mb-4"
              />
              <div className="flex gap-3">
                <button
                  onClick={() => handleAnnotate('approved')}
                  disabled={submitting}
                  className="flex-1 py-2.5 rounded-lg text-sm font-bold transition-all disabled:opacity-50"
                  style={{ background: 'rgba(80,200,120,0.15)', color: 'rgba(80,200,120,0.9)', border: '1px solid rgba(80,200,120,0.3)' }}
                >
                  ✓ 标记通过
                </button>
                <button
                  onClick={() => handleAnnotate('revision')}
                  disabled={submitting}
                  className="flex-1 py-2.5 rounded-lg text-sm font-bold transition-all disabled:opacity-50"
                  style={{ background: 'rgba(255,140,60,0.12)', color: 'rgba(255,140,60,0.85)', border: '1px solid rgba(255,140,60,0.3)' }}
                >
                  ↩ 需要修改
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-white/20 text-sm">选择左侧镜头查看详情</p>
          </div>
        )}
      </div>

      {/* Footer watermark */}
      <div className="h-10 flex items-center justify-center border-t border-white/5">
        <p className="text-[10px] text-white/15">
          由 JM AIGC Studio 制作
          <a href="/" className="ml-2 text-white/25 hover:text-white/40 transition-colors underline">
            免费注册 →
          </a>
        </p>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: TypeScript 检查**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: 手动验证 ReviewPage**

1. 用 curl 创建分享链接（需要真实 projectId）：
   ```bash
   curl -X POST http://localhost:3001/api/projects/<projectId>/share
   ```
2. 在浏览器访问 `http://localhost:3000/r/<token>`
3. 验证：分镜网格显示、点击切换、标记通过/修改后左侧角标变色

- [ ] **Step 4: Commit**

```bash
git add src/pages/ReviewPage.tsx
git commit -m "feat(frontend): ReviewPage 甲方审片页完整 UI"
```

---

## Task 6: ShareDialog 组件 + BreakdownView 提交审片按钮

**Files:**
- Create: `src/components/ShareDialog.tsx`
- Modify: `src/components/BreakdownView.tsx`

- [ ] **Step 1: 创建 `src/components/ShareDialog.tsx`**

```tsx
import React, { useState } from 'react';

interface Props {
  projectName: string;
  shareUrl: string;
  expiresAt: number;
  onClose: () => void;
}

export default function ShareDialog({ projectName, shareUrl, expiresAt, onClose }: Props) {
  const [copied, setCopied] = useState(false);

  const fullUrl = `${window.location.origin}${shareUrl}`;

  const handleCopy = async () => {
    await navigator.clipboard.writeText(fullUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const expiryDate = new Date(expiresAt).toLocaleDateString('zh-CN', {
    month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit'
  });

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-[#1a1a1a] border border-white/10 rounded-2xl p-6 w-96 shadow-2xl" style={{ fontFamily: 'Inter' }}>
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-sm font-bold text-[#e8e6e4]" style={{ fontFamily: 'Manrope' }}>
            审片链接已生成
          </h3>
          <button onClick={onClose} className="text-white/30 hover:text-white/60 transition-colors text-lg leading-none">×</button>
        </div>

        <p className="text-xs text-white/35 mb-2">{projectName} · 快照已保存</p>

        <div className="bg-black/40 border border-white/10 rounded-xl p-3 mb-4 flex items-center gap-3">
          <span className="flex-1 text-xs text-white/50 truncate font-mono">{fullUrl}</span>
          <button
            onClick={handleCopy}
            className="px-3 py-1.5 text-xs font-bold rounded-lg transition-all flex-shrink-0"
            style={{
              background: copied ? 'rgba(80,200,120,0.2)' : 'rgba(255,255,255,0.08)',
              color: copied ? 'rgba(80,200,120,0.9)' : 'rgba(255,255,255,0.6)',
              border: copied ? '1px solid rgba(80,200,120,0.3)' : '1px solid rgba(255,255,255,0.1)',
            }}
          >
            {copied ? '已复制 ✓' : '复制'}
          </button>
        </div>

        <p className="text-[10px] text-white/25 mb-5">
          <span className="material-symbols-outlined text-[11px] align-middle mr-1">schedule</span>
          链接有效期至 {expiryDate}，甲方无需注册即可查看和批注
        </p>

        <button
          onClick={onClose}
          className="w-full py-2.5 text-xs font-bold bg-white/90 text-black rounded-xl hover:bg-white transition-colors"
        >
          完成
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: 在 `BreakdownView.tsx` 中新增 Props**

找到 `interface Props {` 并添加以下字段：

```typescript
interface Props {
  initialRows?: StoryboardRow[];
  onImport: (rows: StoryboardRow[], ratio: string, cardW: number, cardH: number) => void;
  externalInitText?: string;
  projectId?: string;           // 新增
  projectName?: string;         // 新增
}
```

同样更新函数签名解构：

```typescript
export default function BreakdownView({ initialRows, onImport, externalInitText, projectId, projectName }: Props) {
```

- [ ] **Step 3: 在 `BreakdownView.tsx` 组件函数顶部新增 state**

在现有 state 声明之后添加：

```typescript
const [shareDialogData, setShareDialogData] = useState<{
  shareUrl: string;
  expiresAt: number;
} | null>(null);
const [sharing, setSharing] = useState(false);
```

同时在文件顶部 import 区新增：

```typescript
import ShareDialog from './ShareDialog';
```

- [ ] **Step 4: 新增"提交审片"处理函数**

在 `BreakdownView` 函数体内（其他函数定义旁边）添加：

```typescript
const handleShare = async () => {
  if (!projectId || sharing) return;
  setSharing(true);
  try {
    const res = await fetch(`/api/projects/${projectId}/share`, { method: 'POST' });
    if (!res.ok) throw new Error('share failed');
    const { url, expiresAt } = await res.json() as { url: string; expiresAt: number };
    setShareDialogData({ shareUrl: url, expiresAt });
  } catch (e) {
    console.error('[share]', e);
  } finally {
    setSharing(false);
  }
};
```

- [ ] **Step 5: 在 `BreakdownView` 的 return JSX 顶部工具栏区域添加"提交审片"按钮**

找到 BreakdownView 中顶部工具栏（包含"AI 拆解"等按钮的区域），在工具栏末尾追加：

```tsx
{projectId && (
  <button
    onClick={handleShare}
    disabled={sharing}
    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg transition-all disabled:opacity-50"
    style={{
      background: 'rgba(200,190,220,0.15)',
      color: 'rgba(200,190,220,0.85)',
      border: '1px solid rgba(200,190,220,0.3)',
    }}
  >
    <span className="material-symbols-outlined text-[13px]">share</span>
    {sharing ? '生成中...' : '提交审片'}
  </button>
)}
```

- [ ] **Step 6: 在 return JSX 末尾（最后的 `</div>` 之前）添加 ShareDialog**

```tsx
{shareDialogData && (
  <ShareDialog
    projectName={projectName ?? '未命名项目'}
    shareUrl={shareDialogData.shareUrl}
    expiresAt={shareDialogData.expiresAt}
    onClose={() => setShareDialogData(null)}
  />
)}
```

- [ ] **Step 7: TypeScript 检查**

```bash
npx tsc --noEmit
```

- [ ] **Step 8: Commit**

```bash
git add src/components/ShareDialog.tsx src/components/BreakdownView.tsx
git commit -m "feat(frontend): ShareDialog 和 BreakdownView 提交审片按钮"
```

---

## Task 7: AnnotationBubble 组件 + BreakdownView 批注显示

**Files:**
- Create: `src/components/AnnotationBubble.tsx`
- Modify: `src/components/BreakdownView.tsx`

- [ ] **Step 1: 创建 `src/components/AnnotationBubble.tsx`**

```tsx
import React, { useState } from 'react';

export interface AnnotationData {
  rowId: string;
  status: 'approved' | 'revision' | 'pending';
  comment: string;
  createdAt: number;
}

interface Props {
  annotation: AnnotationData;
}

const STATUS_COLOR: Record<string, string> = {
  approved: 'rgba(80,200,120,0.8)',
  revision: 'rgba(255,140,60,0.8)',
  pending: 'rgba(255,255,255,0.3)',
};

const STATUS_ICON: Record<string, string> = {
  approved: '✓',
  revision: '↩',
  pending: '●',
};

export default function AnnotationBubble({ annotation }: Props) {
  const [expanded, setExpanded] = useState(false);
  const color = STATUS_COLOR[annotation.status];

  return (
    <div className="relative flex-shrink-0" onMouseEnter={() => setExpanded(true)} onMouseLeave={() => setExpanded(false)}>
      <div
        className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold cursor-pointer border"
        style={{ background: `${color}22`, borderColor: color, color }}
      >
        {STATUS_ICON[annotation.status]}
      </div>
      {expanded && annotation.comment && (
        <div
          className="absolute right-0 top-7 z-30 bg-[#1e1e1e] border border-white/10 rounded-xl p-3 shadow-xl w-52"
          style={{ fontFamily: 'Inter' }}
        >
          <div className="flex items-center gap-1.5 mb-1.5">
            <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: color }} />
            <span className="text-[10px] font-bold" style={{ color }}>
              {annotation.status === 'approved' ? '已通过' : '需修改'}
            </span>
          </div>
          <p className="text-[11px] text-white/55 leading-relaxed">{annotation.comment}</p>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: 在 `BreakdownView.tsx` 的 Props 接口新增 `annotations` prop**

```typescript
interface Props {
  initialRows?: StoryboardRow[];
  onImport: (rows: StoryboardRow[], ratio: string, cardW: number, cardH: number) => void;
  externalInitText?: string;
  projectId?: string;
  projectName?: string;
  annotations?: import('./AnnotationBubble').AnnotationData[];  // 新增
}
```

更新函数签名解构加入 `annotations = []`：

```typescript
export default function BreakdownView({ initialRows, onImport, externalInitText, projectId, projectName, annotations = [] }: Props) {
```

- [ ] **Step 3: 在 `BreakdownView.tsx` 顶部 import 区新增**

```typescript
import AnnotationBubble, { type AnnotationData } from './AnnotationBubble';
```

- [ ] **Step 4: 在 BreakdownView 的分镜行 JSX 中找到每行的右侧区域，添加批注气泡**

在每一行的操作按钮区域（通常是行右侧的 delete/edit 按钮旁），在最右端添加：

```tsx
{(() => {
  const ann = annotations.find(a => a.rowId === row.id);
  return ann ? <AnnotationBubble annotation={ann} /> : null;
})()}
```

注：具体插入位置取决于 BreakdownView 的行渲染结构。找到 `storyboardRows.map` 或 `rows.map` 中渲染每行的 JSX，在行内靠右侧添加此代码。

- [ ] **Step 5: TypeScript 检查**

```bash
npx tsc --noEmit
```

- [ ] **Step 6: Commit**

```bash
git add src/components/AnnotationBubble.tsx src/components/BreakdownView.tsx
git commit -m "feat(frontend): AnnotationBubble 组件和分镜行批注气泡"
```

---

## Task 8: NotificationBell + useSync + App.tsx 接入

**Files:**
- Create: `src/components/NotificationBell.tsx`
- Modify: `src/hooks/useSync.ts`
- Modify: `src/App.tsx`

- [ ] **Step 1: 创建 `src/components/NotificationBell.tsx`**

```tsx
import React, { useState } from 'react';
import type { AnnotationData } from './AnnotationBubble';

export interface NotificationItem {
  id: string;
  projectId: string;
  shareId: string;
  rowIndex: number;
  rowId: string;
  status: string;
  comment: string;
  createdAt: number;
  read: number;
}

interface Props {
  notifications: NotificationItem[];
  onRead: (id: string) => void;
  onReadAll: (projectId: string) => void;
  onNavigate: (projectId: string, rowId: string) => void;
}

const STATUS_COLOR: Record<string, string> = {
  approved: 'rgba(80,200,120,0.8)',
  revision: 'rgba(255,140,60,0.8)',
};

export default function NotificationBell({ notifications, onRead, onReadAll, onNavigate }: Props) {
  const [open, setOpen] = useState(false);
  const unreadCount = notifications.filter(n => n.read === 0).length;

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(v => !v)}
        className="relative w-8 h-8 flex items-center justify-center text-white/40 hover:text-white/70 transition-colors"
      >
        <span className="material-symbols-outlined text-[20px]">notifications</span>
        {unreadCount > 0 && (
          <div className="absolute top-1 right-1 w-4 h-4 rounded-full bg-red-500 flex items-center justify-center text-[8px] text-white font-bold">
            {unreadCount > 9 ? '9+' : unreadCount}
          </div>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-10 z-50 w-80 bg-[#1a1a1a] border border-white/10 rounded-2xl shadow-2xl overflow-hidden" style={{ fontFamily: 'Inter' }}>
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/8">
              <span className="text-xs font-bold text-white/60">批注通知</span>
              {unreadCount > 0 && (
                <button
                  onClick={() => {
                    const ids = [...new Set(notifications.map(n => n.projectId))];
                    ids.forEach(id => onReadAll(id));
                  }}
                  className="text-[10px] text-white/30 hover:text-white/50 transition-colors"
                >
                  全部已读
                </button>
              )}
            </div>
            <div className="max-h-72 overflow-y-auto">
              {notifications.length === 0 ? (
                <p className="text-xs text-white/25 text-center py-8">暂无批注通知</p>
              ) : (
                notifications.slice(0, 20).map(n => (
                  <button
                    key={n.id}
                    onClick={() => {
                      onNavigate(n.projectId, n.rowId);
                      onRead(n.id);
                      setOpen(false);
                    }}
                    className="w-full flex items-start gap-3 px-4 py-3 hover:bg-white/5 transition-colors text-left border-b border-white/5"
                  >
                    <div
                      className="w-2 h-2 rounded-full flex-shrink-0 mt-1.5"
                      style={{ background: STATUS_COLOR[n.status] ?? 'rgba(255,255,255,0.3)', opacity: n.read ? 0.4 : 1 }}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-white/60 mb-0.5" style={{ opacity: n.read ? 0.5 : 1 }}>
                        镜头 {String(n.rowIndex + 1).padStart(2, '0')} ·{' '}
                        <span style={{ color: STATUS_COLOR[n.status] }}>
                          {n.status === 'approved' ? '已通过' : '需修改'}
                        </span>
                      </p>
                      {n.comment && (
                        <p className="text-[10px] text-white/35 truncate">"{n.comment}"</p>
                      )}
                    </div>
                    {n.read === 0 && (
                      <div className="w-1.5 h-1.5 rounded-full bg-blue-400 flex-shrink-0 mt-1.5" />
                    )}
                  </button>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 2: 修改 `src/hooks/useSync.ts`，新增 `onAnnotationAdded` 回调**

找到 `useSync` 的参数接口（或直接函数参数），添加回调参数。找到如下模式：

```typescript
export function useSync(onRemoteProjectUpdate: ...) {
```

改为：

```typescript
export function useSync(
  onRemoteProjectUpdate: (project: Project) => void,
  onAnnotationAdded?: (msg: {
    projectId: string;
    shareId: string;
    rowIndex: number;
    rowId: string;
    status: string;
    comment: string;
    createdAt: number;
  }) => void
) {
```

然后在 WebSocket 消息处理的 `switch/if` 块中，在处理 `project_update` 和 `project_deleted` 的分支之后追加：

```typescript
} else if (msg.type === 'annotation_added') {
  onAnnotationAdded?.({
    projectId: msg.projectId as string,
    shareId: msg.shareId as string,
    rowIndex: msg.rowIndex as number,
    rowId: msg.rowId as string,
    status: msg.status as string,
    comment: msg.comment as string,
    createdAt: msg.createdAt as number,
  });
}
```

（具体插入位置：找 ws.onmessage 或类似的消息处理 handler，在 project 相关处理之后追加）

- [ ] **Step 3: 在 `App.tsx` 中添加 notifications state 和处理逻辑**

在现有的 state 声明区（如 `const [currentProject, setCurrentProject] = ...` 附近）添加：

```typescript
const [notifications, setNotifications] = useState<import('./components/NotificationBell').NotificationItem[]>([]);
const [projectAnnotations, setProjectAnnotations] = useState<import('./components/AnnotationBubble').AnnotationData[]>([]);
```

在文件顶部 import 区新增：

```typescript
import NotificationBell, { type NotificationItem } from './components/NotificationBell';
import type { AnnotationData } from './components/AnnotationBubble';
```

- [ ] **Step 4: 在 `App.tsx` 的 `handleOpenProject` 中拉取批注和通知**

找到 `handleOpenProject` 函数，在 `setView('canvas')` 之前追加：

```typescript
// 拉取该项目的批注通知
fetch(`/api/projects/${project.id}/notifications`)
  .then(r => r.ok ? r.json() : [])
  .then((notifs: NotificationItem[]) => {
    setNotifications(notifs);
    setProjectAnnotations(notifs.map(n => ({
      rowId: n.rowId,
      status: n.status as 'approved' | 'revision' | 'pending',
      comment: n.comment,
      createdAt: n.createdAt,
    })));
  })
  .catch(() => {});
```

- [ ] **Step 5: 在 `App.tsx` 中向 `useSync` 传入 `onAnnotationAdded` 回调**

找到：
```typescript
const { projects, connected, saveProject: wsSaveProject, deleteProject: wsDeleteProject } =
  useSync(handleRemoteProjectUpdate);
```

替换为：
```typescript
const handleAnnotationAdded = (msg: {
  projectId: string; shareId: string; rowIndex: number; rowId: string;
  status: string; comment: string; createdAt: number;
}) => {
  const newNotif: NotificationItem = {
    id: `notif_${Date.now()}`,
    projectId: msg.projectId,
    shareId: msg.shareId,
    rowIndex: msg.rowIndex,
    rowId: msg.rowId,
    status: msg.status,
    comment: msg.comment,
    createdAt: msg.createdAt,
    read: 0,
  };
  setNotifications(prev => [newNotif, ...prev]);
  setProjectAnnotations(prev => {
    const filtered = prev.filter(a => a.rowId !== msg.rowId);
    return [...filtered, {
      rowId: msg.rowId,
      status: msg.status as 'approved' | 'revision',
      comment: msg.comment,
      createdAt: msg.createdAt,
    }];
  });
};

const { projects, connected, saveProject: wsSaveProject, deleteProject: wsDeleteProject } =
  useSync(handleRemoteProjectUpdate, handleAnnotationAdded);
```

- [ ] **Step 6: 在 `App.tsx` 中挂载 `NotificationBell` 到顶部 UI**

找到 `<UserMenu .../>` 所在的 JSX 区域，在其旁边添加：

```tsx
<div className="fixed top-3 right-16 z-50">
  <NotificationBell
    notifications={notifications}
    onRead={id => {
      fetch(`/api/notifications/${id}/read`, { method: 'POST' }).catch(() => {});
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: 1 } : n));
    }}
    onReadAll={projectId => {
      fetch(`/api/projects/${projectId}/notifications/read-all`, { method: 'POST' }).catch(() => {});
      setNotifications(prev => prev.map(n => n.projectId === projectId ? { ...n, read: 1 } : n));
    }}
    onNavigate={(projectId, _rowId) => {
      const proj = projects.find(p => p.id === projectId);
      if (proj) handleOpenProject(proj);
    }}
  />
</div>
```

- [ ] **Step 7: 在 `App.tsx` 中向 `BreakdownView` 传入新 props**

找到 `<BreakdownView` 的 JSX，添加：

```tsx
<BreakdownView
  initialRows={storyboardRows}
  onImport={handleImportFromBreakdown}
  externalInitText={breakdownInitText}
  projectId={currentProject?.id}
  projectName={currentProject?.name}
  annotations={projectAnnotations}
/>
```

- [ ] **Step 8: TypeScript 检查**

```bash
npx tsc --noEmit
```

- [ ] **Step 9: 端到端手动验证**

1. 启动 `npm run dev:all`
2. 打开首页，选一个有分镜的项目，进入画布 → 切换到"分镜管理"Tab
3. 点"提交审片" → 弹出 ShareDialog，复制链接
4. 在另一个浏览器 Tab 打开链接 → 看到审片页，点任一镜头 → 标记"需修改" + 输入批注 → 提交
5. 返回第一个 Tab → 通知铃铛出现红点，点击看到批注通知
6. 分镜管理界面对应行右侧出现橙色批注气泡，hover 看到批注内容

- [ ] **Step 10: Commit**

```bash
git add src/components/NotificationBell.tsx src/hooks/useSync.ts src/App.tsx
git commit -m "feat(frontend): NotificationBell 和 App.tsx 通知系统接入"
```
