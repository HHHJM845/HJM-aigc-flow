# 视频管理 Tab Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "视频管理" fourth tab to the bottom tab bar — users check-mark video nodes on the canvas, view them in a 4-column 16:9 grid, drag-reorder them, and download them individually with sequential filenames.

**Architecture:** `VideoOrderItem[]` state lives in the `Flow` component (same level as `storyboardOrder`), persisted via `storage.ts`. `VideoNode` receives `data.videoOrderUrls` and `data.onToggleVideo` injected in the `nodesWithHandlers` map (same pattern as `isInStoryboard`/`onToggleStoryboard` for ImageNode). A new `VideoView` component renders the grid using `@dnd-kit/sortable` (already in project).

**Tech Stack:** React 18, TypeScript, Tailwind CSS, @dnd-kit/sortable (already installed), lucide-react

---

### Task 1: Add VideoOrderItem type + update storage

**Files:**
- Modify: `src/lib/storage.ts`

- [ ] **Step 1: Add `VideoOrderItem` interface and update `Project`**

Open `src/lib/storage.ts`. After the `HistoryItem` interface (around line 18), add:

```ts
export interface VideoOrderItem {
  id: string;       // e.g. `vid-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
  nodeId: string;   // source VideoNode ID
  url: string;      // snapshotted video URL at time of check
  label: string;    // snapshotted node label at time of check
}
```

Then in the `Project` interface, add one field after `storyboardOrder`:

```ts
  storyboardOrder: string[];
  videoOrder: VideoOrderItem[];
```

- [ ] **Step 2: Update `createProject` default**

In `createProject()`, add `videoOrder: []` alongside `storyboardOrder: []`:

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
  };
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd C:\Users\oldch\Desktop\HJM-aigc-flow-main
npx tsc --noEmit 2>&1 | head -30
```

Expected: no errors (or only pre-existing errors unrelated to storage.ts).

- [ ] **Step 4: Commit**

```bash
git add src/lib/storage.ts
git commit -m "feat: add VideoOrderItem type and videoOrder field to Project"
```

---

### Task 2: Add checkmark button to VideoNode

**Files:**
- Modify: `src/components/VideoNode.tsx`

- [ ] **Step 1: Read current VideoNode signature and hover state**

The component signature is:
```ts
export default function VideoNode({ id, data, selected }: { id: string, data: any, selected?: boolean })
```

Data props are injected via `data.xxx` (not direct props). The component already has `isHovered` state and `setIsHovered` handlers.

- [ ] **Step 2: Extract toggle data from `data` object**

After the existing `const showPanel = selected && selectedCount === 1;` line, add:

```ts
const videoOrderUrls: string[] = Array.isArray(data.videoOrderUrls) ? data.videoOrderUrls : [];
const onToggleVideo: ((nodeId: string, url: string, label: string) => void) | undefined = data.onToggleVideo;
const isInVideoOrder = currentContent ? videoOrderUrls.includes(currentContent) : false;
```

- [ ] **Step 3: Add checkmark button JSX**

Find the `{/* 预选中环绕光效 */}` comment inside the return JSX (it's the first child after the outer `<div>`). Add the checkmark button **just before** that comment:

```tsx
{/* 视频收录打勾按钮 */}
{onToggleVideo && (isHovered || isInVideoOrder) && currentContent && (
  <button
    className="nodrag absolute top-2 right-2 z-30 w-[22px] h-[22px] rounded-full flex items-center justify-center transition-all duration-150"
    style={
      isInVideoOrder
        ? { background: 'white', boxShadow: '0 2px 6px rgba(0,0,0,0.4)' }
        : { background: 'rgba(0,0,0,0.35)', border: '1.5px solid rgba(255,255,255,0.5)', backdropFilter: 'blur(4px)' }
    }
    onClick={(e) => {
      e.stopPropagation();
      onToggleVideo(id, currentContent, data.label || id);
    }}
    title={isInVideoOrder ? '从视频管理中移除' : '加入视频管理'}
  >
    {isInVideoOrder && (
      <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
        <path d="M2 6l3 3 5-5" stroke="#111" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    )}
  </button>
)}
```

- [ ] **Step 4: Add white ring when in video order**

Find the ring class logic on the outer wrapper div. It currently reads something like:

```ts
isInStoryboard
  ? 'ring-2 ring-inset ring-white/80'
  : selected ...
```

VideoNode does NOT have `isInStoryboard`. Find the `selected` ring logic in the outer wrapper className and add `isInVideoOrder` support. The wrapper className string includes a ternary for `selected`. Locate the line that has `ring-2` and update the ring logic to:

```ts
isInVideoOrder
  ? 'ring-2 ring-inset ring-white/80'
  : selected
    ? 'ring-2 ring-inset ring-gray-500 shadow-[0_0_25px_rgba(255,255,255,0.05)]'
    : 'ring-1 ring-inset ring-white/5 hover:ring-white/10'
```

- [ ] **Step 5: Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1 | head -30
```

Expected: no new errors.

- [ ] **Step 6: Commit**

```bash
git add src/components/VideoNode.tsx
git commit -m "feat: add video order checkmark button to VideoNode"
```

---

### Task 3: Add 'video' tab to BottomTabBar

**Files:**
- Modify: `src/components/BottomTabBar.tsx`

- [ ] **Step 1: Update ActiveView type and tabs array**

Open `src/components/BottomTabBar.tsx`. The file currently has:

```ts
type ActiveView = 'canvas' | 'storyboard' | 'breakdown';

const tabs: { key: ActiveView; label: string }[] = [
  { key: 'breakdown', label: '剧本拆解' },
  { key: 'canvas', label: '无限画布' },
  { key: 'storyboard', label: '分镜管理' },
];
```

Update both to:

```ts
type ActiveView = 'canvas' | 'storyboard' | 'breakdown' | 'video';

const tabs: { key: ActiveView; label: string }[] = [
  { key: 'breakdown', label: '剧本拆解' },
  { key: 'canvas', label: '无限画布' },
  { key: 'storyboard', label: '分镜管理' },
  { key: 'video', label: '视频管理' },
];
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1 | head -30
```

Expected: may show errors in App.tsx because `activeView` type hasn't been updated yet — that's fine, will be fixed in Task 5.

- [ ] **Step 3: Commit**

```bash
git add src/components/BottomTabBar.tsx
git commit -m "feat: add 视频管理 tab to BottomTabBar"
```

---

### Task 4: Create VideoView component

**Files:**
- Create: `src/components/VideoView.tsx`

- [ ] **Step 1: Create the file with full implementation**

Create `src/components/VideoView.tsx` with this content:

```tsx
import React, { useState } from 'react';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, X, Download } from 'lucide-react';
import type { VideoOrderItem } from '../lib/storage';

interface Props {
  videoOrder: VideoOrderItem[];
  onReorder: (newOrder: VideoOrderItem[]) => void;
  onRemove: (id: string) => void;
}

function VideoCard({
  item,
  index,
  onRemove,
  onDownload,
}: {
  item: VideoOrderItem;
  index: number;
  onRemove: (id: string) => void;
  onDownload: (url: string, index: number) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: item.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 50 : undefined,
  };

  const padded = String(index + 1).padStart(2, '0');

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`relative bg-[#1a1a1a] border rounded-[10px] overflow-hidden ${
        isDragging ? 'border-white/30 shadow-2xl scale-[1.02]' : 'border-white/[0.08]'
      }`}
    >
      {/* Video area 16:9 */}
      <div className="relative w-full" style={{ aspectRatio: '16/9', background: '#111' }}>
        {item.url ? (
          <video
            src={item.url}
            preload="metadata"
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <span className="text-gray-700 text-sm">▶</span>
          </div>
        )}

        {/* Drag handle — top left */}
        <div
          {...attributes}
          {...listeners}
          className="absolute top-1.5 left-1.5 cursor-grab active:cursor-grabbing text-white/25 hover:text-white/50 transition-colors p-0.5"
        >
          <GripVertical size={14} />
        </div>

        {/* Sequence badge — bottom left */}
        <div className="absolute bottom-1.5 left-1.5 bg-black/70 text-white text-[9px] font-bold px-1.5 py-0.5 rounded">
          {padded}
        </div>

        {/* Remove button — top right */}
        <button
          onClick={() => onRemove(item.id)}
          className="absolute top-1.5 right-1.5 w-5 h-5 bg-black/60 hover:bg-black/80 rounded-full flex items-center justify-center text-gray-500 hover:text-gray-200 transition-colors"
          title="从视频管理中移除"
        >
          <X size={10} />
        </button>
      </div>

      {/* Bottom row */}
      <div className="flex items-center justify-between px-2 py-1.5 gap-2">
        <span className="text-[#aaa] text-[10px] truncate flex-1">{item.label || `视频 ${padded}`}</span>
        <button
          onClick={() => onDownload(item.url, index)}
          className="flex-shrink-0 flex items-center gap-1 px-2 py-1 bg-white/5 hover:bg-white/10 border border-white/[0.08] rounded text-[9px] text-gray-500 hover:text-gray-300 transition-colors"
        >
          <Download size={9} />
          下载
        </button>
      </div>
    </div>
  );
}

export default function VideoView({ videoOrder, onReorder, onRemove }: Props) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = videoOrder.findIndex(v => v.id === active.id);
      const newIndex = videoOrder.findIndex(v => v.id === over.id);
      onReorder(arrayMove(videoOrder, oldIndex, newIndex));
    }
  };

  const handleDownload = (url: string, index: number) => {
    const padded = String(index + 1).padStart(2, '0');
    const a = document.createElement('a');
    a.href = url;
    a.download = `${padded}.mp4`;
    a.click();
  };

  const handleDownloadAll = () => {
    videoOrder.forEach((item, index) => {
      setTimeout(() => handleDownload(item.url, index), index * 200);
    });
  };

  return (
    <div className="absolute inset-0 bg-[#0c0c0c] flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/[0.06] flex-shrink-0">
        <div className="flex items-center gap-2.5">
          <span className="text-white font-medium text-[14px]">视频管理</span>
          <span className="text-gray-600 text-xs">已选 {videoOrder.length} 个视频</span>
        </div>
        {videoOrder.length > 0 && (
          <button
            onClick={handleDownloadAll}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white/[0.08] hover:bg-white/[0.12] border border-white/10 rounded-lg text-gray-300 text-xs transition-colors"
          >
            <Download size={12} />
            全部下载（{videoOrder.length}个）
          </button>
        )}
      </div>

      {/* Grid or empty state */}
      {videoOrder.length === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-gray-600 text-sm text-center leading-relaxed">
            在画布中点击视频节点右上角的勾选按钮<br />即可加入视频管理
          </p>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto p-5">
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={videoOrder.map(v => v.id)} strategy={verticalListSortingStrategy}>
              <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
                {videoOrder.map((item, index) => (
                  <VideoCard
                    key={item.id}
                    item={item}
                    index={index}
                    onRemove={onRemove}
                    onDownload={handleDownload}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1 | head -30
```

Expected: no errors in VideoView.tsx (App.tsx may still complain about `'video'` not being in its local `ActiveView` — fixed in Task 5).

- [ ] **Step 3: Commit**

```bash
git add src/components/VideoView.tsx
git commit -m "feat: create VideoView component with 4-col 16:9 grid and drag-reorder"
```

---

### Task 5: Wire everything in App.tsx

**Files:**
- Modify: `src/App.tsx`

This is the largest task. Work through it in steps.

- [ ] **Step 1: Add import for VideoView and VideoOrderItem**

At the top of `src/App.tsx`, after the existing imports, add:

```ts
import VideoView from './components/VideoView';
import type { VideoOrderItem } from './lib/storage';
```

Also add `VideoOrderItem` to the `storage.ts` import line — find:
```ts
import {
  saveProject,
  ...
} from './lib/storage';
```
And add `type VideoOrderItem` to that import (or keep the separate import above — either works).

- [ ] **Step 2: Add `videoOrder` props to the `Flow` component interface**

Find the `Flow` function definition (around line 85). Its props destructuring currently ends with:
```ts
  onSaveStoryboardOrder: (order: string[]) => void;
```

Add two more props after that:
```ts
  initialVideoOrder: VideoOrderItem[];
  onSaveVideoOrder: (order: VideoOrderItem[]) => void;
```

And in the destructuring parameter list add:
```ts
  initialVideoOrder,
  onSaveVideoOrder,
```

- [ ] **Step 3: Add `videoOrder` state inside `Flow`**

Inside the `Flow` function body, after the `storyboardOrder` state line:
```ts
const [storyboardOrder, setStoryboardOrder] = useState<string[]>(initialStoryboardOrder);
```

Add:
```ts
const [videoOrder, setVideoOrder] = useState<VideoOrderItem[]>(initialVideoOrder);
```

- [ ] **Step 4: Update `activeView` type**

Find:
```ts
const [activeView, setActiveView] = useState<'canvas' | 'storyboard' | 'breakdown'>('canvas');
```

Replace with:
```ts
const [activeView, setActiveView] = useState<'canvas' | 'storyboard' | 'breakdown' | 'video'>('canvas');
```

- [ ] **Step 5: Add `handleToggleVideo` callback**

After `handleToggleStoryboard` (around line 250), add:

```ts
const handleToggleVideo = useCallback((nodeId: string, url: string, label: string) => {
  setVideoOrder(prev => {
    const exists = prev.find(v => v.nodeId === nodeId && v.url === url);
    const next = exists
      ? prev.filter(v => v.id !== exists.id)
      : [...prev, { id: `vid-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, nodeId, url, label }];
    onSaveVideoOrder(next);
    return next;
  });
}, [onSaveVideoOrder]);
```

- [ ] **Step 6: Inject videoOrderUrls and onToggleVideo into VideoNode data**

Find the `nodesWithHandlers` map (around line 515). It currently has:
```ts
...(node.type === 'imageNode' ? {
  isInStoryboard: storyboardOrder.includes(node.id),
  onToggleStoryboard: handleToggleStoryboard,
} : {}),
```

Add a similar block right after for videoNode:
```ts
...(node.type === 'videoNode' ? {
  videoOrderUrls: videoOrder.map(v => v.url),
  onToggleVideo: handleToggleVideo,
} : {}),
```

- [ ] **Step 7: Add VideoView rendering**

Find the Breakdown view block (around line 700):
```tsx
{/* Breakdown view */}
<div
  className="absolute inset-0"
  style={{
    opacity: activeView === 'breakdown' ? 1 : 0,
    ...
  }}
>
  <BreakdownView ... />
</div>
```

Add the VideoView block right after it, before `<BottomTabBar .../>`:

```tsx
{/* Video manager view */}
<div
  className="absolute inset-0"
  style={{
    opacity: activeView === 'video' ? 1 : 0,
    transform: activeView === 'video' ? 'translateY(0)' : 'translateY(8px)',
    transition: 'opacity 300ms ease-out, transform 300ms ease-out',
    pointerEvents: activeView === 'video' ? 'auto' : 'none',
  }}
>
  <VideoView
    videoOrder={videoOrder}
    onReorder={(newOrder) => {
      setVideoOrder(newOrder);
      onSaveVideoOrder(newOrder);
    }}
    onRemove={(id) => {
      setVideoOrder(prev => {
        const next = prev.filter(v => v.id !== id);
        onSaveVideoOrder(next);
        return next;
      });
    }}
  />
</div>
```

- [ ] **Step 8: Add `initialVideoOrder` and `onSaveVideoOrder` state/handlers in the outer `App` component**

In the outer `App` function (around line 735), after the `canvasInitialStoryboardOrder` state:

```ts
const [canvasInitialVideoOrder, setCanvasInitialVideoOrder] = useState<VideoOrderItem[]>([]);
```

Then add a save handler after `handleStoryboardOrderSave`:

```ts
const handleVideoOrderSave = (order: VideoOrderItem[]) => {
  if (!currentProject) return;
  const updated = { ...currentProject, videoOrder: order, updatedAt: Date.now() };
  setCurrentProject(updated);
  saveProject(updated);
};
```

- [ ] **Step 9: Load `videoOrder` when opening a project**

Find where `storyboardOrder` is loaded when opening a project (around line 754):
```ts
setCanvasInitialStoryboardOrder(project.storyboardOrder || []);
```

Add right after:
```ts
setCanvasInitialVideoOrder(project.videoOrder || []);
```

- [ ] **Step 10: Pass new props to `<Flow>`**

Find the `<Flow ... />` JSX (around line 810). Add the two new props:

```tsx
initialVideoOrder={canvasInitialVideoOrder}
onSaveVideoOrder={handleVideoOrderSave}
```

- [ ] **Step 11: Verify TypeScript compiles cleanly**

```bash
npx tsc --noEmit 2>&1 | head -40
```

Expected: zero errors.

- [ ] **Step 12: Run dev server and manually verify**

```bash
npm run dev
```

Check:
1. Bottom tab bar shows 4 tabs: 剧本拆解 / 无限画布 / 分镜管理 / 视频管理
2. On a VideoNode with a video loaded, hovering shows the checkmark button top-right
3. Clicking checkmark adds it (white ring + filled check appears)
4. Clicking 视频管理 tab shows the video in a 16:9 card
5. Clicking ✕ on card removes the video (also removes ring on canvas node)
6. Drag-reorder works (sequence numbers update)
7. "下载" button triggers file download named `01.mp4`
8. "全部下载" triggers sequential downloads

- [ ] **Step 13: Commit**

```bash
git add src/App.tsx
git commit -m "feat: wire videoOrder state and VideoView into App"
```

---

### Task 6: Persist videoOrder in storage and deploy

**Files:**
- Modify: `src/lib/storage.ts` (already has the field — just verify save/load works)
- Deploy to server

- [ ] **Step 1: Verify project save/load round-trips videoOrder**

The `saveProject` and `loadProjects` functions use `JSON.stringify` / `JSON.parse` — `videoOrder` is included automatically since it's on the `Project` object. No code change needed. Just confirm by:

1. Add a video to 视频管理
2. Refresh the page
3. Open the same project
4. Navigate to 视频管理 — the video card should still be there

- [ ] **Step 2: Build and check for warnings**

```bash
npm run build 2>&1 | tail -20
```

Expected: build succeeds (chunk size warning is pre-existing and OK).

- [ ] **Step 3: Push to GitHub**

```bash
git push origin main
```

- [ ] **Step 4: Deploy to server**

```bash
ssh root@218.244.158.35 "cd /www/wwwroot/HJM-aigc-flow && git pull origin main && npm run build && cp -r dist /home/HJM-aigc-flow/ && pm2 restart aigc-flow"
```

Expected: pm2 shows `aigc-flow` status `online`.
