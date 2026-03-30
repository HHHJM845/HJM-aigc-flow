# 画板功能修复设计文档

**日期：** 2026-03-30
**状态：** 已确认，待实现

---

## 问题描述

画板（BoardNode）功能存在三个问题：

1. **子节点不跟随画板移动** — 拖动画板时，画板内的节点原地不动
2. **拖进/拖出分组关系未更新** — 把节点拖入画板范围松手后，未正确建立父子关系；拖出后也未正确解除
3. **删除画板不删子节点** — 删掉画板后，原来属于该画板的节点变成孤立节点留在画布上

---

## 根本原因分析

### 问题 1：节点数组排序错误

ReactFlow v12 要求父节点必须在 `nodes` 数组中排在其子节点**前面**，才能激活 parent-child 跟随行为。

当前 `handleBoardDragEnd` 的代码：
```js
return [...updatedChildren, boardNode];
```
boardNode 被追加到末尾，排在所有子节点**后面**，导致 ReactFlow 无法识别父子关系，子节点不跟随移动。

### 问题 2：`onNodeDragStop` 坐标换算有 bug

画板内子节点使用**相对坐标**（相对于画板左上角），画布独立节点使用**绝对坐标**。当节点被拖入/拖出画板时，需要在两种坐标系之间正确转换，当前逻辑存在换算错误，导致节点跳位或分组关系未更新。

### 问题 3：`handleDeleteNode` 未处理子节点

当前实现只过滤被删节点本身：
```js
setNodes(nds => nds.filter(n => n.id !== id));
```
不检查是否有子节点存在，删除画板后子节点成为悬空孤儿节点。

---

## 设计方案

**方案：精准修复（方案 A）**，仅修改 `src/App.tsx` 三处，不改动其他组件。

### 修复 1：`handleBoardDragEnd` — 正确的节点插入顺序

创建画板时，确保 boardNode 排在其子节点前面：

```js
// 修复前
return [...updatedChildren, boardNode];

// 修复后
const childrenOfBoard = updatedChildren.filter(n => n.parentId === boardId);
const otherNodes = updatedChildren.filter(n => n.parentId !== boardId);
return [...otherNodes, boardNode, ...childrenOfBoard];
```

### 修复 2：`onNodeDragStop` — 正确的坐标换算

拖动结束时判断节点的新归属：

- **落入某个画板内** → 将节点 position 从绝对坐标换算为相对坐标（减去画板 position），设置 `parentId`
- **落在画布空白处** → 将节点 position 从相对坐标换算为绝对坐标（加上原画板 position），清除 `parentId`
- **未改变归属** → 不做任何更新（避免无效 setNodes）

绝对坐标计算：
```js
let absX = draggedNode.position.x;
let absY = draggedNode.position.y;
if (draggedNode.parentId) {
  const parent = allNodes.find(n => n.id === draggedNode.parentId);
  if (parent) {
    absX += parent.position.x;
    absY += parent.position.y;
  }
}
```

### 修复 3：`handleDeleteNode` — 删除画板时连带删除子节点

```js
const handleDeleteNode = useCallback((id: string) => {
  setNodes(nds => {
    const target = nds.find(n => n.id === id);
    if (target?.type === 'boardNode') {
      // 删除画板及其所有子节点
      return nds.filter(n => n.id !== id && n.parentId !== id);
    }
    return nds.filter(n => n.id !== id);
  });
}, [setNodes]);
```

---

## 改动范围

| 文件 | 改动 |
|------|------|
| `src/App.tsx` | 三处精准修改：handleBoardDragEnd、onNodeDragStop、handleDeleteNode |

其他组件（BoardNode.tsx 等）无需修改。

---

## 范围说明

- 本期不做：画板内批量操作、画板折叠/展开、画板嵌套
- 缩放画板不自动重新分组（用户已确认）
- 子节点可以自由拖出画板（不使用 `extent: 'parent'` 限制）
