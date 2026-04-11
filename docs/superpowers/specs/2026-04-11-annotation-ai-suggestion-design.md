# 设计文档：批注驱动的 AI 修改建议

**日期：** 2026-04-11  
**状态：** 待实现

---

## 背景与目标

当前审片流程中，甲方通过分享链接提交批注（如"这个镜头太暗了"），创作者需要手动阅读批注再决定如何修改提示词。目标是让 AI 自动分析"需修改"批注，直接生成对应分镜的修改提示词草稿，创作者确认后可一键推送到画布生成新节点。

---

## 范围

- 只处理状态为 `revision`（需修改）的批注
- 不处理 `approved`（通过）的批注
- 建议展示在 BreakdownView（分镜管理界面）
- 创作者确认后在画布新建节点（不替换原节点）

---

## 整体数据流

```
甲方提交批注（POST /api/review/:token/annotate）
    ↓
后端写入 DB + broadcast WebSocket "annotation_added"
    ↓
App.tsx 收到 WS 事件，过滤 status === 'revision'
    ↓
debounce 3s（积累同项目批注）
    ↓
POST /api/agent/annotation-review
    ↓
后端一次 AI 调用，返回所有 rowId 对应的建议
    ↓
前端存入 annotationSuggestions（Map<rowId, Suggestion>）
    ↓
BreakdownView 对应行展示 AI 建议卡片
    ↓
创作者点"导入画布" → 画布原节点旁新建 ImageNode（带新提示词）
```

---

## 后端：新增路由

### `server/routes/agent-annotation-review.ts`

**入参**
```typescript
{
  rows: {
    rowId: string;
    rowIndex: number;
    shotType: string;      // 景别，如"近景"
    description: string;   // 原分镜描述
    comment: string;       // 甲方批注内容
  }[]
}
```

**AI Prompt**
```
你是专业分镜修改顾问。根据甲方批注，为每个分镜生成修改后的 AI 图像生成提示词。

规则：
- 保留原分镜的核心构图和人物，只调整批注指出的问题
- 提示词用中文，50-100字
- only 返回 JSON：{"suggestions":[{"rowId":"...","prompt":"...","reason":"..."},...]}

分镜列表：
[逐条列出 rowIndex、shotType、description、comment]
```

**返回**
```typescript
{
  suggestions: {
    rowId: string;
    prompt: string;   // 修改后的提示词草稿
    reason: string;   // 一句话说明改了什么
  }[]
}
```

**模型：** Doubao `doubao-1-5-pro-32k-250115`（与 match-assets、optimize-prompt 一致，使用 `IMAGE_API_KEY`）

**注册：** 在 `server/index.ts` 中挂载到 `/api/agent/annotation-review`

---

## 前端：状态与逻辑

### App.tsx 新增

```typescript
// 建议 Map
const [annotationSuggestions, setAnnotationSuggestions] = useState<
  Map<string, { suggestedPrompt: string; reason: string; comment: string; status: 'pending' | 'dismissed' }>
>(new Map());

// debounce ref
const annotationDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
const pendingAnnotationsRef = useRef<AnnotationRow[]>([]);

// WS 消息处理中，annotation_added 分支：
if (msg.type === 'annotation_added' && msg.status === 'revision' && msg.projectId === currentProjectId) {
  // 积累批注
  pendingAnnotationsRef.current.push({ rowId: msg.rowId, rowIndex: msg.rowIndex, comment: msg.comment });
  // debounce
  if (annotationDebounceRef.current) clearTimeout(annotationDebounceRef.current);
  annotationDebounceRef.current = setTimeout(() => {
    triggerAnnotationReview(pendingAnnotationsRef.current);
    pendingAnnotationsRef.current = [];
  }, 3000);
}
```

`triggerAnnotationReview`：从当前项目的 `storyboardRows` 中查找对应行的 `description` 和 `shotType`，拼好入参后调用 `/api/agent/annotation-review`，结果合并进 `annotationSuggestions` Map。

`annotationSuggestions` 和 `onDismissSuggestion`、`onApplySuggestion` 作为 props 传给 `<BreakdownView>`。

---

## 前端：BreakdownView UI

每条状态为 `revision` 且有对应建议的分镜行，在行内底部追加 AI 建议卡片：

```
┌─────────────────────────────────────────────────┐
│ #3  近景  李明走向窗边，背光站立                   │
│                                                  │
│ 💬 甲方批注："这个镜头太暗了"                     │
│ ┌────────────────────────────────────────────┐  │
│ │ ✦ AI 建议                                  │  │
│ │ 李明走向窗边，侧逆光打亮轮廓，窗外柔和暖光   │  │
│ │ 透入室内，面部有柔和补光，营造温暖氛围感     │  │
│ │ 改动：增加光线描述，将背光改为侧逆光+补光    │  │
│ │                         [忽略] [导入画布]   │  │
│ └────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────┘
```

**样式：** 建议卡片使用 `violet/10` 背景 + `violet/30` 边框，与现有主色一致。

**Loading 状态：** AI 请求进行中时，BreakdownView 顶部显示一条细进度条（或行右侧小转圈），不阻塞用户操作。

### 交互

| 操作 | 结果 |
|------|------|
| 点"忽略" | 将该 rowId 的建议 status 设为 `dismissed`，卡片消失 |
| 点"导入画布" | 在画布原节点（`storyboard-{rowId}`）右侧 200px 处新建 ImageNode，`initialPrompt` = 新提示词，节点 label = `修改版 · #${rowIndex}` |

---

## 画布新建节点逻辑

在 `App.tsx` 的 `onApplySuggestion(rowId, prompt)` 中：

1. 找到现有节点 `storyboard-{rowId}` 的位置 `{ x, y }`
2. 新建 ImageNode：`position = { x: x + 420, y }` （避免与原节点重叠）
3. 节点 `data.initialPrompt = prompt`，`data.label = 修改版 · #${rowIndex}`
4. 通过现有的 `addNode` / `setNodes` 机制推入画布

---

## 不在此次范围内

- 流式响应（SSE 打字效果）——可后续迭代
- 批注建议的持久化（刷新后消失）——首期内存态即可
- 对"通过"批注的处理
- 建议提示词的手动编辑

---

## 文件变更清单

| 文件 | 操作 |
|------|------|
| `server/routes/agent-annotation-review.ts` | 新建 |
| `server/index.ts` | 注册新路由 |
| `src/App.tsx` | WS 监听 + debounce + annotationSuggestions state + onApplySuggestion |
| `src/components/BreakdownView.tsx` | 接收 suggestions props，渲染建议卡片，"忽略"/"导入画布"按钮 |
