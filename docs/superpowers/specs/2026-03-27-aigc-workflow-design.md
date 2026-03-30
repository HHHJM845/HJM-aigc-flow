# AIGC 全链路内容生产工作流平台 — 设计规格

**日期：** 2026-03-27
**范围：** 剧本拆解 → 分镜设计 → 提示词生成 → 图片生成 → 视频素材交付

---

## 1. 整体架构

### 界面结构

采用**状态切换**（无路由）方案：App 维护 `view` 状态，在两个界面之间切换，数据通过 React state 直传。

```
App
├── view: 'breakdown' | 'canvas'
├── storyboardRows: StoryboardRow[]
│
├── [view='breakdown'] BreakdownPage   ← 新增组件
└── [view='canvas']   Flow             ← 现有组件，扩展
```

### 核心数据结构

```ts
interface StoryboardRow {
  id: string
  index: number        // 分镜编号（拖拽后重排）
  description: string  // 镜头内容，填入 ImageNode.data.shotDescription
  location?: string    // 场景地点
  characters?: string  // 出场人物
}
```

---

## 2. 剧本拆解页（BreakdownPage）

### 两阶段流程

**阶段 ①：导入剧本**
- 全屏文本域，用户粘贴完整剧本
- "上传文件"按钮（读取 .txt / .md 文件内容到文本域）
- "✨ AI 拆解"按钮 → 调用 API，进入阶段 ②

**阶段 ②：可编辑分镜表**
- AI 返回后渲染表格，列：`#` / `镜头内容` / `场景地点` / `出场人物` / 删除
- 每行所有字段可直接点击编辑（inline edit）
- 行支持**拖拽排序**（使用 `@dnd-kit/core` + `@dnd-kit/sortable`）
- "＋ 添加分镜"按钮追加空行
- "× 删除"按钮移除该行
- "进入画布 →"按钮：将 storyboardRows 传入 App state，切换 view 为 `'canvas'`
- "返回修改剧本"按钮：回到阶段 ①（保留原文本）

### AI 拆解 Prompt

```
system: 你是一个专业的影视分镜助手。将用户提供的剧本拆解为分镜列表，
        以 JSON 数组返回，每项包含字段：description（镜头内容）、
        location（场景地点，无则返回空字符串）、characters（出场人物，
        多人用空格分隔，无则返回空字符串）。只返回 JSON，不加任何说明。

user:   [用户粘贴的剧本文本]
```

---

## 3. 画布界面扩展（Flow）

### 初始化

从 `storyboardRows` 批量创建 `ImageNode`，节点横向排列（间距 400px），每个节点：
```ts
data: {
  label: `分镜 ${row.index.toString().padStart(2, '0')}`,
  contentType: 'image',
  content: null,
  shotDescription: row.description,  // 新增字段
}
```

### ImageNode 面板改造

在现有弹出面板基础上，从上到下新增/调整：

1. **镜头描述区**（只读）
   展示 `data.shotDescription`，灰色背景卡片，标注"镜头描述"。

2. **AI 对话区**（可折叠，默认折叠）
   - 对话消息列表（用户消息右对齐，AI 消息左对齐）
   - AI 每条回复末尾附"← 导入为提示词"按钮，点击将回复文本填入提示词输入框
   - 底部输入框 + 发送按钮
   - 调用模型：`gpt-5.2-low`
   - System prompt：`你是专业的AI图片提示词工程师。根据以下镜头描述和用户需求，生成适合AI图片生成的英文提示词。镜头描述：[shotDescription]`

3. **提示词输入区**（现有，无改动）

4. **底部控制栏**新增"↓ 下载"按钮
   - 仅在 `data.content` 非空时显示
   - 点击触发 `<a>` 标签下载，文件名 `storyboard-{index}.png`
   - 图片来源为 base64 或 URL

### 图片生成接入真实 API

替换现有 `setTimeout` mock：

```ts
POST https://new.suxi.ai/v1/images/generations
Headers: Authorization: Bearer ${import.meta.env.VITE_API_KEY}
Body: {
  model: "gemini-3-pro-image-preview",
  prompt: string,
  n: generateCount,        // 1-4
  size: ratioToSize(ratio) // "1024x1024" | "1792x1024" | "1024x1792"
}
```

返回结果中取 `data[].b64_json` 渲染为 `data:image/png;base64,...` 存入 `data.content`。

### VideoNode 面板改造

仅新增"↓ 下载"按钮，逻辑与 ImageNode 相同（文件名 `storyboard-{index}.mp4`）。视频生成逻辑保持现有 mock。

---

## 4. API 集成

| 用途 | 模型 | 接口 |
|------|------|------|
| 剧本拆解 | `gpt-5.2-low` | `/v1/chat/completions` |
| 节点 AI 对话 | `gpt-5.2-low` | `/v1/chat/completions` |
| 图片生成 | `gemini-3-pro-image-preview` | `/v1/images/generations` |
| 视频生成 | mock | — |

**Base URL：** `https://new.suxi.ai/`
**Key 存放：** `.env.local` → `VITE_API_KEY=...`（已被 Vite 默认 .gitignore 排除）

### 错误处理

- 所有 API 调用包裹 try/catch
- 失败时在对应节点/区域内显示红色错误提示文字
- 生成中按钮切换为 loading（spinner），禁止重复点击
- 不使用流式输出（streaming），等待完整响应后渲染

---

## 5. 新增依赖

| 包 | 用途 |
|----|------|
| `@dnd-kit/core` | 分镜表行拖拽排序 |
| `@dnd-kit/sortable` | 排序封装 |

---

## 6. 文件变更一览

| 文件 | 操作 |
|------|------|
| `src/App.tsx` | 新增 `view` / `storyboardRows` state；条件渲染两个界面 |
| `src/components/BreakdownPage.tsx` | **新建**：剧本拆解完整页面 |
| `src/components/ImageNode.tsx` | 新增镜头描述区、AI 对话区、下载按钮；接入真实图片 API |
| `src/components/VideoNode.tsx` | 新增下载按钮 |
| `src/lib/api.ts` | **新建**：封装所有 API 调用函数 |
| `.env.local` | 新增 `VITE_API_KEY` |
| `package.json` | 添加 dnd-kit 依赖 |
