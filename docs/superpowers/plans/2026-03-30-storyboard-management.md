# 分镜管理功能实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在画布界面底部添加「无限画布 / 分镜管理」切换标签，图片节点悬停时出现打勾按钮，勾选的节点在分镜管理页面以可拖拽排序的网格形式展示。

**Architecture:** 在 `Flow` 组件中维护 `storyboardOrder: string[]`（选中节点 ID 按打勾顺序排列）和 `activeView: 'canvas' | 'storyboard'` 两个状态。通过 `nodesWithHandlers` 向每个 imageNode 注入 `isInStoryboard` 和 `onToggleStoryboard` prop。分镜管理页面使用 `@dnd-kit/sortable` 实现拖拽排序。底部标签栏始终浮动显示，两个视图各自绝对定位叠放，用 opacity + translateY 过渡动画切换。

**Tech Stack:** React 18, TypeScript, Vite, @xyflow/react 12, @dnd-kit/core + @dnd-kit/sortable（新增），Tailwind CSS

---

## 文件清单

| 操作 | 文件 | 说明 |
|------|------|------|
| 修改 | `src/lib/storage.ts` | Project 接口新增 `storyboardOrder: string[]` |
| 新建 | `src/components/BottomTabBar.tsx` | 底部胶囊切换控件 |
| 新建 | `src/components/StoryboardCard.tsx` | 单张可拖拽分镜卡片 |
| 新建 | `src/components/StoryboardView.tsx` | 分镜管理整页视图 |
| 修改 | `src/components/ImageNode.tsx` | 新增打勾按钮逻辑 |
| 修改 | `src/App.tsx` | 新增状态、handlers、视图切换渲染 |

---

## Task 1: 安装 @dnd-kit 依赖

**Files:**
- 无文件变更，仅安装依赖

- [ ] **Step 1: 安装依赖**

```bash
cd C:/Users/oldch/Desktop/HJM-aigc-flow-main
npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
```

Expected output: 包含 `added N packages` 的成功信息，无报错。

- [ ] **Step 2: 验证安装**

```bash
node -e "require('./node_modules/@dnd-kit/core/dist/core.cjs.js'); console.log('ok')"
```

Expected: `ok`

---

## Task 2: 扩展 storage.ts 数据模型

**Files:**
- Modify: `src/lib/storage.ts`

- [ ] **Step 1: 在 `Project` 接口中新增 `storyboardOrder` 字段**

打开 `src/lib/storage.ts`，在 `generationHistory` 字段后新增：

```typescript
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
  storyboardOrder: string[];  // ← 新增
}
```

- [ ] **Step 2: 在 `createProject` 中添加默认值**

找到 `createProject` 函数，在 `generationHistory: []` 后添加：

```typescript
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
    storyboardOrder: [],  // ← 新增
  };
}
```

- [ ] **Step 3: 确认 TypeScript 编译通过**

```bash
cd C:/Users/oldch/Desktop/HJM-aigc-flow-main
npx tsc --noEmit 2>&1 | head -20
```

Expected: 无输出（无错误）或仅有与本次修改无关的旧错误。

- [ ] **Step 4: Commit**

```bash
git add src/lib/storage.ts
git commit -m "feat: add storyboardOrder field to Project interface"
```

---

## Task 3: 创建 BottomTabBar 组件

**Files:**
- Create: `src/components/BottomTabBar.tsx`

- [ ] **Step 1: 创建文件**

新建 `src/components/BottomTabBar.tsx`，内容如下：

```tsx
import React from 'react';

type ActiveView = 'canvas' | 'storyboard';

interface Props {
  activeView: ActiveView;
  onViewChange: (view: ActiveView) => void;
}

export default function BottomTabBar({ activeView, onViewChange }: Props) {
  return (
    <div
      className="absolute bottom-5 left-1/2 -translate-x-1/2 z-50 flex items-center gap-1 p-1 rounded-full border border-white/10 shadow-2xl"
      style={{ background: 'rgba(28,28,28,0.92)', backdropFilter: 'blur(12px)' }}
    >
      <button
        onClick={() => onViewChange('canvas')}
        className={`px-5 py-1.5 rounded-full text-[13px] font-medium transition-all duration-200 ${
          activeView === 'canvas'
            ? 'bg-white/15 text-white'
            : 'text-white/40 hover:text-white/70'
        }`}
      >
        无限画布
      </button>
      <button
        onClick={() => onViewChange('storyboard')}
        className={`px-5 py-1.5 rounded-full text-[13px] font-medium transition-all duration-200 ${
          activeView === 'storyboard'
            ? 'bg-white/15 text-white'
            : 'text-white/40 hover:text-white/70'
        }`}
      >
        分镜管理
      </button>
    </div>
  );
}
```

- [ ] **Step 2: 确认 TypeScript 编译通过**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Expected: 无新增错误。

- [ ] **Step 3: Commit**

```bash
git add src/components/BottomTabBar.tsx
git commit -m "feat: add BottomTabBar component"
```

---

## Task 4: 创建 StoryboardCard 组件

**Files:**
- Create: `src/components/StoryboardCard.tsx`

- [ ] **Step 1: 创建文件**

新建 `src/components/StoryboardCard.tsx`：

```tsx
import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface Props {
  id: string;
  index: number;
  imageSrc?: string | null;
}

export default function StoryboardCard({ id, index, imageSrc }: Props) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    zIndex: isDragging ? 50 : undefined,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`bg-[#1a1a1a] rounded-xl overflow-hidden border cursor-grab active:cursor-grabbing select-none transition-shadow duration-150 ${
        isDragging
          ? 'border-white/30 shadow-2xl scale-[1.04]'
          : 'border-white/8 hover:border-white/15'
      }`}
    >
      {/* Image area: 16:9 */}
      <div className="relative w-full" style={{ paddingBottom: '56.25%' }}>
        <div className="absolute inset-0">
          {imageSrc ? (
            <img
              src={imageSrc}
              alt={`分镜 ${index}`}
              className="w-full h-full object-cover pointer-events-none"
            />
          ) : (
            <div className="w-full h-full bg-[#242424] flex items-center justify-center text-white/10 text-sm">
              未生成
            </div>
          )}
        </div>
      </div>

      {/* Index label */}
      <div className="py-2 text-center text-[13px] text-white/40 font-medium">
        {index}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: 确认 TypeScript 编译通过**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Expected: 无新增错误。

- [ ] **Step 3: Commit**

```bash
git add src/components/StoryboardCard.tsx
git commit -m "feat: add StoryboardCard sortable component"
```

---

## Task 5: 创建 StoryboardView 组件

**Files:**
- Create: `src/components/StoryboardView.tsx`

- [ ] **Step 1: 创建文件**

新建 `src/components/StoryboardView.tsx`：

```tsx
import React from 'react';
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
  rectSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable';
import type { Node } from '@xyflow/react';
import StoryboardCard from './StoryboardCard';

interface Props {
  storyboardOrder: string[];
  nodes: Node[];
  onReorder: (newOrder: string[]) => void;
}

export default function StoryboardView({ storyboardOrder, nodes, onReorder }: Props) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = storyboardOrder.indexOf(String(active.id));
    const newIndex = storyboardOrder.indexOf(String(over.id));
    if (oldIndex === -1 || newIndex === -1) return;
    onReorder(arrayMove(storyboardOrder, oldIndex, newIndex));
  };

  // Build lookup: nodeId → first image src
  const getImageSrc = (nodeId: string): string | null => {
    const node = nodes.find(n => n.id === nodeId);
    if (!node?.data?.content) return null;
    const content = node.data.content as string | string[];
    const first = Array.isArray(content) ? content[0] : content;
    return typeof first === 'string' && first.length > 0 ? first : null;
  };

  return (
    <div className="w-full h-full bg-[#0f0f0f] flex flex-col overflow-hidden">
      {/* Top bar */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-white/6 shrink-0">
        <span className="text-[15px] font-semibold text-white">分镜管理</span>
        <span className="text-[12px] text-white/35">
          已选 {storyboardOrder.length} 个镜头
        </span>
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-y-auto px-6 py-6">
        {storyboardOrder.length === 0 ? (
          <div className="flex items-center justify-center h-full text-white/20 text-[14px]">
            在画布中勾选图片节点，它们会出现在这里
          </div>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext items={storyboardOrder} strategy={rectSortingStrategy}>
              <div className="grid grid-cols-4 gap-4">
                {storyboardOrder.map((nodeId, i) => (
                  <StoryboardCard
                    key={nodeId}
                    id={nodeId}
                    index={i + 1}
                    imageSrc={getImageSrc(nodeId)}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: 确认 TypeScript 编译通过**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Expected: 无新增错误。

- [ ] **Step 3: Commit**

```bash
git add src/components/StoryboardView.tsx
git commit -m "feat: add StoryboardView with dnd-kit sortable grid"
```

---

## Task 6: 在 ImageNode 中添加打勾按钮

**Files:**
- Modify: `src/components/ImageNode.tsx`

- [ ] **Step 1: 在 props 解构中接收新字段**

找到 `ImageNode` 函数签名：

```tsx
export default function ImageNode({ id, data, selected }: { id: string; data: any; selected?: boolean }) {
```

保持不变（`data` 为 `any`，新字段通过 data 传入），在组件内部顶部读取：

```tsx
const isInStoryboard: boolean = Boolean(data.isInStoryboard);
const onToggleStoryboard: ((id: string) => void) | undefined = data.onToggleStoryboard;
```

在现有 `const [isHovered, setIsHovered] = useState(false);` 之后添加这两行。

- [ ] **Step 2: 在节点主容器上添加打勾按钮**

找到节点主容器 div 的 className（含 `ring-2 ring-inset ring-gray-500` 的那行），将 `ring` 条件修改如下，同时在容器内添加打勾按钮：

将：
```tsx
className={`relative w-full h-full min-w-[320px] min-h-[250px] flex flex-col bg-[#262626] rounded-2xl shadow-2xl transition-all duration-200 overflow-visible ${
  selected
    ? 'ring-2 ring-inset ring-gray-500 shadow-[0_0_25px_rgba(255,255,255,0.05)]'
    : 'ring-1 ring-inset ring-white/5 hover:ring-white/10'
}`}
```

改为：
```tsx
className={`relative w-full h-full min-w-[320px] min-h-[250px] flex flex-col bg-[#262626] rounded-2xl shadow-2xl transition-all duration-200 overflow-visible ${
  isInStoryboard
    ? 'ring-2 ring-inset ring-white/80'
    : selected
    ? 'ring-2 ring-inset ring-gray-500 shadow-[0_0_25px_rgba(255,255,255,0.05)]'
    : 'ring-1 ring-inset ring-white/5 hover:ring-white/10'
}`}
```

- [ ] **Step 3: 添加打勾按钮 JSX**

在 `{/* 预选中环绕光效 */}` div 之前（容器内第一个元素位置）插入：

```tsx
{/* 分镜打勾按钮 */}
{onToggleStoryboard && (isHovered || isInStoryboard) && (
  <button
    className="nodrag absolute top-2 right-2 z-30 w-[22px] h-[22px] rounded-full flex items-center justify-center transition-all duration-150"
    style={
      isInStoryboard
        ? { background: 'white', boxShadow: '0 2px 6px rgba(0,0,0,0.4)' }
        : { background: 'rgba(0,0,0,0.35)', border: '1.5px solid rgba(255,255,255,0.5)', backdropFilter: 'blur(4px)' }
    }
    onClick={(e) => { e.stopPropagation(); onToggleStoryboard(id); }}
    title={isInStoryboard ? '从分镜中移除' : '加入分镜'}
  >
    {isInStoryboard && (
      <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
        <path d="M2 6l3 3 5-5" stroke="#111" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    )}
  </button>
)}
```

- [ ] **Step 4: 确认 TypeScript 编译通过**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Expected: 无新增错误。

- [ ] **Step 5: Commit**

```bash
git add src/components/ImageNode.tsx
git commit -m "feat: add storyboard checkmark button to ImageNode"
```

---

## Task 7: 在 App.tsx 中接入完整功能

**Files:**
- Modify: `src/App.tsx`

### 7a: 更新 Flow 组件 props 接口和状态

- [ ] **Step 1: 在 Flow 函数的 props 接口中新增两个字段**

找到 Flow 函数的 props 类型定义块（`initialNodes`, `initialEdges` 等），在 `onSaveHistory` 后添加：

```tsx
  initialStoryboardOrder: string[];
  onSaveStoryboardOrder: (order: string[]) => void;
```

- [ ] **Step 2: 在 Flow 函数体顶部解构新 props 并初始化状态**

找到 Flow 函数参数解构，添加两个新 prop：

```tsx
function Flow({
  initialNodes,
  initialEdges,
  initialStoryboardRows,
  initialAssets,
  initialHistory,
  initialStoryboardOrder,      // ← 新增
  onGoHome,
  onSave,
  onSaveRows,
  onSaveAssets,
  onSaveHistory,
  onSaveStoryboardOrder,       // ← 新增
}: { ... })
```

在现有 state 声明区域（`showBreakdown`, `activeTool` 等附近）添加：

```tsx
const [activeView, setActiveView] = useState<'canvas' | 'storyboard'>('canvas');
const [storyboardOrder, setStoryboardOrder] = useState<string[]>(initialStoryboardOrder);
```

- [ ] **Step 3: 添加 handleToggleStoryboard handler**

在 `handleDeleteNode` 之后添加：

```tsx
const handleToggleStoryboard = useCallback((nodeId: string) => {
  setStoryboardOrder(prev => {
    const next = prev.includes(nodeId)
      ? prev.filter(id => id !== nodeId)
      : [...prev, nodeId];
    onSaveStoryboardOrder(next);
    return next;
  });
}, [onSaveStoryboardOrder]);
```

- [ ] **Step 4: 在 nodesWithHandlers 中注入 isInStoryboard 和 onToggleStoryboard**

找到 `nodesWithHandlers` 的 map 中 return 语句的最后一行：

```tsx
return { ...node, data: { ...node.data, onPlusClick: handlePlusClick, onUpdate: handleUpdateNode, onDelete: handleDeleteNode, referenceImage, sourceImage } };
```

改为：

```tsx
return {
  ...node,
  data: {
    ...node.data,
    onPlusClick: handlePlusClick,
    onUpdate: handleUpdateNode,
    onDelete: handleDeleteNode,
    referenceImage,
    sourceImage,
    ...(node.type === 'imageNode' ? {
      isInStoryboard: storyboardOrder.includes(node.id),
      onToggleStoryboard: handleToggleStoryboard,
    } : {}),
  },
};
```

### 7b: 更新 Flow 组件的 JSX 渲染

- [ ] **Step 5: 在 App.tsx 顶部导入新组件**

在现有 import 区域添加：

```tsx
import BottomTabBar from './components/BottomTabBar';
import StoryboardView from './components/StoryboardView';
```

- [ ] **Step 6: 将 Flow 的 return JSX 改为双视图叠放结构**

找到 Flow 的 return 语句：

```tsx
return (
  <div
    className="w-screen h-screen bg-[#000000]"
    onDragOver={e => e.preventDefault()}
    onDrop={handleCanvasDrop}
  >
    <div className="w-full h-full relative">
      ...（所有画布内容）...
    </div>
    <AIPanel />
  </div>
);
```

改为：

```tsx
return (
  <div className="w-screen h-screen bg-[#000000] overflow-hidden relative">

    {/* Canvas view */}
    <div
      className="absolute inset-0"
      style={{
        opacity: activeView === 'canvas' ? 1 : 0,
        transform: activeView === 'canvas' ? 'translateY(0)' : 'translateY(8px)',
        transition: 'opacity 300ms ease-out, transform 300ms ease-out',
        pointerEvents: activeView === 'canvas' ? 'auto' : 'none',
      }}
      onDragOver={e => e.preventDefault()}
      onDrop={handleCanvasDrop}
    >
      <div className="w-full h-full relative">
        ...（原有全部画布内容，含 ReactFlow、LeftToolbar、panels 等，原样保留）...
      </div>
      <AIPanel />
    </div>

    {/* Storyboard view */}
    <div
      className="absolute inset-0"
      style={{
        opacity: activeView === 'storyboard' ? 1 : 0,
        transform: activeView === 'storyboard' ? 'translateY(0)' : 'translateY(8px)',
        transition: 'opacity 300ms ease-out, transform 300ms ease-out',
        pointerEvents: activeView === 'storyboard' ? 'auto' : 'none',
      }}
    >
      <StoryboardView
        storyboardOrder={storyboardOrder}
        nodes={nodes}
        onReorder={(newOrder) => {
          setStoryboardOrder(newOrder);
          onSaveStoryboardOrder(newOrder);
        }}
      />
    </div>

    {/* Bottom tab bar — always on top */}
    <BottomTabBar activeView={activeView} onViewChange={setActiveView} />

  </div>
);
```

### 7c: 更新外层 App 组件

- [ ] **Step 7: 在外层 App 中添加 storyboardOrder 状态**

找到外层 `App` 函数中现有的 state 声明（`canvasInitialNodes` 等），添加：

```tsx
const [canvasInitialStoryboardOrder, setCanvasInitialStoryboardOrder] = useState<string[]>([]);
```

- [ ] **Step 8: 在 handleOpenProject 中读取 storyboardOrder**

找到 `handleOpenProject` 函数，在 `setCanvasInitialHistory(project.generationHistory || [])` 之后添加：

```tsx
setCanvasInitialStoryboardOrder(project.storyboardOrder || []);
```

- [ ] **Step 9: 在 handleNewProject 中初始化 storyboardOrder**

找到 `handleNewProject`，在 `setCanvasInitialHistory([])` 之后添加：

```tsx
setCanvasInitialStoryboardOrder([]);
```

- [ ] **Step 10: 添加 handleStoryboardOrderSave 函数**

在 `handleHistorySave` 函数之后添加：

```tsx
const handleStoryboardOrderSave = (order: string[]) => {
  if (!currentProject) return;
  const updated = { ...currentProject, storyboardOrder: order, updatedAt: Date.now() };
  setCurrentProject(updated);
  saveProject(updated);
};
```

- [ ] **Step 11: 将新 props 传给 Flow 组件**

找到 `<Flow ... />` 的 JSX，添加两个新 prop：

```tsx
<Flow
  initialNodes={canvasInitialNodes}
  initialEdges={canvasInitialEdges}
  initialStoryboardRows={canvasInitialRows}
  initialAssets={canvasInitialAssets}
  initialHistory={canvasInitialHistory}
  initialStoryboardOrder={canvasInitialStoryboardOrder}      {/* ← 新增 */}
  onGoHome={handleGoHome}
  onSave={handleCanvasSave}
  onSaveRows={handleRowsSave}
  onSaveAssets={handleAssetsSave}
  onSaveHistory={handleHistorySave}
  onSaveStoryboardOrder={handleStoryboardOrderSave}          {/* ← 新增 */}
/>
```

- [ ] **Step 12: 确认 TypeScript 编译通过**

```bash
npx tsc --noEmit 2>&1 | head -30
```

Expected: 无新增错误。

- [ ] **Step 13: Commit**

```bash
git add src/App.tsx src/components/BottomTabBar.tsx src/components/StoryboardView.tsx src/components/StoryboardCard.tsx src/components/ImageNode.tsx src/lib/storage.ts
git commit -m "feat: integrate storyboard management view with bottom tab bar"
```

---

## Task 8: 手动验证

- [ ] **Step 1: 启动开发服务器**

```bash
npm run dev
```

打开 http://localhost:5173，进入一个项目。

- [ ] **Step 2: 验证底部标签栏**

确认画布底部中央出现「无限画布 / 分镜管理」胶囊控件，当前激活项（无限画布）高亮显示。

- [ ] **Step 3: 验证打勾按钮**

将鼠标移到任意图片节点上，确认右上角出现空心圆圈。点击后变为白色实心打勾，节点边框变白。移开鼠标后打勾按钮保持显示。再次点击后取消选中。

- [ ] **Step 4: 验证分镜管理视图**

打勾选中 2-3 个节点，点击底部「分镜管理」按钮，确认：
- 整页切换到分镜管理界面，有 300ms 淡入动画
- 显示「已选 N 个镜头」
- 卡片按打勾顺序排列，下方显示序号
- 拖拽卡片可以改变顺序

- [ ] **Step 5: 验证持久化**

排序后刷新页面，重新打开同一项目，确认勾选列表和排列顺序保持不变。

- [ ] **Step 6: 验证空状态**

在没有任何节点被勾选时切换到分镜管理，确认显示「在画布中勾选图片节点，它们会出现在这里」提示。
