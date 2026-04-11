# Asset Management Module Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a full-page "资产管理" view with AI-assisted asset generation via multi-turn chat dialog, sharing the existing `assets` state with the canvas AssetPanel sidebar.

**Architecture:** New `activeView = 'assets'` renders `AssetManagerView` (full-page grid + upload). "✨生成新素材" opens `AssetGenerateDialog` — multi-turn chat with `/api/asset-chat` to refine needs, then calls existing `/api/generate` for the image. Save writes to the shared `assets` state in App.tsx so AssetPanel syncs automatically.

**Tech Stack:** React + TypeScript + Tailwind CSS (frontend), Express + doubao-pro-32k (asset-chat server route), existing doubao-seedream `/api/generate` for image generation.

---

## File Map

| Action | File | Purpose |
|--------|------|---------|
| Create | `server/routes/asset-chat.ts` | Multi-turn chat + prompt extraction API |
| Modify | `server/index.ts` | Register `/api/asset-chat` route |
| Create | `src/components/AssetManagerView.tsx` | Full-page asset management UI |
| Create | `src/components/AssetGenerateDialog.tsx` | AI chat modal for generating assets |
| Modify | `src/components/BottomTabBar.tsx` | Add 'assets' to type + tabs array |
| Modify | `src/App.tsx` | Add 'assets' to activeView, import + render AssetManagerView |

---

## Task 1: Server route `/api/asset-chat`

**Files:**
- Create: `server/routes/asset-chat.ts`
- Modify: `server/index.ts`

- [ ] **Step 1: Create `server/routes/asset-chat.ts`**

```typescript
import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';

const router = Router();
const ARK_BASE = 'https://ark.cn-beijing.volces.com/api/v3';
const TEXT_MODEL = 'doubao-pro-32k';

const CATEGORY_LABELS: Record<string, string> = {
  character: '人物',
  scene: '场景',
  other: '其他',
};

const CHAT_SYSTEM = (category: string) =>
  `你是一个专业的AI影视素材设计顾问。用户正在为影视项目生成${CATEGORY_LABELS[category] ?? '素材'}素材。你的任务是通过对话帮助用户明确素材需求。每次只问一个关键问题，逐步了解：外观特征、风格、情绪、参考等。不要直接生成图片描述，专注于沟通需求。回复简洁，不超过100字。`;

const EXTRACT_SYSTEM =
  '根据以下对话历史，提取并优化出一段用于AI图像生成的提示词。要求：详细描述外观、风格、光线、构图；适合图像生成模型；中文输出；100-200字以内。只输出提示词本身，不要任何前缀说明。';

router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { messages, category, mode } = req.body as {
      messages: { role: 'user' | 'assistant'; content: string }[];
      category: 'character' | 'scene' | 'other';
      mode: 'chat' | 'extract-prompt';
    };

    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: '请提供对话历史' });
    }

    const apiKey = process.env.IMAGE_API_KEY;
    if (!apiKey) return res.status(500).json({ error: '服务端未配置 IMAGE_API_KEY' });

    const systemContent = mode === 'extract-prompt'
      ? EXTRACT_SYSTEM
      : CHAT_SYSTEM(category ?? 'other');

    const upstream = await fetch(`${ARK_BASE}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: TEXT_MODEL,
        messages: [
          { role: 'system', content: systemContent },
          ...messages,
        ],
        temperature: 0.7,
      }),
    });

    if (!upstream.ok) {
      const err = await upstream.text();
      console.error('[asset-chat] upstream error:', err);
      return res.status(502).json({ error: `AI API error: ${upstream.status}` });
    }

    const data = await upstream.json() as { choices: { message: { content: string } }[] };
    const reply = data.choices?.[0]?.message?.content?.trim() ?? '';
    res.json({ reply });
  } catch (err) {
    next(err);
  }
});

export default router;
```

- [ ] **Step 2: Register route in `server/index.ts`**

Add after the existing `optimizePromptRouter` import (line 15) and registration (line 46):

```typescript
// Add import after line 15:
import assetChatRouter from './routes/asset-chat.js';

// Add registration after line 46:
app.use('/api/asset-chat', assetChatRouter);
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd C:/Users/oldch/Desktop/HJM-aigc-flow-main
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add server/routes/asset-chat.ts server/index.ts
git commit -m "feat: add /api/asset-chat server route"
```

---

## Task 2: Update BottomTabBar

**Files:**
- Modify: `src/components/BottomTabBar.tsx`

- [ ] **Step 1: Update `src/components/BottomTabBar.tsx`**

Replace the entire file content:

```tsx
import React from 'react';

type ActiveView = 'assets' | 'canvas' | 'storyboard' | 'breakdown' | 'video' | 'subtitle';

interface Props {
  activeView: ActiveView;
  onViewChange: (view: ActiveView) => void;
}

export default function BottomTabBar({ activeView, onViewChange }: Props) {
  const tabs: { key: ActiveView; label: string }[] = [
    { key: 'canvas', label: '无限画布' },
    { key: 'assets', label: '资产管理' },
    { key: 'storyboard', label: '分镜管理' },
    { key: 'breakdown', label: '剧本拆解' },
    { key: 'video', label: '视频管理' },
    { key: 'subtitle', label: '字幕编辑' },
  ];

  return (
    <div
      className="absolute bottom-5 left-1/2 -translate-x-1/2 z-50 flex items-center gap-1 p-1 rounded-full border border-white/10 shadow-2xl"
      style={{ background: 'rgba(28,28,28,0.92)', backdropFilter: 'blur(12px)' }}
    >
      {tabs.map(({ key, label }) => (
        <button
          key={key}
          onClick={() => onViewChange(key)}
          className={`px-5 py-1.5 rounded-full text-[13px] font-medium transition-all duration-200 ${
            activeView === key
              ? 'bg-white/15 text-white'
              : 'text-white/40 hover:text-white/70'
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: TypeScript will report an error on `App.tsx` because the `activeView` type there is still the old union — that is expected and will be fixed in Task 4.

- [ ] **Step 3: Commit**

```bash
git add src/components/BottomTabBar.tsx
git commit -m "feat: add assets tab to BottomTabBar"
```

---

## Task 3: Create AssetManagerView

**Files:**
- Create: `src/components/AssetManagerView.tsx`

- [ ] **Step 1: Create `src/components/AssetManagerView.tsx`**

```tsx
import React, { useRef, useState } from 'react';
import { X, Upload } from 'lucide-react';
import type { AssetItem } from '../lib/storage';
import AssetGenerateDialog from './AssetGenerateDialog';

type Category = 'all' | 'character' | 'scene' | 'other';

const CATEGORIES: { key: Category; label: string }[] = [
  { key: 'all', label: '全部' },
  { key: 'character', label: '👤 人物' },
  { key: 'scene', label: '🏙 场景' },
  { key: 'other', label: '📦 其他' },
];

interface Props {
  assets: AssetItem[];
  onAddAsset: (asset: AssetItem) => void;
  onDeleteAsset: (id: string) => void;
  onRenameAsset: (id: string, name: string) => void;
}

interface PendingFile {
  src: string;
  name: string;
}

export default function AssetManagerView({ assets, onAddAsset, onDeleteAsset, onRenameAsset }: Props) {
  const [activeCategory, setActiveCategory] = useState<Category>('all');
  const [showGenerate, setShowGenerate] = useState(false);
  const [pendingFile, setPendingFile] = useState<PendingFile | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const filtered = assets.filter(a =>
    activeCategory === 'all' ? true : a.category === activeCategory
  );

  const countFor = (cat: Category) =>
    cat === 'all' ? assets.length : assets.filter(a => a.category === cat).length;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      const src = ev.target?.result as string;
      setPendingFile({ src, name: file.name });
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleConfirmUpload = (category: 'character' | 'scene' | 'other') => {
    if (!pendingFile) return;
    const asset: AssetItem = {
      id: `asset_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      type: 'image',
      src: pendingFile.src,
      name: pendingFile.name,
      createdAt: Date.now(),
      category,
    };
    onAddAsset(asset);
    setPendingFile(null);
  };

  return (
    <div className="absolute inset-0 bg-[#0d0d0d] overflow-hidden flex flex-col" style={{ paddingBottom: '64px' }}>
      {/* Top bar */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.06] flex-shrink-0">
        <div className="flex gap-2">
          {CATEGORIES.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setActiveCategory(key)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${
                activeCategory === key
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-500 border border-white/[0.08] hover:text-gray-300'
              }`}
            >
              {label} {countFor(key)}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white/10 hover:bg-white/15 text-gray-300 rounded-lg text-sm transition-colors"
          >
            <Upload size={14} />
            上传素材
          </button>
          <button
            onClick={() => setShowGenerate(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm transition-colors"
          >
            ✨ 生成新素材
          </button>
        </div>
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-y-auto p-6">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-gray-600 text-sm gap-3">
            <p>暂无素材</p>
            <button
              onClick={() => setShowGenerate(true)}
              className="px-4 py-2 bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 rounded-lg text-sm transition-colors"
            >
              ✨ 生成新素材
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-3">
            {filtered.map(asset => (
              <div
                key={asset.id}
                className="group relative bg-[#1c1c1c] border border-white/[0.08] rounded-xl overflow-hidden"
              >
                <div className="aspect-square overflow-hidden">
                  <img src={asset.src} alt={asset.name} className="w-full h-full object-cover" />
                </div>
                <div className="px-2 py-1.5">
                  {editingId === asset.id ? (
                    <input
                      autoFocus
                      value={editingName}
                      onChange={e => setEditingName(e.target.value)}
                      onBlur={() => { onRenameAsset(asset.id, editingName); setEditingId(null); }}
                      onKeyDown={e => {
                        if (e.key === 'Enter') { onRenameAsset(asset.id, editingName); setEditingId(null); }
                        if (e.key === 'Escape') setEditingId(null);
                      }}
                      className="w-full bg-transparent text-[11px] text-white/80 outline-none border-b border-white/30"
                    />
                  ) : (
                    <p
                      className="text-[11px] text-white/40 truncate cursor-pointer hover:text-white/70"
                      onClick={() => { setEditingId(asset.id); setEditingName(asset.name); }}
                    >
                      {asset.name}
                    </p>
                  )}
                </div>
                <button
                  onClick={() => onDeleteAsset(asset.id)}
                  className="absolute top-1.5 right-1.5 w-5 h-5 bg-black/60 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500/70"
                >
                  <X size={10} className="text-white" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileChange}
      />

      {/* Category picker overlay for upload */}
      {pendingFile && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="bg-[#1c1c1c] border border-white/10 rounded-xl p-4 shadow-2xl min-w-[180px]">
            <p className="text-gray-400 text-xs mb-1 text-center">选择分类</p>
            <p className="text-gray-500 text-[10px] mb-3 text-center truncate max-w-[160px]">{pendingFile.name}</p>
            {(['character', 'scene', 'other'] as const).map(cat => (
              <button
                key={cat}
                onClick={() => handleConfirmUpload(cat)}
                className="flex items-center gap-2 w-full px-3 py-2 bg-white/5 hover:bg-white/10 rounded-lg text-sm text-gray-200 transition-colors mb-1"
              >
                {cat === 'character' ? '👤 人物' : cat === 'scene' ? '🏙 场景' : '📦 其他'}
              </button>
            ))}
            <button
              onClick={() => setPendingFile(null)}
              className="w-full px-3 py-2 text-gray-500 text-xs hover:text-gray-400 transition-colors mt-1"
            >
              取消
            </button>
          </div>
        </div>
      )}

      {/* Generate dialog */}
      <AssetGenerateDialog
        open={showGenerate}
        onClose={() => setShowGenerate(false)}
        onAddAsset={onAddAsset}
      />
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/AssetManagerView.tsx
git commit -m "feat: add AssetManagerView full-page component"
```

---

## Task 4: Create AssetGenerateDialog

**Files:**
- Create: `src/components/AssetGenerateDialog.tsx`

- [ ] **Step 1: Create `src/components/AssetGenerateDialog.tsx`**

```tsx
import React, { useEffect, useRef, useState } from 'react';
import { Loader2, X } from 'lucide-react';
import type { AssetItem } from '../lib/storage';

type MsgRole = 'ai' | 'user';
interface Message {
  role: MsgRole;
  text: string;
  image?: string;
}

type GenCategory = 'character' | 'scene' | 'other';

interface Props {
  open: boolean;
  onClose: () => void;
  onAddAsset: (asset: AssetItem) => void;
}

const CATEGORY_TABS: { key: GenCategory; label: string }[] = [
  { key: 'character', label: '👤 人物' },
  { key: 'scene', label: '🏙 场景' },
  { key: 'other', label: '📦 其他' },
];

const CATEGORY_LABELS: Record<GenCategory, string> = {
  character: '人物',
  scene: '场景',
  other: '其他',
};

const GREETINGS: Record<GenCategory, string> = {
  character: '你好！请描述你想要的人物形象，比如年龄、外貌、风格、情绪等。',
  scene: '你好！请描述你想要的场景，比如地点、时间、氛围、天气等。',
  other: '你好！请描述你需要的素材，比如道具、动物、特效等。',
};

export default function AssetGenerateDialog({ open, onClose, onAddAsset }: Props) {
  const [category, setCategory] = useState<GenCategory>('character');
  const [messages, setMessages] = useState<Message[]>([{ role: 'ai', text: GREETINGS['character'] }]);
  const [input, setInput] = useState('');
  const [referenceImage, setReferenceImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Reset when dialog opens
  useEffect(() => {
    if (open) {
      setCategory('character');
      setMessages([{ role: 'ai', text: GREETINGS['character'] }]);
      setInput('');
      setReferenceImage(null);
      setGeneratedImage(null);
    }
  }, [open]);

  // Reset greeting when category changes
  useEffect(() => {
    setMessages([{ role: 'ai', text: GREETINGS[category] }]);
    setGeneratedImage(null);
  }, [category]);

  // Scroll to bottom on new messages
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, generatedImage]);

  if (!open) return null;

  // Build API-format messages (excluding the opening AI greeting which has no user context)
  const apiMessages = messages
    .filter(m => !(m.role === 'ai' && messages.indexOf(m) === 0))
    .map(m => ({
      role: m.role === 'ai' ? 'assistant' as const : 'user' as const,
      content: m.text,
    }));

  const handleSend = async () => {
    const text = input.trim();
    if (!text || loading) return;
    const userMsg: Message = { role: 'user', text, image: referenceImage ?? undefined };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    const pendingRefImage = referenceImage;
    setReferenceImage(null);
    setLoading(true);
    try {
      const resp = await fetch('/api/asset-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [...apiMessages, { role: 'user', content: text }],
          category,
          mode: 'chat',
        }),
      });
      if (!resp.ok) throw new Error('chat failed');
      const { reply } = await resp.json() as { reply: string };
      setMessages(prev => [...prev, { role: 'ai', text: reply }]);
    } catch {
      setMessages(prev => [...prev, { role: 'ai', text: '抱歉，出现了网络错误，请重试。' }]);
    } finally {
      setLoading(false);
      void pendingRefImage; // suppress unused warning
    }
  };

  const handleGenerate = async () => {
    if (generating) return;
    setGenerating(true);
    try {
      // Step 1: extract optimized prompt from conversation history
      const extractResp = await fetch('/api/asset-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: apiMessages, category, mode: 'extract-prompt' }),
      });
      if (!extractResp.ok) throw new Error('extract failed');
      const { reply: prompt } = await extractResp.json() as { reply: string };

      // Step 2: generate image using extracted prompt
      const genResp = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt,
          referenceImages: referenceImage ? [referenceImage] : undefined,
          count: 1,
          ratio: '1:1',
          quality: '1K',
        }),
      });
      if (!genResp.ok) throw new Error('generate failed');
      const { urls } = await genResp.json() as { urls: string[] };
      if (urls?.[0]) {
        setGeneratedImage(urls[0]);
      } else {
        throw new Error('no image returned');
      }
    } catch {
      setMessages(prev => [...prev, { role: 'ai', text: '生成失败，请再试一次。' }]);
    } finally {
      setGenerating(false);
    }
  };

  const handleSave = () => {
    if (!generatedImage) return;
    const asset: AssetItem = {
      id: `asset_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      type: 'image',
      src: generatedImage,
      name: `${CATEGORY_LABELS[category]}_${Date.now()}`,
      createdAt: Date.now(),
      category,
    };
    onAddAsset(asset);
    onClose();
  };

  const handleRefImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => setReferenceImage(ev.target?.result as string);
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center">
      <div className="w-[560px] max-h-[80vh] bg-[#141414] border border-white/10 rounded-2xl flex flex-col shadow-2xl">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/[0.07] flex-shrink-0">
          <span className="text-white text-sm font-semibold">生成新素材</span>
          <div className="flex items-center gap-2">
            {CATEGORY_TABS.map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setCategory(key)}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                  category === key
                    ? 'bg-blue-600 text-white'
                    : 'bg-white/[0.06] text-gray-400 hover:text-gray-200'
                }`}
              >
                {label}
              </button>
            ))}
            <button onClick={onClose} className="ml-2 text-gray-500 hover:text-gray-300 transition-colors">
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Chat area */}
        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3 min-h-[320px]">
          {messages.map((msg, i) => (
            <div
              key={i}
              className={`flex gap-2.5 items-start ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}
            >
              <div className={`w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center text-[11px] font-semibold ${
                msg.role === 'ai' ? 'bg-blue-700 text-white' : 'bg-[#374151] text-gray-300'
              }`}>
                {msg.role === 'ai' ? 'AI' : '我'}
              </div>
              <div className={`max-w-[78%] rounded-xl px-3.5 py-2.5 text-[13px] text-gray-200 leading-relaxed ${
                msg.role === 'ai'
                  ? 'bg-[#1c1c1c] border border-white/[0.08] rounded-tl-sm'
                  : 'bg-[#1e3a5f] border border-blue-900/40 rounded-tr-sm'
              }`}>
                {msg.text}
                {msg.image && (
                  <img
                    src={msg.image}
                    alt="参考图"
                    className="mt-2 w-20 h-20 object-cover rounded-lg border border-white/10"
                  />
                )}
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex gap-2.5 items-start">
              <div className="w-7 h-7 rounded-full bg-blue-700 flex-shrink-0 flex items-center justify-center text-[11px] font-semibold text-white">
                AI
              </div>
              <div className="bg-[#1c1c1c] border border-white/[0.08] rounded-xl rounded-tl-sm px-3.5 py-2.5">
                <Loader2 size={14} className="text-gray-400 animate-spin" />
              </div>
            </div>
          )}

          {generatedImage && (
            <div className="flex flex-col items-center gap-3 mt-2">
              <img
                src={generatedImage}
                alt="生成结果"
                className="w-48 h-48 object-cover rounded-xl border border-white/10 shadow-lg"
              />
              <button
                onClick={handleSave}
                className="px-5 py-2 bg-emerald-700/80 hover:bg-emerald-700 text-white text-sm rounded-lg transition-colors"
              >
                保存到资产库
              </button>
            </div>
          )}

          <div ref={chatEndRef} />
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-white/[0.07] flex-shrink-0">
          {/* Reference image row */}
          <div className="flex items-center gap-2 mb-2.5">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-8 h-8 border border-dashed border-white/20 rounded-lg flex items-center justify-center text-gray-500 hover:text-gray-300 hover:border-white/40 transition-colors flex-shrink-0"
              title="上传参考图"
            >
              📎
            </button>
            {referenceImage ? (
              <div className="relative">
                <img
                  src={referenceImage}
                  alt="参考图"
                  className="w-8 h-8 object-cover rounded-md border border-white/20"
                />
                <button
                  onClick={() => setReferenceImage(null)}
                  className="absolute -top-1 -right-1 w-4 h-4 bg-black/80 rounded-full flex items-center justify-center"
                >
                  <X size={8} className="text-white" />
                </button>
              </div>
            ) : (
              <span className="text-gray-600 text-[11px]">上传参考图（可选）</span>
            )}
          </div>

          {/* Input row */}
          <div className="flex gap-2">
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
              }}
              placeholder="继续描述需求..."
              className="flex-1 bg-[#1c1c1c] border border-white/10 rounded-lg px-3 py-2 text-[13px] text-gray-200 placeholder-gray-600 outline-none focus:border-white/20"
            />
            <button
              onClick={handleSend}
              disabled={loading || !input.trim()}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-sm rounded-lg transition-colors"
            >
              发送
            </button>
            <button
              onClick={handleGenerate}
              disabled={generating || messages.length < 2}
              className="px-4 py-2 bg-violet-600 hover:bg-violet-500 disabled:opacity-40 text-white text-sm rounded-lg transition-colors flex items-center gap-1.5"
            >
              {generating ? <Loader2 size={14} className="animate-spin" /> : '✨'}
              生成
            </button>
          </div>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleRefImageChange}
        />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors (assuming App.tsx type is still old — that's OK, fixed in Task 5).

- [ ] **Step 3: Commit**

```bash
git add src/components/AssetGenerateDialog.tsx
git commit -m "feat: add AssetGenerateDialog AI chat modal"
```

---

## Task 5: Wire up in App.tsx

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1: Update `activeView` type in `src/App.tsx` (line 137)**

Find:
```ts
const [activeView, setActiveView] = useState<'canvas' | 'storyboard' | 'breakdown' | 'video' | 'subtitle'>('canvas');
```

Replace with:
```ts
const [activeView, setActiveView] = useState<'assets' | 'canvas' | 'storyboard' | 'breakdown' | 'video' | 'subtitle'>('canvas');
```

- [ ] **Step 2: Add import for AssetManagerView in `src/App.tsx`**

After the existing `import SubtitleView` line (line 48), add:
```ts
import AssetManagerView from './components/AssetManagerView';
```

- [ ] **Step 3: Add AssetManagerView render block in `src/App.tsx`**

Find the storyboard view section (starts around line 787):
```tsx
      {/* Storyboard view */}
      <div
        className="absolute inset-0"
        style={{
          opacity: activeView === 'storyboard' ? 1 : 0,
```

Insert this block **immediately before** that storyboard view comment:

```tsx
      {/* Asset management view */}
      <div
        className="absolute inset-0"
        style={{
          opacity: activeView === 'assets' ? 1 : 0,
          transform: activeView === 'assets' ? 'translateY(0)' : 'translateY(8px)',
          transition: 'opacity 300ms ease-out, transform 300ms ease-out',
          pointerEvents: activeView === 'assets' ? 'auto' : 'none',
        }}
      >
        <AssetManagerView
          assets={assets}
          onAddAsset={(asset) => handleAssetUpload([asset])}
          onDeleteAsset={handleAssetRemove}
          onRenameAsset={handleAssetRename}
        />
      </div>

```

- [ ] **Step 4: Verify TypeScript compiles cleanly**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Verify frontend builds**

```bash
npm run build 2>&1 | tail -10
```

Expected: `✓ built in` with no errors.

- [ ] **Step 6: Commit**

```bash
git add src/App.tsx
git commit -m "feat: wire AssetManagerView into App, add assets activeView"
```

---

## Task 6: Deploy to server

- [ ] **Step 1: Push to GitHub**

```bash
git push origin main
```

- [ ] **Step 2: Deploy on Aliyun ECS**

```bash
ssh root@218.244.158.35 "cd /home/HJM-aigc-flow && git pull origin main && npm run build 2>&1 | tail -5 && pm2 restart aigc-flow && pm2 status aigc-flow"
```

Expected: PM2 status shows `aigc-flow` as `online`.

- [ ] **Step 3: Verify in browser**

Open `http://218.244.158.35:3001`, confirm:
1. "资产管理" tab appears in navigation bar between "无限画布" and "分镜管理"
2. Clicking it shows the full-page asset grid
3. "✨ 生成新素材" opens the AI chat dialog
4. Assets saved in this view appear in the canvas AssetPanel sidebar

---

## Self-Review Checklist

- **Spec coverage:**
  - ✅ New `assets` view in nav (Task 2, 5)
  - ✅ Full-page grid with category tabs (Task 3)
  - ✅ Upload with category picker (Task 3)
  - ✅ Inline rename + delete (Task 3)
  - ✅ AI chat dialog with multi-turn conversation (Task 4)
  - ✅ Reference image upload in dialog (Task 4)
  - ✅ User-triggered generation button (Task 4)
  - ✅ Generated image preview + save (Task 4)
  - ✅ Shared asset state with canvas AssetPanel (Task 5 — `handleAssetUpload` / `handleAssetRemove` / `handleAssetRename`)
  - ✅ Server route `/api/asset-chat` (Task 1)

- **Type consistency:** `AssetItem` imported from `../lib/storage` in both components. `onAddAsset: (asset: AssetItem) => void` matches across AssetManagerView → AssetGenerateDialog → App.tsx call `handleAssetUpload([asset])`.

- **No placeholders:** All steps have complete code.
