# Spec: 资产库分类与界面放大

**日期**: 2026-04-01
**状态**: 待实现
**涉及文件**: `src/components/AssetPanel.tsx`, `src/lib/storage.ts`

---

## 一、功能概述

对画布界面的资产库面板进行两项改造：
1. 新增**人物 / 场景**分类，支持上传时指定、按类筛选
2. 面板整体放大，图片缩略图改为自适应原始比例展示

---

## 二、数据层变更

**文件**: `src/lib/storage.ts`

`AssetItem` 新增可选字段：

```typescript
export interface AssetItem {
  id: string;
  type: 'image' | 'video';
  src: string;
  name: string;
  createdAt: number;
  category?: 'character' | 'scene';  // 新增，旧数据无此字段视为未分类
}
```

- `category` 为可选，历史资产无此字段，仅出现在"全部"分类中
- 两个合法值：`'character'`（人物）、`'scene'`（场景）

---

## 三、面板尺寸

**文件**: `src/components/AssetPanel.tsx`

| 属性 | 改前 | 改后 |
|------|------|------|
| 宽度 | `w-[280px]` | `w-[500px]` |
| 最大高度 | `max-h-[70vh]` | `max-h-[85vh]` |

---

## 四、布局结构

面板内部改为左右分栏：

```
┌─ 面板（500px × 85vh）──────────────────────────┐
│  Header: "资产库"                      [上传]   │
├──────────────────────────────────────────────  ┤
│  左侧分类栏（68px）  │  右侧图片网格（flex-1）   │
│  ┌──────────┐        │  ┌───┐ ┌───┐ ┌───┐      │
│  │  全部 12 │ ←选中  │  │   │ │   │ │   │      │
│  ├──────────┤        │  └───┘ └───┘ └───┘      │
│  │  人物  5 │        │  ┌───┐ ┌───┐ ┌───┐      │
│  ├──────────┤        │  │   │ │   │ │   │      │
│  │  场景  7 │        │  └───┘ └───┘ └───┘      │
│  └──────────┘        │                          │
└──────────────────────────────────────────────  ┘
```

### 左侧分类栏

- 固定宽度 `68px`，右侧有分隔线
- 三个选项：**全部**、**人物**、**场景**，各显示当前数量
- 选中项高亮（`bg-[#333]`，白色文字），未选项暗色
- 点击切换，过滤右侧网格内容

### 右侧图片网格

- 3 列，`grid-cols-3`，间距 `gap-2`
- 缩略图**不强制宽高比**，改用 `object-contain` + 图片自然尺寸自适应展示：
  ```tsx
  <img
    src={asset.src}
    alt={asset.name}
    className="w-full h-auto object-contain rounded-lg"
  />
  ```
- 保留左上角类型角标（IMAGE / VIDEO）
- 保留右上角 hover 删除按钮
- 保留拖拽到画布功能（`draggable`、`onDragStart`）

---

## 五、上传 + 分类选择流程

1. 用户点击 Header 的"上传"按钮 → 触发 `<input type="file">`
2. 用户选择文件后，**每个文件读取完成后**弹出分类选择弹窗
3. 弹窗内容：
   ```
   ┌─ 选择分类 ──────┐
   │  👤 人物         │
   │  🏞 场景         │
   └─────────────────┘
   ```
4. 用户点击分类 → 该文件以对应 `category` 写入 `AssetItem`，弹窗关闭
5. 若一次上传多张，逐张弹窗（串行，上一张确认后再弹下一张）

### 弹窗状态管理

```typescript
const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([]);

interface PendingFile {
  src: string;
  name: string;
  type: 'image' | 'video';
}
```

- `pendingFiles[0]` 为当前待分类文件
- 选择分类后 → 调用 `onUpload`，然后 `setPendingFiles(prev => prev.slice(1))`
- `pendingFiles.length > 0` 时渲染弹窗

---

## 六、过滤逻辑

```typescript
const activeCategory = 'all' | 'character' | 'scene';

const filteredAssets = activeCategory === 'all'
  ? assets
  : assets.filter(a => a.category === activeCategory);
```

分类计数：
```typescript
const counts = {
  all: assets.length,
  character: assets.filter(a => a.category === 'character').length,
  scene: assets.filter(a => a.category === 'scene').length,
};
```

---

## 七、不在范围内

- 重命名分类或自定义分类
- 批量修改已有资产的分类
- 分类图标可自定义
- 视频资产的分类（当前视频仍显示 Film 图标，逻辑一致）

---

## 八、文件变更清单

| 文件 | 操作 |
|------|------|
| `src/lib/storage.ts` | 修改：`AssetItem` 新增 `category` 字段 |
| `src/components/AssetPanel.tsx` | 重写：新布局、分类栏、弹窗、自适应缩略图 |
