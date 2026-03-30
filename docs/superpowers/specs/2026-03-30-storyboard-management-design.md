# 分镜管理功能设计文档

**日期：** 2026-03-30
**状态：** 已确认，待实现

---

## 需求概述

在现有画布界面基础上增加「分镜管理」视图，允许用户在画布上标记关键图片节点，并在专属页面中预览和排序分镜序列。

---

## 功能设计

### 1. 底部标签栏

- 胶囊形浮动控件，固定在画布/分镜管理界面正下方中央
- 两个选项：**无限画布** / **分镜管理**
- 当前激活项白色半透明背景高亮，非激活项文字变暗
- 毛玻璃背景效果（`backdrop-filter: blur`），不遮挡内容
- 切换时整页淡入 + 向上滑动过渡动画（300ms ease-out）

### 2. 图片节点打勾按钮

- 位置：每个 `imageNode` 右上角
- 显示逻辑：
  - 默认不显示
  - 鼠标悬停节点时：出现空心圆圈按钮
  - 点击后：变为白色实心打勾，节点边框变白（`ring-white`），加入分镜序列
  - 已选中节点：鼠标离开后按钮保持白色可见
  - 再次点击：取消选中，恢复默认状态
- 未生成图片的节点也可被打勾（在分镜管理中占位显示）

### 3. 分镜管理界面

- 整页替换画布（带 300ms 过渡动画）
- 布局：固定 4 列网格，卡片固定 16:9 比例
- 卡片内容：图片 + 底部居中序号（1、2、3…）
- 排列规则：按用户打勾的先后顺序排列
- 拖拽排序：使用 `@dnd-kit/sortable` 实现
  - 拖拽时卡片略微放大（`scale(1.04)`）并浮起（阴影加深）
  - 目标位置显示虚线占位提示
  - 松手后序号自动重新编号
- 顶部显示已选镜头数量（「已选 N 个镜头」）
- 底部标签栏同样浮动显示，随时可切换回画布

---

## 数据设计

### 状态结构（App.tsx）

```typescript
// 选中的节点 ID 列表，按打勾顺序排列
const [storyboardOrder, setStoryboardOrder] = useState<string[]>([]);

// 当前视图
const [activeView, setActiveView] = useState<'canvas' | 'storyboard'>('canvas');
```

### 持久化

- `storyboardOrder` 随项目一起保存到 `localStorage`
- `Project` 接口新增 `storyboardOrder: string[]` 字段

### ImageNode data 扩展

```typescript
// 在 data 中新增
onToggleStoryboard?: (id: string) => void;
isInStoryboard?: boolean;
```

---

## 组件结构

| 组件 | 说明 |
|------|------|
| `BottomTabBar.tsx` | 新建，胶囊形切换控件 |
| `StoryboardView.tsx` | 新建，分镜管理整页视图 |
| `StoryboardCard.tsx` | 新建，单个分镜卡片（含拖拽支持） |
| `ImageNode.tsx` | 修改，新增打勾按钮逻辑 |
| `App.tsx` | 修改，新增 storyboardOrder 状态和视图切换 |
| `storage.ts` | 修改，Project 接口新增 storyboardOrder 字段 |

---

## 依赖

- `@dnd-kit/core` + `@dnd-kit/sortable`（需新增安装）

---

## 范围说明

- 本期不做：分镜导出（PDF/视频）、分镜备注/描述编辑、多项目分镜对比
- 未生成图片的选中节点在分镜管理中显示空白占位，不阻止打勾操作
