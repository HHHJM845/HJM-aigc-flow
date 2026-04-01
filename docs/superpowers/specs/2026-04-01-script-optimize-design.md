# Spec: AI 剧本优化功能

**日期**: 2026-04-01
**状态**: 待实现
**涉及文件**: `src/components/BreakdownView.tsx`, `src/components/ScriptOptimizeModal.tsx`（新建）

---

## 一、功能概述

在 BreakdownView 左侧脚本编辑区顶部增加"✨ AI 优化"按钮。点击后弹出对话弹窗，AI 多轮提问了解优化需求，问完后生成优化版剧本并展示 Diff 预览，用户确认后写回脚本编辑器。

---

## 二、入口

**文件**: `src/components/BreakdownView.tsx`

- 在左侧工具栏（现有"✨ AI 拆解"按钮附近）新增按钮：
  ```tsx
  <button
    onClick={() => setShowOptimizeModal(true)}
    disabled={!scriptText.trim()}
    className="..."
  >
    ✨ AI 优化
  </button>
  ```
- 新增 state：`const [showOptimizeModal, setShowOptimizeModal] = useState(false)`
- 渲染 Modal：
  ```tsx
  {showOptimizeModal && (
    <ScriptOptimizeModal
      scriptText={scriptText}
      onApply={(optimized) => {
        setScriptText(optimized);
        setShowOptimizeModal(false);
      }}
      onClose={() => setShowOptimizeModal(false)}
    />
  )}
  ```

---

## 三、ScriptOptimizeModal 组件

**文件**: `src/components/ScriptOptimizeModal.tsx`（新建）

### Props

```typescript
interface ScriptOptimizeModalProps {
  scriptText: string;          // 当前剧本原文
  onApply: (optimized: string) => void;  // 确认应用回调
  onClose: () => void;         // 关闭回调
}
```

### 内部 State

```typescript
type Phase = 'questioning' | 'generating' | 'preview';

const [phase, setPhase] = useState<Phase>('questioning');
const [messages, setMessages] = useState<ChatMessage[]>([]);   // 展示用消息列表
const [apiMessages, setApiMessages] = useState<ApiMessage[]>([]); // 发给 API 的完整历史
const [userInput, setUserInput] = useState('');
const [isLoading, setIsLoading] = useState(false);
const [optimizedScript, setOptimizedScript] = useState('');
const [diffChunks, setDiffChunks] = useState<DiffChunk[]>([]);
```

### 类型定义

```typescript
interface ChatMessage {
  role: 'ai' | 'user';
  content: string;
}

interface ApiMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface DiffChunk {
  type: 'unchanged' | 'removed' | 'added';
  text: string;
}
```

### 系统提示（System Prompt）

```
你是一位专业的影视剧本编辑，正在帮助用户优化剧本。

请按以下流程进行：
1. 通过多轮提问（3-5轮）了解用户需求，每轮只问一个问题，问题要简洁具体。
   参考问题方向：目标受众、整体风格（严肃/轻松/悬疑等）、节奏偏好、重点想加强的部分、是否有不想改动的内容。
2. 收集到足够信息后，输出优化后的完整剧本，格式如下：

[OPTIMIZED_SCRIPT_START]
（优化后的完整剧本内容）
[OPTIMIZED_SCRIPT_END]

注意事项：
- 不要在标记外附加任何额外说明
- 保持剧本整体结构，只优化表达方式和内容质量
- 输出完整剧本，不要省略任何部分
```

### 初始化流程

Modal 打开时，立即发起第一轮 AI 提问：

1. 构建 `apiMessages` 初始值：
   ```typescript
   [{ role: 'user', content: `以下是我的剧本：\n\n${scriptText}` }]
   ```
2. 调用 `POST /api/chat`，传入：
   ```json
   {
     "messages": [{ "role": "user", "content": "以下是我的剧本：\n\n{scriptText}" }],
     "systemPrompt": "..."
   }
   ```
3. AI 返回第一个问题 → 追加到 `messages`（role: 'ai'）和 `apiMessages`（role: 'assistant'）

### 用户发送回答流程

1. 用户在输入框输入并点击"发送"（或按 Ctrl+Enter）
2. 追加用户消息到 `messages` 和 `apiMessages`
3. 清空输入框，`isLoading = true`
4. 调用 `/api/chat`，传入完整 `apiMessages`（包含 systemPrompt）
5. 收到响应后：
   - 检测响应是否包含 `[OPTIMIZED_SCRIPT_START]`
   - **不含标记**：追加 AI 消息，继续提问状态
   - **含标记**：提取两个标记之间的内容 → `optimizedScript`，计算 diff，切换到 `preview` 阶段

### 标记提取逻辑

```typescript
function extractOptimizedScript(response: string): string | null {
  const start = response.indexOf('[OPTIMIZED_SCRIPT_START]');
  const end = response.indexOf('[OPTIMIZED_SCRIPT_END]');
  if (start === -1 || end === -1) return null;
  return response.slice(start + '[OPTIMIZED_SCRIPT_START]'.length, end).trim();
}
```

### Diff 计算逻辑

按段落（连续空行）分割，逐段对比：

```typescript
function computeDiff(original: string, optimized: string): DiffChunk[] {
  const origParas = original.split(/\n\s*\n/).map(p => p.trim()).filter(Boolean);
  const optParas  = optimized.split(/\n\s*\n/).map(p => p.trim()).filter(Boolean);

  const chunks: DiffChunk[] = [];
  const maxLen = Math.max(origParas.length, optParas.length);

  for (let i = 0; i < maxLen; i++) {
    const o = origParas[i];
    const n = optParas[i];
    if (o === n) {
      chunks.push({ type: 'unchanged', text: o });
    } else {
      if (o) chunks.push({ type: 'removed', text: o });
      if (n) chunks.push({ type: 'added',   text: n });
    }
  }
  return chunks;
}
```

---

## 四、UI 渲染

### 布局结构

```
┌─ Modal 容器（max-w-2xl, h-[80vh], flex col）─────────────┐
│  Header: "✨ AI 优化剧本"                      [×]        │
├──────────────────────────────────────────────────────────┤
│  对话区（flex-1, overflow-y-auto）                        │
│  · AI 消息：左对齐，灰色气泡                               │
│  · User 消息：右对齐，蓝色气泡                             │
│  · loading 时显示打点动画                                  │
├──────────────────────────────────────────────────────────┤
│  [phase === 'preview'] Diff 预览区（max-h-48, overflow）  │
│  · unchanged 段落：不显示（折叠）                          │
│  · removed 段落：红色背景 + 删除线                         │
│  · added 段落：绿色背景                                   │
├──────────────────────────────────────────────────────────┤
│  [phase === 'questioning'] 输入区                         │
│  textarea (rows=3) + "发送" 按钮                          │
│  [phase === 'preview'] 操作区                             │
│  "取消" 按钮 + "✓ 确认应用" 按钮                          │
└──────────────────────────────────────────────────────────┘
```

### Diff 样式

```tsx
// removed
<p className="bg-red-50 text-red-700 line-through rounded p-2 text-sm">
  {chunk.text}
</p>

// added
<p className="bg-green-50 text-green-800 rounded p-2 text-sm">
  {chunk.text}
</p>
```

---

## 五、写回逻辑

`onApply(optimizedScript)` 由 BreakdownView 接收：

```typescript
// BreakdownView.tsx
onApply={(optimized) => {
  setScriptText(optimized);
  setShowOptimizeModal(false);
  // 若已有拆解结果，committedScript 与新内容不同，BreakdownView 会自动显示"重新拆解变动部分"提示
}}
```

---

## 六、错误处理

- API 调用失败：在对话区显示错误提示气泡，`isLoading = false`，允许重发
- 超时：同上
- AI 响应中标记格式不完整：视为普通回复，继续提问阶段

---

## 七、文件变更清单

| 文件 | 操作 |
|------|------|
| `src/components/ScriptOptimizeModal.tsx` | 新建 |
| `src/components/BreakdownView.tsx` | 修改：添加按钮 + Modal 引用 |

---

## 八、不在范围内

- 流式输出（SSE）：当前 `/api/chat` 返回完整响应，不做流式
- 多版本对比：只展示一次优化结果
- 功能二（资产参考图匹配）：单独规划
