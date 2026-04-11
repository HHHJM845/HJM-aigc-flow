# 分镜管理"导出到画布"功能设计

**日期：** 2026-04-02
**状态：** 已批准

---

## 功能目标

在分镜管理视图的顶部栏增加"导出到画布"按钮，将当前分镜顺序中的所有节点批量导出为视频节点（videoNode），追加到无限画布上，每个视频节点预载：
- 分镜图片作为图生视频参考图
- AI 根据分镜描述生成的视频提示词（预填到提示词输入框）

---

## 方案选择

选用**方案 B**：导出时调用 `generateImagePrompt` API，将 `shotDescription` 优化为视频生成专用提示词。

原因：比直接使用原始描述更精准，`Promise.all` 并行调用控制等待时间。

---

## 涉及文件

| 文件 | 改动类型 |
|------|----------|
| `src/components/VideoNode.tsx` | 小改：支持 `data.initialPrompt` 和 `data.referenceImage` 初始化 |
| `src/components/StoryboardView.tsx` | 加按钮：顶部栏"导出到画布"，带 loading 状态 |
| `src/App.tsx` | 核心逻辑：`handleExportStoryboardToCanvas`，Grid 定位，节点追加 |

---

## 详细设计

### 1. VideoNode.tsx

两处 `useState` 初始值修改：

```ts
// 原来
const [mode, setMode] = useState<'text' | 'image'>('text');
const [prompt, setPrompt] = useState('');

// 修改后
const [mode, setMode] = useState<'text' | 'image'>(data.referenceImage ? 'image' : 'text');
const [prompt, setPrompt] = useState<string>(data.initialPrompt || '');
```

效果：从分镜导出的 videoNode 打开即处于"图生视频"模式，提示词已预填。

---

### 2. StoryboardView.tsx

新增 prop：
```ts
onExportToCanvas: () => Promise<void>
```

顶部栏加按钮：
- 默认状态：`导出到画布`
- loading 状态：`Loader2` 旋转图标 + 禁用，防止重复点击
- 仅在 `storyboardOrder.length > 0` 时显示

---

### 3. App.tsx — handleExportStoryboardToCanvas

在 `Flow` 组件内新增异步函数：

```
1. 遍历 storyboardOrder，从 nodes 查找每个节点
2. 取 imageSrc = node.data.content[0]（分镜图片）
3. 取 shotDesc = node.data.shotDescription || ''
4. Promise.all 并行调用 generateImagePrompt(shotDesc, imageSrc) → optimizedPrompt[]
5. 计算 Grid 起始位置：
   - startX = max(node.position.x + node.width) over all existing nodes + 80
   - 若无现有节点，startX = 80
   - startY = 80（固定顶部对齐）
6. 按 4 列网格排列，NODE_W=380, NODE_H=214, GAP_X=60, GAP_Y=60
7. 构建 videoNode[]，每个节点 data 包含：
   - label: `分镜 {1-based index}`
   - contentType: 'video'
   - content: null（空，等待用户生成）
   - referenceImage: imageSrc
   - initialPrompt: optimizedPrompt
   - onPlusClick, onUpdate（已有 handler）
8. setNodes(nds => [...nds, ...newVideoNodes])
```

传递链：`Flow` → `onExportToCanvas` prop → `StoryboardView`

---

## Grid 位置计算示例

现有节点 bounding box 最右为 x=800，宽 380 → startX = 1280

```
[分镜01] [分镜02] [分镜03] [分镜04]
[分镜05] [分镜06] ...
```

列宽 = 380 + 60 = 440，行高 = 214 + 60 = 274

---

## 错误处理

- `generateImagePrompt` 单个失败时不阻断其他节点：用 `Promise.allSettled`，失败节点 `initialPrompt` 置为空字符串
- 导出完成后自动切换到 `canvas` 视图，方便用户查看新节点

---

## 不在本次范围内

- 重复导出检测（同一分镜多次导出会产生重复节点）
- 导出进度逐节点显示（全部完成后一次性追加）
