# 分镜管理"导出到画布"功能 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在分镜管理顶部栏加"导出到画布"按钮，将分镜按顺序批量生成 videoNode 追加到画布，每个节点预载分镜图片为参考图、AI生成的视频提示词预填入提示框。

**Architecture:** 共改动 3 个现有文件 + 新增 1 个 api.ts 函数。VideoNode 支持从 data 初始化 mode/prompt；StoryboardView 新增导出按钮和 loading 态；App.tsx Flow 组件新增异步导出 handler，调用新增的 `generateVideoPrompt` API 函数并行生成提示词，再以 Grid 布局追加节点。

**Tech Stack:** React, TypeScript, ReactFlow (@xyflow/react), lucide-react, /api/chat (DeepSeek)

---

## 文件改动清单

| 文件 | 操作 |
|------|------|
| `src/lib/api.ts` | 新增 `generateVideoPrompt` 函数 |
| `src/components/VideoNode.tsx` | 修改 2 处 useState 初始值 |
| `src/components/StoryboardView.tsx` | 新增 `onExportToCanvas` prop + 导出按钮 |
| `src/App.tsx` | 新增 `handleExportStoryboardToCanvas`，传递给 StoryboardView |

---

## Task 1: 在 api.ts 新增 generateVideoPrompt 函数

**Files:**
- Modify: `src/lib/api.ts`

- [ ] **Step 1: 在 `src/lib/api.ts` 末尾添加函数**

在文件末尾（第 146 行后）追加：

```ts
// ── 分镜描述 → 视频提示词 ─────────────────────────────
export async function generateVideoPrompt(shotDescription: string): Promise<string> {
  const systemPrompt = `你是专业的AI视频提示词工程师。根据以下分镜描述，生成一段适合AI视频生成的英文提示词，要求：简洁、具体、包含画面运动感描述，不超过80个英文单词。分镜描述：${shotDescription}`;

  const res = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messages: [{ role: 'user', content: '生成视频提示词' }],
      systemPrompt,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` })) as { error: string };
    throw new Error(err.error || `API 错误 ${res.status}`);
  }

  const { content } = await res.json() as { content: string };
  return content;
}
```

- [ ] **Step 2: 确认 TypeScript 无报错**

```bash
cd C:\Users\Administrator\Desktop\HJM-aigc-flow-main\.claude\worktrees\youthful-borg
npx tsc --noEmit 2>&1 | head -20
```

期望输出：无错误（空输出或只有警告）

- [ ] **Step 3: Commit**

```bash
git add src/lib/api.ts
git commit -m "feat: add generateVideoPrompt api function"
```

---

## Task 2: 更新 VideoNode.tsx 支持初始 mode 和 prompt

**Files:**
- Modify: `src/components/VideoNode.tsx`（第 28-29 行）

- [ ] **Step 1: 修改两处 useState 初始值**

找到 `src/components/VideoNode.tsx` 第 28-29 行：

```ts
// 原来
const [mode, setMode] = useState<'text' | 'image'>('text');
const [prompt, setPrompt] = useState('');
```

替换为：

```ts
const [mode, setMode] = useState<'text' | 'image'>(data.referenceImage ? 'image' : 'text');
const [prompt, setPrompt] = useState<string>(data.initialPrompt || '');
```

- [ ] **Step 2: 确认 TypeScript 无报错**

```bash
npx tsc --noEmit 2>&1 | head -20
```

期望输出：无错误

- [ ] **Step 3: Commit**

```bash
git add src/components/VideoNode.tsx
git commit -m "feat: VideoNode supports initialPrompt and auto image mode from data"
```

---

## Task 3: 更新 StoryboardView.tsx 加导出按钮

**Files:**
- Modify: `src/components/StoryboardView.tsx`

- [ ] **Step 1: 完整替换 StoryboardView.tsx**

用以下内容替换 `src/components/StoryboardView.tsx`：

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
  rectSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable';
import { Loader2 } from 'lucide-react';
import type { Node } from '@xyflow/react';
import StoryboardCard from './StoryboardCard';

interface Props {
  storyboardOrder: string[];
  nodes: Node[];
  onReorder: (newOrder: string[]) => void;
  onToggle: (nodeId: string) => void;
  onExportToCanvas: () => Promise<void>;
}

export default function StoryboardView({ storyboardOrder, nodes, onReorder, onToggle, onExportToCanvas }: Props) {
  const [isExporting, setIsExporting] = useState(false);

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

  const handleExport = async () => {
    setIsExporting(true);
    try {
      await onExportToCanvas();
    } finally {
      setIsExporting(false);
    }
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
        <div className="flex items-center gap-3">
          <span className="text-[12px] text-white/35">
            已选 {storyboardOrder.length} 个镜头
          </span>
          {storyboardOrder.length > 0 && (
            <button
              onClick={handleExport}
              disabled={isExporting}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-full text-[13px] font-medium bg-white/10 hover:bg-white/15 text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isExporting ? (
                <>
                  <Loader2 size={13} className="animate-spin" />
                  导出中...
                </>
              ) : (
                '导出到画布'
              )}
            </button>
          )}
        </div>
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
                    onRemove={() => onToggle(nodeId)}
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

- [ ] **Step 2: 确认 TypeScript 无报错**

```bash
npx tsc --noEmit 2>&1 | head -20
```

期望：有关 `onExportToCanvas` prop 缺失的错误（因为 App.tsx 还没传），属于正常，下一个 Task 修复。

- [ ] **Step 3: Commit**

```bash
git add src/components/StoryboardView.tsx
git commit -m "feat: StoryboardView add export-to-canvas button with loading state"
```

---

## Task 4: 在 App.tsx 添加导出 handler 并传递给 StoryboardView

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1: 在 App.tsx 顶部 import 处加入 generateVideoPrompt**

找到 App.tsx 中的 import 行：
```ts
import { type StoryboardRow } from './lib/api';
```

替换为：
```ts
import { type StoryboardRow, generateVideoPrompt } from './lib/api';
```

- [ ] **Step 2: 在 Flow 组件内添加 handleExportStoryboardToCanvas 函数**

找到 App.tsx 中（约第 320 行）：
```ts
  }, [onSaveStoryboardOrder]);

  const handleToggleVideo = useCallback(
```

在 `}, [onSaveStoryboardOrder]);` 和 `const handleToggleVideo` 之间插入以下函数：

```ts
  const handleExportStoryboardToCanvas = useCallback(async () => {
    const COLS = 4;
    const NODE_W = 380;
    const NODE_H = 214;
    const GAP_X = 60;
    const GAP_Y = 60;

    // 找现有节点 bounding box 最右边，新节点从右侧追加
    const currentNodes = nodesRef.current;
    const startX = currentNodes.length > 0
      ? Math.max(...currentNodes.map(n => n.position.x + (n.width ?? NODE_W))) + 80
      : 80;
    const startY = 80;

    // 收集每个分镜的图片和描述
    const items = storyboardOrder.map((nodeId, i) => {
      const node = currentNodes.find(n => n.id === nodeId);
      const content = node?.data?.content;
      const contentArr = Array.isArray(content) ? content : (content ? [content] : []);
      const imageSrc = (contentArr[0] as string) || '';
      const shotDesc = (node?.data?.shotDescription as string) || '';
      return { nodeId, imageSrc, shotDesc, index: i + 1 };
    });

    // 并行调 AI 生成视频提示词，单个失败不阻断
    const promptResults = await Promise.allSettled(
      items.map(item => generateVideoPrompt(item.shotDesc))
    );

    const newNodes: Node[] = items.map((item, i) => {
      const col = i % COLS;
      const row = Math.floor(i / COLS);
      const x = startX + col * (NODE_W + GAP_X);
      const y = startY + row * (NODE_H + GAP_Y);
      const optimizedPrompt =
        promptResults[i].status === 'fulfilled' ? promptResults[i].value : '';

      return {
        id: `export_${item.nodeId}_${Date.now()}_${i}`,
        type: 'videoNode' as const,
        position: { x, y },
        width: NODE_W,
        height: NODE_H,
        data: {
          label: `分镜 ${String(item.index).padStart(2, '0')}`,
          contentType: 'video',
          content: null,
          referenceImage: item.imageSrc || undefined,
          initialPrompt: optimizedPrompt,
          onPlusClick: handlePlusClick,
          onUpdate: handleUpdateNode,
        },
      };
    });

    setNodes(nds => [...nds, ...newNodes]);
    setActiveView('canvas');
  }, [storyboardOrder, nodesRef, setNodes, setActiveView, handlePlusClick, handleUpdateNode]);
```

- [ ] **Step 3: 将 handleExportStoryboardToCanvas 传递给 StoryboardView**

找到 App.tsx 中渲染 StoryboardView 的地方（约第 806 行）：

```tsx
        <StoryboardView
          storyboardOrder={storyboardOrder}
          nodes={nodes}
          onReorder={(newOrder) => {
            setStoryboardOrder(newOrder);
            onSaveStoryboardOrder(newOrder);
          }}
          onToggle={handleToggleStoryboard}
        />
```

替换为：

```tsx
        <StoryboardView
          storyboardOrder={storyboardOrder}
          nodes={nodes}
          onReorder={(newOrder) => {
            setStoryboardOrder(newOrder);
            onSaveStoryboardOrder(newOrder);
          }}
          onToggle={handleToggleStoryboard}
          onExportToCanvas={handleExportStoryboardToCanvas}
        />
```

- [ ] **Step 4: 确认 TypeScript 无报错**

```bash
npx tsc --noEmit 2>&1 | head -30
```

期望输出：无错误

- [ ] **Step 5: Commit**

```bash
git add src/App.tsx
git commit -m "feat: add handleExportStoryboardToCanvas in Flow, wire to StoryboardView"
```

---

## Task 5: 合并到 main 并部署

- [ ] **Step 1: 合并到 main**

```bash
cd C:\Users\Administrator\Desktop\HJM-aigc-flow-main
git merge claude/youthful-borg
git push origin main
```

- [ ] **Step 2: 服务器拉取、构建、重启**

```python
import paramiko, sys

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect('218.244.158.35', port=22, username='root', password='Huang_21254875', timeout=15)

stdin, stdout, stderr = client.exec_command(
    'cd /home/HJM-aigc-flow && git pull origin main && npm run build 2>&1'
)
stdout.channel.settimeout(120)
out = stdout.read().decode('utf-8', errors='replace')
lines = out.strip().split('\n')
sys.stdout.buffer.write('\n'.join(lines[-8:]).encode('utf-8'))

stdin2, stdout2, stderr2 = client.exec_command('pm2 restart aigc-flow 2>&1')
stdout2.channel.settimeout(15)
print(stdout2.read().decode('utf-8', errors='replace'))
client.close()
```

期望：`✓ built in X.XXs` 且 pm2 status `online`

- [ ] **Step 3: 同步本地 worktree**

```bash
cd C:\Users\Administrator\Desktop\HJM-aigc-flow-main\.claude\worktrees\practical-ardinghelli
git pull origin main
```
