# Asset Management Module — Design Spec
Date: 2026-04-02

## Overview

A new full-page view "资产管理" inserted before "剧本" in the navigation bar. Users can browse, upload, rename, delete, and AI-generate assets (characters, scenes, props). Assets are shared with the existing canvas AssetPanel sidebar — same state, zero sync needed.

Navigation order after this change:
`画布 → 资产管理 → 剧本 → 剧本拆解 → 视频 → 字幕`

---

## 1. Architecture & Data Flow

### New activeView value
`activeView` in App.tsx expands from:
```ts
'canvas' | 'storyboard' | 'breakdown' | 'video' | 'subtitle'
```
to:
```ts
'assets' | 'canvas' | 'storyboard' | 'breakdown' | 'video' | 'subtitle'
```

### Shared asset state
`assets: AssetItem[]` lives in App.tsx (unchanged). Both `AssetManagerView` and `AssetPanel` receive `assets` as a prop. Saves go through `onSaveAssets` — all existing persistence logic is reused.

### New files
| File | Purpose |
|------|---------|
| `src/components/AssetManagerView.tsx` | Full-page asset management UI |
| `src/components/AssetGenerateDialog.tsx` | AI chat modal for generating assets |
| `server/routes/asset-chat.ts` | Multi-turn chat + prompt extraction API |

### Data flow
```
User chats → POST /api/asset-chat (mode: 'chat') → AI reply appended to messages
User clicks ✨生成 → POST /api/asset-chat (mode: 'extract-prompt') → final prompt
                   → POST /api/generate (prompt + referenceImage) → image URL
User clicks 保存 → onAddAsset(newAssetItem) → App.tsx setAssets → AssetPanel synced
```

---

## 2. AssetManagerView Component

**File:** `src/components/AssetManagerView.tsx`

### Props
```ts
interface AssetManagerViewProps {
  assets: AssetItem[]
  onAddAsset: (asset: AssetItem) => void
  onDeleteAsset: (id: string) => void
  onRenameAsset: (id: string, name: string) => void
}
```

### Layout
- **Top bar:** Category tabs (全部 / 👤人物 / 🏙场景 / 📦其他) with counts + right-aligned "上传素材" and "✨ 生成新素材" buttons
- **Grid:** `grid-cols-4 md:grid-cols-6 lg:grid-cols-8`, card = image thumbnail (aspect-ratio 1:1) + name below
- **Card interactions:** hover reveals delete button (top-right X); click name to inline-rename

### Colors (matching existing UI)
- Background: `bg-[#0d0d0d]` page, `bg-[#1c1c1c]` cards
- Borders: `border-white/[0.08]`
- Active tab: `bg-blue-600 text-white`
- Inactive tab: `text-gray-500 border-white/[0.08]`
- Primary button (生成): `bg-blue-600 hover:bg-blue-500`
- Secondary button (上传): `bg-white/10 hover:bg-white/15`

### Upload
Reuses the same `FileReader` → base64 pattern from `AssetPanel`. On file select, shows category picker overlay (same as AssetPanel's existing category modal), then calls `onAddAsset`.

---

## 3. AssetGenerateDialog Component

**File:** `src/components/AssetGenerateDialog.tsx`

### Props
```ts
interface AssetGenerateDialogProps {
  open: boolean
  onClose: () => void
  onAddAsset: (asset: AssetItem) => void
}
```

### State
```ts
type Message = { role: 'ai' | 'user'; text: string; image?: string }

const [category, setCategory] = useState<'character' | 'scene' | 'other'>('character')
const [messages, setMessages] = useState<Message[]>([opening greeting])
const [referenceImage, setReferenceImage] = useState<string | null>(null)
const [input, setInput] = useState('')
const [loading, setLoading] = useState(false)   // chat sending
const [generating, setGenerating] = useState(false)  // image generating
const [generatedImage, setGeneratedImage] = useState<string | null>(null)
```

### Layout
- **Modal overlay:** `fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center`
- **Dialog box:** `w-[560px] max-h-[80vh] bg-[#141414] border border-white/10 rounded-2xl flex flex-col`
- **Header:** title + category selector + close button; `border-b border-white/[0.07]`
- **Chat area:** `flex-1 overflow-y-auto p-4`, min-height ~320px; AI bubbles left, user bubbles right; reference image thumbnails inline in user messages
- **Footer (fixed):** reference image upload row + input + 发送 + ✨生成 buttons; `border-t border-white/[0.07]`

### Opening greeting (per category)
- 人物: "你好！请描述你想要的人物形象，比如年龄、外貌、风格、情绪等。"
- 场景: "你好！请描述你想要的场景，比如地点、时间、氛围、天气等。"
- 其他: "你好！请描述你需要的素材，比如道具、动物、特效等。"

Greeting resets when category changes.

### Chat flow
1. User types → click 发送 → POST `/api/asset-chat` `{messages, category, mode: 'chat'}` → append AI reply
2. User can upload reference image at any point — shown as thumbnail in next user message
3. User clicks ✨生成 → POST `/api/asset-chat` `{messages, category, mode: 'extract-prompt'}` → get `prompt` → POST `/api/generate` `{prompt, referenceImage, ratio: '1:1', quality: '1K', count: 1}` → `generatedImage` set
4. Generated image appears at bottom of chat with "保存到资产库" button
5. Click save → `onAddAsset({ id: `asset_${Date.now()}`, type: 'image', src: generatedImage, name: `${categoryLabel}_${Date.now()}`, category, createdAt: Date.now() })` → `onClose()`. User can rename inline afterward.

### Button colors
- 发送: `bg-blue-600 hover:bg-blue-500`
- ✨生成: `bg-violet-600 hover:bg-violet-500`
- 保存到资产库: `bg-emerald-700/80 hover:bg-emerald-700`

---

## 4. Server Route: /api/asset-chat

**File:** `server/routes/asset-chat.ts`
**Model:** `doubao-pro-32k` (same as match-assets, optimize-prompt)
**Auth:** `IMAGE_API_KEY` env var

### Request
```ts
POST /api/asset-chat
{
  messages: { role: 'user' | 'assistant'; content: string }[]
  category: 'character' | 'scene' | 'other'
  mode: 'chat' | 'extract-prompt'
}
```

### Response
```ts
{ reply: string }
// chat mode: AI conversational reply
// extract-prompt mode: optimized image generation prompt (Chinese preferred)
```

### System prompts

**chat mode:**
```
你是一个专业的AI影视素材设计顾问。用户正在为影视项目生成[人物/场景/其他]素材。
你的任务是通过对话帮助用户明确素材需求。每次只问一个关键问题，逐步了解：外观特征、风格、情绪、参考等。
不要直接生成图片描述，专注于沟通需求。回复简洁，不超过100字。
```

**extract-prompt mode:**
```
根据以下对话历史，提取并优化出一段用于AI图像生成的提示词。
要求：详细描述外观、风格、光线、构图；适合图像生成模型；中文输出；100-200字以内。
只输出提示词本身，不要任何前缀说明。
```

### Registration
Add to `server/index.ts`:
```ts
import { assetChatRouter } from './routes/asset-chat'
app.use('/api', assetChatRouter)
```

---

## 5. App.tsx Changes

1. Add `'assets'` to `activeView` type
2. Add `AssetManagerView` import
3. Add nav tab "资产管理" between 画布 and 剧本 in `BottomTabBar`
4. Render `<AssetManagerView>` when `activeView === 'assets'`, passing `assets`, `onAddAsset`, `onDeleteAsset`, `onRenameAsset` callbacks (reuse existing `handleAssetRename` and delete handler patterns)

---

## Out of Scope

- Video asset generation (only images)
- Asset tagging beyond the 3 existing categories
- Search/filter within asset management page
- Batch generation
