# 模板库 + 节点面板改版 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 新增模板库 Tab（增删改查模板），并在 ImageNode / VideoNode 控制面板中集成模板选择和 AI 融合提示词功能。

**Architecture:** 后端在 SQLite 新增 `templates` 表，新建 `server/routes/templates.ts` 处理 CRUD 和 AI 融合；前端新增 `TemplateLibraryView` 管理页和 `TemplateFormDrawer` 表单抽屉，ImageNode 和 VideoNode 面板顶部加入模板横向选择条和 AI 融合提示词区域。

**Tech Stack:** Express + better-sqlite3（后端），React + TypeScript + Tailwind（前端），豆包 doubao-1-5-pro-32k-250115 模型（AI 融合）

---

## 文件变更清单

| 文件 | 操作 |
|------|------|
| `server/db.ts` | 新增 templates 表 DDL + 5 个 CRUD 函数 |
| `server/routes/templates.ts` | 新建：CRUD 路由 + POST /merge-prompt |
| `server/index.ts` | 注册 `/api/templates` 路由 |
| `src/components/TemplateLibraryView.tsx` | 新建：模板库页面（列表 + 筛选） |
| `src/components/TemplateFormDrawer.tsx` | 新建：新建/编辑模板右侧抽屉 |
| `src/components/BottomTabBar.tsx` | 新增 `'templates'` tab |
| `src/App.tsx` | 导入并渲染 TemplateLibraryView |
| `src/components/ImageNode.tsx` | 面板改版：模板条 + AI 融合提示词 |
| `src/components/VideoNode.tsx` | 面板改版：模板条 + AI 融合提示词 |

---

## Task 1: 后端数据库 — 新增 templates 表和 CRUD 函数

**Files:**
- Modify: `server/db.ts`

- [ ] **Step 1: 在 db.exec 中追加建表语句**

在 `server/db.ts` 的 `db.exec(...)` 字符串末尾（`);` 之前）追加：

```sql
  CREATE TABLE IF NOT EXISTS templates (
    id              TEXT PRIMARY KEY,
    name            TEXT NOT NULL,
    genre           TEXT NOT NULL,
    nodeType        TEXT NOT NULL,
    promptPreset    TEXT NOT NULL,
    styleTag        TEXT,
    compositionTip  TEXT,
    cameraParams    TEXT,
    durationHint    INTEGER,
    audioHint       TEXT,
    createdAt       INTEGER NOT NULL
  );
```

- [ ] **Step 2: 追加 TypeScript 类型和 CRUD 函数**

在 `server/db.ts` 末尾追加：

```typescript
// ── Template functions ───────────────────────────────────

export interface Template {
  id: string;
  name: string;
  genre: string;
  nodeType: 'image' | 'video';
  promptPreset: string;
  styleTag: string | null;
  compositionTip: string | null;
  cameraParams: string | null;
  durationHint: number | null;
  audioHint: string | null;
  createdAt: number;
}

export function getTemplates(nodeType?: string, genre?: string): Template[] {
  let sql = 'SELECT * FROM templates WHERE 1=1';
  const params: string[] = [];
  if (nodeType) { sql += ' AND nodeType = ?'; params.push(nodeType); }
  if (genre && genre !== '全部') { sql += ' AND genre = ?'; params.push(genre); }
  sql += ' ORDER BY createdAt DESC';
  return db.prepare(sql).all(...params) as Template[];
}

export function createTemplate(t: Omit<Template, 'createdAt'>): void {
  db.prepare(`
    INSERT INTO templates
      (id, name, genre, nodeType, promptPreset, styleTag, compositionTip, cameraParams, durationHint, audioHint, createdAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(t.id, t.name, t.genre, t.nodeType, t.promptPreset,
         t.styleTag ?? null, t.compositionTip ?? null,
         t.cameraParams ?? null, t.durationHint ?? null,
         t.audioHint ?? null, Date.now());
}

export function updateTemplate(id: string, t: Partial<Omit<Template, 'id' | 'createdAt'>>): void {
  const fields = Object.keys(t).map(k => `${k} = ?`).join(', ');
  const values = Object.values(t);
  if (!fields) return;
  db.prepare(`UPDATE templates SET ${fields} WHERE id = ?`).run(...values, id);
}

export function deleteTemplate(id: string): void {
  db.prepare('DELETE FROM templates WHERE id = ?').run(id);
}
```

- [ ] **Step 3: 验证服务器能正常启动**

```bash
npm run dev:server
```

预期：终端输出 `[server] running on http://localhost:3001`，无报错。

- [ ] **Step 4: Commit**

```bash
git add server/db.ts
git commit -m "feat(db): 新增 templates 表和 CRUD 函数"
```

---

## Task 2: 后端路由 — templates CRUD + merge-prompt

**Files:**
- Create: `server/routes/templates.ts`
- Modify: `server/index.ts`

- [ ] **Step 1: 新建路由文件**

新建 `server/routes/templates.ts`：

```typescript
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
```

- [ ] **Step 2: 注册路由到 server/index.ts，同时修复 CORS**

在 `server/index.ts` 的 import 块末尾加：

```typescript
import templatesRouter from './routes/templates.js';
```

将 CORS 中间件中的这一行：

```typescript
res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
```

改为：

```typescript
res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
```

在 `app.use('/api', reviewRouter);` 之前加：

```typescript
app.use('/api/templates', templatesRouter);
```

注意：`/api/templates/merge-prompt` 的 POST 路由必须在通配 `:id` 路由之前注册，已在路由文件内部按顺序定义（merge-prompt 在 PUT /:id 之前），Express 会正确匹配。

- [ ] **Step 3: 验证路由**

```bash
npm run dev:server
```

然后在另一个终端：

```bash
curl -X POST http://localhost:3001/api/templates \
  -H "Content-Type: application/json" \
  -d '{"name":"测试模板","genre":"古风武侠","nodeType":"image","promptPreset":"古风山水，晨雾缭绕"}'
```

预期：返回 `{"id":"tpl_..."}` 格式的 JSON。

```bash
curl http://localhost:3001/api/templates
```

预期：返回包含刚才创建模板的数组。

- [ ] **Step 4: Commit**

```bash
git add server/routes/templates.ts server/index.ts
git commit -m "feat(api): 新增 templates CRUD 和 merge-prompt 路由"
```

---

## Task 3: 前端 — BottomTabBar 新增模板库 Tab

**Files:**
- Modify: `src/components/BottomTabBar.tsx`

- [ ] **Step 1: 更新 ActiveView 类型和 TABS 数组**

将 `src/components/BottomTabBar.tsx` 第 4 行的类型改为：

```typescript
export type ActiveView = 'topic' | 'canvas' | 'assets' | 'storyboard' | 'breakdown' | 'video' | 'subtitle' | 'templates';
```

在 `TABS` 数组末尾（`subtitle` 项之后）追加：

```typescript
  { key: 'templates', icon: 'bookmark_manager', label: '模板库' },
```

- [ ] **Step 2: 验证前端编译无报错**

```bash
npm run lint
```

预期：无 TypeScript 报错。

- [ ] **Step 3: Commit**

```bash
git add src/components/BottomTabBar.tsx
git commit -m "feat(ui): BottomTabBar 新增模板库 Tab"
```

---

## Task 4: 前端 — TemplateFormDrawer 表单抽屉

**Files:**
- Create: `src/components/TemplateFormDrawer.tsx`

- [ ] **Step 1: 新建组件文件**

新建 `src/components/TemplateFormDrawer.tsx`：

```typescript
import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';

export interface TemplateFormData {
  name: string;
  genre: string;
  nodeType: 'image' | 'video';
  promptPreset: string;
  styleTag: string;
  compositionTip: string;
  cameraParams: string;
  durationHint: string;
  audioHint: string;
}

const GENRES = ['古风武侠', '都市情感', '科幻奇幻', '微短剧爆款', '自定义'];

const EMPTY: TemplateFormData = {
  name: '', genre: '古风武侠', nodeType: 'image', promptPreset: '',
  styleTag: '', compositionTip: '', cameraParams: '', durationHint: '', audioHint: '',
};

interface Props {
  open: boolean;
  initial?: Partial<TemplateFormData> & { id?: string };
  onClose: () => void;
  onSave: (data: TemplateFormData, id?: string) => Promise<void>;
}

export default function TemplateFormDrawer({ open, initial, onClose, onSave }: Props) {
  const [form, setForm] = useState<TemplateFormData>(EMPTY);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) setForm({ ...EMPTY, ...initial });
  }, [open, initial]);

  const set = (k: keyof TemplateFormData, v: string) =>
    setForm(prev => ({ ...prev, [k]: v }));

  const handleSave = async () => {
    if (!form.name.trim() || !form.promptPreset.trim()) return;
    setSaving(true);
    try { await onSave(form, initial?.id); onClose(); }
    finally { setSaving(false); }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end" onClick={onClose}>
      <div
        className="w-[400px] h-full bg-[#1c1c20] border-l border-white/8 flex flex-col shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/8">
          <span className="text-white font-medium text-sm">
            {initial?.id ? '编辑模板' : '新建模板'}
          </span>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-300 transition-colors">
            <X size={16} />
          </button>
        </div>

        {/* Form */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* 节点类型 */}
          <div>
            <label className="block text-[11px] text-gray-500 uppercase tracking-wide mb-1.5">节点类型</label>
            <div className="flex gap-2">
              {(['image', 'video'] as const).map(t => (
                <button
                  key={t}
                  onClick={() => set('nodeType', t)}
                  className={`px-4 py-1.5 rounded-lg text-[12px] transition-colors border ${
                    form.nodeType === t
                      ? 'bg-white/10 text-white border-white/20'
                      : 'text-gray-500 border-white/8 hover:text-gray-300'
                  }`}
                >
                  {t === 'image' ? '图片' : '视频'}
                </button>
              ))}
            </div>
          </div>

          {/* 名称 */}
          <div>
            <label className="block text-[11px] text-gray-500 uppercase tracking-wide mb-1.5">模板名称 *</label>
            <input
              value={form.name}
              onChange={e => set('name', e.target.value)}
              placeholder="如：古风·开场航拍"
              className="w-full bg-white/5 border border-white/8 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 outline-none focus:border-white/20"
            />
          </div>

          {/* 题材 */}
          <div>
            <label className="block text-[11px] text-gray-500 uppercase tracking-wide mb-1.5">题材分类</label>
            <div className="flex flex-wrap gap-2">
              {GENRES.map(g => (
                <button
                  key={g}
                  onClick={() => set('genre', g)}
                  className={`px-3 py-1 rounded-full text-[11px] transition-colors border ${
                    form.genre === g
                      ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                      : 'text-gray-500 border-white/8 hover:text-gray-300'
                  }`}
                >
                  {g}
                </button>
              ))}
            </div>
          </div>

          {/* 提示词预设 */}
          <div>
            <label className="block text-[11px] text-gray-500 uppercase tracking-wide mb-1.5">提示词预设 *</label>
            <textarea
              value={form.promptPreset}
              onChange={e => set('promptPreset', e.target.value)}
              placeholder="核心提示词，AI 将以此为基底与用户输入融合"
              rows={4}
              className="w-full bg-white/5 border border-white/8 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 outline-none focus:border-white/20 resize-none"
            />
          </div>

          {/* 图片模板专属 */}
          {form.nodeType === 'image' && (
            <>
              <div>
                <label className="block text-[11px] text-gray-500 uppercase tracking-wide mb-1.5">画风标签</label>
                <input
                  value={form.styleTag}
                  onChange={e => set('styleTag', e.target.value)}
                  placeholder="如：中国水墨/暖色调"
                  className="w-full bg-white/5 border border-white/8 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 outline-none focus:border-white/20"
                />
              </div>
              <div>
                <label className="block text-[11px] text-gray-500 uppercase tracking-wide mb-1.5">构图建议</label>
                <input
                  value={form.compositionTip}
                  onChange={e => set('compositionTip', e.target.value)}
                  placeholder="如：三分法/低角度仰拍"
                  className="w-full bg-white/5 border border-white/8 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 outline-none focus:border-white/20"
                />
              </div>
            </>
          )}

          {/* 视频模板专属 */}
          {form.nodeType === 'video' && (
            <>
              <div>
                <label className="block text-[11px] text-gray-500 uppercase tracking-wide mb-1.5">运镜参数</label>
                <input
                  value={form.cameraParams}
                  onChange={e => set('cameraParams', e.target.value)}
                  placeholder="如：缓慢推进+俯拍45°"
                  className="w-full bg-white/5 border border-white/8 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 outline-none focus:border-white/20"
                />
              </div>
              <div>
                <label className="block text-[11px] text-gray-500 uppercase tracking-wide mb-1.5">建议时长（秒）</label>
                <input
                  value={form.durationHint}
                  onChange={e => set('durationHint', e.target.value)}
                  type="number"
                  min={4} max={12}
                  placeholder="如：5"
                  className="w-full bg-white/5 border border-white/8 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 outline-none focus:border-white/20"
                />
              </div>
              <div>
                <label className="block text-[11px] text-gray-500 uppercase tracking-wide mb-1.5">音效建议</label>
                <input
                  value={form.audioHint}
                  onChange={e => set('audioHint', e.target.value)}
                  placeholder="如：古筝背景音/无音效"
                  className="w-full bg-white/5 border border-white/8 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 outline-none focus:border-white/20"
                />
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-white/8 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-500 hover:text-gray-300 transition-colors"
          >
            取消
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !form.name.trim() || !form.promptPreset.trim()}
            className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white text-sm rounded-lg transition-colors"
          >
            {saving ? '保存中…' : '保存'}
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/TemplateFormDrawer.tsx
git commit -m "feat(ui): TemplateFormDrawer 新建/编辑模板抽屉"
```

---

## Task 5: 前端 — TemplateLibraryView 模板库页面

**Files:**
- Create: `src/components/TemplateLibraryView.tsx`

- [ ] **Step 1: 新建组件文件**

新建 `src/components/TemplateLibraryView.tsx`：

```typescript
import React, { useState, useEffect, useCallback } from 'react';
import { BookMarked, Trash2, Pencil } from 'lucide-react';
import TemplateFormDrawer, { type TemplateFormData } from './TemplateFormDrawer';

interface Template {
  id: string;
  name: string;
  genre: string;
  nodeType: 'image' | 'video';
  promptPreset: string;
  styleTag: string | null;
  compositionTip: string | null;
  cameraParams: string | null;
  durationHint: number | null;
  audioHint: string | null;
  createdAt: number;
}

const GENRES = ['全部', '古风武侠', '都市情感', '科幻奇幻', '微短剧爆款', '自定义'];

const GENRE_COLORS: Record<string, string> = {
  '古风武侠': 'bg-amber-500/12 text-amber-300 border-amber-500/30',
  '都市情感': 'bg-blue-500/12 text-blue-300 border-blue-500/30',
  '科幻奇幻': 'bg-violet-500/12 text-violet-300 border-violet-500/30',
  '微短剧爆款': 'bg-rose-500/12 text-rose-300 border-rose-500/30',
  '自定义': 'bg-white/8 text-gray-400 border-white/15',
};

export default function TemplateLibraryView() {
  const [nodeType, setNodeType] = useState<'image' | 'video'>('image');
  const [genre, setGenre] = useState('全部');
  const [templates, setTemplates] = useState<Template[]>([]);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState<Template | null>(null);

  const fetchTemplates = useCallback(async () => {
    const params = new URLSearchParams({ nodeType });
    if (genre !== '全部') params.set('genre', genre);
    const res = await fetch(`/api/templates?${params}`);
    if (res.ok) setTemplates(await res.json() as Template[]);
  }, [nodeType, genre]);

  useEffect(() => { fetchTemplates(); }, [fetchTemplates]);

  const handleSave = async (data: TemplateFormData, id?: string) => {
    const body = {
      ...data,
      durationHint: data.durationHint ? Number(data.durationHint) : null,
    };
    if (id) {
      await fetch(`/api/templates/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
    } else {
      await fetch('/api/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
    }
    await fetchTemplates();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('确定删除这个模板吗？')) return;
    await fetch(`/api/templates/${id}`, { method: 'DELETE' });
    await fetchTemplates();
  };

  const openCreate = () => { setEditing(null); setDrawerOpen(true); };
  const openEdit = (t: Template) => { setEditing(t); setDrawerOpen(true); };

  return (
    <div className="flex-1 overflow-y-auto p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <BookMarked size={20} className="text-gray-400" />
          <h1 className="text-white font-semibold text-lg">模板库</h1>
        </div>
        <button
          onClick={openCreate}
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm rounded-xl transition-colors"
        >
          + 新建模板
        </button>
      </div>

      {/* Node type tabs */}
      <div className="flex gap-1 bg-white/5 rounded-xl p-1 w-fit mb-5">
        {(['image', 'video'] as const).map(t => (
          <button
            key={t}
            onClick={() => { setNodeType(t); setGenre('全部'); }}
            className={`px-5 py-1.5 rounded-lg text-sm transition-all ${
              nodeType === t ? 'bg-white/10 text-white' : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            {t === 'image' ? '图片模板' : '视频模板'}
          </button>
        ))}
      </div>

      {/* Genre filter */}
      <div className="flex gap-2 flex-wrap mb-5">
        {GENRES.map(g => (
          <button
            key={g}
            onClick={() => setGenre(g)}
            className={`px-3 py-1 rounded-full text-[11px] border transition-colors ${
              genre === g
                ? 'bg-amber-500/15 text-amber-300 border-amber-500/35'
                : 'bg-white/5 text-gray-500 border-white/8 hover:text-gray-300'
            }`}
          >
            {g}
          </button>
        ))}
      </div>

      {/* Template grid */}
      <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-3">
        {templates.map(t => (
          <div
            key={t.id}
            className="bg-[#1c1c20] border border-white/8 rounded-2xl p-4 hover:border-white/15 transition-colors"
          >
            <div className="flex items-start justify-between mb-2">
              <span className="text-[13px] text-white font-medium leading-tight">{t.name}</span>
              <span className={`text-[10px] px-2 py-0.5 rounded-full border flex-shrink-0 ml-2 ${GENRE_COLORS[t.genre] ?? GENRE_COLORS['自定义']}`}>
                {t.genre}
              </span>
            </div>
            <p className="text-[11px] text-gray-500 leading-relaxed line-clamp-2 mb-3">
              {t.promptPreset}
            </p>
            {/* Meta tags */}
            <div className="flex flex-wrap gap-1 mb-3">
              {t.styleTag && <span className="text-[10px] px-2 py-0.5 bg-white/5 rounded-md text-gray-500 border border-white/8">{t.styleTag}</span>}
              {t.compositionTip && <span className="text-[10px] px-2 py-0.5 bg-white/5 rounded-md text-gray-500 border border-white/8">{t.compositionTip}</span>}
              {t.cameraParams && <span className="text-[10px] px-2 py-0.5 bg-white/5 rounded-md text-gray-500 border border-white/8">{t.cameraParams}</span>}
              {t.durationHint && <span className="text-[10px] px-2 py-0.5 bg-white/5 rounded-md text-gray-500 border border-white/8">{t.durationHint}s</span>}
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => openEdit(t)}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] text-gray-500 hover:text-gray-200 bg-white/5 hover:bg-white/10 transition-colors"
              >
                <Pencil size={11} /> 编辑
              </button>
              <button
                onClick={() => handleDelete(t.id)}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] text-gray-500 hover:text-red-400 bg-white/5 hover:bg-red-500/10 transition-colors"
              >
                <Trash2 size={11} /> 删除
              </button>
            </div>
          </div>
        ))}

        {/* Add card */}
        <button
          onClick={openCreate}
          className="border-2 border-dashed border-white/10 hover:border-white/20 rounded-2xl p-4 flex flex-col items-center justify-center gap-2 min-h-[130px] transition-colors group"
        >
          <span className="text-2xl text-gray-700 group-hover:text-gray-500 transition-colors">+</span>
          <span className="text-[12px] text-gray-600 group-hover:text-gray-400 transition-colors">新建模板</span>
        </button>
      </div>

      <TemplateFormDrawer
        open={drawerOpen}
        initial={editing ? {
          id: editing.id,
          name: editing.name,
          genre: editing.genre,
          nodeType: editing.nodeType,
          promptPreset: editing.promptPreset,
          styleTag: editing.styleTag ?? '',
          compositionTip: editing.compositionTip ?? '',
          cameraParams: editing.cameraParams ?? '',
          durationHint: editing.durationHint?.toString() ?? '',
          audioHint: editing.audioHint ?? '',
        } : undefined}
        onClose={() => setDrawerOpen(false)}
        onSave={handleSave}
      />
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/TemplateLibraryView.tsx
git commit -m "feat(ui): TemplateLibraryView 模板库页面"
```

---

## Task 6: 前端 — App.tsx 接入模板库 Tab

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1: 导入 TemplateLibraryView**

在 `src/App.tsx` 的 import 区域（TopicView 导入附近）添加：

```typescript
import TemplateLibraryView from './components/TemplateLibraryView';
```

- [ ] **Step 2: 找到渲染各 view 的区域，添加 templates 分支**

在 App.tsx 中找到类似 `activeView === 'subtitle'` 的条件渲染区域，增加 templates 分支。具体模式是在已有的 `{activeView === 'subtitle' && <SubtitleView ... />}` 之后添加：

```typescript
{activeView === 'templates' && <TemplateLibraryView />}
```

- [ ] **Step 3: 验证编译无误**

```bash
npm run lint
```

预期：无报错。

- [ ] **Step 4: 启动并手动验证**

```bash
npm run dev:all
```

打开 http://localhost:3000，点击底部「模板库」Tab（bookmark_manager 图标），确认页面出现「图片模板 / 视频模板」切换和「+ 新建模板」按钮。

- [ ] **Step 5: Commit**

```bash
git add src/App.tsx
git commit -m "feat(ui): App.tsx 接入模板库 Tab"
```

---

## Task 7: ImageNode 面板改版

**Files:**
- Modify: `src/components/ImageNode.tsx`

- [ ] **Step 1: 新增模板相关状态和 hook**

在 `ImageNode` 组件内，在现有 state 声明之后添加：

```typescript
const [templates, setTemplates] = useState<Array<{ id: string; name: string; promptPreset: string; styleTag: string | null }>>([]);
const [selectedTplId, setSelectedTplId] = useState<string | null>(null);
const [mergedPrompt, setMergedPrompt] = useState('');
const [userExtra, setUserExtra] = useState('');
const [merging, setMerging] = useState(false);

// 面板展开时拉取图片模板
useEffect(() => {
  if (!showPanel) return;
  fetch('/api/templates?nodeType=image')
    .then(r => r.json())
    .then((list: Array<{ id: string; name: string; promptPreset: string; styleTag: string | null }>) => setTemplates(list))
    .catch(() => {});
}, [showPanel]);
```

- [ ] **Step 2: 新增 mergePrompt 函数**

在 `handleOptimizePrompt` 函数之后添加：

```typescript
const mergePrompt = async (tplId: string, extra: string) => {
  const tpl = templates.find(t => t.id === tplId);
  if (!tpl) return;
  setMerging(true);
  try {
    const resp = await fetch('/api/templates/merge-prompt', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        templatePrompt: tpl.promptPreset,
        userInput: extra,
        nodeType: 'image',
        shotDescription: data.shotDescription,
      }),
    });
    if (resp.ok) {
      const { mergedPrompt: mp } = await resp.json() as { mergedPrompt: string };
      setMergedPrompt(mp);
      setPrompt(mp);
    }
  } finally {
    setMerging(false);
  }
};
```

- [ ] **Step 3: 替换面板内容**

找到 `showPanel` 为 true 时渲染的 `<div className="nodrag absolute top-full ...">` 内部，将其内容替换为以下结构（保留原有的 `onMouseDown` 阻止冒泡）：

```tsx
{/* 0. 模板选择条 */}
{templates.length > 0 && (
  <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
    <span className="text-[10px] text-gray-600 flex-shrink-0">模板</span>
    <button
      onClick={() => { setSelectedTplId(null); setMergedPrompt(''); }}
      className={`px-2.5 py-1 rounded-full text-[11px] flex-shrink-0 border transition-colors ${
        !selectedTplId ? 'bg-white/8 text-gray-300 border-white/15' : 'text-gray-600 border-white/8 hover:text-gray-400'
      }`}
    >全部</button>
    {templates.map(t => (
      <button
        key={t.id}
        onClick={() => { setSelectedTplId(t.id); mergePrompt(t.id, userExtra); }}
        className={`px-2.5 py-1 rounded-full text-[11px] flex-shrink-0 border transition-colors whitespace-nowrap ${
          selectedTplId === t.id
            ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40'
            : 'text-gray-500 border-white/8 hover:text-gray-300'
        }`}
      >
        {selectedTplId === t.id && merging ? '✦ 融合中…' : `✦ ${t.name}`}
      </button>
    ))}
  </div>
)}

{/* 1. 提示词区域：有模板时显示融合框，无模板时显示普通输入 */}
<div className="flex flex-col gap-1.5">
  {selectedTplId ? (
    <>
      <div className="bg-[#1a1a24] border border-indigo-500/25 rounded-xl px-3 py-2.5">
        <div className="text-[10px] text-indigo-400 mb-1.5 flex items-center gap-1">✦ AI 融合提示词</div>
        <textarea
          value={mergedPrompt}
          onChange={e => { setMergedPrompt(e.target.value); setPrompt(e.target.value); }}
          className="w-full bg-transparent text-[13px] text-indigo-100 leading-relaxed resize-none outline-none min-h-[60px]"
          placeholder="AI 融合中…"
        />
      </div>
      <input
        value={userExtra}
        onChange={e => setUserExtra(e.target.value)}
        onBlur={() => { if (selectedTplId) mergePrompt(selectedTplId, userExtra); }}
        placeholder="+ 加入你的想法（可选）"
        className="bg-white/[0.04] border border-white/[0.06] text-[12px] text-gray-400 placeholder-gray-700 rounded-lg px-3 py-2 outline-none focus:border-white/15"
      />
    </>
  ) : (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <span className="text-[11px] text-gray-500 font-medium uppercase tracking-wide">提示词</span>
        <button
          onClick={handleOptimizePrompt}
          disabled={optimizing || !data.shotDescription}
          className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-violet-600/60 hover:bg-violet-600/80 disabled:opacity-40 text-[11px] text-white transition-colors"
        >
          {optimizing ? <Loader2 size={10} className="animate-spin" /> : <span>✨</span>}
          {optimizing ? '优化中…' : 'AI优化'}
        </button>
      </div>
      <textarea
        value={prompt}
        onChange={e => setPrompt(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleGenerate(); } }}
        placeholder="描述任何你想生成的内容"
        className="flex-1 bg-transparent border-none text-[16px] text-gray-200 placeholder-gray-600 focus:outline-none resize-none min-h-[80px] py-1 leading-relaxed"
      />
    </div>
  )}
</div>

{/* 2. 参考图区域（保持原有逻辑） */}
<div className="flex items-center gap-2 flex-wrap">
  {allRefImages.map((img, i) => {
    const isEdgeConnected = data.referenceImage && i === 0;
    const uploadedIndex = data.referenceImage ? i - 1 : i;
    return (
      <div key={i} className="relative w-14 h-14 rounded-xl overflow-hidden border border-white/10 group flex-shrink-0">
        <img src={img} alt="参考图" className="w-full h-full object-cover" />
        {isEdgeConnected && (
          <div className="absolute bottom-0 left-0 right-0 text-center text-[9px] text-white/50 bg-black/40 py-0.5">链接</div>
        )}
        {!isEdgeConnected && (
          <button
            onClick={() => removeUploadedRef(uploadedIndex)}
            className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity"
          >
            <X size={16} className="text-white" />
          </button>
        )}
      </div>
    );
  })}
  {allRefImages.length < 4 && (
    <button
      onClick={() => refImageInputRef.current?.click()}
      className="w-14 h-14 rounded-xl border-2 border-dashed border-white/15 hover:border-white/35 flex items-center justify-center text-gray-600 hover:text-gray-400 transition-colors flex-shrink-0"
    >
      <Plus size={20} />
    </button>
  )}
  <input type="file" ref={refImageInputRef} className="hidden" accept="image/*" multiple onChange={handleRefImageUpload} />
</div>

{/* 3. 镜头描述（保持不变） */}
{data.shotDescription && (
  <div className="bg-white/5 rounded-xl px-4 py-3">
    <p className="text-[11px] text-gray-500 mb-1 font-medium uppercase tracking-wide">镜头描述</p>
    <p className="text-[13px] text-gray-300 leading-relaxed select-text cursor-text" onMouseDown={e => e.stopPropagation()}>
      {data.shotDescription}
    </p>
  </div>
)}

{/* 4. 画风选择（保持不变） */}
<div className="flex flex-wrap gap-1.5 items-center" onMouseDown={e => e.stopPropagation()}>
  {STYLE_PRESETS.map(style => (
    <button
      key={style}
      onClick={() => { const newStyle = selectedStyle === style ? '' : style; setSelectedStyle(newStyle); setCustomStyle(''); data.onUpdate?.(id, { style: newStyle }); }}
      className={`px-2 py-0.5 rounded-full text-[11px] border transition-colors ${
        selectedStyle === style ? 'bg-violet-600/80 border-violet-500 text-white' : 'bg-white/5 border-white/10 text-white/50 hover:text-white/80'
      }`}
    >{style}</button>
  ))}
  <input
    value={customStyle}
    onChange={e => { setCustomStyle(e.target.value); setSelectedStyle(''); data.onUpdate?.(id, { style: e.target.value }); }}
    placeholder="自定义画风"
    className="flex-1 min-w-[80px] bg-white/5 border border-white/10 rounded-full px-3 py-0.5 text-[11px] text-white/70 placeholder-white/25 outline-none focus:border-white/30"
  />
</div>

{genError && <p className="text-red-400 text-[12px]">{genError}</p>}

{/* 5. 底部控制栏（保持原有结构） */}
<div className="flex items-center justify-between mt-2">
  <div className="flex items-center gap-3 relative">
    <span className="text-[13px] text-gray-400 font-medium">SeeDream 4.5</span>
    <div className="w-[1px] h-3.5 bg-white/10" />
    <div className="relative">
      <button
        onClick={() => setIsRatioOpen(!isRatioOpen)}
        className="flex items-center gap-2 text-[13px] text-gray-300 hover:text-white transition-colors group px-2 py-1 rounded-lg hover:bg-white/5"
      >
        <div className="w-3.5 h-3.5 border border-gray-500 rounded-sm group-hover:border-blue-400" />
        <span>{ratio} · {quality}</span>
        <ChevronDown size={12} className={`text-gray-600 transition-transform ${isRatioOpen ? 'rotate-180' : ''}`} />
      </button>
      {isRatioOpen && (
        <div className="absolute bottom-full left-0 mb-2 w-48 bg-[#0a0a0a] border border-white/10 rounded-xl shadow-2xl overflow-hidden z-50">
          <div className="px-4 py-2 text-[11px] text-gray-500 uppercase font-mono border-b border-white/5">比例</div>
          {(['1:1', '4:3', '3:4', '16:9', '9:16', '3:2', '2:3', '21:9'] as const).map(r => (
            <button key={r} onClick={() => { setRatio(r); const size = RATIO_SIZES[r] ?? { w: 380, h: 214 }; data.onUpdate?.(id, { ratio: r, _width: size.w, _height: size.h }); }}
              className={`w-full px-4 py-2 text-left text-[13px] transition-colors flex items-center justify-between ${ratio === r ? 'text-white bg-white/10' : 'text-gray-300 hover:bg-white/10'}`}
            >{r}{ratio === r && <span className="text-white/40 text-[10px]">✓</span>}</button>
          ))}
          <div className="px-4 py-2 text-[11px] text-gray-500 uppercase font-mono border-y border-white/5">画质</div>
          {(['1K', '2K'] as const).map(q => (
            <button key={q} onClick={() => setQuality(q)}
              className={`w-full px-4 py-2 text-left text-[13px] transition-colors flex items-center justify-between ${quality === q ? 'text-white bg-white/10' : 'text-gray-300 hover:bg-white/10'}`}
            >{q}{quality === q && <span className="text-white/40 text-[10px]">✓</span>}</button>
          ))}
        </div>
      )}
    </div>
  </div>
  <div className="flex items-center gap-3">
    {currentContent && (
      <button onClick={handleDownload} className="p-2 text-gray-400 hover:text-white transition-colors" title="下载图片">
        <Download size={20} />
      </button>
    )}
    <div className="relative">
      <button onClick={() => setIsCountOpen(!isCountOpen)}
        className="flex items-center gap-1 px-3 py-1.5 bg-white/5 hover:bg-white/10 text-gray-300 rounded-xl text-[13px] font-medium transition-colors border border-white/5"
      >{generateCount}x</button>
      {isCountOpen && (
        <div className="absolute bottom-full right-0 mb-2 bg-[#1a1a1a] border border-white/10 rounded-xl shadow-2xl overflow-hidden z-50 flex flex-col">
          {[4, 3, 2, 1].map(num => (
            <button key={num} onClick={() => { setGenerateCount(num); setIsCountOpen(false); }}
              className={`px-4 py-2 text-center text-[13px] transition-colors ${generateCount === num ? 'text-white bg-white/10' : 'text-gray-400 hover:bg-white/5 hover:text-gray-200'}`}
            >{num}x</button>
          ))}
        </div>
      )}
    </div>
    <button
      onClick={handleGenerate}
      disabled={isGenerating || !prompt}
      className="p-2 bg-white text-black rounded-full hover:bg-gray-200 transition-all active:scale-95 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {isGenerating ? <Loader2 size={20} className="animate-spin" /> : <ArrowUp size={20} strokeWidth={3} />}
    </button>
  </div>
</div>
```

- [ ] **Step 4: 验证编译无报错**

```bash
npm run lint
```

- [ ] **Step 5: Commit**

```bash
git add src/components/ImageNode.tsx
git commit -m "feat(ui): ImageNode 面板接入模板选择和 AI 融合提示词"
```

---

## Task 8: VideoNode 面板改版

**Files:**
- Modify: `src/components/VideoNode.tsx`

- [ ] **Step 1: 新增模板相关状态和 hook**

在 `VideoNode` 组件的现有 state 之后添加：

```typescript
const [templates, setTemplates] = useState<Array<{ id: string; name: string; promptPreset: string; cameraParams: string | null; durationHint: number | null }>>([]);
const [selectedTplId, setSelectedTplId] = useState<string | null>(null);
const [mergedPrompt, setMergedPrompt] = useState('');
const [userExtra, setUserExtra] = useState('');
const [merging, setMerging] = useState(false);

useEffect(() => {
  if (!showPanel) return;
  fetch('/api/templates?nodeType=video')
    .then(r => r.json())
    .then((list: Array<{ id: string; name: string; promptPreset: string; cameraParams: string | null; durationHint: number | null }>) => setTemplates(list))
    .catch(() => {});
}, [showPanel]);
```

- [ ] **Step 2: 新增 mergePrompt 函数**

在 `handleGenerate` 函数之前添加：

```typescript
const mergeVideoPrompt = async (tplId: string, extra: string) => {
  const tpl = templates.find(t => t.id === tplId);
  if (!tpl) return;
  setMerging(true);
  try {
    const resp = await fetch('/api/templates/merge-prompt', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        templatePrompt: tpl.promptPreset,
        userInput: extra,
        nodeType: 'video',
      }),
    });
    if (resp.ok) {
      const { mergedPrompt: mp } = await resp.json() as { mergedPrompt: string };
      setMergedPrompt(mp);
      setPrompt(mp);
      // 若模板有建议时长，自动切换
      if (tpl.durationHint) setDuration(tpl.durationHint);
    }
  } finally {
    setMerging(false);
  }
};
```

- [ ] **Step 3: 在面板中插入模板选择条和融合提示词区域**

在 `showPanel` 块内，找到「Tab 切换」div（`mode-tab` 区域）之后，「提示词 textarea」之前，插入：

```tsx
{/* 模板选择条 */}
{templates.length > 0 && (
  <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
    <span className="text-[10px] text-gray-600 flex-shrink-0">模板</span>
    <button
      onClick={() => { setSelectedTplId(null); setMergedPrompt(''); }}
      className={`px-2.5 py-1 rounded-full text-[11px] flex-shrink-0 border transition-colors ${
        !selectedTplId ? 'bg-white/8 text-gray-300 border-white/15' : 'text-gray-600 border-white/8 hover:text-gray-400'
      }`}
    >全部</button>
    {templates.map(t => (
      <button
        key={t.id}
        onClick={() => { setSelectedTplId(t.id); mergeVideoPrompt(t.id, userExtra); }}
        className={`px-2.5 py-1 rounded-full text-[11px] flex-shrink-0 border transition-colors whitespace-nowrap ${
          selectedTplId === t.id
            ? 'bg-orange-500/20 text-orange-300 border-orange-500/40'
            : 'text-gray-500 border-white/8 hover:text-gray-300'
        }`}
      >
        {selectedTplId === t.id && merging ? '✦ 融合中…' : `✦ ${t.name}`}
      </button>
    ))}
  </div>
)}

{/* 选中模板时显示推荐运镜 */}
{selectedTplId && (() => {
  const tpl = templates.find(t => t.id === selectedTplId);
  return tpl?.cameraParams ? (
    <div
      className="text-[11px] text-violet-300 bg-violet-500/10 border border-violet-500/25 rounded-lg px-3 py-1.5 cursor-pointer hover:bg-violet-500/15 transition-colors"
      onClick={() => setPrompt(prev => prev ? `${prev}，${tpl.cameraParams}` : tpl.cameraParams!)}
    >
      推荐运镜: {tpl.cameraParams} · 点击加入
    </div>
  ) : null;
})()}
```

将原有的提示词 `textarea` 替换为：

```tsx
{/* 提示词区域 */}
{selectedTplId ? (
  <>
    <div className="bg-[#1a1a24] border border-orange-500/20 rounded-xl px-3 py-2.5">
      <div className="text-[10px] text-orange-400 mb-1.5">✦ AI 融合提示词</div>
      <textarea
        value={mergedPrompt}
        onChange={e => { setMergedPrompt(e.target.value); setPrompt(e.target.value); }}
        className="w-full bg-transparent text-[13px] text-orange-100 leading-relaxed resize-none outline-none min-h-[50px]"
        placeholder="AI 融合中…"
      />
    </div>
    <input
      value={userExtra}
      onChange={e => setUserExtra(e.target.value)}
      onBlur={() => { if (selectedTplId) mergeVideoPrompt(selectedTplId, userExtra); }}
      placeholder="+ 加入你的想法（可选）"
      className="w-full bg-white/[0.04] border border-white/[0.06] text-[12px] text-gray-400 placeholder-gray-700 rounded-lg px-3 py-2 outline-none focus:border-white/15"
    />
  </>
) : (
  <textarea
    value={prompt}
    onChange={e => setPrompt(e.target.value)}
    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleGenerate(); } }}
    placeholder="描述您的修改或生成需求..."
    className="w-full bg-transparent border-none text-[16px] text-gray-200 placeholder-gray-600 focus:outline-none resize-none min-h-[60px] py-1 leading-relaxed"
  />
)}
```

- [ ] **Step 4: 验证编译无报错**

```bash
npm run lint
```

- [ ] **Step 5: Commit**

```bash
git add src/components/VideoNode.tsx
git commit -m "feat(ui): VideoNode 面板接入模板选择和 AI 融合提示词"
```

---

## Task 9: 端到端验证

- [ ] **Step 1: 启动前后端**

```bash
npm run dev:all
```

- [ ] **Step 2: 验证模板库 Tab**

1. 打开 http://localhost:3000，点击底部「模板库」Tab
2. 点击「+ 新建模板」，填写名称「测试图片模板」、题材「古风武侠」、节点类型「图片」、提示词预设「古风山水，晨雾缭绕」，点击保存
3. 确认卡片出现在网格中
4. 点击「编辑」修改名称，保存后确认更新
5. 切换到「视频模板」Tab，新建一个视频模板（含运镜参数「缓慢推进」、时长「5」）

- [ ] **Step 3: 验证 ImageNode 模板融合**

1. 切换到「无限画布」Tab
2. 右键创建一个图片节点，单击选中
3. 面板出现后，确认顶部有模板选择条（显示刚才创建的「测试图片模板」）
4. 点击该模板，等待约 2 秒，确认「AI 融合提示词」区域出现内容
5. 在「加入你的想法」输入框中填写「加入一名骑马的侠客」，失焦后确认提示词重新融合更新

- [ ] **Step 4: 验证 VideoNode 模板融合**

1. 右键创建一个视频节点，单击选中
2. 面板出现后，选择视频模板，确认融合提示词出现
3. 确认「推荐运镜: 缓慢推进 · 点击加入」标签出现，点击后确认追加到提示词

- [ ] **Step 5: 最终 Commit**

```bash
git add -A
git commit -m "feat: 模板库完整功能验证通过"
```
