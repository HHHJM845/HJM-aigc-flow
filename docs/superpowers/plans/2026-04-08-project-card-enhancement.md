# 项目卡片增强 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在首页项目卡片上新增阶段步骤连线、成员头像、项目类型 badge、自定义标签，并提供新建弹窗和卡片菜单两个编辑入口。

**Architecture:** 扩展 `Project` 数据模型，提取 `ProjectCard` 为独立组件（含所有子弹窗），新建 `NewProjectDialog` 组件，`HomePage` 管理弹窗状态并通过 `onUpdateProject` 回调将变更冒泡到 `App.tsx`。

**Tech Stack:** React 18, TypeScript, Tailwind CSS, localStorage

---

## File Map

| 文件 | 操作 | 职责 |
|---|---|---|
| `src/lib/storage.ts` | 修改 | 新增类型、字段、`inferStage()` |
| `src/components/ProjectCard.tsx` | 新建 | 卡片 UI + 所有子弹窗（阶段/成员/标签） |
| `src/components/NewProjectDialog.tsx` | 新建 | 新建项目弹窗 |
| `src/components/HomePage.tsx` | 修改 | 移除内联 ProjectCard，接入新组件和回调 |
| `src/App.tsx` | 修改 | 扩展 `handleNewProject` 签名，添加 `handleUpdateProject` |

---

## Task 1: 扩展数据模型

**Files:**
- Modify: `src/lib/storage.ts`

- [ ] **Step 1: 在 `storage.ts` 顶部新增类型定义，插入到 `SubtitleEntry` 之前**

```ts
export type ProjectStage = 'script' | 'storyboard' | 'generation' | 'review';
export type ProjectType = '短片' | '广告' | 'MV' | '教程' | '其他';
```

- [ ] **Step 2: 在 `Project` interface 末尾新增四个字段**

```ts
export interface Project {
  // ...已有字段不变...
  topicDraft?: string;
  // 新增：
  stageOverride?: ProjectStage;
  members: string[];
  projectType?: ProjectType;
  tags: string[];
}
```

- [ ] **Step 3: 在 `createProject()` 中初始化新字段**

```ts
export function createProject(name = '未命名项目'): Project {
  return {
    id: `proj_${Date.now()}`,
    name,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    storyboardRows: [],
    nodes: [],
    edges: [],
    assets: [],
    generationHistory: [],
    storyboardOrder: [],
    videoOrder: [],
    subtitles: [],
    members: [],
    tags: [],
  };
}
```

- [ ] **Step 4: 在 `extractThumbnail` 之后新增 `inferStage` 纯函数**

```ts
const STAGE_ORDER: ProjectStage[] = ['script', 'storyboard', 'generation', 'review'];

export function stageIndex(stage: ProjectStage): number {
  return STAGE_ORDER.indexOf(stage);
}

export function inferStage(project: Project): ProjectStage {
  if (project.stageOverride) return project.stageOverride;
  if (project.videoOrder.length > 0) return 'review';
  const hasGeneratedImage = project.nodes.some(
    n => n.type === 'imageNode' && n.data?.content
  );
  if (hasGeneratedImage) return 'generation';
  if (project.storyboardRows.length > 0) return 'storyboard';
  return 'script';
}
```

- [ ] **Step 5: 运行开发服务器，确认现有功能无报错**

```bash
npm run dev
```

浏览器打开首页，确认项目卡片正常显示，无 TypeScript 报错。

- [ ] **Step 6: Commit**

```bash
git add src/lib/storage.ts
git commit -m "feat(storage): 新增 ProjectStage/Type 类型、成员/标签字段和 inferStage 函数"
```

---

## Task 2: 提取 `ProjectCard` 为独立组件

**Files:**
- Create: `src/components/ProjectCard.tsx`
- Modify: `src/components/HomePage.tsx`

- [ ] **Step 1: 新建 `src/components/ProjectCard.tsx`，将 `HomePage.tsx` 中 `ProjectCard` 函数完整复制过来**

```tsx
import React, { useState, useRef, useEffect } from 'react';
import { Trash2, Pencil } from 'lucide-react';
import { type Project } from '../lib/storage';

function timeAgo(ts: number): string {
  const d = Date.now() - ts;
  if (d < 60_000) return '刚刚';
  if (d < 3_600_000) return `${Math.floor(d / 60_000)} 分钟前`;
  if (d < 86_400_000) return `${Math.floor(d / 3_600_000)} 小时前`;
  if (d < 86_400_000 * 2) return '昨日';
  return `${Math.floor(d / 86_400_000)} 天前`;
}

interface ProjectCardProps {
  project: Project;
  onOpen: () => void;
  onDelete: () => void;
  onRename: (name: string) => void;
}

export default function ProjectCard({ project, onOpen, onDelete, onRename }: ProjectCardProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [nameInput, setNameInput] = useState(project.name);
  const inputRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const clickTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const startEditing = () => {
    setNameInput(project.name);
    setEditing(true);
    setTimeout(() => inputRef.current?.select(), 0);
  };

  const handleNameClick = () => {
    if (clickTimer.current) {
      clearTimeout(clickTimer.current);
      clickTimer.current = null;
      startEditing();
    } else {
      clickTimer.current = setTimeout(() => {
        clickTimer.current = null;
        onOpen();
      }, 220);
    }
  };

  const commitEdit = () => {
    const trimmed = nameInput.trim();
    if (trimmed && trimmed !== project.name) onRename(trimmed);
    setEditing(false);
  };

  const cancelEdit = () => { setNameInput(project.name); setEditing(false); };

  useEffect(() => {
    if (!menuOpen) return;
    const handle = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [menuOpen]);

  return (
    <div className="group relative aspect-[4/5] bg-black/40 backdrop-blur-sm rounded-2xl overflow-hidden flex flex-col transition-all duration-500 hover:-translate-y-1.5 hover:shadow-xl hover:shadow-black/60 border border-white/15">
      {/* Thumbnail */}
      <button onClick={onOpen} className="relative h-[62%] w-full bg-black/30 overflow-hidden flex-shrink-0">
        {project.thumbnail ? (
          <img src={project.thumbnail} alt={project.name} className="w-full h-full object-cover opacity-75 group-hover:scale-105 transition-transform duration-700" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <span className="material-symbols-outlined text-white/20 text-5xl">movie_creation</span>
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/10 to-transparent" />
        <div className="absolute bottom-3 left-4 flex items-center gap-1.5">
          <span className="material-symbols-outlined text-white/30 text-[12px]">folder</span>
          <span className="text-[9px] uppercase tracking-[0.18em] text-white/30 font-bold" style={{ fontFamily: 'Inter' }}>
            {project.name.slice(0, 14).replace(/\s+/g, '_').toUpperCase() || 'PROJECT'}
          </span>
        </div>
      </button>

      {/* Info */}
      <div className="p-5 flex flex-col justify-between flex-grow">
        <div>
          {editing ? (
            <input
              ref={inputRef}
              value={nameInput}
              onChange={e => setNameInput(e.target.value)}
              onBlur={commitEdit}
              onKeyDown={e => {
                if (e.key === 'Enter') { e.preventDefault(); commitEdit(); }
                if (e.key === 'Escape') { e.preventDefault(); cancelEdit(); }
              }}
              className="w-full bg-white/10 text-[#fbf9f8] text-sm font-bold rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-white/30"
              onClick={e => e.stopPropagation()}
              style={{ fontFamily: 'Manrope' }}
            />
          ) : (
            <h3
              className="text-[#fbf9f8] font-bold truncate group-hover:text-[#c6c6c7] transition-colors text-base cursor-pointer select-none"
              onClick={handleNameClick}
              style={{ fontFamily: 'Manrope' }}
            >
              {project.name}
            </h3>
          )}
          <p className="text-white/35 text-xs mt-1.5" style={{ fontFamily: 'Inter' }}>
            {timeAgo(project.updatedAt)}编辑
          </p>
        </div>

        <div className="flex justify-between items-center mt-4">
          <div className="w-6 h-6 rounded-full border border-white/20 bg-white/10" />
          <div className="relative" ref={menuRef}>
            <button onClick={e => { e.stopPropagation(); setMenuOpen(v => !v); }} className="opacity-0 group-hover:opacity-100 transition-opacity">
              <span className="material-symbols-outlined text-[#acabaa]/40 hover:text-[#fbf9f8] transition-colors text-[20px]">more_horiz</span>
            </button>
            {menuOpen && (
              <div className="absolute right-0 bottom-8 bg-[#242424] border border-white/10 rounded-xl py-1 shadow-xl z-20 min-w-[110px]">
                <button onClick={() => { setMenuOpen(false); startEditing(); }} className="w-full flex items-center gap-2 px-3 py-1.5 text-[#e7e5e4] hover:bg-white/5 text-xs transition-colors" style={{ fontFamily: 'Inter' }}>
                  <Pencil size={11} /> 重命名
                </button>
                <button onClick={() => { setMenuOpen(false); onDelete(); }} className="w-full flex items-center gap-2 px-3 py-1.5 text-red-400 hover:bg-white/5 text-xs transition-colors" style={{ fontFamily: 'Inter' }}>
                  <Trash2 size={11} /> 删除项目
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: 更新 `src/components/HomePage.tsx`，移除内联 `ProjectCard` 函数，改为 import**

删除 `HomePage.tsx` 中第 25–171 行的 `function ProjectCard(...)` 整个函数块，在文件顶部 import 中添加：

```ts
import ProjectCard from './ProjectCard';
```

同时删除 `timeAgo` 函数（它已移到 `ProjectCard.tsx`）。

- [ ] **Step 3: 运行开发服务器，确认卡片渲染正常**

```bash
npm run dev
```

首页项目卡片外观与之前完全一致，无控制台报错。

- [ ] **Step 4: Commit**

```bash
git add src/components/ProjectCard.tsx src/components/HomePage.tsx
git commit -m "refactor(homepage): 提取 ProjectCard 为独立组件"
```

---

## Task 3: 更新 `ProjectCard` UI（类型 badge、标签、阶段步骤、成员头像）

**Files:**
- Modify: `src/components/ProjectCard.tsx`

- [ ] **Step 1: 更新 `ProjectCardProps` 接口，新增 `onUpdate` 回调**

```ts
import { type Project, type ProjectStage, inferStage, stageIndex } from '../lib/storage';

interface ProjectCardProps {
  project: Project;
  onOpen: () => void;
  onDelete: () => void;
  onRename: (name: string) => void;
  onUpdate: (updates: Partial<Project>) => void;  // 新增
}
```

- [ ] **Step 2: 在组件顶部定义头像色板和阶段配置常量（函数体外）**

```ts
const AVATAR_COLORS = [
  'rgba(160,145,130,0.45)',
  'rgba(145,155,165,0.45)',
  'rgba(130,150,135,0.45)',
  'rgba(155,145,160,0.45)',
  'rgba(150,160,145,0.45)',
];

const STAGES: { key: ProjectStage; label: string }[] = [
  { key: 'script',      label: '剧本' },
  { key: 'storyboard',  label: '分镜' },
  { key: 'generation',  label: '生成' },
  { key: 'review',      label: '审片' },
];
```

- [ ] **Step 3: 在 `ProjectCard` 函数内，render 前计算当前阶段**

```ts
const currentStage = inferStage(project);
const currentStageIdx = stageIndex(currentStage);
```

- [ ] **Step 4: 在缩略图区域左上角加类型 badge（在 `<button onClick={onOpen}>` 内部，紧接 `<div className="absolute inset-0 ...">` 之后添加）**

```tsx
{project.projectType && (
  <div className="absolute top-2 left-2 bg-white/7 border border-white/12 rounded-full px-2 py-0.5 text-[9px] text-white/45 leading-none">
    {project.projectType}
  </div>
)}
```

- [ ] **Step 5: 在项目名和时间下方添加标签 pills（在 `<p className="text-white/35...">` 之后）**

```tsx
<div className="flex flex-wrap gap-1 mt-2 min-h-[14px]">
  {project.tags?.map(tag => (
    <span
      key={tag}
      className="text-[9px] px-1.5 py-0.5 rounded-full bg-white/6 text-white/35 leading-none"
      style={{ fontFamily: 'Inter' }}
    >
      {tag}
    </span>
  ))}
</div>
```

- [ ] **Step 6: 用阶段步骤连线替换底部区域的头像占位（将 `<div className="flex justify-between items-center mt-4">` 整个 div 替换）**

```tsx
<div className="mt-3">
  {/* Stage step dots */}
  <div className="flex items-center mb-3">
    {STAGES.map((s, i) => {
      const done = i <= currentStageIdx;
      return (
        <React.Fragment key={s.key}>
          <div className="flex flex-col items-center gap-0.5">
            <div
              className="w-4 h-4 rounded-full flex items-center justify-center text-[7px] text-white/90 flex-shrink-0"
              style={{ background: done ? 'rgba(200,190,220,0.7)' : 'rgba(255,255,255,0.07)', border: done ? 'none' : '1px solid rgba(255,255,255,0.15)' }}
            >
              {done && '✓'}
            </div>
            <span className="text-[6.5px] leading-none" style={{ color: done ? 'rgba(255,255,255,0.35)' : 'rgba(255,255,255,0.2)', fontFamily: 'Inter' }}>
              {s.label}
            </span>
          </div>
          {i < STAGES.length - 1 && (
            <div className="flex-1 h-px mb-2.5" style={{ background: done && i < currentStageIdx ? 'rgba(200,190,220,0.35)' : 'rgba(255,255,255,0.1)' }} />
          )}
        </React.Fragment>
      );
    })}
  </div>

  {/* Avatars + menu */}
  <div className="flex justify-between items-center">
    <div className="flex">
      {(project.members ?? []).length === 0 ? (
        <div className="w-5 h-5 rounded-full border border-white/15 bg-white/5" />
      ) : (
        <>
          {(project.members ?? []).slice(0, 3).map((m, i) => (
            <div
              key={i}
              className="w-5 h-5 rounded-full flex items-center justify-center text-[7px] font-bold border-[1.5px] border-[#111]"
              style={{ background: AVATAR_COLORS[i % AVATAR_COLORS.length], color: 'rgba(255,255,255,0.65)', marginLeft: i > 0 ? '-5px' : 0, zIndex: 3 - i }}
            >
              {m.slice(0, 1)}
            </div>
          ))}
          {(project.members ?? []).length > 3 && (
            <div className="w-5 h-5 rounded-full flex items-center justify-center text-[7px] font-bold border-[1.5px] border-[#111] bg-white/10 text-white/50" style={{ marginLeft: '-5px' }}>
              +{project.members.length - 3}
            </div>
          )}
        </>
      )}
    </div>

    <div className="relative" ref={menuRef}>
      <button onClick={e => { e.stopPropagation(); setMenuOpen(v => !v); }} className="opacity-0 group-hover:opacity-100 transition-opacity">
        <span className="material-symbols-outlined text-[#acabaa]/40 hover:text-[#fbf9f8] transition-colors text-[20px]">more_horiz</span>
      </button>
      {menuOpen && (
        <div className="absolute right-0 bottom-8 bg-[#242424] border border-white/10 rounded-xl py-1 shadow-xl z-20 min-w-[130px]">
          <button onClick={() => { setMenuOpen(false); startEditing(); }} className="w-full flex items-center gap-2 px-3 py-1.5 text-[#e7e5e4] hover:bg-white/5 text-xs transition-colors" style={{ fontFamily: 'Inter' }}>
            <Pencil size={11} /> 重命名
          </button>
          <button onClick={() => { setMenuOpen(false); onDelete(); }} className="w-full flex items-center gap-2 px-3 py-1.5 text-red-400 hover:bg-white/5 text-xs transition-colors" style={{ fontFamily: 'Inter' }}>
            <Trash2 size={11} /> 删除项目
          </button>
        </div>
      )}
    </div>
  </div>
</div>
```

- [ ] **Step 7: 在 `ProjectCard` 的 export 签名中加入 `onUpdate`（确保 TypeScript 无报错）**

`HomePage.tsx` 中使用 `ProjectCard` 的地方暂时传入空函数 `onUpdate={() => {}}`，后续 Task 8 中再完整接入。

```tsx
<ProjectCard
  key={project.id}
  project={project}
  onOpen={() => onOpenProject(project)}
  onDelete={() => onDeleteProject(project.id)}
  onRename={name => onRenameProject?.(project.id, name)}
  onUpdate={() => {}}   // 临时占位
/>
```

- [ ] **Step 8: 运行开发服务器，验证卡片 UI 正确渲染**

- 有 `members` 的项目显示头像叠排（手动在 localStorage 中给项目加 `"members":["张三","李四"]` 测试）
- 阶段步骤正确高亮（根据项目内容自动推断）
- 类型 badge 在有 `projectType` 时显示
- 标签 pills 在有 `tags` 时显示

- [ ] **Step 9: Commit**

```bash
git add src/components/ProjectCard.tsx src/components/HomePage.tsx
git commit -m "feat(project-card): 新增阶段步骤连线、类型badge、标签、成员头像"
```

---

## Task 4: 卡片菜单 — 调整阶段子菜单

**Files:**
- Modify: `src/components/ProjectCard.tsx`

- [ ] **Step 1: 在 `ProjectCard` 函数内添加 `stageMenuOpen` state**

```ts
const [stageMenuOpen, setStageMenuOpen] = useState(false);
```

- [ ] **Step 2: 在 ··· 菜单内，"重命名"之后、"删除"之前插入"调整阶段"菜单项和子菜单**

替换菜单 `{menuOpen && (...)}` 内的内容：

```tsx
{menuOpen && (
  <div className="absolute right-0 bottom-8 bg-[#242424] border border-white/10 rounded-xl py-1 shadow-xl z-20 min-w-[130px]">
    <button onClick={() => { setMenuOpen(false); startEditing(); }} className="w-full flex items-center gap-2 px-3 py-1.5 text-[#e7e5e4] hover:bg-white/5 text-xs transition-colors" style={{ fontFamily: 'Inter' }}>
      <Pencil size={11} /> 重命名
    </button>

    {/* 调整阶段 */}
    <div className="relative">
      <button
        onClick={e => { e.stopPropagation(); setStageMenuOpen(v => !v); }}
        className="w-full flex items-center justify-between gap-2 px-3 py-1.5 text-[#e7e5e4] hover:bg-white/5 text-xs transition-colors"
        style={{ fontFamily: 'Inter' }}
      >
        <span className="flex items-center gap-2">
          <span className="material-symbols-outlined text-[12px]">flag</span> 调整阶段
        </span>
        <span className="text-white/30">›</span>
      </button>
      {stageMenuOpen && (
        <div className="absolute right-full top-0 mr-1 bg-[#2a2a2a] border border-white/10 rounded-xl py-1 shadow-xl z-30 min-w-[120px]">
          <p className="px-3 py-1 text-[9px] text-white/30 uppercase tracking-wide" style={{ fontFamily: 'Inter' }}>手动指定</p>
          {STAGES.map((s, i) => {
            const isCurrent = currentStageIdx === i;
            const isDone = i <= currentStageIdx;
            return (
              <button
                key={s.key}
                onClick={() => {
                  onUpdate({ stageOverride: s.key, updatedAt: Date.now() });
                  setStageMenuOpen(false);
                  setMenuOpen(false);
                }}
                className={`w-full flex items-center gap-2 px-3 py-1.5 text-xs transition-colors hover:bg-white/5 ${isCurrent ? 'bg-white/6' : ''}`}
                style={{ color: isCurrent ? '#e8e6e4' : 'rgba(255,255,255,0.5)', fontFamily: 'Inter' }}
              >
                <div className="w-3 h-3 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: isDone ? 'rgba(200,190,220,0.7)' : 'rgba(255,255,255,0.08)', border: isDone ? 'none' : '1px solid rgba(255,255,255,0.15)' }}>
                  {isDone && <span className="text-[6px] text-white/90">✓</span>}
                </div>
                {s.label}
                {isCurrent && <span className="ml-auto text-[9px] text-white/30">当前</span>}
              </button>
            );
          })}
          <div className="h-px bg-white/7 mx-2 my-1" />
          <button
            onClick={() => {
              onUpdate({ stageOverride: undefined, updatedAt: Date.now() });
              setStageMenuOpen(false);
              setMenuOpen(false);
            }}
            className="w-full flex items-center gap-2 px-3 py-1.5 text-[10px] text-white/30 hover:text-white/50 hover:bg-white/5 transition-colors"
            style={{ fontFamily: 'Inter' }}
          >
            ↺ 恢复自动推断
          </button>
        </div>
      )}
    </div>

    <div className="h-px bg-white/7 mx-2 my-0.5" />
    <button onClick={() => { setMenuOpen(false); onDelete(); }} className="w-full flex items-center gap-2 px-3 py-1.5 text-red-400 hover:bg-white/5 text-xs transition-colors" style={{ fontFamily: 'Inter' }}>
      <Trash2 size={11} /> 删除项目
    </button>
  </div>
)}
```

- [ ] **Step 3: 确保点击菜单外部时关闭子菜单（在现有 `useEffect` 的 handle 函数中添加）**

```ts
useEffect(() => {
  if (!menuOpen) { setStageMenuOpen(false); return; }
  const handle = (e: MouseEvent) => {
    if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
      setMenuOpen(false);
      setStageMenuOpen(false);
    }
  };
  document.addEventListener('mousedown', handle);
  return () => document.removeEventListener('mousedown', handle);
}, [menuOpen]);
```

- [ ] **Step 4: 运行开发服务器，手动测试**

- hover 卡片 → 点 `···` → 点"调整阶段" → 子菜单弹出
- 点某个阶段 → 卡片步骤点更新（`stageOverride` 写入 localStorage）
- 点"恢复自动推断" → 回到推断阶段

注意：此时 `onUpdate` 仍是临时空函数，需在 localStorage DevTools 中手动验证写入，或先接入 Task 8 再测。

- [ ] **Step 5: Commit**

```bash
git add src/components/ProjectCard.tsx
git commit -m "feat(project-card): 添加调整阶段子菜单"
```

---

## Task 5: 卡片菜单 — 管理成员弹窗

**Files:**
- Modify: `src/components/ProjectCard.tsx`

- [ ] **Step 1: 在 `ProjectCard` 函数内添加成员弹窗相关 state**

```ts
const [memberModalOpen, setMemberModalOpen] = useState(false);
const [memberInput, setMemberInput] = useState('');
const [memberList, setMemberList] = useState<string[]>([]);
```

- [ ] **Step 2: 在"调整阶段"按钮之后、分割线之前插入"管理成员"菜单项**

```tsx
<button
  onClick={() => {
    setMemberList(project.members ?? []);
    setMemberInput('');
    setMemberModalOpen(true);
    setMenuOpen(false);
  }}
  className="w-full flex items-center gap-2 px-3 py-1.5 text-[#e7e5e4] hover:bg-white/5 text-xs transition-colors"
  style={{ fontFamily: 'Inter' }}
>
  <span className="material-symbols-outlined text-[12px]">group</span> 管理成员
</button>
```

- [ ] **Step 3: 在 `return` 的 JSX 中（`<div className="group relative..."` 内最后），添加成员管理弹窗**

```tsx
{memberModalOpen && (
  <div
    className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
    onClick={e => { if (e.target === e.currentTarget) setMemberModalOpen(false); }}
  >
    <div className="bg-[#1e1e1e] border border-white/10 rounded-2xl p-5 w-72 shadow-2xl" style={{ fontFamily: 'Inter' }}>
      <h3 className="text-sm font-bold text-[#e8e6e4] mb-4" style={{ fontFamily: 'Manrope' }}>管理成员</h3>

      {/* Member list */}
      <div className="flex flex-col gap-2 mb-3 max-h-40 overflow-y-auto">
        {memberList.length === 0 && (
          <p className="text-xs text-white/30 text-center py-2">暂无成员</p>
        )}
        {memberList.map((m, i) => (
          <div key={i} className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full flex items-center justify-center text-[8px] font-bold text-white/65" style={{ background: AVATAR_COLORS[i % AVATAR_COLORS.length] }}>
                {m.slice(0, 1)}
              </div>
              <span className="text-xs text-white/70">{m}</span>
            </div>
            <button onClick={() => setMemberList(prev => prev.filter((_, j) => j !== i))} className="text-white/25 hover:text-white/50 text-sm px-1 transition-colors">×</button>
          </div>
        ))}
      </div>

      {/* Add input */}
      <input
        value={memberInput}
        onChange={e => setMemberInput(e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Enter') {
            const v = memberInput.trim();
            if (v && !memberList.includes(v)) setMemberList(prev => [...prev, v]);
            setMemberInput('');
          }
        }}
        placeholder="输入姓名后回车添加..."
        className="w-full bg-black/30 border border-white/12 rounded-lg px-3 py-2 text-xs text-white/70 placeholder:text-white/25 focus:outline-none focus:border-white/25 mb-4"
      />

      <div className="flex justify-end gap-2">
        <button onClick={() => setMemberModalOpen(false)} className="px-3 py-1.5 text-xs text-white/40 hover:text-white/60 transition-colors">取消</button>
        <button
          onClick={() => {
            onUpdate({ members: memberList, updatedAt: Date.now() });
            setMemberModalOpen(false);
          }}
          className="px-4 py-1.5 text-xs font-bold bg-white/90 text-black rounded-lg hover:bg-white transition-colors"
        >
          完成
        </button>
      </div>
    </div>
  </div>
)}
```

- [ ] **Step 4: 运行开发服务器，手动测试**

- hover 卡片 → `···` → 管理成员 → 弹窗出现
- 输入姓名回车添加 → 列表更新
- × 删除成员 → 列表更新
- 点"完成" → `onUpdate` 调用（暂时空函数，Task 8 接入后生效）
- 点"取消"或弹窗外部 → 关闭

- [ ] **Step 5: Commit**

```bash
git add src/components/ProjectCard.tsx
git commit -m "feat(project-card): 添加管理成员弹窗"
```

---

## Task 6: 卡片菜单 — 编辑标签/类型弹窗

**Files:**
- Modify: `src/components/ProjectCard.tsx`

- [ ] **Step 1: 添加标签/类型弹窗相关 state**

```ts
const [metaModalOpen, setMetaModalOpen] = useState(false);
const [metaType, setMetaType] = useState<ProjectType | undefined>(undefined);
const [metaTags, setMetaTags] = useState<string[]>([]);
const [metaTagInput, setMetaTagInput] = useState('');
```

在文件顶部 import 中加入 `ProjectType`：

```ts
import { type Project, type ProjectStage, type ProjectType, inferStage, stageIndex } from '../lib/storage';
```

同时在 `STAGES` 常量旁边定义类型选项：

```ts
const PROJECT_TYPES: ProjectType[] = ['短片', '广告', 'MV', '教程', '其他'];
```

- [ ] **Step 2: 在"管理成员"菜单项之后（分割线之前）插入"编辑标签/类型"菜单项**

```tsx
<button
  onClick={() => {
    setMetaType(project.projectType);
    setMetaTags(project.tags ?? []);
    setMetaTagInput('');
    setMetaModalOpen(true);
    setMenuOpen(false);
  }}
  className="w-full flex items-center gap-2 px-3 py-1.5 text-[#e7e5e4] hover:bg-white/5 text-xs transition-colors"
  style={{ fontFamily: 'Inter' }}
>
  <span className="material-symbols-outlined text-[12px]">label</span> 编辑标签/类型
</button>
```

- [ ] **Step 3: 在成员弹窗的 `{memberModalOpen && ...}` 之后添加标签/类型弹窗**

```tsx
{metaModalOpen && (
  <div
    className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
    onClick={e => { if (e.target === e.currentTarget) setMetaModalOpen(false); }}
  >
    <div className="bg-[#1e1e1e] border border-white/10 rounded-2xl p-5 w-72 shadow-2xl" style={{ fontFamily: 'Inter' }}>
      <h3 className="text-sm font-bold text-[#e8e6e4] mb-4" style={{ fontFamily: 'Manrope' }}>编辑标签/类型</h3>

      {/* Type selector */}
      <p className="text-[10px] text-white/35 uppercase tracking-wider mb-2">项目类型</p>
      <div className="flex flex-wrap gap-1.5 mb-4">
        {PROJECT_TYPES.map(t => (
          <button
            key={t}
            onClick={() => setMetaType(prev => prev === t ? undefined : t)}
            className="px-2.5 py-1 rounded-full text-[10px] transition-colors"
            style={{
              background: metaType === t ? 'rgba(200,190,220,0.18)' : 'rgba(255,255,255,0.05)',
              border: metaType === t ? '1px solid rgba(200,190,220,0.35)' : '1px solid rgba(255,255,255,0.12)',
              color: metaType === t ? 'rgba(220,210,240,0.8)' : 'rgba(255,255,255,0.35)',
            }}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Tags */}
      <p className="text-[10px] text-white/35 uppercase tracking-wider mb-2">标签</p>
      <div className="flex flex-wrap gap-1.5 mb-2 min-h-[20px]">
        {metaTags.map((tag, i) => (
          <span key={i} className="flex items-center gap-1 bg-white/6 rounded-full px-2 py-0.5 text-[10px] text-white/45">
            {tag}
            <button onClick={() => setMetaTags(prev => prev.filter((_, j) => j !== i))} className="text-white/25 hover:text-white/50 leading-none">×</button>
          </span>
        ))}
      </div>
      <input
        value={metaTagInput}
        onChange={e => setMetaTagInput(e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Enter') {
            const v = metaTagInput.trim();
            if (v && !metaTags.includes(v)) setMetaTags(prev => [...prev, v]);
            setMetaTagInput('');
          }
        }}
        placeholder="输入标签后回车添加..."
        className="w-full bg-black/30 border border-white/12 rounded-lg px-3 py-2 text-xs text-white/70 placeholder:text-white/25 focus:outline-none focus:border-white/25 mb-4"
      />

      <div className="flex justify-end gap-2">
        <button onClick={() => setMetaModalOpen(false)} className="px-3 py-1.5 text-xs text-white/40 hover:text-white/60 transition-colors">取消</button>
        <button
          onClick={() => {
            onUpdate({ projectType: metaType, tags: metaTags, updatedAt: Date.now() });
            setMetaModalOpen(false);
          }}
          className="px-4 py-1.5 text-xs font-bold bg-white/90 text-black rounded-lg hover:bg-white transition-colors"
        >
          完成
        </button>
      </div>
    </div>
  </div>
)}
```

- [ ] **Step 4: 运行开发服务器，手动测试**

- 打开"编辑标签/类型"弹窗
- 点击类型 pill（再次点击取消选中）
- 回车添加标签，× 删除标签
- 点"完成"关闭

- [ ] **Step 5: Commit**

```bash
git add src/components/ProjectCard.tsx
git commit -m "feat(project-card): 添加编辑标签/类型弹窗"
```

---

## Task 7: 新建 `NewProjectDialog` 组件

**Files:**
- Create: `src/components/NewProjectDialog.tsx`

- [ ] **Step 1: 创建 `src/components/NewProjectDialog.tsx`**

```tsx
import React, { useState } from 'react';
import { type ProjectType } from '../lib/storage';

const PROJECT_TYPES: ProjectType[] = ['短片', '广告', 'MV', '教程', '其他'];

const AVATAR_COLORS = [
  'rgba(160,145,130,0.45)',
  'rgba(145,155,165,0.45)',
  'rgba(130,150,135,0.45)',
  'rgba(155,145,160,0.45)',
  'rgba(150,160,145,0.45)',
];

export interface NewProjectData {
  name: string;
  projectType?: ProjectType;
  tags: string[];
  members: string[];
}

interface Props {
  onConfirm: (data: NewProjectData) => void;
  onCancel: () => void;
}

export default function NewProjectDialog({ onConfirm, onCancel }: Props) {
  const [name, setName] = useState('未命名项目');
  const [projectType, setProjectType] = useState<ProjectType | undefined>(undefined);
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [members, setMembers] = useState<string[]>([]);
  const [memberInput, setMemberInput] = useState('');

  const handleConfirm = () => {
    onConfirm({ name: name.trim() || '未命名项目', projectType, tags, members });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70"
      onClick={e => { if (e.target === e.currentTarget) onCancel(); }}
    >
      <div className="bg-[#1a1a1a] border border-white/10 rounded-2xl p-6 w-80 shadow-2xl" style={{ fontFamily: 'Inter' }}>
        <h2 className="text-sm font-bold text-[#e8e6e4] mb-5" style={{ fontFamily: 'Manrope' }}>新建项目</h2>

        {/* Name */}
        <div className="mb-4">
          <p className="text-[10px] text-white/35 uppercase tracking-wider mb-1.5">项目名称</p>
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            onFocus={e => e.target.select()}
            className="w-full bg-black/30 border border-white/12 rounded-lg px-3 py-2 text-xs text-white/80 focus:outline-none focus:border-white/25"
          />
        </div>

        {/* Type */}
        <div className="mb-4">
          <p className="text-[10px] text-white/35 uppercase tracking-wider mb-1.5">项目类型</p>
          <div className="flex flex-wrap gap-1.5">
            {PROJECT_TYPES.map(t => (
              <button
                key={t}
                onClick={() => setProjectType(prev => prev === t ? undefined : t)}
                className="px-2.5 py-1 rounded-full text-[10px] transition-colors"
                style={{
                  background: projectType === t ? 'rgba(200,190,220,0.18)' : 'rgba(255,255,255,0.05)',
                  border: projectType === t ? '1px solid rgba(200,190,220,0.35)' : '1px solid rgba(255,255,255,0.12)',
                  color: projectType === t ? 'rgba(220,210,240,0.8)' : 'rgba(255,255,255,0.35)',
                }}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        {/* Tags */}
        <div className="mb-4">
          <p className="text-[10px] text-white/35 uppercase tracking-wider mb-1.5">标签 <span className="normal-case text-white/20">（可选）</span></p>
          {tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-2">
              {tags.map((tag, i) => (
                <span key={i} className="flex items-center gap-1 bg-white/6 rounded-full px-2 py-0.5 text-[10px] text-white/45">
                  {tag}
                  <button onClick={() => setTags(prev => prev.filter((_, j) => j !== i))} className="text-white/25 hover:text-white/50">×</button>
                </span>
              ))}
            </div>
          )}
          <input
            value={tagInput}
            onChange={e => setTagInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') {
                const v = tagInput.trim();
                if (v && !tags.includes(v)) setTags(prev => [...prev, v]);
                setTagInput('');
              }
            }}
            placeholder="输入标签后回车添加..."
            className="w-full bg-black/30 border border-white/12 rounded-lg px-3 py-2 text-xs text-white/70 placeholder:text-white/25 focus:outline-none focus:border-white/25"
          />
        </div>

        {/* Members */}
        <div className="mb-5">
          <p className="text-[10px] text-white/35 uppercase tracking-wider mb-1.5">成员 <span className="normal-case text-white/20">（可选）</span></p>
          {members.length > 0 && (
            <div className="flex flex-col gap-1.5 mb-2">
              {members.map((m, i) => (
                <div key={i} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-5 h-5 rounded-full flex items-center justify-center text-[7px] font-bold text-white/65 flex-shrink-0" style={{ background: AVATAR_COLORS[i % AVATAR_COLORS.length] }}>
                      {m.slice(0, 1)}
                    </div>
                    <span className="text-xs text-white/65">{m}</span>
                  </div>
                  <button onClick={() => setMembers(prev => prev.filter((_, j) => j !== i))} className="text-white/25 hover:text-white/50 px-1 text-sm">×</button>
                </div>
              ))}
            </div>
          )}
          <input
            value={memberInput}
            onChange={e => setMemberInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') {
                const v = memberInput.trim();
                if (v && !members.includes(v)) setMembers(prev => [...prev, v]);
                setMemberInput('');
              }
            }}
            placeholder="输入姓名后回车添加..."
            className="w-full bg-black/30 border border-white/12 rounded-lg px-3 py-2 text-xs text-white/70 placeholder:text-white/25 focus:outline-none focus:border-white/25"
          />
        </div>

        {/* Buttons */}
        <div className="flex justify-end gap-2">
          <button onClick={onCancel} className="px-3 py-1.5 text-xs text-white/40 hover:text-white/60 transition-colors border border-white/10 rounded-lg bg-white/5">取消</button>
          <button onClick={handleConfirm} className="px-4 py-1.5 text-xs font-bold bg-white/90 text-black rounded-lg hover:bg-white transition-colors">创建</button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: 运行 TypeScript 检查**

```bash
npx tsc --noEmit
```

无报错即可。

- [ ] **Step 3: Commit**

```bash
git add src/components/NewProjectDialog.tsx
git commit -m "feat: 新增 NewProjectDialog 组件"
```

---

## Task 8: 接入回调 — `HomePage` + `App.tsx`

**Files:**
- Modify: `src/components/HomePage.tsx`
- Modify: `src/App.tsx`

- [ ] **Step 1: 更新 `HomePage.tsx` 的 Props 接口**

```ts
import NewProjectDialog, { type NewProjectData } from './NewProjectDialog';
import ProjectCard from './ProjectCard';
import { type Project } from '../lib/storage';

interface Props {
  projects: Project[];
  onNewProject: (data?: NewProjectData) => void;   // 签名更新
  onOpenProject: (project: Project) => void;
  onDeleteProject: (id: string) => void;
  onRenameProject?: (id: string, name: string) => void;
  onUpdateProject?: (id: string, updates: Partial<Project>) => void;  // 新增
  onGoToSkills?: () => void;
  onGoToTopic?: (keyword: string) => void;
}
```

- [ ] **Step 2: 在 `HomePage` 函数内添加弹窗状态，替换新建逻辑**

```ts
const [dialogOpen, setDialogOpen] = useState(false);

const handleSubmit = () => {
  const kw = inputText.trim();
  if (kw && onGoToTopic) {
    onGoToTopic(kw);
  } else {
    setDialogOpen(true);   // 不直接创建，打开弹窗
  }
  setInputText('');
};
```

- [ ] **Step 3: 将"新建项目"卡片的 `onClick` 也改为打开弹窗**

```tsx
<button
  onClick={() => setDialogOpen(true)}
  ...
>
```

- [ ] **Step 4: 在 `return` JSX 末尾（`</div>` 之前）添加弹窗渲染和 `ProjectCard` 的 `onUpdate` 接入**

```tsx
{dialogOpen && (
  <NewProjectDialog
    onConfirm={data => { onNewProject(data); setDialogOpen(false); }}
    onCancel={() => setDialogOpen(false)}
  />
)}
```

同时更新 `ProjectCard` 的调用，接入 `onUpdate`：

```tsx
<ProjectCard
  key={project.id}
  project={project}
  onOpen={() => onOpenProject(project)}
  onDelete={() => onDeleteProject(project.id)}
  onRename={name => onRenameProject?.(project.id, name)}
  onUpdate={updates => onUpdateProject?.(project.id, updates)}
/>
```

- [ ] **Step 5: 更新 `App.tsx` 的 `handleNewProject`，接受 `NewProjectData`**

在 `App.tsx` 顶部 import 中添加：

```ts
import { type NewProjectData } from './components/NewProjectDialog';
```

更新函数：

```ts
const handleNewProject = (data?: NewProjectData) => {
  const proj: Project = {
    ...createProject(data?.name),
    projectType: data?.projectType,
    tags: data?.tags ?? [],
    members: data?.members ?? [],
  };
  wsSaveProject(proj);
  setCurrentProject(proj);
  setCanvasInitialNodes([]);
  setCanvasInitialEdges([]);
  setCanvasInitialRows([]);
  setCanvasInitialAssets([]);
  setCanvasInitialHistory([]);
  setCanvasInitialStoryboardOrder([]);
  setCanvasInitialVideoOrder([]);
  setCanvasInitialSubtitles([]);
  setCanvasInitialTopicDraft('');
  setCanvasInitialTopicKeyword('');
  setView('canvas');
};
```

- [ ] **Step 6: 在 `App.tsx` 中添加 `handleUpdateProject` 并传入 `HomePage`**

```ts
const handleUpdateProject = (id: string, updates: Partial<Project>) => {
  const proj = projects.find(p => p.id === id);
  if (!proj) return;
  wsSaveProject({ ...proj, ...updates });
};
```

在 `<HomePage>` 的 JSX 中添加：

```tsx
onUpdateProject={handleUpdateProject}
```

- [ ] **Step 7: 运行 TypeScript 检查**

```bash
npx tsc --noEmit
```

修复所有类型报错。

- [ ] **Step 8: 运行开发服务器，完整端到端测试**

1. 点击"新建项目"→ 弹窗出现，填入名称/类型/标签/成员 → 点创建 → 新卡片出现，显示类型 badge、标签、成员头像
2. hover 已有卡片 → `···` → 编辑标签/类型 → 保存 → 卡片更新
3. hover 卡片 → `···` → 管理成员 → 添加成员 → 保存 → 头像更新
4. hover 卡片 → `···` → 调整阶段 → 选"审片" → 四个步骤点全亮
5. 调整阶段 → "恢复自动推断" → 阶段回到推断值

- [ ] **Step 9: Commit**

```bash
git add src/components/HomePage.tsx src/App.tsx
git commit -m "feat: 接入 NewProjectDialog 和 onUpdateProject 回调，完成卡片增强"
```

---

## Self-Review

**Spec coverage check:**

| Spec 要求 | 对应 Task |
|---|---|
| `ProjectStage`, `ProjectType` 类型 | Task 1 |
| `stageOverride`, `members`, `projectType`, `tags` 字段 | Task 1 |
| `inferStage()` 纯函数 | Task 1 |
| 阶段步骤连线 UI | Task 3 |
| 类型 badge | Task 3 |
| 标签 pills | Task 3 |
| 成员头像叠排 | Task 3 |
| 调整阶段子菜单 | Task 4 |
| 管理成员弹窗 | Task 5 |
| 编辑标签/类型弹窗 | Task 6 |
| 新建项目弹窗 | Task 7 |
| 弹窗接入 HomePage + App.tsx | Task 8 |
| 恢复自动推断 | Task 4 |
| 超过 3 人显示 +N | Task 3 Step 6 |
| 无成员时透明占位圆 | Task 3 Step 6 |

所有 spec 要求均有对应 task，无遗漏。

**Type consistency check:**
- `inferStage` 在 Task 1 定义，Task 3 和 Task 4 使用 ✓
- `stageIndex` 在 Task 1 定义，Task 3 和 Task 4 使用 ✓
- `onUpdate: (updates: Partial<Project>) => void` 在 Task 3 定义，Task 4/5/6 使用 ✓
- `NewProjectData` 在 Task 7 定义，Task 8 引用 ✓
- `AVATAR_COLORS` 和 `PROJECT_TYPES` 在 Task 3 定义（ProjectCard.tsx），Task 7 内独立重新定义（NewProjectDialog.tsx，避免跨文件依赖） ✓
