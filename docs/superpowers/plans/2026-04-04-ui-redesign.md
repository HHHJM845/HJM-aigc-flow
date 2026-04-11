# UI 全局重设计实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将项目 UI 迁移至 Obsidian Atelier 设计系统，先建全局 token 基础，再重构底部导航栏和剧本拆解页面。

**Architecture:** Tailwind v4（@theme CSS 指令注入 token）+ Google Fonts（Manrope / Inter / Material Symbols）。先注入全局样式基础，再逐组件重写，保留所有业务逻辑不变。

**Tech Stack:** React 19, TypeScript, Tailwind CSS v4 (@tailwindcss/vite), @dnd-kit, lucide-react

---

## 文件变更清单

| 操作 | 文件 | 说明 |
|------|------|------|
| Modify | `index.html` | 引入 Google Fonts + Material Symbols |
| Modify | `src/index.css` | `@theme` 注入设计 token + 全局工具类 |
| Modify | `src/components/BottomTabBar.tsx` | 重写为浮动胶囊图标导航 |
| Modify | `src/components/BreakdownView.tsx` | 重写为三栏布局（保留全部逻辑） |

---

## Task 1：引入字体和图标库

**Files:**
- Modify: `index.html`

- [ ] **Step 1: 在 `<head>` 中添加 Google Fonts 和 Material Symbols 链接**

打开 `index.html`，将 `<head>` 内容替换为：

```html
<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>JM AIGC STUDIO</title>
    <link
      href="https://fonts.googleapis.com/css2?family=Manrope:wght@200;400;600;800&family=Inter:wght@300;400;600&family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&display=swap"
      rel="stylesheet"
    />
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 2: 在浏览器中验证字体加载**

启动开发服务器（`npm run dev`），打开 `http://localhost:3000`，打开 DevTools → Network → 筛选 `fonts.googleapis.com`，确认请求成功（状态 200）。

- [ ] **Step 3: Commit**

```bash
git add index.html
git commit -m "feat: add Manrope, Inter, Material Symbols fonts"
```

---

## Task 2：注入全局设计 Token

**Files:**
- Modify: `src/index.css`

- [ ] **Step 1: 将 `@theme` 块和工具类追加到 `src/index.css`**

在文件现有内容**末尾**追加以下内容（不删除现有内容）：

```css
/* ── Obsidian Atelier Design Tokens ── */
@theme {
  /* 背景 / 表面层级 */
  --color-background: #0e0e0e;
  --color-surface: #0e0e0e;
  --color-surface-dim: #0e0e0e;
  --color-surface-bright: #2c2c2c;
  --color-surface-container-lowest: #000000;
  --color-surface-container-low: #131313;
  --color-surface-container: #191a1a;
  --color-surface-container-high: #1f2020;
  --color-surface-container-highest: #252626;
  --color-surface-variant: #252626;
  --color-surface-tint: #c6c6c7;

  /* 文字 */
  --color-on-background: #e7e5e4;
  --color-on-surface: #e7e5e4;
  --color-on-surface-variant: #acabaa;

  /* Primary */
  --color-primary: #c6c6c7;
  --color-primary-dim: #b8b9b9;
  --color-primary-fixed: #e2e2e2;
  --color-primary-fixed-dim: #d4d4d4;
  --color-on-primary: #3f4041;
  --color-on-primary-fixed: #3e4040;
  --color-on-primary-fixed-variant: #5a5c5c;
  --color-primary-container: #454747;
  --color-on-primary-container: #d0d0d0;
  --color-inverse-primary: #5e5f60;

  /* Secondary */
  --color-secondary: #9f9d9d;
  --color-secondary-dim: #9f9d9d;
  --color-secondary-fixed: #e4e2e1;
  --color-secondary-fixed-dim: #d6d4d3;
  --color-on-secondary: #202020;
  --color-on-secondary-fixed: #3f3f3f;
  --color-on-secondary-fixed-variant: #5c5b5b;
  --color-secondary-container: #3b3b3b;
  --color-on-secondary-container: #c1bfbe;

  /* Tertiary（最亮白色调） */
  --color-tertiary: #fbf9f8;
  --color-tertiary-dim: #edeaea;
  --color-tertiary-fixed: #f5f3f3;
  --color-tertiary-fixed-dim: #e7e5e4;
  --color-on-tertiary: #5f5f5f;
  --color-on-tertiary-fixed: #4a4949;
  --color-on-tertiary-fixed-variant: #666666;
  --color-tertiary-container: #edeaea;
  --color-on-tertiary-container: #575757;

  /* 边框 */
  --color-outline: #767575;
  --color-outline-variant: #484848;

  /* 错误 */
  --color-error: #ee7d77;
  --color-error-dim: #bb5551;
  --color-error-container: #7f2927;
  --color-on-error: #490106;
  --color-on-error-container: #ff9993;

  /* 反转 */
  --color-inverse-surface: #fcf9f8;
  --color-inverse-on-surface: #565555;

  /* 字体 */
  --font-headline: "Manrope", sans-serif;
  --font-body: "Manrope", sans-serif;
  --font-label: "Inter", sans-serif;

  /* 圆角 */
  --radius: 1rem;
  --radius-lg: 2rem;
  --radius-xl: 3rem;
  --radius-full: 9999px;
}

/* ── Material Symbols 基础配置 ── */
.material-symbols-outlined {
  font-variation-settings: 'FILL' 0, 'wght' 300, 'GRAD' 0, 'opsz' 24;
  font-size: 20px;
  line-height: 1;
  vertical-align: middle;
  display: inline-block;
}

/* ── 自定义滚动条 ── */
.custom-scrollbar::-webkit-scrollbar {
  width: 4px;
}
.custom-scrollbar::-webkit-scrollbar-track {
  background: #0e0e0e;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
  background: #484848;
  border-radius: 10px;
}

/* ── 发光按钮 ── */
.glow-button {
  box-shadow: 0 0 15px rgba(198, 198, 199, 0.2);
}

/* ── 分镜列表激活行 ── */
.active-row {
  background: linear-gradient(90deg, rgba(198, 198, 199, 0.05) 0%, rgba(198, 198, 199, 0) 100%);
  border-left: 2px solid #c6c6c7;
}
```

- [ ] **Step 2: 验证 token 可用**

在浏览器 DevTools Console 中输入：
```js
getComputedStyle(document.documentElement).getPropertyValue('--color-primary').trim()
```
预期输出：`#c6c6c7`

- [ ] **Step 3: Commit**

```bash
git add src/index.css
git commit -m "feat: inject Obsidian Atelier design tokens via @theme"
```

---

## Task 3：重写底部导航栏

**Files:**
- Modify: `src/components/BottomTabBar.tsx`

保留 `ActiveView` 类型和 `Props` 接口不变（其他组件依赖这些类型），仅替换渲染层。

- [ ] **Step 1: 替换 `BottomTabBar.tsx` 全文**

```tsx
// src/components/BottomTabBar.tsx
import React from 'react';

export type ActiveView = 'topic' | 'canvas' | 'assets' | 'storyboard' | 'breakdown' | 'video' | 'subtitle';

interface Props {
  activeView: ActiveView;
  onViewChange: (view: ActiveView) => void;
  onGoHome: () => void;
}

interface TabItem {
  key: ActiveView;
  icon: string;
  label: string;
}

const TABS: TabItem[] = [
  { key: 'topic',      icon: 'lightbulb',     label: '选题' },
  { key: 'assets',     icon: 'inventory_2',   label: '资产管理' },
  { key: 'breakdown',  icon: 'description',   label: '剧本拆解' },
  { key: 'canvas',     icon: 'architecture',  label: '无限画布' },
  { key: 'storyboard', icon: 'movie_edit',    label: '分镜管理' },
  { key: 'video',      icon: 'video_library', label: '视频管理' },
  { key: 'subtitle',   icon: 'subtitles',     label: '字幕编辑' },
];

export default function BottomTabBar({ activeView, onViewChange, onGoHome }: Props) {
  return (
    <nav
      className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-4 py-3 rounded-full border border-white/10 shadow-2xl"
      style={{ background: 'rgba(26,26,26,0.90)', backdropFilter: 'blur(24px)' }}
    >
      {/* 首页 */}
      <button
        onClick={onGoHome}
        title="返回首页"
        className="w-12 h-12 flex items-center justify-center rounded-full text-[#9f9d9d] hover:text-[#fbf9f8] hover:bg-white/5 transition-all"
      >
        <span className="material-symbols-outlined">home</span>
      </button>

      {/* Tab 项 */}
      {TABS.map(({ key, icon, label }) => {
        const isActive = activeView === key;
        return (
          <button
            key={key}
            onClick={() => onViewChange(key)}
            title={label}
            className={`w-12 h-12 flex items-center justify-center rounded-full transition-all ${
              isActive
                ? 'bg-[#c6c6c7] text-[#1a1a1a] shadow-lg scale-110'
                : 'text-[#9f9d9d] hover:text-[#fbf9f8] hover:bg-white/5'
            }`}
          >
            <span
              className="material-symbols-outlined"
              style={isActive ? { fontVariationSettings: "'FILL' 1" } : undefined}
            >
              {icon}
            </span>
          </button>
        );
      })}
    </nav>
  );
}
```

- [ ] **Step 2: 验证导航栏渲染**

在浏览器中打开任意项目页面，底部应出现浮动胶囊导航栏：
- 8 个圆形图标按钮（首页 + 7 个 tab）
- 当前激活 tab 显示亮色填充背景 + 图标 FILL=1
- 悬停其他 tab 时文字变亮
- 点击各图标可正常切换视图

- [ ] **Step 3: Commit**

```bash
git add src/components/BottomTabBar.tsx
git commit -m "feat: redesign BottomTabBar as floating capsule icon nav"
```

---

## Task 4：重写剧本拆解页面（三栏布局）

**Files:**
- Modify: `src/components/BreakdownView.tsx`

**保留的业务逻辑（不改）：**
- `SortableRow` 组件（拖拽排序）
- 所有 state 变量和 handler 函数
- diff 检测和局部重拆逻辑
- `ScriptOptimizeModal` 集成
- `Props` 接口（`initialRows`, `onImport`, `externalInitText`）

**新增的 UI 元素：**
- 右侧属性面板（纯视觉，画面比例 / 镜头模组 / 视觉提示词 / 核心模型）
- 属性面板中的"导入画布并生成节点"按钮（复用现有 `onImport` 逻辑）

- [ ] **Step 1: 替换 `BreakdownView.tsx` 全文**

```tsx
// src/components/BreakdownView.tsx
import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  DndContext, closestCenter, PointerSensor, useSensor, useSensors, DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext, verticalListSortingStrategy, useSortable, arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Loader2, Sparkles, Plus, X, GripVertical, Wand2 } from 'lucide-react';
import { breakdownScript, type StoryboardRow } from '../lib/api';
import { splitParagraphs, diffParagraphs, mergeRows } from '../lib/diff';
import ScriptOptimizeModal from './ScriptOptimizeModal';

// ── 比例选项 ─────────────────────────────────────────
const CARD_RATIOS = [
  { label: '16:9', ratio: '16:9', w: 380, h: 214 },
  { label: '4:3',  ratio: '4:3',  w: 380, h: 285 },
  { label: '1:1',  ratio: '1:1',  w: 380, h: 380 },
  { label: '3:4',  ratio: '3:4',  w: 380, h: 507 },
  { label: '9:16', ratio: '9:16', w: 380, h: 676 },
  { label: '3:2',  ratio: '3:2',  w: 380, h: 253 },
  { label: '2:3',  ratio: '2:3',  w: 380, h: 570 },
  { label: '21:9', ratio: '21:9', w: 380, h: 163 },
];

const LENS_OPTIONS = [
  'Anamorphic 35mm f/1.4',
  'Standard Prime 50mm',
  'Telephoto 85mm f/1.8',
  'Wide Angle 24mm f/2.8',
];

// ── SortableRow ───────────────────────────────────────
function SortableRow({
  row, onUpdate, onDelete, isNew,
}: {
  row: StoryboardRow;
  onUpdate: (id: string, field: keyof StoryboardRow, value: string) => void;
  onDelete: (id: string) => void;
  isNew: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: row.id });
  const style: React.CSSProperties = { transform: CSS.Transform.toString(transform), transition };

  return (
    <tr
      ref={setNodeRef}
      style={style}
      className={`border-b border-[#484848]/10 hover:bg-[#131313] transition-colors group cursor-pointer font-label ${
        isNew ? 'active-row' : ''
      }`}
    >
      {/* ID */}
      <td className="py-4 px-6 text-[#acabaa] font-light text-sm">
        <div className="flex items-center gap-2">
          <button
            {...attributes}
            {...listeners}
            className="text-[#484848] hover:text-[#acabaa] cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <GripVertical size={13} />
          </button>
          <span>{String(row.index).padStart(2, '0')}</span>
        </div>
      </td>
      {/* 景别 */}
      <td className="py-4 px-2">
        <input
          value={row.shotType}
          onChange={e => onUpdate(row.id, 'shotType', e.target.value)}
          className="px-2 py-0.5 rounded-sm bg-[#252626] text-[10px] text-[#e7e5e4] focus:outline-none w-16"
          placeholder="景别"
        />
      </td>
      {/* 描述 */}
      <td className="py-4 px-6">
        <textarea
          value={row.description}
          onChange={e => onUpdate(row.id, 'description', e.target.value)}
          className="w-full bg-transparent text-[#e7e5e4] text-sm focus:outline-none resize-none leading-relaxed"
          rows={2}
        />
      </td>
      {/* 时长占位 + 删除 */}
      <td className="py-4 px-4 text-right">
        <button
          onClick={() => onDelete(row.id)}
          className="text-[#484848] hover:text-[#ee7d77] transition-colors opacity-0 group-hover:opacity-100"
        >
          <X size={12} />
        </button>
      </td>
    </tr>
  );
}

// ── Props ─────────────────────────────────────────────
interface Props {
  initialRows?: StoryboardRow[];
  onImport: (rows: StoryboardRow[], ratio: string, cardW: number, cardH: number) => void;
  externalInitText?: string;
}

// ── Main Component ────────────────────────────────────
export default function BreakdownView({ initialRows, onImport, externalInitText }: Props) {
  const [scriptText, setScriptText] = useState('');
  const [committedScript, setCommittedScript] = useState('');
  const [rows, setRows] = useState<StoryboardRow[]>(initialRows ?? []);
  const [isBreaking, setIsBreaking] = useState(false);
  const [error, setError] = useState('');
  const [changedSegments, setChangedSegments] = useState<string[]>([]);
  const [newlyUpdatedIds, setNewlyUpdatedIds] = useState<Set<string>>(new Set());
  const [cardRatio, setCardRatio] = useState('16:9');
  const [showOptimizeModal, setShowOptimizeModal] = useState(false);
  // 右侧面板状态
  const [selectedLens, setSelectedLens] = useState(LENS_OPTIONS[0]);
  const [promptText, setPromptText] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  useEffect(() => {
    if (externalInitText) setScriptText(externalInitText);
  }, [externalInitText]);

  useEffect(() => {
    if (!committedScript || rows.length === 0) { setChangedSegments([]); return; }
    const { changed } = diffParagraphs(splitParagraphs(committedScript), splitParagraphs(scriptText));
    setChangedSegments(changed);
  }, [scriptText, committedScript, rows.length]);

  useEffect(() => {
    if (newlyUpdatedIds.size === 0) return;
    const timer = setTimeout(() => setNewlyUpdatedIds(new Set()), 3000);
    return () => clearTimeout(timer);
  }, [newlyUpdatedIds]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => setScriptText((ev.target?.result as string) || '');
    reader.readAsText(file);
  };

  const handleFirstBreakdown = async () => {
    if (!scriptText.trim() || isBreaking) return;
    setIsBreaking(true); setError('');
    try {
      const result = await breakdownScript(scriptText);
      setRows(result); setCommittedScript(scriptText); setChangedSegments([]);
    } catch (err: any) {
      setError(err.message || '拆解失败，请重试');
    } finally { setIsBreaking(false); }
  };

  const handlePartialBreakdown = useCallback(async () => {
    if (changedSegments.length === 0 || isBreaking) return;
    setIsBreaking(true); setError('');
    try {
      const newRows = await breakdownScript(changedSegments.join('\n\n'));
      setRows(prev => {
        const merged = mergeRows(prev, newRows, changedSegments);
        setNewlyUpdatedIds(new Set(newRows.map(r => r.id)));
        return merged;
      });
      setCommittedScript(scriptText); setChangedSegments([]);
    } catch (err: any) {
      setError(err.message || '拆解失败，请重试');
    } finally { setIsBreaking(false); }
  }, [changedSegments, isBreaking, scriptText]);

  const handleUpdateRow = (id: string, field: keyof StoryboardRow, value: string) =>
    setRows(prev => prev.map(r => r.id === id ? { ...r, [field]: value } : r));

  const handleDeleteRow = (id: string) =>
    setRows(prev => prev.filter(r => r.id !== id).map((r, i) => ({ ...r, index: i + 1 })));

  const handleAddRow = () =>
    setRows(prev => [...prev, { id: `row-${Date.now()}`, index: prev.length + 1, shotType: '', description: '', sourceSegment: '' }]);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setRows(prev => {
      const oldIndex = prev.findIndex(r => r.id === active.id);
      const newIndex = prev.findIndex(r => r.id === over.id);
      return arrayMove(prev, oldIndex, newIndex).map((r, i) => ({ ...r, index: i + 1 }));
    });
  };

  const handleImport = () => {
    const r = CARD_RATIOS.find(c => c.ratio === cardRatio) ?? CARD_RATIOS[0];
    onImport(rows, r.ratio, r.w, r.h);
  };

  const hasDiff = changedSegments.length > 0 && scriptText !== committedScript;
  const isFirstBreakdown = rows.length === 0;

  return (
    <div className="w-full h-full flex bg-[#0e0e0e] overflow-hidden font-body">

      {/* ══ 左栏：脚本正文 30% ══ */}
      <section className="w-[30%] h-full bg-[#131313] flex flex-col border-r border-[#484848]/15">
        <div className="p-6 flex flex-col h-full">
          {/* 头部 */}
          <div className="flex justify-between items-center mb-6 flex-shrink-0">
            <h2 className="font-headline font-extrabold text-[#fbf9f8] tracking-tight text-base">脚本正文</h2>
            <div className="flex items-center gap-2">
              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-2 bg-[#252626] px-4 py-2 rounded-full text-xs font-semibold text-[#e7e5e4] hover:bg-[#2c2c2c] transition-all active:scale-95 font-label"
              >
                <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>upload_file</span>
                导入剧本
              </button>
              <input ref={fileInputRef} type="file" accept=".txt,.md" className="hidden" onChange={handleFileUpload} />
            </div>
          </div>

          {/* 操作按钮行 */}
          <div className="flex items-center gap-2 mb-4 flex-shrink-0">
            {isFirstBreakdown && (
              <button
                onClick={handleFirstBreakdown}
                disabled={!scriptText.trim() || isBreaking}
                className="flex items-center gap-1.5 px-4 py-1.5 bg-[#c6c6c7] text-[#1a1a1a] rounded-full text-xs font-semibold hover:bg-[#e2e2e2] transition-all disabled:opacity-40 disabled:cursor-not-allowed glow-button font-label"
              >
                {isBreaking ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
                {isBreaking ? 'AI 拆解中...' : '✨ AI 拆解'}
              </button>
            )}
            <button
              onClick={() => setShowOptimizeModal(true)}
              disabled={!scriptText.trim()}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-[#252626] hover:bg-[#2c2c2c] text-[#acabaa] hover:text-[#fbf9f8] rounded-full text-xs transition-colors border border-[#484848]/30 disabled:opacity-40 font-label"
            >
              <Wand2 size={12} />
              AI 优化
            </button>
          </div>

          {/* Diff 提示 */}
          {hasDiff && !isFirstBreakdown && (
            <div className="flex items-center justify-between px-4 py-2 mb-4 rounded-xl border border-yellow-400/20 bg-yellow-400/5 flex-shrink-0">
              <span className="text-yellow-300/80 text-xs font-label">
                检测到 {changedSegments.length} 处变动
              </span>
              <button
                onClick={handlePartialBreakdown}
                disabled={isBreaking}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-yellow-400 text-black rounded-full text-xs font-semibold hover:bg-yellow-300 transition-all disabled:opacity-40 font-label"
              >
                {isBreaking ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
                {isBreaking ? '拆解中...' : '重新拆解变动部分'}
              </button>
            </div>
          )}

          {error && (
            <p className="text-[#ee7d77] text-xs mb-4 flex-shrink-0 font-label">{error}</p>
          )}

          {/* 脚本内容区 */}
          <div className="flex-1 overflow-y-auto custom-scrollbar min-h-0">
            <textarea
              value={scriptText}
              onChange={e => setScriptText(e.target.value)}
              placeholder="在此粘贴剧本内容..."
              className="w-full h-full min-h-full bg-transparent text-[#e7e5e4] text-sm leading-loose focus:outline-none resize-none font-light"
            />
          </div>
        </div>
      </section>

      {/* ══ 中栏：分镜列表 45% ══ */}
      <section className="w-[45%] h-full bg-[#0e0e0e] flex flex-col">
        {/* 头部 */}
        <div className="px-6 py-4 flex items-center justify-between border-b border-[#484848]/10 flex-shrink-0">
          <div className="flex items-center gap-4">
            <h2 className="font-headline font-bold text-[#fbf9f8] text-base">分镜列表</h2>
            {rows.length > 0 && (
              <span className="text-[10px] px-2 py-0.5 rounded bg-[#252626] text-[#acabaa] font-label uppercase tracking-wide">
                {rows.length} SHOTS
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleAddRow}
              className="w-8 h-8 flex items-center justify-center rounded-full text-[#acabaa] hover:text-[#fbf9f8] hover:bg-[#252626] transition-all"
              title="添加分镜"
            >
              <Plus size={14} />
            </button>
          </div>
        </div>

        {rows.length === 0 ? (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-[#acabaa] text-sm font-label">完成 AI 拆解后，分镜将显示在这里</p>
          </div>
        ) : (
          <div className="flex flex-col flex-1 min-h-0">
            {/* 固定表头 */}
            <table className="w-full table-fixed flex-shrink-0">
              <colgroup>
                <col style={{ width: '80px' }} />
                <col style={{ width: '80px' }} />
                <col />
                <col style={{ width: '48px' }} />
              </colgroup>
              <thead className="sticky top-0 bg-[#0e0e0e] z-10">
                <tr className="border-b border-[#484848]/10 text-[10px] text-[#acabaa] uppercase tracking-widest font-label">
                  <th className="py-4 px-6 font-medium text-left">ID</th>
                  <th className="py-4 px-2 font-medium text-left">景别</th>
                  <th className="py-4 px-6 font-medium text-left">分镜内容描述</th>
                  <th className="py-4 px-4 font-medium text-right">操作</th>
                </tr>
              </thead>
            </table>

            {/* 可滚动列表 */}
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <div className="overflow-y-auto flex-1 custom-scrollbar">
                <table className="w-full table-fixed">
                  <colgroup>
                    <col style={{ width: '80px' }} />
                    <col style={{ width: '80px' }} />
                    <col />
                    <col style={{ width: '48px' }} />
                  </colgroup>
                  <SortableContext items={rows.map(r => r.id)} strategy={verticalListSortingStrategy}>
                    <tbody>
                      {rows.map(row => (
                        <SortableRow
                          key={row.id}
                          row={row}
                          onUpdate={handleUpdateRow}
                          onDelete={handleDeleteRow}
                          isNew={newlyUpdatedIds.has(row.id)}
                        />
                      ))}
                    </tbody>
                  </SortableContext>
                </table>
              </div>
            </DndContext>
          </div>
        )}
      </section>

      {/* ══ 右栏：属性调整 25% ══ */}
      <section className="w-[25%] h-full bg-[#191a1a] flex flex-col border-l border-[#484848]/15">
        <div className="p-6 flex flex-col h-full overflow-y-auto custom-scrollbar pb-32">
          <h2 className="font-headline font-bold text-[#fbf9f8] mb-8 text-base">属性调整</h2>

          {/* 画面比例 */}
          <div className="mb-8">
            <label className="text-[10px] text-[#acabaa] uppercase tracking-widest block mb-3 font-label">画面比例</label>
            <div className="grid grid-cols-2 gap-3">
              {['16:9', '9:16'].map(ratio => (
                <button
                  key={ratio}
                  onClick={() => setCardRatio(ratio)}
                  className={`rounded-xl p-4 flex flex-col items-center justify-center transition-all border ${
                    cardRatio === ratio
                      ? 'bg-[#252626] border-[#c6c6c7]/20'
                      : 'bg-[#0e0e0e] border-[#484848]/30 hover:bg-[#252626]'
                  }`}
                >
                  <div
                    className={`border rounded-sm mb-2 ${cardRatio === ratio ? 'border-[#c6c6c7]/40' : 'border-[#484848]/40'}`}
                    style={ratio === '16:9' ? { width: '28px', height: '16px' } : { width: '12px', height: '20px' }}
                  />
                  <span className={`text-xs font-semibold font-label ${cardRatio === ratio ? 'text-[#e7e5e4]' : 'text-[#acabaa]'}`}>
                    {ratio}
                  </span>
                </button>
              ))}
            </div>
            {/* 其他比例（下拉补充） */}
            <select
              value={cardRatio}
              onChange={e => setCardRatio(e.target.value)}
              className="mt-3 w-full bg-[#0e0e0e] border border-[#484848]/30 rounded-xl px-4 py-2.5 text-sm text-[#e7e5e4] focus:ring-1 focus:ring-[#c6c6c7]/40 outline-none font-label appearance-none"
            >
              {CARD_RATIOS.map(({ label, ratio }) => (
                <option key={ratio} value={ratio}>{label}</option>
              ))}
            </select>
          </div>

          {/* 镜头模组 */}
          <div className="mb-8">
            <label className="text-[10px] text-[#acabaa] uppercase tracking-widest block mb-3 font-label">镜头模组</label>
            <select
              value={selectedLens}
              onChange={e => setSelectedLens(e.target.value)}
              className="w-full bg-[#0e0e0e] border border-[#484848]/30 rounded-xl px-4 py-3 text-sm text-[#e7e5e4] focus:ring-1 focus:ring-[#c6c6c7]/40 outline-none font-label appearance-none"
            >
              {LENS_OPTIONS.map(opt => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
          </div>

          {/* 视觉提示词 */}
          <div className="mb-8">
            <label className="text-[10px] text-[#acabaa] uppercase tracking-widest block mb-3 font-label">视觉提示词</label>
            <textarea
              value={promptText}
              onChange={e => setPromptText(e.target.value)}
              placeholder="描述场景的视觉细节..."
              className="w-full bg-[#0e0e0e] border border-[#484848]/30 rounded-xl px-4 py-3 text-sm text-[#e7e5e4] focus:ring-1 focus:ring-[#c6c6c7]/40 outline-none h-32 resize-none leading-relaxed font-label placeholder-[#484848]"
            />
          </div>

          {/* 核心模型 */}
          <div className="mb-8">
            <label className="text-[10px] text-[#acabaa] uppercase tracking-widest block mb-3 font-label">核心模型</label>
            <div className="flex items-center justify-between p-3 bg-[#252626] rounded-xl">
              <div className="flex items-center gap-3">
                <span className="material-symbols-outlined text-[#c6c6c7]" style={{ fontSize: '18px' }}>auto_awesome</span>
                <span className="text-xs font-medium text-[#e7e5e4] font-label">Visionary-V2 (Pro)</span>
              </div>
              <span className="material-symbols-outlined text-[#c6c6c7]" style={{ fontSize: '16px', fontVariationSettings: "'FILL' 1" }}>check_circle</span>
            </div>
          </div>

          {/* 导入画布按钮 */}
          <div className="mt-auto pt-6">
            <button
              onClick={handleImport}
              disabled={rows.length === 0}
              className="w-full py-4 rounded-xl bg-[#c6c6c7] text-[#1a1a1a] font-bold tracking-tight glow-button flex items-center justify-center gap-2 hover:bg-[#e2e2e2] transition-all active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed font-label"
            >
              <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>auto_fix_high</span>
              导入画布并生成节点
              {rows.length > 0 && (
                <div className="w-2 h-2 rounded-full bg-[#1a1a1a] animate-pulse ml-1" />
              )}
            </button>
          </div>
        </div>
      </section>

      {showOptimizeModal && (
        <ScriptOptimizeModal
          scriptText={scriptText}
          onApply={(optimized) => { setScriptText(optimized); setShowOptimizeModal(false); }}
          onClose={() => setShowOptimizeModal(false)}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 2: 验证布局和功能**

在浏览器中切换到"剧本拆解"tab，逐项确认：

| 检查项 | 预期结果 |
|--------|----------|
| 三栏布局 | 左30% / 中45% / 右25% 正确显示 |
| 导入剧本按钮 | 点击弹出文件选择框 |
| AI 拆解按钮 | 输入文本后按钮可用，点击触发拆解 |
| AI 优化按钮 | 点击弹出 ScriptOptimizeModal |
| 分镜列表 | 拆解后显示表格，可拖拽排序，可删除行 |
| 画面比例 | 点击 16:9 / 9:16 卡片可切换高亮，下拉可选更多比例 |
| 导入画布按钮 | 有分镜数据时可点击，触发 `onImport` 跳转画布 |
| diff 提示栏 | 修改脚本后（有已有分镜时）底部出现黄色提示 |

- [ ] **Step 3: Commit**

```bash
git add src/components/BreakdownView.tsx
git commit -m "feat: redesign BreakdownView as 3-column Obsidian Atelier layout"
```

---

## Self-Review

**Spec coverage 检查：**
- ✅ 全局颜色 token（Task 2）
- ✅ 字体 Manrope + Inter + Material Symbols（Task 1 + 2）
- ✅ 圆角系统（Task 2 @theme）
- ✅ 滚动条 / glow-button / active-row 工具类（Task 2）
- ✅ 底部导航栏浮动胶囊图标设计（Task 3）
- ✅ 图标映射完整（Task 3 TABS 数组）
- ✅ 剧本拆解三栏布局（Task 4）
- ✅ 所有原有功能保留（AI拆解、局部重拆、diff、拖拽、导入画布）
- ✅ 右侧属性面板（画面比例 / 镜头模组 / 提示词 / 模型 / 导入按钮）

**Placeholder 扫描：** 无 TBD/TODO，所有 step 包含完整代码。

**类型一致性：**
- `StoryboardRow` 类型来自 `../lib/api`，Task 4 中未修改，接口保持一致。
- `Props` 接口（`initialRows`, `onImport`, `externalInitText`）未变，上层 `App.tsx` 无需修改。
- `ActiveView` 类型在 Task 3 中保持原有所有值，依赖该类型的组件无需修改。
