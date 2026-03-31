# 剧本拆解功能重构设计

**日期：** 2026-03-31
**状态：** 已批准

---

## 概述

重构现有的 `BreakdownModal`（现已作为全页 tab），实现：
1. 左右分栏布局：左侧剧本编辑器 + 右侧分镜列表
2. 首次拆解：全文发给 AI 生成分镜
3. 二次修改：diff 检测变动段落 → 高亮展示 → 用户确认 → 局部重拆 → 合并进列表
4. 导入画布：选比例后生成节点，切换到无限画布

---

## 布局

```
┌─────────────────────┬──────────────────────┐
│   剧本编辑器（左）   │   分镜列表（右）      │
│                     │                       │
│  [导入文件] [AI拆解] │  #1 景别 | 描述       │
│                     │  #2 景别 | 描述       │
│  textarea           │  ...                  │
│  （可高亮变动段落）  │                       │
│                     │  [添加分镜]           │
│  ── diff 提示栏 ──  │  [比例] [导入画布]    │
└─────────────────────┴──────────────────────┘
```

---

## 数据结构

### StoryboardRow（扩展）

```ts
interface StoryboardRow {
  id: string;
  index: number;
  shotType: string;
  description: string;
  sourceSegment: string; // 对应的原文段落文本（用于 diff 映射）
}
```

### BreakdownState（组件内部）

```ts
interface BreakdownState {
  scriptText: string;          // 当前编辑器内容
  committedScript: string;     // 上次成功拆解时的脚本（用于 diff 基准）
  rows: StoryboardRow[];
  pendingSegments: string[];   // diff 检测到的变动段落
  newlyUpdatedIds: Set<string>; // 刚更新的行 id（用于蓝色高亮 3 秒）
}
```

---

## 核心流程

### 首次拆解

1. 用户粘贴/上传剧本文本
2. 点击"✨ AI 拆解"
3. 将全文发给 `/api/breakdown`，AI 返回 `StoryboardRow[]`（含 `sourceSegment`）
4. 保存 `committedScript = scriptText`
5. 右侧显示分镜列表

### 二次修改检测

条件：`rows.length > 0 && scriptText !== committedScript`

1. 将 `committedScript` 和 `scriptText` 各自按双换行（`\n\n`）分段
2. 用 LCS diff 找出新增/修改的段落
3. 高亮 textarea 中变动的段落（黄色背景，通过 contenteditable 或覆盖层实现）
4. 底部提示栏显示："检测到 X 处变动，点击重新拆解变动部分"

### 用户确认重拆

1. 用户点击"重新拆解变动部分"
2. 把变动段落合并为文本，发给 `/api/breakdown`
3. 根据 `sourceSegment` 找到现有 rows 中对应的行范围
4. 用新行替换该范围（其余行保持不变，index 重新编号）
5. 新生成的行 id 加入 `newlyUpdatedIds`，蓝色边框高亮 3 秒后清除
6. 更新 `committedScript = scriptText`

### 段落→行映射规则

- 按 `sourceSegment` 字段匹配：找到所有 `row.sourceSegment` 属于变动段落的行
- 如果某变动段落没有对应 row（纯新增段落），新行追加到列表末尾
- 如果某变动段落有对应 rows，用新 rows 替换（数量可以不同）

---

## API 接口

现有 `/api/breakdown` 不变，但返回的 `scenes` 需要包含 `sourceSegment` 字段：

```json
{
  "scenes": [
    {
      "id": "row-1",
      "index": 1,
      "shotType": "远景",
      "description": "...",
      "sourceSegment": "原文段落文本"
    }
  ]
}
```

服务端 prompt 需更新，要求 AI 返回每个分镜对应的原文片段。

---

## 组件结构

```
BreakdownView (新组件，替换 BreakdownModal 的 fullPage 模式)
├── ScriptEditor       左侧编辑器（textarea + 高亮层 + diff 提示栏）
│   ├── HighlightLayer 覆盖在 textarea 上的段落高亮层
│   └── DiffBanner     底部"X 处变动"提示 + 确认按钮
└── StoryboardTable    右侧分镜表格（复用现有 SortableRow）
    └── RatioSelector + ImportButton
```

---

## 边界情况

| 场景 | 处理方式 |
|------|----------|
| 用户删除了整个段落 | 对应 rows 从列表中删除 |
| 变动段落 AI 返回 0 条分镜 | 对应 rows 删除，不报错 |
| 首次拆解（无 committedScript）| 全文拆解，无 diff 逻辑 |
| 用户拆解前手动编辑了分镜行 | 手动编辑的内容在重拆对应段落时会被覆盖（符合预期） |
| API 失败 | 显示错误提示，rows 不变，committedScript 不更新 |
