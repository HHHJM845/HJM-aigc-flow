# Canvas Left Toolbar Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a left-side vertical toolbar to the canvas with Asset Library, Generation History, Board Tool, and Comment Tool.

**Architecture:** Five new components + storage model extension + App.tsx wiring. Board tool uses a transparent overlay div for drag detection, then ReactFlow's native `parentId` for node grouping. Asset drag-to-canvas uses HTML5 drag events on the ReactFlow wrapper.

**Tech Stack:** React, TypeScript, ReactFlow 12 (`@xyflow/react`), NodeResizer, Tailwind CSS, lucide-react

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `src/lib/storage.ts` | Modify | Add `AssetItem`, `HistoryItem`, extend `Project` |
| `src/components/LeftToolbar.tsx` | Create | Vertical icon toolbar |
| `src/components/BoardNode.tsx` | Create | Board frame node with resizer + editable name |
| `src/components/CommentNode.tsx` | Create | Yellow sticky note node |
| `src/components/AssetPanel.tsx` | Create | Asset library panel with upload + drag |
| `src/components/HistoryPanel.tsx` | Create | Generation history panel grouped by date |
| `src/App.tsx` | Modify | Wire all state, events, panels, new node types |

---

### Task 1: Extend Storage Types

**Files:**
- Modify: `src/lib/storage.ts`

- [ ] **Step 1: Add interfaces and update Project**

Replace the file content with:

```typescript
import type { Node, Edge } from '@xyflow/react';
import type { StoryboardRow } from './api';

export interface AssetItem {
  id: string;
  type: 'image' | 'video';
  src: string;
  name: string;
  createdAt: number;
}

export interface HistoryItem {
  id: string;
  type: 'image' | 'video';
  src: string;
  nodeLabel: string;
  createdAt: number;
}

export interface Project {
  id: string;
  name: string;
  thumbnail?: string;
  createdAt: number;
  updatedAt: number;
  storyboardRows: StoryboardRow[];
  nodes: Node[];
  edges: Edge[];
  assets: AssetItem[];
  generationHistory: HistoryItem[];
}

const STORAGE_KEY = 'hjm_aigc_projects';

export function loadProjects(): Project[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  } catch {
    return [];
  }
}

export function saveProject(project: Project): void {
  const all = loadProjects();
  const idx = all.findIndex(p => p.id === project.id);
  if (idx >= 0) all[idx] = project;
  else all.unshift(project);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  } catch {
    const lite: Project = {
      ...project,
      thumbnail: undefined,
      assets: [],
      generationHistory: project.generationHistory.slice(0, 20),
      nodes: project.nodes.map(n => ({
        ...n,
        data: { ...n.data, content: null, uploadedImages: [] },
      })),
    };
    const idx2 = all.findIndex(p => p.id === lite.id);
    if (idx2 >= 0) all[idx2] = lite;
    else all.unshift(lite);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(all)); } catch {}
  }
}

export function deleteProject(id: string): void {
  const all = loadProjects().filter(p => p.id !== id);
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(all)); } catch {}
}

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
  };
}

export function extractThumbnail(nodes: Node[]): string | undefined {
  for (const node of nodes) {
    if (node.type === 'imageNode' && node.data?.content) {
      const c = node.data.content as string | string[];
      const first = Array.isArray(c) ? c[0] : c;
      if (typeof first === 'string' && first.startsWith('data:image')) return first;
    }
  }
  return undefined;
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd C:\Users\oldch\Desktop\HJM-aigc-flow-main && npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors related to storage.ts

- [ ] **Step 3: Commit**

```bash
git add src/lib/storage.ts
git commit -m "feat: extend Project with assets and generationHistory"
```

---

### Task 2: LeftToolbar Component

**Files:**
- Create: `src/components/LeftToolbar.tsx`

- [ ] **Step 1: Create the file**

```tsx
import React from 'react';
import { Library, History, Frame, MessageSquare, HelpCircle, Plus } from 'lucide-react';

export type ActiveTool = 'board' | 'comment' | null;

interface Props {
  activeTool: ActiveTool;
  showAssets: boolean;
  showHistory: boolean;
  onToolChange: (tool: ActiveTool) => void;
  onToggleAssets: () => void;
  onToggleHistory: () => void;
}

export default function LeftToolbar({
  activeTool, showAssets, showHistory,
  onToolChange, onToggleAssets, onToggleHistory,
}: Props) {
  return (
    <div className="absolute left-4 top-1/2 -translate-y-1/2 z-50 flex flex-col items-center gap-1 bg-[#1a1a1a] border border-white/[0.08] rounded-2xl p-1.5 shadow-xl">
      {/* Asset Library */}
      <button
        onClick={onToggleAssets}
        title="资产库"
        className={`w-9 h-9 flex items-center justify-center rounded-xl transition-colors ${
          showAssets ? 'bg-white/20 text-white' : 'text-gray-400 hover:bg-white/10 hover:text-gray-200'
        }`}
      >
        <Library size={16} />
      </button>

      {/* History */}
      <button
        onClick={onToggleHistory}
        title="历史记录"
        className={`w-9 h-9 flex items-center justify-center rounded-xl transition-colors ${
          showHistory ? 'bg-white/20 text-white' : 'text-gray-400 hover:bg-white/10 hover:text-gray-200'
        }`}
      >
        <History size={16} />
      </button>

      {/* Board Tool */}
      <button
        onClick={() => onToolChange(activeTool === 'board' ? null : 'board')}
        title="画板工具"
        className={`w-9 h-9 flex items-center justify-center rounded-xl transition-colors ${
          activeTool === 'board'
            ? 'bg-blue-500/30 text-blue-400 ring-1 ring-blue-500/40'
            : 'text-gray-400 hover:bg-white/10 hover:text-gray-200'
        }`}
      >
        <Frame size={16} />
      </button>

      {/* Comment Tool */}
      <button
        onClick={() => onToolChange(activeTool === 'comment' ? null : 'comment')}
        title="评论"
        className={`w-9 h-9 flex items-center justify-center rounded-xl transition-colors ${
          activeTool === 'comment'
            ? 'bg-yellow-500/30 text-yellow-400 ring-1 ring-yellow-500/40'
            : 'text-gray-400 hover:bg-white/10 hover:text-gray-200'
        }`}
      >
        <MessageSquare size={16} />
      </button>

      <div className="w-5 h-px bg-white/10 my-0.5" />

      {/* Help */}
      <button
        title="帮助"
        className="w-9 h-9 flex items-center justify-center text-gray-600 hover:text-gray-400 rounded-xl hover:bg-white/5 transition-colors"
      >
        <HelpCircle size={16} />
      </button>

      {/* User Avatar */}
      <div className="w-9 h-9 rounded-full bg-blue-500 flex items-center justify-center text-white text-xs font-bold mt-0.5 cursor-pointer select-none">
        少军
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
cd C:\Users\oldch\Desktop\HJM-aigc-flow-main && npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add src/components/LeftToolbar.tsx
git commit -m "feat: add LeftToolbar component"
```

---

### Task 3: BoardNode Component

**Files:**
- Create: `src/components/BoardNode.tsx`

- [ ] **Step 1: Create the file**

```tsx
import React, { useState } from 'react';
import { NodeResizer } from '@xyflow/react';

export default function BoardNode({ id, data, selected }: { id: string; data: any; selected?: boolean }) {
  const [isEditingName, setIsEditingName] = useState(false);
  const [name, setName] = useState(data.label || '未命名画板');

  const handleNameSave = () => {
    setIsEditingName(false);
    data.onUpdate?.(id, { label: name });
  };

  return (
    <div className="w-full h-full relative">
      <NodeResizer
        isVisible={selected}
        minWidth={200}
        minHeight={150}
        handleStyle={{ width: 8, height: 8, borderRadius: 2, background: '#555', border: '1px solid #888' }}
        lineStyle={{ borderColor: '#555' }}
      />

      {/* Board background */}
      <div
        className={`w-full h-full rounded-2xl border-2 transition-colors ${
          selected ? 'border-white/25 bg-white/[0.03]' : 'border-white/10 bg-white/[0.015]'
        }`}
      />

      {/* Editable name at top-left */}
      <div className="absolute -top-7 left-1">
        {isEditingName ? (
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            onBlur={handleNameSave}
            onKeyDown={e => {
              if (e.key === 'Enter') handleNameSave();
              e.stopPropagation();
            }}
            className="bg-[#1a1a1a] border border-white/15 text-white text-xs font-medium focus:outline-none px-2 py-0.5 rounded-md min-w-[80px]"
            autoFocus
            onClick={e => e.stopPropagation()}
            onMouseDown={e => e.stopPropagation()}
          />
        ) : (
          <span
            className="text-gray-400 text-xs font-medium cursor-pointer hover:text-gray-200 px-1 py-0.5 rounded hover:bg-white/5 transition-colors select-none"
            onDoubleClick={e => { e.stopPropagation(); setIsEditingName(true); }}
          >
            {name}
          </span>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
cd C:\Users\oldch\Desktop\HJM-aigc-flow-main && npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 3: Commit**

```bash
git add src/components/BoardNode.tsx
git commit -m "feat: add BoardNode component with NodeResizer and editable name"
```

---

### Task 4: CommentNode Component

**Files:**
- Create: `src/components/CommentNode.tsx`

- [ ] **Step 1: Create the file**

```tsx
import React, { useState, useRef, useEffect } from 'react';

const COLORS = ['#fef08a', '#86efac', '#93c5fd', '#f9a8d4', '#fdba74'];

export default function CommentNode({ id, data, selected }: { id: string; data: any; selected?: boolean }) {
  const [text, setText] = useState(data.text || '');
  const color = data.color || COLORS[0];
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    // Auto-focus when first placed
    if (!data.text && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setText(e.target.value);
    data.onUpdate?.(id, { text: e.target.value });
  };

  return (
    <div
      className={`relative w-full h-full min-w-[160px] min-h-[100px] rounded-2xl rounded-tl-none shadow-xl ${
        selected ? 'ring-2 ring-white/30' : ''
      }`}
      style={{ backgroundColor: color }}
    >
      {/* Folded top-left corner */}
      <div
        className="absolute top-0 left-0 w-0 h-0"
        style={{
          borderRight: '18px solid rgba(0,0,0,0.18)',
          borderBottom: `18px solid ${color}`,
        }}
      />

      <textarea
        ref={textareaRef}
        value={text}
        onChange={handleChange}
        placeholder="写下评论..."
        className="w-full h-full bg-transparent text-gray-800 text-[13px] leading-relaxed resize-none focus:outline-none p-3 pt-5 nodrag"
        onMouseDown={e => e.stopPropagation()}
        onKeyDown={e => e.stopPropagation()}
        style={{ fontFamily: 'inherit' }}
      />

      {data.author && (
        <div className="absolute bottom-2 right-3 text-[10px] text-gray-600/70 font-medium pointer-events-none">
          — {data.author}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/CommentNode.tsx
git commit -m "feat: add CommentNode sticky note component"
```

---

### Task 5: AssetPanel Component

**Files:**
- Create: `src/components/AssetPanel.tsx`

- [ ] **Step 1: Create the file**

```tsx
import React, { useRef } from 'react';
import { Upload, X, Image as ImageIcon, Film } from 'lucide-react';
import type { AssetItem } from '../lib/storage';

interface Props {
  assets: AssetItem[];
  onUpload: (items: AssetItem[]) => void;
  onRemove: (id: string) => void;
}

export default function AssetPanel({ assets, onUpload, onRemove }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    files.forEach(file => {
      const reader = new FileReader();
      reader.onload = ev => {
        const src = ev.target?.result as string;
        const type: 'image' | 'video' = file.type.startsWith('video') ? 'video' : 'image';
        onUpload([{
          id: `asset_${Date.now()}_${Math.random().toString(36).slice(2)}`,
          type,
          src,
          name: file.name,
          createdAt: Date.now(),
        }]);
      };
      reader.readAsDataURL(file);
    });
    e.target.value = '';
  };

  const handleDragStart = (e: React.DragEvent, asset: AssetItem) => {
    e.dataTransfer.setData('application/asset-type', asset.type);
    e.dataTransfer.setData('application/asset-src', asset.src);
    e.dataTransfer.setData('application/asset-name', asset.name);
    e.dataTransfer.effectAllowed = 'copy';
  };

  return (
    <div className="absolute left-16 top-1/2 -translate-y-1/2 z-40 w-[280px] max-h-[70vh] bg-[#141414] border border-white/[0.08] rounded-2xl shadow-2xl flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06] flex-shrink-0">
        <span className="text-white text-sm font-medium">资产库</span>
        <button
          onClick={() => fileInputRef.current?.click()}
          className="flex items-center gap-1.5 px-2.5 py-1 bg-white/10 hover:bg-white/15 text-gray-300 rounded-lg text-xs transition-colors"
        >
          <Upload size={11} />
          上传
        </button>
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          accept="image/*,video/*"
          multiple
          onChange={handleFileChange}
        />
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-y-auto p-3">
        {assets.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-gray-600 text-xs text-center gap-2">
            <ImageIcon size={28} className="opacity-30" />
            <p>上传素材或从画布生成图片<br />后将在这里显示</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {assets.map(asset => (
              <div
                key={asset.id}
                draggable
                onDragStart={e => handleDragStart(e, asset)}
                className="relative group rounded-xl overflow-hidden border border-white/10 cursor-grab active:cursor-grabbing aspect-video bg-black/30"
              >
                {asset.type === 'image' ? (
                  <img src={asset.src} alt={asset.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-gray-800">
                    <Film size={24} className="text-gray-500" />
                  </div>
                )}
                {/* Type badge */}
                <div className="absolute top-1.5 left-1.5 px-1.5 py-0.5 bg-black/60 rounded text-[9px] text-white/70 font-medium uppercase">
                  {asset.type === 'image' ? 'IMAGE' : 'VIDEO'}
                </div>
                {/* Remove button */}
                <button
                  onClick={() => onRemove(asset.id)}
                  className="absolute top-1.5 right-1.5 w-5 h-5 bg-black/60 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500/70"
                >
                  <X size={10} className="text-white" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/AssetPanel.tsx
git commit -m "feat: add AssetPanel with upload and drag-to-canvas support"
```

---

### Task 6: HistoryPanel Component

**Files:**
- Create: `src/components/HistoryPanel.tsx`

- [ ] **Step 1: Create the file**

```tsx
import React, { useState, useMemo } from 'react';
import { Search, Film } from 'lucide-react';
import type { HistoryItem } from '../lib/storage';

interface Props {
  history: HistoryItem[];
  onUseItem: (item: HistoryItem) => void;
}

function groupByDate(items: HistoryItem[]): { label: string; items: HistoryItem[] }[] {
  const now = Date.now();
  const today = new Date(now).setHours(0, 0, 0, 0);
  const yesterday = today - 86400000;

  const groups: Record<string, HistoryItem[]> = {};
  items.forEach(item => {
    const d = new Date(item.createdAt).setHours(0, 0, 0, 0);
    const label = d >= today ? '今天 Today' : d >= yesterday ? '昨天 Yesterday' : '更早 Earlier';
    if (!groups[label]) groups[label] = [];
    groups[label].push(item);
  });

  return Object.entries(groups).map(([label, items]) => ({ label, items }));
}

export default function HistoryPanel({ history, onUseItem }: Props) {
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    if (!search.trim()) return history;
    return history.filter(h => h.nodeLabel.toLowerCase().includes(search.toLowerCase()));
  }, [history, search]);

  const groups = useMemo(() => groupByDate(filtered), [filtered]);

  return (
    <div className="absolute left-16 top-1/2 -translate-y-1/2 z-40 w-[320px] max-h-[70vh] bg-[#141414] border border-white/[0.08] rounded-2xl shadow-2xl flex flex-col overflow-hidden">
      {/* Search */}
      <div className="flex items-center gap-2 px-3 py-2.5 border-b border-white/[0.06] flex-shrink-0">
        <Search size={13} className="text-gray-500 flex-shrink-0" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search History..."
          className="flex-1 bg-transparent text-sm text-gray-300 placeholder-gray-600 focus:outline-none"
        />
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-4">
        {groups.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-gray-600 text-xs text-center gap-2">
            <p>生成图片或视频后<br />将记录在这里</p>
          </div>
        ) : (
          groups.map(({ label, items }) => (
            <div key={label}>
              <p className="text-xs text-gray-500 font-medium mb-2">{label}</p>
              <div className="grid grid-cols-2 gap-2">
                {items.map(item => (
                  <div
                    key={item.id}
                    onClick={() => onUseItem(item)}
                    className="relative group rounded-xl overflow-hidden border border-white/10 cursor-pointer aspect-video bg-black/30 hover:border-white/25 transition-colors"
                  >
                    {item.type === 'image' ? (
                      <img src={item.src} alt={item.nodeLabel} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-gray-800">
                        <Film size={20} className="text-gray-500" />
                      </div>
                    )}
                    <div className="absolute top-1.5 left-1.5 px-1.5 py-0.5 bg-black/60 rounded text-[9px] text-white/70 font-medium uppercase">
                      {item.type === 'image' ? 'IMAGE 图像' : 'VIDEO 视频'}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/HistoryPanel.tsx
git commit -m "feat: add HistoryPanel with date grouping and search"
```

---

### Task 7: Wire Everything in App.tsx

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1: Add imports**

At the top of `src/App.tsx`, replace the existing imports block with:

```tsx
import React, { useCallback, useState, useRef, useEffect } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  BackgroundVariant,
  useReactFlow,
  ReactFlowProvider,
  Panel,
  addEdge,
  type Node,
  type Edge,
  type Connection,
  type OnConnectEnd
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import ImageNode from './components/ImageNode';
import TextNode from './components/TextNode';
import VideoNode from './components/VideoNode';
import ContextMenu from './components/ContextMenu';
import CustomEdge from './components/CustomEdge';
import BreakdownModal from './components/BreakdownModal';
import HomePage from './components/HomePage';
import AIPanel from './components/AIPanel';
import SkillCommunity from './components/SkillCommunity';
import LeftToolbar, { type ActiveTool } from './components/LeftToolbar';
import BoardNode from './components/BoardNode';
import CommentNode from './components/CommentNode';
import AssetPanel from './components/AssetPanel';
import HistoryPanel from './components/HistoryPanel';
import { type StoryboardRow } from './lib/api';
import {
  createProject,
  saveProject,
  extractThumbnail,
  type Project,
  type AssetItem,
  type HistoryItem,
} from './lib/storage';
import { FileText } from 'lucide-react';
```

- [ ] **Step 2: Add boardNode and commentNode to nodeTypes**

Replace the `nodeTypes` constant:

```tsx
const nodeTypes = {
  imageNode: ImageNode,
  textNode: TextNode,
  videoNode: VideoNode,
  boardNode: BoardNode,
  commentNode: CommentNode,
};
```

- [ ] **Step 3: Update Flow component props interface**

Replace the Flow function signature and props interface:

```tsx
function Flow({
  initialNodes,
  initialEdges,
  initialStoryboardRows,
  initialAssets,
  initialHistory,
  onGoHome,
  onSave,
  onSaveRows,
  onSaveAssets,
  onSaveHistory,
}: {
  initialNodes: Node[];
  initialEdges: Edge[];
  initialStoryboardRows: StoryboardRow[];
  initialAssets: AssetItem[];
  initialHistory: HistoryItem[];
  onGoHome: () => void;
  onSave: (nodes: Node[], edges: Edge[]) => void;
  onSaveRows: (rows: StoryboardRow[]) => void;
  onSaveAssets: (assets: AssetItem[]) => void;
  onSaveHistory: (history: HistoryItem[]) => void;
}) {
```

- [ ] **Step 4: Add new state inside Flow component**

After the existing `const { screenToFlowPosition, getNodes } = useReactFlow();` line, add:

```tsx
  const [activeTool, setActiveTool] = useState<ActiveTool>(null);
  const [showAssets, setShowAssets] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [assets, setAssets] = useState<AssetItem[]>(initialAssets);
  const [generationHistory, setGenerationHistory] = useState<HistoryItem[]>(initialHistory);

  // Board drag-create state (screen coordinates)
  const [boardDraft, setBoardDraft] = useState<{ startX: number; startY: number; currentX: number; currentY: number } | null>(null);
  const isDraggingBoard = useRef(false);
```

- [ ] **Step 5: Add Escape key handler inside Flow component**

After the state declarations, add:

```tsx
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setActiveTool(null);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);
```

- [ ] **Step 6: Update handleUpdateNode to record generation history**

Replace the existing `handleUpdateNode`:

```tsx
  const handleUpdateNode = useCallback((id: string, newData: any) => {
    // Record generated content to history
    if (newData.content) {
      const contents = Array.isArray(newData.content) ? newData.content : [newData.content];
      const node = nodesRef.current.find(n => n.id === id);
      const isVideo = node?.type === 'videoNode';
      const newItems: HistoryItem[] = contents
        .filter((src: string) => typeof src === 'string' && src.length > 0)
        .map((src: string) => ({
          id: `hist_${Date.now()}_${Math.random().toString(36).slice(2)}`,
          type: isVideo ? 'video' : 'image',
          src,
          nodeLabel: String(node?.data?.label || ''),
          createdAt: Date.now(),
        }));
      if (newItems.length > 0) {
        setGenerationHistory(prev => {
          const updated = [...newItems, ...prev];
          onSaveHistory(updated);
          return updated;
        });
      }
    }

    setNodes(nds => nds.map(node => {
      if (node.id !== id) return node;
      const { _width, _height, ...rest } = newData;
      const updated = { ...node, data: { ...node.data, ...rest } };
      if (_width != null) updated.width = _width;
      if (_height != null) updated.height = _height;
      return updated;
    }));
  }, [setNodes, onSaveHistory]);
```

- [ ] **Step 7: Add board drag handlers**

After `handleUpdateNode`, add:

```tsx
  const handleBoardDragStart = useCallback((e: React.MouseEvent) => {
    if (activeTool !== 'board') return;
    e.preventDefault();
    isDraggingBoard.current = true;
    setBoardDraft({ startX: e.clientX, startY: e.clientY, currentX: e.clientX, currentY: e.clientY });
  }, [activeTool]);

  const handleBoardDragMove = useCallback((e: React.MouseEvent) => {
    if (!isDraggingBoard.current) return;
    setBoardDraft(prev => prev ? { ...prev, currentX: e.clientX, currentY: e.clientY } : null);
  }, []);

  const handleBoardDragEnd = useCallback((e: React.MouseEvent) => {
    if (!isDraggingBoard.current || !boardDraft) return;
    isDraggingBoard.current = false;

    const screenW = Math.abs(boardDraft.currentX - boardDraft.startX);
    const screenH = Math.abs(boardDraft.currentY - boardDraft.startY);

    if (screenW < 30 || screenH < 30) {
      setBoardDraft(null);
      return;
    }

    const topLeft = screenToFlowPosition({
      x: Math.min(boardDraft.startX, boardDraft.currentX),
      y: Math.min(boardDraft.startY, boardDraft.currentY),
    });
    const bottomRight = screenToFlowPosition({
      x: Math.max(boardDraft.startX, boardDraft.currentX),
      y: Math.max(boardDraft.startY, boardDraft.currentY),
    });
    const boardW = bottomRight.x - topLeft.x;
    const boardH = bottomRight.y - topLeft.y;
    const boardId = `board_${Date.now()}`;

    const boardNode: Node = {
      id: boardId,
      type: 'boardNode',
      position: topLeft,
      width: boardW,
      height: boardH,
      zIndex: -1,
      data: { label: '未命名画板', onUpdate: handleUpdateNode },
    };

    // Auto-assign nodes inside board as children
    setNodes(nds => {
      const updatedChildren = nds.map(n => {
        if (n.type === 'boardNode' || n.type === 'commentNode') return n;
        const cx = n.position.x + (n.width || 380) / 2;
        const cy = n.position.y + (n.height || 300) / 2;
        const inside = cx >= topLeft.x && cx <= topLeft.x + boardW &&
                       cy >= topLeft.y && cy <= topLeft.y + boardH;
        if (inside && !n.parentId) {
          return { ...n, parentId: boardId, position: { x: n.position.x - topLeft.x, y: n.position.y - topLeft.y } };
        }
        return n;
      });
      return [...updatedChildren, boardNode];
    });

    setBoardDraft(null);
    setActiveTool(null);
  }, [boardDraft, screenToFlowPosition, setNodes, handleUpdateNode]);
```

- [ ] **Step 8: Add onNodeDragStop handler**

After the board drag handlers, add:

```tsx
  const onNodeDragStop = useCallback((_: React.MouseEvent, draggedNode: Node, allNodes: Node[]) => {
    if (draggedNode.type === 'boardNode' || draggedNode.type === 'commentNode') return;
    const boards = allNodes.filter(n => n.type === 'boardNode');
    if (boards.length === 0 && !draggedNode.parentId) return;

    // Compute absolute position
    let absX = draggedNode.position.x;
    let absY = draggedNode.position.y;
    if (draggedNode.parentId) {
      const parent = allNodes.find(n => n.id === draggedNode.parentId);
      if (parent) { absX += parent.position.x; absY += parent.position.y; }
    }
    const centerX = absX + (draggedNode.width || 380) / 2;
    const centerY = absY + (draggedNode.height || 300) / 2;

    const containingBoard = boards.find(board => {
      const bw = board.width || 600;
      const bh = board.height || 400;
      return centerX >= board.position.x && centerX <= board.position.x + bw &&
             centerY >= board.position.y && centerY <= board.position.y + bh;
    });

    const newParentId = containingBoard?.id;
    if (draggedNode.parentId === newParentId) return;

    setNodes(nds => nds.map(n => {
      if (n.id !== draggedNode.id) return n;
      if (newParentId && containingBoard) {
        return { ...n, parentId: newParentId, position: { x: absX - containingBoard.position.x, y: absY - containingBoard.position.y } };
      }
      return { ...n, parentId: undefined, position: { x: absX, y: absY } };
    }));
  }, [setNodes]);
```

- [ ] **Step 9: Add comment creation via pane click**

Replace the existing `onPaneContextMenu` and add a modified `onPaneClick`:

```tsx
  const onPaneClick = useCallback((event: React.MouseEvent) => {
    closeMenu();
    if (activeTool === 'comment') {
      const pos = screenToFlowPosition({ x: event.clientX, y: event.clientY });
      const commentId = `comment_${Date.now()}`;
      const commentNode: Node = {
        id: commentId,
        type: 'commentNode',
        position: { x: pos.x - 100, y: pos.y - 70 },
        width: 200,
        height: 140,
        data: { text: '', author: '少军', color: '#fef08a', onUpdate: handleUpdateNode },
      };
      setNodes(nds => [...nds, commentNode]);
      setActiveTool(null);
    }
  }, [activeTool, closeMenu, screenToFlowPosition, setNodes, handleUpdateNode]);

  const onPaneContextMenu = useCallback((event: React.MouseEvent) => {
    if (activeTool) return; // Suppress context menu when a tool is active
    event.preventDefault();
    setMenu({ isOpen: true, x: event.clientX, y: event.clientY, sourceNodeId: null, sourceNodeType: null, sourceHandleId: null });
  }, [activeTool]);
```

- [ ] **Step 10: Add asset handlers**

After the comment-creation handler, add:

```tsx
  const handleAssetUpload = useCallback((newItems: AssetItem[]) => {
    setAssets(prev => {
      const updated = [...newItems, ...prev];
      onSaveAssets(updated);
      return updated;
    });
  }, [onSaveAssets]);

  const handleAssetRemove = useCallback((id: string) => {
    setAssets(prev => {
      const updated = prev.filter(a => a.id !== id);
      onSaveAssets(updated);
      return updated;
    });
  }, [onSaveAssets]);

  const handleHistoryUse = useCallback((item: HistoryItem) => {
    const pos = screenToFlowPosition({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
    const newId = `from_hist_${Date.now()}`;
    const newNode: Node = {
      id: newId,
      type: item.type === 'video' ? 'videoNode' : 'imageNode',
      position: { x: pos.x - 190, y: pos.y - 107 },
      width: 380,
      height: 214,
      data: { label: item.nodeLabel || '历史图片', contentType: item.type, content: [item.src], onPlusClick: handlePlusClick, onUpdate: handleUpdateNode },
    };
    setNodes(nds => [...nds, newNode]);
    setShowHistory(false);
  }, [screenToFlowPosition, setNodes, handlePlusClick, handleUpdateNode]);
```

- [ ] **Step 11: Add canvas drop handler for asset drag**

After the asset handlers, add:

```tsx
  const handleCanvasDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const assetType = e.dataTransfer.getData('application/asset-type') as 'image' | 'video' | '';
    const assetSrc = e.dataTransfer.getData('application/asset-src');
    const assetName = e.dataTransfer.getData('application/asset-name');
    if (!assetType || !assetSrc) return;

    const pos = screenToFlowPosition({ x: e.clientX, y: e.clientY });
    const newId = `dropped_${Date.now()}`;
    const newNode: Node = {
      id: newId,
      type: assetType === 'video' ? 'videoNode' : 'imageNode',
      position: { x: pos.x - 190, y: pos.y - 107 },
      width: 380,
      height: 214,
      data: { label: assetName || '素材', contentType: assetType, content: [assetSrc], onPlusClick: handlePlusClick, onUpdate: handleUpdateNode },
    };
    setNodes(nds => [...nds, newNode]);
  }, [screenToFlowPosition, setNodes, handlePlusClick, handleUpdateNode]);
```

- [ ] **Step 12: Update the nodesWithHandlers mapping to include onUpdate for board/comment**

The existing `nodesWithHandlers` mapping already spreads `onUpdate: handleUpdateNode`. Verify the existing line:
```tsx
return { ...node, data: { ...node.data, onPlusClick: handlePlusClick, onUpdate: handleUpdateNode, referenceImage, sourceImage } };
```
This is already correct — no change needed.

- [ ] **Step 13: Update the JSX return — wrap ReactFlow with drop handler and overlay**

Replace the entire `return (` block of the Flow component with:

```tsx
  return (
    <div
      className="w-screen h-screen bg-[#000000]"
      onDragOver={e => e.preventDefault()}
      onDrop={handleCanvasDrop}
    >
      <div className="w-full h-full relative">
        <ReactFlow
          nodes={nodesWithHandlers}
          edges={edgesWithHighlight}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onConnectEnd={onConnectEnd}
          onPaneClick={onPaneClick}
          onPaneContextMenu={onPaneContextMenu}
          onMoveStart={closeMenu}
          onNodeDragStop={onNodeDragStop}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          defaultEdgeOptions={{ type: 'custom' }}
          colorMode="dark"
          style={{ '--xy-background-color': '#000000' } as React.CSSProperties}
          connectionLineStyle={{ stroke: '#666666', strokeWidth: 2, strokeDasharray: '5 5' }}
          connectionRadius={250}
          panOnDrag={activeTool === 'board' ? false : [1, 2]}
          selectionOnDrag={activeTool === null}
          panOnScroll={false}
          minZoom={0.05}
          maxZoom={4}
          defaultViewport={{ x: 0, y: 0, zoom: 1 }}
        >
          <Background variant={BackgroundVariant.Dots} color="#2a2a2a" gap={24} size={1.8} />
          <Controls />

          {/* Top-left: home button */}
          <Panel position="top-left">
            <button
              onClick={handleGoHome}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white/5 hover:bg-white/10 text-gray-400 hover:text-gray-200 rounded-xl text-[13px] border border-white/5 transition-all backdrop-blur-sm"
            >
              ⌂ 首页
            </button>
          </Panel>

          {/* Top-center: breakdown trigger */}
          <Panel position="top-center">
            <button
              onClick={() => setShowBreakdown(v => !v)}
              className={`flex items-center gap-2 px-4 py-1.5 rounded-xl text-[13px] border transition-all backdrop-blur-sm ${
                showBreakdown
                  ? 'bg-white/15 text-white border-white/20'
                  : 'bg-white/5 hover:bg-white/10 text-gray-400 hover:text-gray-200 border-white/5'
              }`}
            >
              <FileText size={13} />
              剧本拆解
              {storyboardRows.length > 0 && (
                <span className="bg-white/10 text-gray-400 text-[10px] px-1.5 py-0.5 rounded-full leading-none">
                  {storyboardRows.length}
                </span>
              )}
            </button>
          </Panel>

          <MiniMap nodeColor="#333333" maskColor="rgba(0, 0, 0, 0.8)" className="bg-[#0a0a0a] border-[#1a1a1a]" />
        </ReactFlow>

        {/* Board drag-create overlay */}
        {activeTool === 'board' && (
          <div
            className="absolute inset-0 z-40"
            style={{ cursor: 'crosshair' }}
            onMouseDown={handleBoardDragStart}
            onMouseMove={handleBoardDragMove}
            onMouseUp={handleBoardDragEnd}
          />
        )}

        {/* Board draft preview rectangle */}
        {boardDraft && (
          <div
            className="absolute pointer-events-none z-41 border-2 border-dashed border-blue-400/70 bg-blue-400/5 rounded-xl"
            style={{
              left: Math.min(boardDraft.startX, boardDraft.currentX),
              top: Math.min(boardDraft.startY, boardDraft.currentY),
              width: Math.abs(boardDraft.currentX - boardDraft.startX),
              height: Math.abs(boardDraft.currentY - boardDraft.startY),
            }}
          />
        )}

        {/* Active tool hint */}
        {activeTool && (
          <div className="absolute top-20 left-1/2 -translate-x-1/2 z-50 px-4 py-1.5 bg-black/70 backdrop-blur-sm border border-white/10 rounded-full text-sm text-white/70 pointer-events-none">
            {activeTool === 'board' ? '拖拽画布创建画板 · Esc 退出' : '点击画布添加评论 · Esc 退出'}
          </div>
        )}

        {/* Left Toolbar */}
        <LeftToolbar
          activeTool={activeTool}
          showAssets={showAssets}
          showHistory={showHistory}
          onToolChange={setActiveTool}
          onToggleAssets={() => { setShowAssets(v => !v); setShowHistory(false); }}
          onToggleHistory={() => { setShowHistory(v => !v); setShowAssets(false); }}
        />

        {/* Asset Panel */}
        {showAssets && (
          <AssetPanel
            assets={assets}
            onUpload={handleAssetUpload}
            onRemove={handleAssetRemove}
          />
        )}

        {/* History Panel */}
        {showHistory && (
          <HistoryPanel
            history={generationHistory}
            onUseItem={handleHistoryUse}
          />
        )}

        <ContextMenu
          x={menu.x} y={menu.y}
          visible={menu.isOpen}
          sourceNodeType={menu.sourceNodeType}
          onClose={closeMenu}
          onAction={onAction}
        />

        {showBreakdown && (
          <BreakdownModal
            initialRows={storyboardRows}
            onClose={() => setShowBreakdown(false)}
            onImport={handleImportFromBreakdown}
          />
        )}
      </div>
      <AIPanel />
    </div>
  );
```

- [ ] **Step 14: Update App component to pass new props to Flow**

In the `App` component, update state and handlers:

```tsx
export default function App() {
  const [view, setView] = useState<'home' | 'canvas' | 'skills'>('home');
  const [currentProject, setCurrentProject] = useState<Project | null>(null);
  const [canvasInitialNodes, setCanvasInitialNodes] = useState<Node[]>([]);
  const [canvasInitialEdges, setCanvasInitialEdges] = useState<Edge[]>([]);
  const [canvasInitialRows, setCanvasInitialRows] = useState<StoryboardRow[]>([]);
  const [canvasInitialAssets, setCanvasInitialAssets] = useState<AssetItem[]>([]);
  const [canvasInitialHistory, setCanvasInitialHistory] = useState<HistoryItem[]>([]);

  const handleNewProject = () => {
    const proj = createProject();
    saveProject(proj);
    setCurrentProject(proj);
    setCanvasInitialNodes([]);
    setCanvasInitialEdges([]);
    setCanvasInitialRows([]);
    setCanvasInitialAssets([]);
    setCanvasInitialHistory([]);
    setView('canvas');
  };

  const handleOpenProject = (project: Project) => {
    setCurrentProject(project);
    setCanvasInitialNodes(project.nodes);
    setCanvasInitialEdges(project.edges);
    setCanvasInitialRows(project.storyboardRows);
    setCanvasInitialAssets(project.assets || []);
    setCanvasInitialHistory(project.generationHistory || []);
    setView('canvas');
  };

  const handleGoHome = () => setView('home');
  const handleGoToSkills = () => setView('skills');

  const handleCanvasSave = (nodes: Node[], edges: Edge[]) => {
    if (!currentProject) return;
    const thumbnail = extractThumbnail(nodes);
    const updated = { ...currentProject, nodes, edges, thumbnail, updatedAt: Date.now() };
    setCurrentProject(updated);
    saveProject(updated);
  };

  const handleRowsSave = (rows: StoryboardRow[]) => {
    if (!currentProject) return;
    const updated = { ...currentProject, storyboardRows: rows, updatedAt: Date.now() };
    setCurrentProject(updated);
    saveProject(updated);
  };

  const handleAssetsSave = (assets: AssetItem[]) => {
    if (!currentProject) return;
    const updated = { ...currentProject, assets, updatedAt: Date.now() };
    setCurrentProject(updated);
    saveProject(updated);
  };

  const handleHistorySave = (history: HistoryItem[]) => {
    if (!currentProject) return;
    const updated = { ...currentProject, generationHistory: history, updatedAt: Date.now() };
    setCurrentProject(updated);
    saveProject(updated);
  };

  return (
    <ReactFlowProvider>
      {view === 'home' ? (
        <HomePage
          onNewProject={handleNewProject}
          onOpenProject={handleOpenProject}
          onGoToSkills={handleGoToSkills}
        />
      ) : view === 'skills' ? (
        <SkillCommunity onBack={handleGoHome} />
      ) : (
        <Flow
          initialNodes={canvasInitialNodes}
          initialEdges={canvasInitialEdges}
          initialStoryboardRows={canvasInitialRows}
          initialAssets={canvasInitialAssets}
          initialHistory={canvasInitialHistory}
          onGoHome={handleGoHome}
          onSave={handleCanvasSave}
          onSaveRows={handleRowsSave}
          onSaveAssets={handleAssetsSave}
          onSaveHistory={handleHistorySave}
        />
      )}
    </ReactFlowProvider>
  );
}
```

- [ ] **Step 15: Verify TypeScript compiles clean**

```bash
cd C:\Users\oldch\Desktop\HJM-aigc-flow-main && npx tsc --noEmit 2>&1
```

Expected: no errors. Fix any type errors before committing.

- [ ] **Step 16: Commit**

```bash
git add src/App.tsx
git commit -m "feat: wire left toolbar, board tool, comment tool, asset panel, history panel"
```

---

### Task 8: Smoke Test

- [ ] **Step 1: Verify dev server is running and open the app**

```bash
cd C:\Users\oldch\Desktop\HJM-aigc-flow-main
# Check server is running on port 3000
netstat -ano | findstr ":3000"
```

Open http://localhost:3000 in browser, create a new project.

- [ ] **Step 2: Test Left Toolbar**

- Toolbar visible on left side of canvas ✓
- Clicking Library icon toggles asset panel ✓
- Clicking History icon toggles history panel (closes asset panel) ✓
- Asset and history panels are mutually exclusive ✓

- [ ] **Step 3: Test Board Tool**

- Click Frame icon → cursor becomes crosshair, hint appears ✓
- Drag on canvas → blue dashed preview rectangle tracks mouse ✓
- Release → board node appears with "未命名画板" label ✓
- Double-click board name → editable input appears, saves on Enter ✓
- Drag a node into board → node follows board when board is moved ✓
- Drag node out of board → node stays in place (no longer child) ✓
- Esc key exits board tool ✓

- [ ] **Step 4: Test Comment Tool**

- Click chat bubble icon → hint appears ✓
- Click canvas → yellow sticky note appears ✓
- Type in sticky note ✓
- Author "少军" shows bottom-right ✓

- [ ] **Step 5: Test Asset Panel**

- Click upload → file picker opens ✓
- Upload image → appears in thumbnail grid ✓
- Drag thumbnail to canvas → imageNode created at drop position ✓
- Click × on thumbnail → asset removed ✓

- [ ] **Step 6: Test History Panel**

- Generate an image on any imageNode ✓
- Open History panel → generated image appears under "今天 Today" ✓
- Click thumbnail → new imageNode created on canvas ✓
