# 分镜版本管理 Phase 2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在分镜管理界面顶部新增版本下拉菜单，支持查看历史快照、还原到指定版本（覆盖当前，有未保存改动时提示）、手动保存快照并打标签。

**Architecture:** 依赖 Phase 1 已建立的 `project_snapshots` 表和 `POST /api/projects/:id/snapshot` 接口。Phase 2 新增 `GET /api/projects/:id/snapshots` 和 `POST /api/snapshots/:id/restore` 两个后端路由，前端新建 `VersionDropdown` 组件嵌入 `BreakdownView` 顶部。

**Tech Stack:** Express, better-sqlite3, React 19, TypeScript, Tailwind CSS v4

**前置条件：** Phase 1 必须已完成并合并。

---

## 文件变更清单

| 操作 | 文件 | 职责 |
|------|------|------|
| Modify | `server/routes/review.ts` | 新增 GET snapshots + POST restore 路由 |
| Create | `src/components/VersionDropdown.tsx` | 版本历史下拉菜单 UI |
| Modify | `src/components/BreakdownView.tsx` | 接入 VersionDropdown，传入 rows 变化检测 |
| Modify | `src/App.tsx` | 传 `onSnapshotRestore` 回调给 BreakdownView |

---

## Task 1: 后端 — GET snapshots + POST restore

**Files:**
- Modify: `server/db.ts`
- Modify: `server/routes/review.ts`

- [ ] **Step 1: 在 `server/db.ts` 末尾追加 getSnapshotsByProjectId 函数**

```typescript
export function getSnapshotsByProjectId(projectId: string): Omit<ProjectSnapshot, 'data'>[] {
  return db.prepare(
    'SELECT id, project_id, label, auto, created_at FROM project_snapshots WHERE project_id = ? ORDER BY created_at DESC'
  ).all(projectId) as Omit<ProjectSnapshot, 'data'>[];
}
```

- [ ] **Step 2: 在 `server/routes/review.ts` 中新增两个路由**

在现有路由之后、`export default router` 之前追加：

```typescript
// ── GET /api/projects/:id/snapshots ──────────────────────

router.get('/projects/:id/snapshots', (req, res) => {
  const { getSnapshotsByProjectId } = await import('../db.js').then(m => m);
  res.json(getSnapshotsByProjectId(req.params.id));
});

// ── POST /api/snapshots/:snapshotId/restore ───────────────

router.post('/snapshots/:snapshotId/restore', (req, res) => {
  const snapshot = getSnapshotById(req.params.snapshotId);
  if (!snapshot) return res.status(404).json({ error: 'snapshot not found' });

  const snapshotData: SnapshotData = JSON.parse(snapshot.data);

  // Load current project
  const projects = getAllProjects();
  const project = projects.find(p => p.id === snapshot.project_id);
  if (!project) return res.status(404).json({ error: 'project not found' });

  // Restore storyboardRows and storyboardOrder; preserve other fields
  const restoredImageNodeIds = new Set(snapshotData.storyboardOrder.map(id => `storyboard-${id}`));
  const otherNodes = project.nodes.filter(n => !restoredImageNodeIds.has(n.id));
  const restoredNodes = snapshotData.imageNodes
    .filter(n => n.imageUrl !== null)
    .map(n => {
      const existingNode = project.nodes.find(node => node.id === `storyboard-${n.rowId}`);
      if (existingNode) {
        return { ...existingNode, data: { ...existingNode.data, contents: [n.imageUrl!], content: n.imageUrl } };
      }
      return null;
    })
    .filter(Boolean);

  const updatedProject = {
    ...project,
    storyboardRows: snapshotData.storyboardRows,
    storyboardOrder: snapshotData.storyboardOrder,
    nodes: [...otherNodes, ...(restoredNodes as NonNullable<typeof restoredNodes[0]>[])],
    updatedAt: Date.now(),
  };

  const { upsertProject } = await import('../db.js').then(m => m);
  upsertProject(updatedProject);
  broadcast({ type: 'project_update', project: updatedProject });

  res.json({ ok: true, projectId: snapshot.project_id });
});
```

> **注意**：`getSnapshotsByProjectId` 和 `upsertProject` 需要加入顶部 import 列表：

在 `review.ts` 顶部的 import 语句中添加 `getSnapshotsByProjectId` 和确保 `upsertProject` 已导入：

```typescript
import {
  getAllProjects,
  upsertProject,          // 确保此行存在
  createSnapshot,
  getSnapshotById,
  getSnapshotsByProjectId, // 新增
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
```

同时将 restore 路由中的 `await import('../db.js')` 改为直接使用已导入的函数（去掉动态 import）：

```typescript
router.get('/projects/:id/snapshots', (req, res) => {
  res.json(getSnapshotsByProjectId(req.params.id));
});

router.post('/snapshots/:snapshotId/restore', (req, res) => {
  const snapshot = getSnapshotById(req.params.snapshotId);
  if (!snapshot) return res.status(404).json({ error: 'snapshot not found' });

  const snapshotData: SnapshotData = JSON.parse(snapshot.data);
  const projects = getAllProjects();
  const project = projects.find(p => p.id === snapshot.project_id);
  if (!project) return res.status(404).json({ error: 'project not found' });

  const restoredNodeIds = new Set(snapshotData.storyboardOrder.map(id => `storyboard-${id}`));
  const otherNodes = project.nodes.filter(n => !restoredNodeIds.has(n.id));
  const restoredNodes = snapshotData.imageNodes
    .filter(n => n.imageUrl !== null)
    .map(n => {
      const existing = project.nodes.find(node => node.id === `storyboard-${n.rowId}`);
      if (!existing) return null;
      return { ...existing, data: { ...existing.data as object, contents: [n.imageUrl!], content: n.imageUrl } };
    })
    .filter((n): n is NonNullable<typeof n> => n !== null);

  const updatedProject = {
    ...project,
    storyboardRows: snapshotData.storyboardRows,
    storyboardOrder: snapshotData.storyboardOrder,
    nodes: [...otherNodes, ...restoredNodes],
    updatedAt: Date.now(),
  };

  upsertProject(updatedProject);
  broadcast({ type: 'project_update', project: updatedProject });

  res.json({ ok: true, projectId: snapshot.project_id });
});
```

- [ ] **Step 3: TypeScript 检查**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: 手动验证**

```bash
# 列出项目的快照（需先有 Phase 1 创建的快照）
curl http://localhost:3001/api/projects/<projectId>/snapshots
# 期望：[{ id, project_id, label, auto, created_at }, ...]

# 还原到某个快照
curl -X POST http://localhost:3001/api/snapshots/<snapshotId>/restore
# 期望：{ ok: true, projectId }
```

- [ ] **Step 5: Commit**

```bash
git add server/db.ts server/routes/review.ts
git commit -m "feat(api): 新增快照列表和还原接口"
```

---

## Task 2: VersionDropdown 组件

**Files:**
- Create: `src/components/VersionDropdown.tsx`

- [ ] **Step 1: 创建 `src/components/VersionDropdown.tsx`**

```tsx
import React, { useState, useEffect, useRef } from 'react';

export interface SnapshotSummary {
  id: string;
  project_id: string;
  label: string | null;
  auto: number;
  created_at: number;
}

interface Props {
  projectId: string;
  currentLabel?: string;          // 当前版本的 label（最新快照的 label 或 "当前版本"）
  hasUnsavedChanges: boolean;     // 当前分镜与最新快照有差异
  onRestore: (snapshotId: string) => Promise<void>;
  onSaveSnapshot: (label: string) => Promise<void>;
}

function timeAgo(ts: number): string {
  const d = Date.now() - ts;
  if (d < 60_000) return '刚刚';
  if (d < 3_600_000) return `${Math.floor(d / 60_000)} 分钟前`;
  if (d < 86_400_000) return `${Math.floor(d / 3_600_000)} 小时前`;
  if (d < 86_400_000 * 2) return '昨天';
  return `${Math.floor(d / 86_400_000)} 天前`;
}

export default function VersionDropdown({
  projectId,
  currentLabel,
  hasUnsavedChanges,
  onRestore,
  onSaveSnapshot,
}: Props) {
  const [open, setOpen] = useState(false);
  const [snapshots, setSnapshots] = useState<SnapshotSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [restoring, setRestoring] = useState<string | null>(null);
  const [showSaveInput, setShowSaveInput] = useState(false);
  const [saveLabel, setSaveLabel] = useState('');
  const [saving, setSaving] = useState(false);
  const [confirmRestore, setConfirmRestore] = useState<SnapshotSummary | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Load snapshots when dropdown opens
  useEffect(() => {
    if (!open || !projectId) return;
    setLoading(true);
    fetch(`/api/projects/${projectId}/snapshots`)
      .then(r => r.ok ? r.json() : [])
      .then(data => setSnapshots(data as SnapshotSummary[]))
      .catch(() => setSnapshots([]))
      .finally(() => setLoading(false));
  }, [open, projectId]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handle = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
        setShowSaveInput(false);
        setConfirmRestore(null);
      }
    };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [open]);

  const latestLabel = snapshots[0]?.label ?? currentLabel ?? '当前版本';

  const doRestore = async (snapshot: SnapshotSummary) => {
    setRestoring(snapshot.id);
    try {
      await onRestore(snapshot.id);
      setOpen(false);
      setConfirmRestore(null);
    } finally {
      setRestoring(null);
    }
  };

  const handleRestoreClick = (snapshot: SnapshotSummary) => {
    if (hasUnsavedChanges) {
      setConfirmRestore(snapshot);
    } else {
      doRestore(snapshot);
    }
  };

  const handleSaveSnapshot = async () => {
    if (!saveLabel.trim() || saving) return;
    setSaving(true);
    try {
      await onSaveSnapshot(saveLabel.trim());
      setSaveLabel('');
      setShowSaveInput(false);
      // Refresh snapshots list
      const data = await fetch(`/api/projects/${projectId}/snapshots`).then(r => r.json());
      setSnapshots(data as SnapshotSummary[]);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="relative" ref={dropdownRef} style={{ fontFamily: 'Inter' }}>
      {/* Trigger */}
      <button
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-white/40 hover:text-white/60 border border-white/10 rounded-lg hover:border-white/20 transition-all bg-white/3"
      >
        <span className="material-symbols-outlined text-[13px]">history</span>
        <span className="max-w-[100px] truncate">{latestLabel}</span>
        <span className="text-white/20">▾</span>
        {hasUnsavedChanges && (
          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 flex-shrink-0" title="有未保存的修改" />
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute left-0 top-10 z-50 w-64 bg-[#1e1e1e] border border-white/10 rounded-2xl shadow-2xl overflow-hidden">
          <div className="px-4 py-3 border-b border-white/8">
            <p className="text-[10px] text-white/30 uppercase tracking-wider">版本历史</p>
          </div>

          <div className="max-h-56 overflow-y-auto py-1">
            {loading ? (
              <p className="text-xs text-white/25 text-center py-4">加载中...</p>
            ) : snapshots.length === 0 ? (
              <p className="text-xs text-white/25 text-center py-4">暂无版本记录</p>
            ) : (
              snapshots.map((s, i) => (
                <div
                  key={s.id}
                  className="flex items-center justify-between px-4 py-2.5 hover:bg-white/5 transition-colors"
                  style={{ background: i === 0 ? 'rgba(200,190,220,0.05)' : undefined }}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      {i === 0 && (
                        <span className="w-1.5 h-1.5 rounded-full bg-purple-300/60 flex-shrink-0" />
                      )}
                      <p className="text-xs text-white/60 truncate">{s.label ?? '未命名快照'}</p>
                    </div>
                    <p className="text-[10px] text-white/25 mt-0.5 ml-3.5">{timeAgo(s.created_at)}</p>
                  </div>
                  {i > 0 && (
                    <button
                      onClick={() => handleRestoreClick(s)}
                      disabled={restoring === s.id}
                      className="ml-3 text-[10px] text-purple-300/50 hover:text-purple-300/80 transition-colors flex-shrink-0 disabled:opacity-40"
                    >
                      {restoring === s.id ? '还原中...' : '↩ 还原'}
                    </button>
                  )}
                  {i === 0 && (
                    <span className="text-[10px] text-white/25 ml-2 flex-shrink-0">当前</span>
                  )}
                </div>
              ))
            )}
          </div>

          {/* Save snapshot */}
          <div className="border-t border-white/8 p-3">
            {showSaveInput ? (
              <div className="flex gap-2">
                <input
                  autoFocus
                  value={saveLabel}
                  onChange={e => setSaveLabel(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') handleSaveSnapshot();
                    if (e.key === 'Escape') { setShowSaveInput(false); setSaveLabel(''); }
                  }}
                  placeholder="如：v2·第二轮修改"
                  className="flex-1 bg-black/30 border border-white/12 rounded-lg px-2.5 py-1.5 text-xs text-white/70 placeholder:text-white/25 focus:outline-none focus:border-white/25"
                />
                <button
                  onClick={handleSaveSnapshot}
                  disabled={!saveLabel.trim() || saving}
                  className="px-2.5 py-1.5 text-xs font-bold bg-white/90 text-black rounded-lg hover:bg-white transition-colors disabled:opacity-50"
                >
                  {saving ? '...' : '存'}
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowSaveInput(true)}
                className="w-full text-xs text-white/30 hover:text-white/50 transition-colors text-center py-1"
              >
                + 保存当前为快照
              </button>
            )}
          </div>
        </div>
      )}

      {/* Restore confirm dialog */}
      {confirmRestore && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60"
          onClick={e => { if (e.target === e.currentTarget) setConfirmRestore(null); }}
        >
          <div className="bg-[#1e1e1e] border border-white/10 rounded-2xl p-5 w-80 shadow-2xl" style={{ fontFamily: 'Inter' }}>
            <h3 className="text-sm font-bold text-white/80 mb-2" style={{ fontFamily: 'Manrope' }}>还原到此版本？</h3>
            <p className="text-xs text-white/40 mb-1">"{confirmRestore.label ?? '未命名快照'}"</p>
            <p className="text-xs text-amber-400/70 mb-5">当前有未保存的修改，还原后将丢失。</p>
            <div className="flex flex-col gap-2">
              <button
                onClick={async () => {
                  // Save current first, then restore
                  await onSaveSnapshot(`还原前自动保存 · ${new Date().toLocaleTimeString('zh-CN')}`);
                  await doRestore(confirmRestore);
                }}
                className="w-full py-2 text-xs font-bold bg-white/8 text-white/70 rounded-xl hover:bg-white/12 transition-colors border border-white/10"
              >
                先保存当前再还原
              </button>
              <button
                onClick={() => doRestore(confirmRestore)}
                className="w-full py-2 text-xs text-red-400/70 hover:text-red-400 transition-colors"
              >
                直接还原（放弃当前修改）
              </button>
              <button
                onClick={() => setConfirmRestore(null)}
                className="w-full py-2 text-xs text-white/30 hover:text-white/50 transition-colors"
              >
                取消
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: TypeScript 检查**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/components/VersionDropdown.tsx
git commit -m "feat(frontend): VersionDropdown 版本历史组件"
```

---

## Task 3: BreakdownView + App.tsx 接入版本下拉

**Files:**
- Modify: `src/components/BreakdownView.tsx`
- Modify: `src/App.tsx`

- [ ] **Step 1: 在 `BreakdownView.tsx` Props 接口新增版本管理相关 props**

```typescript
interface Props {
  initialRows?: StoryboardRow[];
  onImport: (rows: StoryboardRow[], ratio: string, cardW: number, cardH: number) => void;
  externalInitText?: string;
  projectId?: string;
  projectName?: string;
  annotations?: import('./AnnotationBubble').AnnotationData[];
  savedRowsHash?: string;          // 最新快照的 rows JSON hash，用于检测未保存改动
  onSnapshotRestore?: (snapshotId: string) => Promise<void>;  // 新增
  onSaveSnapshot?: (label: string) => Promise<void>;          // 新增
}
```

更新函数签名：

```typescript
export default function BreakdownView({
  initialRows, onImport, externalInitText,
  projectId, projectName, annotations = [],
  savedRowsHash, onSnapshotRestore, onSaveSnapshot,
}: Props) {
```

- [ ] **Step 2: 在 `BreakdownView.tsx` 顶部 import 区新增 VersionDropdown import**

```typescript
import VersionDropdown from './VersionDropdown';
```

- [ ] **Step 3: 计算 hasUnsavedChanges**

在 `BreakdownView` 函数体内（state 声明区附近）添加：

```typescript
const hasUnsavedChanges = savedRowsHash !== undefined
  ? JSON.stringify(rows) !== savedRowsHash
  : false;
```

- [ ] **Step 4: 在 BreakdownView 顶部工具栏添加 VersionDropdown**

在现有"提交审片"按钮之前（或之后）插入：

```tsx
{projectId && onSnapshotRestore && onSaveSnapshot && (
  <VersionDropdown
    projectId={projectId}
    hasUnsavedChanges={hasUnsavedChanges}
    onRestore={onSnapshotRestore}
    onSaveSnapshot={onSaveSnapshot}
  />
)}
```

- [ ] **Step 5: 在 `App.tsx` 新增 snapshot 相关处理函数**

在 `handleRenameProject` 附近添加：

```typescript
const handleSnapshotRestore = async (snapshotId: string) => {
  const res = await fetch(`/api/snapshots/${snapshotId}/restore`, { method: 'POST' });
  if (!res.ok) throw new Error('restore failed');
  // 还原后重新拉取项目数据（ws broadcast 会触发 useSync 更新）
};

const handleSaveSnapshot = async (label: string) => {
  if (!currentProject) return;
  await fetch(`/api/projects/${currentProject.id}/snapshot`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ label }),
  });
};
```

- [ ] **Step 6: 在 App.tsx 中向 BreakdownView 传入新 props**

找到 `<BreakdownView` JSX，补充以下 props（在 Phase 1 已有的 props 基础上追加）：

```tsx
<BreakdownView
  initialRows={storyboardRows}
  onImport={handleImportFromBreakdown}
  externalInitText={breakdownInitText}
  projectId={currentProject?.id}
  projectName={currentProject?.name}
  annotations={projectAnnotations}
  onSnapshotRestore={handleSnapshotRestore}
  onSaveSnapshot={handleSaveSnapshot}
/>
```

（`savedRowsHash` 暂时不传，`hasUnsavedChanges` 默认 false，Phase 2 后续可以在 `handleOpenProject` 时计算初始 hash）

- [ ] **Step 7: TypeScript 检查**

```bash
npx tsc --noEmit
```

- [ ] **Step 8: 端到端手动验证**

1. 打开一个有分镜的项目，进入分镜管理
2. 确认顶部出现版本下拉触发器（`⟲ 历史 ▾`）
3. 点击下拉：确认显示历史快照列表（需先通过"提交审片"创建过快照）
4. 点"+ 保存当前为快照" → 输入标签 → 回车 → 快照列表更新
5. 修改一两个分镜描述，再点"↩ 还原"某个旧版本
   - 若有未保存改动：弹出确认框，选"先保存再还原"或"直接还原"
   - 还原后分镜列表回到旧版本内容

- [ ] **Step 9: Commit**

```bash
git add src/components/BreakdownView.tsx src/App.tsx
git commit -m "feat(frontend): BreakdownView 和 App 接入版本下拉菜单"
```
