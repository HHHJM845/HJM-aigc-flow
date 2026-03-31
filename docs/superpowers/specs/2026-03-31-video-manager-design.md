# 视频管理 Tab — 设计文档

**日期：** 2026-03-31
**状态：** 已批准，待实现

---

## 概述

在底部标签栏新增"视频管理"Tab（第4个）。用户可在画布中对视频节点打勾收录，被收录的视频在视频管理页面中以 4列 16:9 网格展示，支持拖拽排序，并可逐个或批量按序号下载。

---

## 1. 数据结构

在 `App.tsx` 新增状态：

```ts
interface VideoOrderItem {
  id: string;      // nanoid 生成的唯一ID，供 dnd-kit 使用
  nodeId: string;  // 来源 VideoNode 的 ID
  url: string;     // 打勾时快照的视频 URL（base64 或 blob URL）
  label: string;   // 节点名称，打勾时快照
}

const [videoOrder, setVideoOrder] = useState<VideoOrderItem[]>([]);
```

- 打勾时快照 URL 和 label，不依赖原节点是否存在
- 数组顺序即展示/导出顺序
- 随项目持久化到 localStorage（通过现有 `storage.ts`）

---

## 2. VideoNode 改动

**文件：** `src/components/VideoNode.tsx`

新增 Props：
```ts
videoOrderUrls?: string[];                                    // 已收录的视频URL列表，VideoNode内部判断当前视频是否已收录
onToggleVideo?: (nodeId: string, url: string, label: string) => void;  // 点击勾选时回调，传当前视频URL和label
```

**勾选按钮行为（与 ImageNode 完全一致）：**
- VideoNode 内部计算：`isInVideoOrder = videoOrderUrls.includes(currentUrl)`
- 悬停或 `isInVideoOrder === true` 时，右上角显示圆形按钮
- 未勾选：半透明深色背景，无勾图标
- 已勾选：白色实底背景 + 黑色勾图标
- 已勾选的节点加 `ring-2 ring-inset ring-white/80` 白色内边框

**点击逻辑（App.tsx 中的 `handleToggleVideo`）：**
```ts
handleToggleVideo(nodeId: string, url: string, label: string) {
  setVideoOrder(prev => {
    const exists = prev.find(v => v.nodeId === nodeId && v.url === url);
    if (exists) return prev.filter(v => v.id !== exists.id);
    return [...prev, { id: nanoid(), nodeId, url, label }];
  });
}
```

**传给 VideoNode：**
```ts
videoOrderUrls={videoOrder.map(v => v.url)}
onToggleVideo={handleToggleVideo}
```

---

## 3. BottomTabBar 改动

**文件：** `src/components/BottomTabBar.tsx`

```ts
type ActiveView = 'canvas' | 'storyboard' | 'breakdown' | 'video';

const tabs = [
  { key: 'breakdown', label: '剧本拆解' },
  { key: 'canvas',    label: '无限画布' },
  { key: 'storyboard',label: '分镜管理' },
  { key: 'video',     label: '视频管理' },
];
```

---

## 4. VideoView 组件（新文件）

**文件：** `src/components/VideoView.tsx`

**Props：**
```ts
interface Props {
  videoOrder: VideoOrderItem[];
  onReorder: (newOrder: VideoOrderItem[]) => void;
  onRemove: (id: string) => void;
}
```

**布局结构：**
```
┌─────────────────────────────────────────────────┐
│ 视频管理   已选 N 个视频        [⬇ 全部下载(N个)] │
├─────────────────────────────────────────────────┤
│  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐           │
│  │16:9  │ │16:9  │ │16:9  │ │16:9  │           │
│  │  01  │ │  02  │ │  03  │ │  04  │           │
│  └──────┘ └──────┘ └──────┘ └──────┘           │
│  ┌──────┐ ┌──────┐ ...                          │
│  │  05  │ │  06  │ ...（垂直滚动）               │
└─────────────────────────────────────────────────┘
```

**卡片内容（每张）：**
- 16:9 `<video>` 标签，`preload="metadata"`，不自动播放，显示第一帧
- 左上角：拖拽手柄图标（`GripVertical`）
- 左下角：序号徽章（`01`、`02`…，按数组索引实时更新）
- 右上角：✕ 按钮，点击调用 `onRemove(id)`
- 底部行：节点名称（截断） + `⬇ 下载` 按钮

**拖排：** 使用 `@dnd-kit/sortable`（项目已有依赖），`handleDragEnd` 调用 `arrayMove` 后触发 `onReorder`

**空状态：** `videoOrder.length === 0` 时显示居中提示：
> 在画布中点击视频节点右上角的勾选按钮即可加入

**下载逻辑：**
- 单个下载：`<a href={url} download={`${padded_index}.mp4`} />.click()`
- 全部下载：遍历 `videoOrder`，每隔 200ms 触发一次单个下载，文件名按当前顺序 `01.mp4`、`02.mp4`…

---

## 5. App.tsx 改动

1. 新增 `videoOrder` state（类型 `VideoOrderItem[]`，初始值 `[]`）
2. 新增 `handleToggleVideo(nodeId: string)` 函数
3. `ActiveView` 类型扩展加 `'video'`
4. VideoNode 传入 `onToggleVideo={handleToggleVideo}` 和 `isInVideoOrder={...}`
5. 渲染 `<VideoView>` 当 `activeView === 'video'` 时显示（与其他 tab 同级）
6. `saveProject` / `loadProject` 中加入 `videoOrder` 的序列化/反序列化

---

## 6. 不在本次范围内

- 视频预览播放（点击播放）—— 未来可加
- 视频重命名 —— 未来可加
- ZIP 打包下载 —— 逐个下载已满足需求
