# 画板功能修复实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 修复画板三个 bug：子节点不跟随移动、拖入/拖出分组关系不更新、删除画板不删子节点。

**Architecture:** 仅修改 `src/App.tsx` 三处函数：`handleBoardDragEnd`（节点数组排序）、`onNodeDragStop`（坐标换算）、`handleDeleteNode`（连带删除）。ReactFlow v12 原生支持 `parentId` 父子跟随，只需确保节点数组顺序正确（父在子前）即可激活该能力。

**Tech Stack:** React 18, TypeScript, @xyflow/react 12

---

## 文件清单

| 操作 | 文件 | 改动位置 |
|------|------|----------|
| 修改 | `src/App.tsx` | `handleBoardDragEnd`（约第 285-298 行）|
| 修改 | `src/App.tsx` | `onNodeDragStop`（约第 305-337 行）|
| 修改 | `src/App.tsx` | `handleDeleteNode`（约第 223-225 行）|

---

## Task 1: 修复 handleBoardDragEnd — 节点数组排序

**Files:**
- Modify: `src/App.tsx` — `handleBoardDragEnd` 函数内的 `setNodes` 回调

**背景：** ReactFlow v12 要求父节点在 `nodes` 数组中排在子节点**前面**，才能激活 parentId 跟随行为。当前代码 `return [...updatedChildren, boardNode]` 把 boardNode 追加到末尾，所有子节点排在父节点后面，导致父子关系无效。

- [ ] **Step 1: 读取当前文件，定位 handleBoardDragEnd 函数**

读取 `C:/Users/oldch/Desktop/HJM-aigc-flow-main/src/App.tsx`，找到 `handleBoardDragEnd` 函数中的 `setNodes` 回调，确认当前最后一行是：
```tsx
return [...updatedChildren, boardNode];
```

- [ ] **Step 2: 替换为正确的节点排序**

将 `setNodes` 回调内的最后一行改为：

```tsx
// Auto-assign nodes inside board as children
setNodes(nds => {
  const updatedChildren = nds.map(n => {
    if (n.type === 'boardNode' || n.type === 'commentNode' || n.parentId) return n;
    const cx = n.position.x + (n.width || 380) / 2;
    const cy = n.position.y + (n.height || 300) / 2;
    const inside = cx >= topLeft.x && cx <= topLeft.x + boardW &&
                   cy >= topLeft.y && cy <= topLeft.y + boardH;
    if (inside) {
      return { ...n, parentId: boardId, position: { x: n.position.x - topLeft.x, y: n.position.y - topLeft.y } };
    }
    return n;
  });
  // boardNode 必须在子节点前面，ReactFlow 才能识别父子关系
  const childrenOfBoard = updatedChildren.filter(n => n.parentId === boardId);
  const otherNodes = updatedChildren.filter(n => n.parentId !== boardId);
  return [...otherNodes, boardNode, ...childrenOfBoard];
});
```

具体来说，只需将原来的：
```tsx
      return [...updatedChildren, boardNode];
```
替换为：
```tsx
      const childrenOfBoard = updatedChildren.filter(n => n.parentId === boardId);
      const otherNodes = updatedChildren.filter(n => n.parentId !== boardId);
      return [...otherNodes, boardNode, ...childrenOfBoard];
```

- [ ] **Step 3: 验证 TypeScript 编译通过**

```bash
cd C:/Users/oldch/Desktop/HJM-aigc-flow-main
npx tsc --noEmit 2>&1 | head -20
```

Expected: 无新增错误。

- [ ] **Step 4: Commit**

```bash
git add src/App.tsx
git commit -m "fix: insert boardNode before children in nodes array for ReactFlow parentId"
```

---

## Task 2: 修复 onNodeDragStop — 坐标换算与分组更新

**Files:**
- Modify: `src/App.tsx` — `onNodeDragStop` 函数（约第 305-337 行）

**背景：** 节点拖动结束时需要重新判断归属。当节点有 `parentId` 时，其 `position` 是**相对坐标**（相对于父画板左上角）；没有 `parentId` 时是**绝对坐标**。拖入/拖出画板时必须在两种坐标系之间正确转换。当前实现逻辑基本正确，但需要确保 `board.position` 始终是画板的绝对坐标（boardNode 自身无 parentId，所以其 position 就是绝对坐标，这点是正确的）。此任务主要是验证并确认逻辑，如有问题则修正。

- [ ] **Step 1: 读取并审查当前 onNodeDragStop 实现**

读取 `src/App.tsx` 的 `onNodeDragStop` 函数（约第 305-337 行），确认以下逻辑存在：

1. 跳过 boardNode 和 commentNode 类型
2. 如果没有画板且节点没有 parentId，直接返回
3. 计算绝对坐标：若有 parentId 则加上 parent.position
4. 计算节点中心点，判断是否落入某个画板
5. 如果 parentId 未变化，直接返回（避免无效更新）
6. 落入新画板：转换为相对坐标，设置 parentId
7. 离开所有画板：使用绝对坐标，清除 parentId

- [ ] **Step 2: 将 onNodeDragStop 替换为经过验证的完整实现**

将整个 `onNodeDragStop` 函数替换为以下完整实现：

```tsx
const onNodeDragStop = useCallback((_: React.MouseEvent, draggedNode: Node, allNodes: Node[]) => {
  if (draggedNode.type === 'boardNode' || draggedNode.type === 'commentNode') return;
  const boards = allNodes.filter(n => n.type === 'boardNode');
  if (boards.length === 0 && !draggedNode.parentId) return;

  // 计算节点的绝对坐标
  // 若节点有 parentId，其 position 是相对坐标，需加上父节点的绝对坐标
  let absX = draggedNode.position.x;
  let absY = draggedNode.position.y;
  if (draggedNode.parentId) {
    const parent = allNodes.find(n => n.id === draggedNode.parentId);
    if (parent) {
      absX += parent.position.x;
      absY += parent.position.y;
    }
  }

  // 用节点中心点判断是否落入画板
  const centerX = absX + (draggedNode.width || 380) / 2;
  const centerY = absY + (draggedNode.height || 300) / 2;

  // boardNode 的 position 始终是绝对坐标（boardNode 自身无 parentId）
  const containingBoard = boards.find(board => {
    const bw = board.width || 600;
    const bh = board.height || 400;
    return centerX >= board.position.x && centerX <= board.position.x + bw &&
           centerY >= board.position.y && centerY <= board.position.y + bh;
  });

  const newParentId = containingBoard?.id;
  // parentId 未变化时不做任何更新，避免无效 setNodes
  if (draggedNode.parentId === newParentId) return;

  setNodes(nds => nds.map(n => {
    if (n.id !== draggedNode.id) return n;
    if (newParentId && containingBoard) {
      // 落入新画板：转换为相对坐标
      return {
        ...n,
        parentId: newParentId,
        position: {
          x: absX - containingBoard.position.x,
          y: absY - containingBoard.position.y,
        },
      };
    }
    // 离开所有画板：使用绝对坐标，清除 parentId
    return { ...n, parentId: undefined, position: { x: absX, y: absY } };
  }));
}, [setNodes]);
```

- [ ] **Step 3: 验证 TypeScript 编译通过**

```bash
cd C:/Users/oldch/Desktop/HJM-aigc-flow-main
npx tsc --noEmit 2>&1 | head -20
```

Expected: 无新增错误。

- [ ] **Step 4: Commit**

```bash
git add src/App.tsx
git commit -m "fix: correct coordinate conversion in onNodeDragStop for board grouping"
```

---

## Task 3: 修复 handleDeleteNode — 删除画板时连带删除子节点

**Files:**
- Modify: `src/App.tsx` — `handleDeleteNode` 函数（约第 223-225 行）

**背景：** 当前 `handleDeleteNode` 只过滤被删节点本身，不处理子节点。删除 boardNode 后，其子节点的 `parentId` 指向一个不存在的节点，变成孤儿节点。

- [ ] **Step 1: 将 handleDeleteNode 替换为以下实现**

找到当前代码：
```tsx
const handleDeleteNode = useCallback((id: string) => {
  setNodes(nds => nds.filter(n => n.id !== id));
}, [setNodes]);
```

替换为（同时清理 storyboardOrder 中已删子节点的 id）：
```tsx
const handleDeleteNode = useCallback((id: string) => {
  setNodes(nds => {
    const target = nds.find(n => n.id === id);
    if (target?.type === 'boardNode') {
      // 找出所有子节点 id，从 storyboardOrder 中清理
      const childIds = new Set(nds.filter(n => n.parentId === id).map(n => n.id));
      if (childIds.size > 0) {
        setStoryboardOrder(prev => {
          const next = prev.filter(nodeId => !childIds.has(nodeId));
          onSaveStoryboardOrder(next);
          return next;
        });
      }
      // 删除画板及其所有子节点
      return nds.filter(n => n.id !== id && n.parentId !== id);
    }
    return nds.filter(n => n.id !== id);
  });
}, [setNodes, setStoryboardOrder, onSaveStoryboardOrder]);
```

- [ ] **Step 2: 验证 TypeScript 编译通过**

```bash
cd C:/Users/oldch/Desktop/HJM-aigc-flow-main
npx tsc --noEmit 2>&1 | head -20
```

Expected: 无新增错误。

- [ ] **Step 3: Commit**

```bash
git add src/App.tsx
git commit -m "fix: delete board children when board node is deleted"
```

---

## Task 4: 手动验证

- [ ] **Step 1: 启动开发服务器**

```bash
cd C:/Users/oldch/Desktop/HJM-aigc-flow-main
npm run dev
```

打开 http://localhost:3000，新建一个项目。

- [ ] **Step 2: 验证子节点跟随移动**

1. 在画布上创建 2-3 个图片节点
2. 激活画板工具，拖拽框选这些节点创建画板
3. 拖动画板，确认画板内的节点跟随移动

- [ ] **Step 3: 验证拖入分组**

1. 在画板外创建一个新节点
2. 把它拖进画板范围，松手
3. 再拖动画板，确认该节点跟随移动（说明已加入画板分组）

- [ ] **Step 4: 验证拖出分组**

1. 把画板内的一个节点拖到画板边界外，松手
2. 拖动画板，确认该节点不再跟随（说明已脱离画板分组）

- [ ] **Step 5: 验证删除画板**

1. 在画板内有节点的情况下，右键画板节点选择删除（或通过画板内的删除机制）
2. 确认画板及其所有子节点一起消失，画布上没有孤立节点残留
