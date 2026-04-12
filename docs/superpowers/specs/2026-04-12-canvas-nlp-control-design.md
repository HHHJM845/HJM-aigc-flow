# 画布自然语言操控 — 设计规格

**日期**：2026-04-12  
**状态**：已批准，待实现

---

## 一、功能概述

允许用户通过自然语言指令直接操控画布：修改节点提示词、插入/删除节点、重排顺序、触发生图。用户可选中画布节点将其作为上下文引入对话，AI 理解意图后执行具体操作。

**典型指令示例**
- "把第三幕的所有镜头色调统一成冷色调"
- "在第2镜和第3镜之间插入一个过渡空镜"
- "帮我把这个镜头的提示词优化得更有电影感"（引用节点）

---

## 二、UI 布局

### 2.1 侧边栏

- **位置**：画布右侧，固定宽度 320px
- **收缩行为**：展开时画布区域自动收窄（非覆盖），收起时变为顶部工具栏右侧图标按钮
- **触发方式**：点击顶部工具栏「画布助手」图标

### 2.2 侧边栏内部结构（从上到下）

```
┌─────────────────────────┐
│  ✦ 画布助手        [×]  │  标题栏 + 关闭按钮
├─────────────────────────┤
│                         │
│     对话消息区           │  AI 回复 + 用户消息（可滚动）
│     （可滚动）           │  AI 回复内可内嵌生成图片
│                         │
├─────────────────────────┤
│ [缩略图×] [缩略图×]      │  已引用节点（自动挂入）
│ ┌─────────────────────┐ │
│ │ 输入你的指令...      │ │  文本输入框（多行自动展开）
│ └──────────────── [↑] ┘ │  发送按钮
└─────────────────────────┘
```

### 2.3 配色规范

沿用项目现有深色主题：

| 元素 | 值 |
|------|----|
| 侧边栏背景 | `#0a0a0a` |
| 消息区背景 | `#111111` |
| AI 消息气泡 | `#1a1a1a` |
| 用户消息气泡 | `rgba(255,255,255,0.05)` |
| 主文字 | `rgba(255,255,255,0.85)` |
| 次要文字 | `rgba(255,255,255,0.4)` |
| 边框 | `rgba(255,255,255,0.06)` |
| AI 标识 / 发送按钮 | `#7c3aed`（紫色，与批注建议面板一致）|
| 底部工具栏背景 | `#080808` + 上边框 `rgba(255,255,255,0.06)` |

---

## 三、节点引用系统

### 3.1 选中自动引用

- 用户在画布上选中节点 → 该节点缩略图自动出现在输入框上方
- 缩略图显示：已生成图片（有图）或占位图标 + label（无图）
- 可点 × 手动移除引用
- 最多同时引用 **4 个节点**，超出不自动添加

### 3.2 发送后的呈现

- 用户消息气泡内含引用标签（节点 label）
- 输入框清空，引用节点缩略图清空

### 3.3 画布上下文传递策略

控制 token 用量，不传整个画布：

| 数据 | 传递内容 |
|------|---------|
| 引用节点 | 完整：id、label、prompt、imageUrl、position |
| 其余节点（≤20个） | 精简：id、label、index（序号） |
| 其余节点（>20个） | 只传引用节点 ±3 的邻居节点（精简格式） |

---

## 四、后端接口

### 4.1 新增路由

```
POST /api/agent/canvas-command
```

**请求体**

```typescript
{
  message: string;                    // 用户自然语言指令
  referencedNodes: {                  // 引用节点（完整）
    id: string;
    label: string;
    prompt: string;
    imageUrl?: string;
  }[];
  canvasNodes: {                      // 画布其余节点（精简）
    id: string;
    label: string;
    index: number;
  }[];
}
```

**响应体**

```typescript
{
  reply: string;         // AI 给用户的自然语言回复
  operations: Operation[];
}
```

### 4.2 Operation 类型定义

```typescript
type Operation =
  | { op: 'update_prompt';  nodeId: string; newPrompt: string }
  | { op: 'update_label';   nodeId: string; newLabel: string }
  | { op: 'insert_node';    afterNodeId: string; label: string; prompt: string }
  | { op: 'delete_node';    nodeId: string }
  | { op: 'generate_image'; nodeId: string };
```

### 4.3 AI Prompt 策略

- System prompt 说明画布结构和所有 op 类型
- 要求 AI 只返回合法 JSON（`{ reply, operations }`），不输出其他内容
- 使用正则提取 JSON（防止 AI 在 JSON 外添加说明文字）
- 使用项目现有的 `doubao-1-5-pro-32k` 文本模型

---

## 五、前端执行逻辑

### 5.1 执行顺序

```
接收 operations 数组
  ↓
逐条按顺序执行：
  update_prompt  → handleUpdateNode(id, { initialPrompt: newPrompt })
  update_label   → handleUpdateNode(id, { label: newLabel })
  insert_node    → 在 afterNodeId 右侧创建新 imageNode，预填 prompt
  delete_node    → handleDeleteNode(id)
  generate_image → 调用现有 /api/generate，结果写入节点 content
  ↓
每步通过现有 setNodes 更新，天然支持 Cmd+Z 撤销
```

### 5.2 执行反馈

- 执行过程中侧边栏显示进度（"正在生成第2镜..."）
- 执行完成后 AI 回复出现在对话消息区
- 生成的图片内嵌在 AI 消息气泡内

### 5.3 错误处理

- 单条 operation 失败不中断后续（记录错误，继续执行）
- 全部执行完后，若有失败项，AI 回复中说明哪步未成功

---

## 六、新增文件

| 文件 | 用途 |
|------|------|
| `src/components/CanvasAssistantPanel.tsx` | 侧边栏 UI 组件（对话区 + 输入框 + 节点引用） |
| `server/routes/agent-canvas-command.ts` | 后端接口，AI 解析指令并返回 operations |

### 修改文件

| 文件 | 改动 |
|------|------|
| `src/App.tsx` | 注册路由、传入侧边栏开关状态、传入 `onAddMessage` / `onExecuteOps` |
| `server/index.ts` | 注册新路由 `app.use('/api/agent/canvas-command', ...)` |

---

## 七、不在本期范围内

- 语音输入（后续可叠加 Web Speech API）
- 多轮澄清对话（AI 反问用户）
- 操作历史面板（查看过去所有指令）
- `@节点名` 文字引用方式（当前只支持选中引用）
