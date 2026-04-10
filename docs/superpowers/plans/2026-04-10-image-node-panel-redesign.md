# Image Node Panel Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将图片节点弹窗从固定大卡片改为「紧凑底部工具栏 + 按需展开面板」交互，包含可编辑镜头描述、风格模板网格、资产面板。

**Architecture:** 仅改动前端 `ImageNode.tsx`（新增 `expandedPanel` / `shotDescription` state，重写面板 JSX）和 `App.tsx`（注入 `assets` 到 imageNode data），以及后端 `db.ts`（预置默认风格模板）和 `optimize-prompt.ts`（放宽校验）。

**Tech Stack:** React 19, TypeScript, Tailwind CSS v4, Express, better-sqlite3

---

## File Map

| 文件 | 操作 | 说明 |
|------|------|------|
| `src/components/ImageNode.tsx` | Modify | 主体重写：state 重构 + 面板 JSX |
| `src/App.tsx` | Modify | 给 imageNode data 注入 `assets` |
| `server/db.ts` | Modify | 新增 `seedDefaultImageTemplates()` + 启动时调用 |
| `server/routes/optimize-prompt.ts` | Modify | 放宽校验：style 非空时 description 可为空 |

---

## Task 1: 后端 — 预置默认风格模板

**Files:**
- Modify: `server/db.ts`

- [ ] **Step 1: 在 `db.ts` 末尾添加 `seedDefaultImageTemplates` 函数**

在文件末尾 `deleteTemplate` 函数后追加：

```ts
const DEFAULT_IMAGE_TEMPLATES = [
  { name: '写实', genre: '写实摄影', styleTag: '写实', promptPreset: '超写实摄影风格，自然光线，细节丰富，照片级质感，真实皮肤纹理' },
  { name: '动漫', genre: '动漫插画', styleTag: '动漫', promptPreset: '日式动漫风格，清晰线条，鲜艳色彩，二次元角色，精细插画' },
  { name: '油画', genre: '艺术绘画', styleTag: '油画', promptPreset: '古典油画风格，丰富肌理，厚涂笔触，温暖色调，博物馆级质感' },
  { name: '水彩', genre: '艺术绘画', styleTag: '水彩', promptPreset: '水彩插画风格，通透色彩，柔和边缘，水痕晕染效果，轻盈唯美' },
  { name: '赛博朋克', genre: '科幻未来', styleTag: '赛博朋克', promptPreset: '赛博朋克风格，霓虹灯光，暗黑城市背景，科技感，未来都市氛围' },
  { name: '中国水墨', genre: '国风艺术', styleTag: '国风', promptPreset: '中国传统水墨画风格，留白构图，墨色浓淡变化，写意笔法，诗意意境' },
  { name: '素描', genre: '艺术绘画', styleTag: '素描', promptPreset: '铅笔素描风格，黑白灰调，线条清晰，光影层次丰富，手绘质感' },
  { name: '3D渲染', genre: '3D设计', styleTag: '3D渲染', promptPreset: '高质量3D渲染，逼真光照，材质细腻，景深效果，电影级渲染质感' },
];

export function seedDefaultImageTemplates(): void {
  const existing = db.prepare("SELECT COUNT(*) as cnt FROM templates WHERE nodeType = 'image'").get() as { cnt: number };
  if (existing.cnt > 0) return; // already seeded
  const insert = db.prepare(`
    INSERT INTO templates (id, name, genre, nodeType, promptPreset, styleTag, compositionTip, cameraParams, durationHint, audioHint, createdAt)
    VALUES (?, ?, ?, 'image', ?, ?, NULL, NULL, NULL, NULL, ?)
  `);
  for (const t of DEFAULT_IMAGE_TEMPLATES) {
    insert.run(`tpl_seed_${t.name}`, t.name, t.genre, t.promptPreset, t.styleTag, Date.now());
  }
}
```

- [ ] **Step 2: 在 `server/index.ts` 中调用 seed 函数**

在 `server/index.ts` 的现有 import 区末尾追加（在 `import { attachWebSocketServer }` 之前）：

```ts
import { seedDefaultImageTemplates } from './db.js';
```

在 `const app = express();` 之后立即调用：

```ts
seedDefaultImageTemplates();
```

- [ ] **Step 3: 重启后端，验证模板已写入**

```bash
curl http://localhost:3001/api/templates?nodeType=image
```

期望：返回包含 8 条记录的 JSON 数组，每条有 `id`, `name`, `styleTag`, `promptPreset` 字段。

- [ ] **Step 4: Commit**

```bash
git add server/db.ts server/index.ts
git commit -m "feat: seed default image style templates on server startup"
```

---

## Task 2: 后端 — 放宽 optimize-prompt 校验

**Files:**
- Modify: `server/routes/optimize-prompt.ts`

当前逻辑要求 `description` 非空才处理。AI 优化现在支持「仅有风格」的情况（description 为空但 style 非空），需更新校验。

- [ ] **Step 1: 更新 `server/routes/optimize-prompt.ts` 校验逻辑**

将文件中的校验和 `userPrompt` 构建替换为：

```ts
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { description, style, label } = req.body as {
      description?: string;
      style?: string;
      label?: string;
    };

    const hasDescription = !!description?.trim();
    const hasStyle = !!style?.trim();

    if (!hasDescription && !hasStyle) {
      return res.status(400).json({ error: '请提供画面描述或风格' });
    }

    const apiKey = process.env.IMAGE_API_KEY;
    if (!apiKey) return res.status(500).json({ error: '服务端未配置 IMAGE_API_KEY' });

    const parts: string[] = [];
    if (hasDescription) parts.push(`画面描述：${description!.trim()}`);
    if (hasStyle) parts.push(`画风：${style!.trim()}`);
    if (label?.trim()) parts.push(`镜头信息：${label.trim()}`);

    const userPrompt = `你是专业的AI图像生成提示词工程师。根据以下信息，生成一段优化的图像生成提示词。

要求：
- 语言：中文
- 长度：50-150字
- 包含：画面主体、构图、光线氛围、画风关键词
- 只输出提示词本身，不要加任何解释或标题

${parts.join('\n')}`.trim();

    const upstream = await fetch(`${ARK_BASE}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: TEXT_MODEL,
        messages: [{ role: 'user', content: userPrompt }],
        temperature: 0.7,
      }),
    });

    if (!upstream.ok) {
      const err = await upstream.text();
      console.error('[optimize-prompt] upstream error:', err);
      return res.status(502).json({ error: `AI API error: ${upstream.status}` });
    }

    const data = await upstream.json() as { choices: { message: { content: string } }[] };
    const optimized = data.choices?.[0]?.message?.content?.trim() ?? '';
    res.json({ prompt: optimized });
  } catch (err) {
    next(err);
  }
});
```

- [ ] **Step 2: 验证新校验**

```bash
# 仅 style，应返回 200
curl -s -X POST http://localhost:3001/api/optimize-prompt \
  -H 'Content-Type: application/json' \
  -d '{"style":"赛博朋克"}' | head -c 200

# 两者都空，应返回 400
curl -s -X POST http://localhost:3001/api/optimize-prompt \
  -H 'Content-Type: application/json' \
  -d '{}' | grep error
```

- [ ] **Step 3: Commit**

```bash
git add server/routes/optimize-prompt.ts
git commit -m "feat: allow style-only requests to optimize-prompt API"
```

---

## Task 3: 前端 — App.tsx 注入 assets 到 imageNode

**Files:**
- Modify: `src/App.tsx` 约第 693 行（`imageNode` data 注入块）

- [ ] **Step 1: 在 imageNode data 注入块加入 `assets`**

找到以下代码块（约第 693-696 行）：

```ts
...(node.type === 'imageNode' ? {
  isInStoryboard: storyboardOrder.includes(node.id),
  onToggleStoryboard: handleToggleStoryboard,
} : {}),
```

替换为：

```ts
...(node.type === 'imageNode' ? {
  isInStoryboard: storyboardOrder.includes(node.id),
  onToggleStoryboard: handleToggleStoryboard,
  assets: assets,
} : {}),
```

- [ ] **Step 2: 验证 TypeScript 无报错**

```bash
cd C:/Users/oldch/Desktop/HJM-aigc-flow-main
npx tsc --noEmit 2>&1 | head -20
```

期望：无输出（无错误）。

- [ ] **Step 3: Commit**

```bash
git add src/App.tsx
git commit -m "feat: inject assets into imageNode data for asset panel"
```

---

## Task 4: 前端 — ImageNode state 重构

**Files:**
- Modify: `src/components/ImageNode.tsx`

移除旧 state（`selectedStyle`, `customStyle`, `mergedPrompt`, `userExtra`, `merging`），新增 `expandedPanel`, `shotDescription`，保留其余。

- [ ] **Step 1: 更新 import 区（移除不需要的图标）**

将文件顶部 import 替换为：

```ts
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Handle, Position, useStore, type ReactFlowState } from '@xyflow/react';
import {
  Plus,
  Upload,
  Image as ImageIcon,
  ArrowUp,
  ChevronDown,
  Loader2,
  Download,
  Sparkles,
  X,
  Palette,
  Users,
} from 'lucide-react';
import { generateImages } from '../lib/api';
import type { AssetItem } from '../lib/storage';
```

- [ ] **Step 2: 更新组件 state 声明**

找到组件函数体开头（`export default function ImageNode`），将所有旧 state 声明替换为：

```ts
// ── Panel expand state ─────────────────────────────
const [expandedPanel, setExpandedPanel] = useState<'style' | 'asset' | null>(null);

// ── Prompt & shot description ──────────────────────
const [prompt, setPrompt] = useState('');
const [shotDescription, setShotDescription] = useState<string>(data.shotDescription ?? '');

// ── Style template ─────────────────────────────────
const [templates, setTemplates] = useState<Array<{ id: string; name: string; promptPreset: string; styleTag: string | null; genre: string }>>([]);
const [selectedTplId, setSelectedTplId] = useState<string | null>(null);
const [styleCatFilter, setStyleCatFilter] = useState<string>('全部');

// ── Asset panel ────────────────────────────────────
const [assetCategory, setAssetCategory] = useState<'character' | 'scene' | 'other'>('character');

// ── Generation controls ────────────────────────────
const [ratio, setRatio] = useState(data.ratio || '16:9');
const [quality, setQuality] = useState<'1K' | '2K'>('2K');
const [generateCount, setGenerateCount] = useState(1);
const [isGenerating, setIsGenerating] = useState(false);
const [genError, setGenError] = useState('');
const [optimizing, setOptimizing] = useState(false);

// ── Dropdowns open state ───────────────────────────
const [isCountOpen, setIsCountOpen] = useState(false);
const [isRatioOpen, setIsRatioOpen] = useState(false);
const [isQualityOpen, setIsQualityOpen] = useState(false);
const [isModelOpen, setIsModelOpen] = useState(false);

// ── Reference images ───────────────────────────────
const [uploadedRefImages, setUploadedRefImages] = useState<string[]>([]);
const refImageInputRef = useRef<HTMLInputElement>(null);
const allRefImages = [
  ...(data.referenceImage ? [data.referenceImage] : []),
  ...uploadedRefImages,
];

// ── File inputs ────────────────────────────────────
const fileInputRef = useRef<HTMLInputElement>(null);

// ── React Flow store ───────────────────────────────
const connectionNodeId = useStore((s: ReactFlowState) =>
  s.connection && 'nodeId' in s.connection ? s.connection.nodeId : null
);
const selectedCount = useStore((s: ReactFlowState) =>
  s.nodes.filter((n) => n.selected).length
);
const isOngoingConnection = connectionNodeId !== null;
const [isHovered, setIsHovered] = useState(false);
const showHandle = isHovered || isOngoingConnection;
const showPanel = selected && selectedCount === 1;

// ── Multi-image display ────────────────────────────
const contents = Array.isArray(data.content) ? data.content : (data.content ? [data.content] : []);
const [currentIndex, setCurrentIndex] = useState(0);
const currentContent = contents[currentIndex] || null;

// ── Assets (injected via data) ─────────────────────
const assets: AssetItem[] = data.assets ?? [];
```

- [ ] **Step 3: 验证 TypeScript 无报错**

```bash
npx tsc --noEmit 2>&1 | head -30
```

期望：只有来自 JSX 未写完的错误（因为还没替换 JSX），或无错误。

- [ ] **Step 4: Commit**

```bash
git add src/components/ImageNode.tsx
git commit -m "refactor: restructure ImageNode state for panel redesign"
```

---

## Task 5: 前端 — ImageNode 业务逻辑函数

**Files:**
- Modify: `src/components/ImageNode.tsx`

在 state 声明之后，JSX return 之前，写入所有业务函数。

- [ ] **Step 1: 写入所有 handler 函数**

```ts
// ── Template loading ───────────────────────────────
useEffect(() => {
  if (!showPanel) return;
  fetch('/api/templates?nodeType=image')
    .then(r => r.json())
    .then((list: Array<{ id: string; name: string; promptPreset: string; styleTag: string | null; genre: string }>) =>
      setTemplates(list))
    .catch(() => {});
}, [showPanel]);

// ── Derived: style categories ──────────────────────
const styleCategories = ['全部', ...Array.from(new Set(templates.map(t => t.styleTag).filter(Boolean) as string[]))];
const filteredTemplates = styleCatFilter === '全部'
  ? templates
  : templates.filter(t => t.styleTag === styleCatFilter);

// ── Toggle expand panel ────────────────────────────
const togglePanel = useCallback((panel: 'style' | 'asset') => {
  setExpandedPanel(prev => prev === panel ? null : panel);
}, []);

// ── Shot description save on blur ──────────────────
const handleShotDescBlur = () => {
  data.onUpdate?.(id, { shotDescription });
};

// ── AI optimize ────────────────────────────────────
const selectedTpl = templates.find(t => t.id === selectedTplId) ?? null;
const canOptimize = !!shotDescription.trim() || !!selectedTpl;

const handleOptimizePrompt = async () => {
  if (!canOptimize || optimizing) return;
  setOptimizing(true);
  try {
    const resp = await fetch('/api/optimize-prompt', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        description: shotDescription,
        style: selectedTpl?.promptPreset ?? '',
        label: data.label,
      }),
    });
    if (resp.ok) {
      const result = await resp.json() as { prompt: string };
      setPrompt(result.prompt);
    }
  } catch { /* silent */ }
  finally { setOptimizing(false); }
};

// ── Template select ────────────────────────────────
const handleSelectTemplate = (tplId: string) => {
  if (selectedTplId === tplId) {
    setSelectedTplId(null);
    return;
  }
  setSelectedTplId(tplId);
};

// ── File upload ────────────────────────────────────
const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
  const file = e.target.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (ev) => {
    data.onUpdate?.(id, { content: [ev.target?.result as string] });
    setCurrentIndex(0);
  };
  reader.readAsDataURL(file);
};

const handleRefImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
  Array.from(e.target.files ?? []).forEach((file: File) => {
    const reader = new FileReader();
    reader.onload = (ev) => {
      setUploadedRefImages(prev => [...prev, ev.target?.result as string]);
    };
    reader.readAsDataURL(file);
  });
  e.target.value = '';
};

const removeUploadedRef = (index: number) => {
  setUploadedRefImages(prev => prev.filter((_, i) => i !== index));
};

// ── Asset click → add as reference ────────────────
const handleAssetClick = (src: string) => {
  if (uploadedRefImages.includes(src)) {
    setUploadedRefImages(prev => prev.filter(s => s !== src));
  } else if (allRefImages.length < 4) {
    setUploadedRefImages(prev => [...prev, src]);
  }
};

// ── Asset category filter ──────────────────────────
const categoryMap: Record<'character' | 'scene' | 'other', string> = {
  character: '角色', scene: '场景', other: '道具',
};
const filteredAssets = assets.filter(a => {
  if (assetCategory === 'character') return a.category === 'character';
  if (assetCategory === 'scene') return a.category === 'scene';
  return a.category === 'other' || !a.category;
});

// ── Generate ───────────────────────────────────────
const handleGenerate = async () => {
  if (!prompt || isGenerating) return;
  setIsGenerating(true);
  setGenError('');
  try {
    const images = await generateImages(
      prompt,
      generateCount,
      ratio,
      allRefImages.length > 0 ? allRefImages : undefined,
      quality,
    );
    data.onUpdate?.(id, { content: images });
    setCurrentIndex(0);
    setPrompt('');
  } catch (err: unknown) {
    setGenError(err instanceof Error ? err.message : '生成失败');
  } finally {
    setIsGenerating(false);
  }
};

// ── Download ───────────────────────────────────────
const handleDownload = () => {
  if (!currentContent) return;
  const a = document.createElement('a');
  a.href = currentContent;
  a.download = `image-${data.label || id}.png`;
  a.click();
};

// ── Drag & drop asset into node ────────────────────
const [isDragOver, setIsDragOver] = useState(false);

const handleAssetDragOver = (e: React.DragEvent) => {
  if (e.dataTransfer.types.includes('application/asset-src')) {
    e.preventDefault(); e.stopPropagation(); setIsDragOver(true);
  }
};
const handleAssetDragLeave = () => setIsDragOver(false);
const handleAssetDrop = (e: React.DragEvent) => {
  e.preventDefault(); e.stopPropagation(); setIsDragOver(false);
  const src = e.dataTransfer.getData('application/asset-src');
  if (src) { data.onUpdate?.(id, { content: [src] }); setCurrentIndex(0); }
};
```

- [ ] **Step 2: 验证 TypeScript 无报错**

```bash
npx tsc --noEmit 2>&1 | head -30
```

- [ ] **Step 3: Commit**

```bash
git add src/components/ImageNode.tsx
git commit -m "feat: add ImageNode handler functions for redesigned panel"
```

---

## Task 6: 前端 — ImageNode JSX（节点主体 + 输入区 + 镜头描述）

**Files:**
- Modify: `src/components/ImageNode.tsx` — `return (...)` 部分

用新 JSX 完全替换原来的 `return (...)` 块。分三步完成：先写节点主体（图片显示区），再写输入区，最后写展开面板和底部栏。

- [ ] **Step 1: 写节点主体 + 输入区 + 镜头描述 JSX**

将 `return (` 到 `);` 的全部内容替换为以下代码（分块完整替换）：

```tsx
return (
  <div
    className={`relative w-full h-full min-w-[320px] min-h-[250px] flex flex-col bg-[#262626] rounded-2xl shadow-2xl transition-all duration-200 overflow-visible ${
      (data.isInStoryboard as boolean | undefined)
        ? 'ring-2 ring-inset ring-white/80'
        : selected
        ? 'ring-2 ring-inset ring-gray-500 shadow-[0_0_25px_rgba(255,255,255,0.05)]'
        : 'ring-1 ring-inset ring-white/5 hover:ring-white/10'
    }`}
    onMouseEnter={() => setIsHovered(true)}
    onMouseLeave={() => { setIsHovered(false); setIsRatioOpen(false); }}
    onDragOver={handleAssetDragOver}
    onDragLeave={handleAssetDragLeave}
    onDrop={handleAssetDrop}
  >
    {/* 分镜打勾按钮 */}
    {data.onToggleStoryboard && (isHovered || data.isInStoryboard) && (
      <button
        className="nodrag absolute top-2 right-2 z-30 w-[22px] h-[22px] rounded-full flex items-center justify-center transition-all duration-150"
        style={
          data.isInStoryboard
            ? { background: 'white', boxShadow: '0 2px 6px rgba(0,0,0,0.4)' }
            : { background: 'rgba(0,0,0,0.35)', border: '1.5px solid rgba(255,255,255,0.5)', backdropFilter: 'blur(4px)' }
        }
        onClick={(e) => { e.stopPropagation(); (data.onToggleStoryboard as (id: string) => void)(id); }}
        title={data.isInStoryboard ? '从分镜中移除' : '加入分镜'}
      >
        {data.isInStoryboard && (
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M2 6l3 3 5-5" stroke="#111" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        )}
      </button>
    )}

    {/* 预选中光效 */}
    <div className="absolute -inset-[2px] rounded-[18px] pointer-events-none target-glow opacity-0 transition-opacity duration-300 z-50 target-glow-mask">
      <div className="absolute inset-[-100%] bg-[conic-gradient(from_0deg_at_50%_50%,#3b82f6_0%,transparent_60%,#3b82f6_100%)] animate-[spin_2s_linear_infinite]" />
    </div>

    {/* 生成流光边框 */}
    {isGenerating && (
      <>
        <div className="absolute -inset-[2px] rounded-[18px] pointer-events-none generating-glow-mask z-20">
          <div className="absolute inset-[-100%] animate-[gen-spin_2.5s_linear_infinite] bg-[conic-gradient(from_0deg_at_50%_50%,#a855f7_0%,#3b82f6_25%,#06b6d4_45%,transparent_60%,transparent_85%,#a855f7_100%)]" />
        </div>
        <div className="absolute inset-0 rounded-2xl pointer-events-none z-10 animate-[gen-pulse_2s_ease-in-out_infinite] bg-[radial-gradient(ellipse_at_50%_0%,rgba(168,85,247,0.18)_0%,transparent_65%)]" />
        <div className="absolute inset-0 rounded-2xl pointer-events-none z-10 animate-[gen-pulse_2s_ease-in-out_infinite_1s] bg-[radial-gradient(ellipse_at_50%_100%,rgba(6,182,212,0.12)_0%,transparent_65%)]" />
      </>
    )}

    {/* Label */}
    <div className="absolute -top-8 left-1 flex items-center gap-2 shrink-0">
      <div className="text-[13px] text-gray-400 font-medium flex items-center gap-2">
        <ImageIcon size={14} className="text-gray-500" />
        {data.label || 'Image'}
      </div>
    </div>

    {/* 节点主体图片区 */}
    <div
      className={`flex-1 w-full bg-transparent relative group transition-all duration-300 rounded-2xl overflow-hidden min-h-0 ${isDragOver ? 'ring-2 ring-inset ring-violet-400' : ''}`}
    >
      <div className="absolute inset-0 flex items-center justify-center">
        {currentContent ? (
          <img
            src={currentContent}
            alt="Node content"
            className="object-cover w-full h-full pointer-events-none"
            referrerPolicy="no-referrer"
          />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-gray-500">
            <ImageIcon size={64} className="opacity-20" strokeWidth={1.5} />
          </div>
        )}
      </div>

      {/* 生成进度条 */}
      {isGenerating && (
        <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-white/10 overflow-hidden rounded-b-2xl">
          <div className="h-full bg-white/70 rounded-full animate-[shimmer_1.6s_ease-in-out_infinite]" style={{ width: '45%' }} />
        </div>
      )}

      {/* 多图切换胶囊 */}
      {currentContent && (
        <button
          className="absolute bottom-3 right-3 z-20 flex items-center gap-1.5 px-3 py-1.5 bg-black/55 backdrop-blur-md border border-white/10 rounded-full text-[12px] text-white font-medium shadow-lg hover:bg-black/75 transition-all nodrag"
          onClick={() => contents.length > 1 && setCurrentIndex((currentIndex + 1) % contents.length)}
        >
          <Sparkles size={12} className="text-white/70" />
          <span>{data.label || 'Image'}</span>
          {contents.length > 1 && (
            <>
              <span className="text-white/40 text-[10px]">{currentIndex + 1}/{contents.length}</span>
              <ChevronDown size={10} className="text-white/50" />
            </>
          )}
        </button>
      )}
    </div>

    {/* 连接点 */}
    <Handle
      type="source"
      position={Position.Right}
      id="right"
      className={`!w-8 !h-8 !bg-gray-500 hover:!bg-gray-400 !text-white !rounded-full !flex !items-center !justify-center !shadow-lg transition-all duration-150 ease-out origin-center !border-none !-right-10 !top-1/2 !-translate-y-1/2 ${
        showHandle ? 'opacity-100 scale-100' : 'opacity-0 scale-50'
      }`}
      onClick={(e) => (data.onPlusClick as ((e: React.MouseEvent, id: string) => void) | undefined)?.(e, id)}
    >
      <Plus size={15} strokeWidth={3} className="pointer-events-none" />
    </Handle>
    <Handle
      type="target"
      position={Position.Left}
      id="left"
      className={`!w-3 !h-3 !bg-gray-500 !border-2 !border-[#1a1d24] transition-opacity duration-150 ${showHandle ? 'opacity-100' : 'opacity-0'} !-left-1.5 !top-1/2 !-translate-y-1/2`}
    />

    {/* ── 下方控制面板 ── */}
    {showPanel && (
      <div
        className="nodrag absolute top-full left-1/2 -translate-x-1/2 mt-4 w-[460px] bg-[#1c1c1e] rounded-3xl shadow-2xl border border-white/[0.07] flex flex-col overflow-hidden z-50"
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* ── 输入区 ── */}
        <div className="p-4 flex flex-col gap-3">
          {/* 上传 + 提示词 */}
          <div className="flex gap-3 items-start">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex-shrink-0 w-[68px] h-[68px] border-[1.5px] border-dashed border-white/15 hover:border-white/30 rounded-[14px] flex flex-col items-center justify-center gap-1 text-gray-500 hover:text-gray-300 transition-all"
            >
              <Upload size={20} />
              <span className="text-[10px]">上传</span>
            </button>
            <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleUpload} />
            <textarea
              value={prompt}
              onChange={e => setPrompt(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleGenerate(); } }}
              placeholder="可复制或拖拽图片至此，描述你想要的画面"
              className="flex-1 bg-transparent border-none text-[14px] text-gray-200 placeholder-gray-600 focus:outline-none resize-none min-h-[68px] py-1 leading-relaxed"
            />
          </div>

          {/* 镜头描述（可编辑） */}
          <div className="flex items-start gap-2">
            <div className="w-[3px] self-stretch bg-white/10 rounded-full flex-shrink-0 mt-1" />
            <div className="flex-1 flex flex-col gap-0.5">
              <span className="text-[10px] text-gray-600 uppercase tracking-wider">镜头描述</span>
              <textarea
                value={shotDescription}
                onChange={e => setShotDescription(e.target.value)}
                onBlur={handleShotDescBlur}
                placeholder="添加镜头描述…"
                className="w-full bg-transparent text-[13px] text-gray-400 placeholder-gray-700 focus:outline-none resize-none min-h-[36px] leading-relaxed"
              />
            </div>
          </div>
        </div>

        {/* ── 展开面板区（风格 / 资产） ── */}
        {expandedPanel !== null && (
          <div className="border-t border-white/[0.06] bg-[#1a1a1c] px-4 py-3 flex flex-col gap-3">

            {/* 风格模板面板 */}
            {expandedPanel === 'style' && (
              <>
                {/* 分类筛选 */}
                <div className="flex flex-wrap gap-1.5">
                  {styleCategories.map(cat => (
                    <button
                      key={cat}
                      onClick={() => setStyleCatFilter(cat)}
                      className={`px-3 py-1 rounded-full text-[12px] border transition-colors ${
                        styleCatFilter === cat
                          ? 'bg-white/10 text-gray-200 border-white/20 font-semibold'
                          : 'text-gray-600 border-white/10 hover:text-gray-400'
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                  <button className="px-3 py-1 rounded-full text-[12px] border border-violet-500/30 text-violet-400 hover:bg-violet-500/10 transition-colors">
                    + 自定义
                  </button>
                </div>

                {/* 模板网格 */}
                {filteredTemplates.length === 0 ? (
                  <div className="text-center py-6 text-gray-600 text-[13px]">暂无模板，点击「+ 自定义」添加</div>
                ) : (
                  <div className="grid grid-cols-5 gap-1.5">
                    {filteredTemplates.map(tpl => (
                      <button
                        key={tpl.id}
                        onClick={() => handleSelectTemplate(tpl.id)}
                        className={`relative rounded-[10px] overflow-hidden aspect-[0.85] bg-white/5 flex flex-col items-center justify-end transition-all ${
                          selectedTplId === tpl.id ? 'ring-2 ring-violet-400' : 'hover:ring-1 hover:ring-white/20'
                        }`}
                      >
                        <div className="absolute inset-0 flex items-center justify-center text-2xl opacity-40">
                          🎨
                        </div>
                        <div className="relative w-full bg-gradient-to-t from-black/75 to-transparent text-[10px] text-center text-gray-200 py-1 px-1 truncate">
                          {tpl.name}
                        </div>
                      </button>
                    ))}
                    {/* + 添加格 */}
                    <button className="relative rounded-[10px] overflow-hidden aspect-[0.85] border-[1.5px] border-dashed border-white/10 flex flex-col items-center justify-center gap-1 text-gray-600 hover:text-gray-400 hover:border-white/20 transition-all">
                      <Plus size={18} />
                      <span className="text-[10px]">添加</span>
                    </button>
                  </div>
                )}
              </>
            )}

            {/* 资产面板 */}
            {expandedPanel === 'asset' && (
              <>
                {/* 分类 Tab */}
                <div className="flex gap-2">
                  {(['character', 'scene', 'other'] as const).map(cat => (
                    <button
                      key={cat}
                      onClick={() => setAssetCategory(cat)}
                      className={`px-4 py-1.5 rounded-full text-[12px] transition-colors ${
                        assetCategory === cat
                          ? 'bg-white/10 text-gray-200 font-semibold'
                          : 'text-gray-600 hover:text-gray-400'
                      }`}
                    >
                      {categoryMap[cat]}
                    </button>
                  ))}
                </div>

                {/* 资产网格 */}
                <div className="grid grid-cols-4 gap-2">
                  {filteredAssets.map(asset => {
                    const isSelected = uploadedRefImages.includes(asset.src);
                    return (
                      <button
                        key={asset.id}
                        onClick={() => handleAssetClick(asset.src)}
                        className={`rounded-xl aspect-square bg-white/[0.05] border overflow-hidden flex flex-col items-center justify-center gap-1 transition-all ${
                          isSelected
                            ? 'border-violet-400 ring-1 ring-violet-400'
                            : 'border-white/[0.07] hover:border-white/20'
                        }`}
                      >
                        {asset.src ? (
                          <img src={asset.src} alt={asset.name} className="w-full h-full object-cover" />
                        ) : (
                          <ImageIcon size={20} className="text-gray-600" />
                        )}
                      </button>
                    );
                  })}
                  {/* + 创建 */}
                  <button className="rounded-xl aspect-square border-[1.5px] border-dashed border-white/10 flex flex-col items-center justify-center gap-1 text-gray-600 hover:text-gray-400 hover:border-white/20 transition-all">
                    <Plus size={20} />
                    <span className="text-[10px]">创建</span>
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {/* ── 底部工具栏 ── */}
        <div className="flex items-center gap-1.5 px-3 py-2.5 border-t border-white/[0.06]">

          {/* 模型 */}
          <button className="flex items-center gap-1.5 px-3 py-1.5 bg-white/[0.05] hover:bg-white/[0.09] border border-white/[0.08] rounded-full text-[12px] text-gray-400 transition-all">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83"/></svg>
            SeeDream
            <ChevronDown size={10} className="text-gray-600" />
          </button>

          {/* 比例 */}
          <div className="relative">
            <button
              onClick={() => { setIsRatioOpen(v => !v); setIsQualityOpen(false); setIsCountOpen(false); }}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white/[0.05] hover:bg-white/[0.09] border border-white/[0.08] rounded-full text-[12px] text-gray-400 transition-all"
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="4" width="20" height="16" rx="2"/></svg>
              {ratio}
              <ChevronDown size={10} className="text-gray-600" />
            </button>
            {isRatioOpen && (
              <div className="absolute bottom-full left-0 mb-2 w-32 bg-[#0a0a0a] border border-white/10 rounded-xl shadow-2xl overflow-hidden z-50">
                {(['1:1','4:3','3:4','16:9','9:16','3:2','2:3','21:9'] as const).map(r => (
                  <button key={r} onClick={() => { setRatio(r); const s = RATIO_SIZES[r] ?? {w:380,h:214}; data.onUpdate?.(id,{ratio:r,_width:s.w,_height:s.h}); setIsRatioOpen(false); }}
                    className={`w-full px-3 py-1.5 text-left text-[12px] transition-colors flex justify-between items-center ${ratio===r?'text-white bg-white/10':'text-gray-400 hover:bg-white/8'}`}
                  >{r}{ratio===r&&<span className="text-white/40 text-[10px]">✓</span>}</button>
                ))}
              </div>
            )}
          </div>

          {/* 清晰度 */}
          <div className="relative">
            <button
              onClick={() => { setIsQualityOpen(v => !v); setIsRatioOpen(false); setIsCountOpen(false); }}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white/[0.05] hover:bg-white/[0.09] border border-white/[0.08] rounded-full text-[12px] text-gray-400 transition-all"
            >
              {quality}
              <ChevronDown size={10} className="text-gray-600" />
            </button>
            {isQualityOpen && (
              <div className="absolute bottom-full left-0 mb-2 w-20 bg-[#0a0a0a] border border-white/10 rounded-xl shadow-2xl overflow-hidden z-50">
                {(['1K','2K'] as const).map(q => (
                  <button key={q} onClick={() => { setQuality(q); setIsQualityOpen(false); }}
                    className={`w-full px-3 py-1.5 text-left text-[12px] transition-colors flex justify-between items-center ${quality===q?'text-white bg-white/10':'text-gray-400 hover:bg-white/8'}`}
                  >{q}{quality===q&&<span className="text-white/40 text-[10px]">✓</span>}</button>
                ))}
              </div>
            )}
          </div>

          {/* 风格图标 */}
          <button
            onClick={() => togglePanel('style')}
            title="风格模板"
            className={`w-[34px] h-[34px] rounded-full flex items-center justify-center border transition-all ${
              expandedPanel === 'style'
                ? 'bg-violet-500/20 border-violet-500/50 text-violet-300'
                : 'bg-white/[0.05] border-white/[0.08] text-gray-500 hover:text-gray-300 hover:bg-white/[0.09]'
            }`}
          >
            <Palette size={15} />
          </button>

          {/* 资产图标 */}
          <button
            onClick={() => togglePanel('asset')}
            title="资产"
            className={`w-[34px] h-[34px] rounded-full flex items-center justify-center border transition-all ${
              expandedPanel === 'asset'
                ? 'bg-violet-500/20 border-violet-500/50 text-violet-300'
                : 'bg-white/[0.05] border-white/[0.08] text-gray-500 hover:text-gray-300 hover:bg-white/[0.09]'
            }`}
          >
            <Users size={15} />
          </button>

          <div className="flex-1" />

          {/* AI优化 */}
          <button
            onClick={handleOptimizePrompt}
            disabled={!canOptimize || optimizing}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-full bg-violet-600/50 hover:bg-violet-600/70 disabled:opacity-30 text-[12px] text-violet-200 border border-violet-500/30 transition-all"
          >
            {optimizing ? <Loader2 size={11} className="animate-spin" /> : <span>✨</span>}
            {optimizing ? '优化中…' : 'AI 优化'}
          </button>

          {/* 数量 */}
          <div className="relative">
            <button
              onClick={() => { setIsCountOpen(v => !v); setIsRatioOpen(false); setIsQualityOpen(false); }}
              className="flex items-center gap-1 px-3 py-1.5 bg-white/[0.05] hover:bg-white/[0.09] border border-white/[0.08] rounded-full text-[12px] text-gray-400 transition-all"
            >
              {generateCount}x
              <ChevronDown size={10} className="text-gray-600" />
            </button>
            {isCountOpen && (
              <div className="absolute bottom-full right-0 mb-2 bg-[#1a1a1a] border border-white/10 rounded-xl shadow-2xl overflow-hidden z-50">
                {[4,3,2,1].map(n => (
                  <button key={n} onClick={() => { setGenerateCount(n); setIsCountOpen(false); }}
                    className={`w-full px-4 py-2 text-center text-[12px] transition-colors ${generateCount===n?'text-white bg-white/10':'text-gray-400 hover:bg-white/5'}`}
                  >{n}x</button>
                ))}
              </div>
            )}
          </div>

          {/* 下载 */}
          {currentContent && (
            <button onClick={handleDownload} className="w-[34px] h-[34px] rounded-full flex items-center justify-center text-gray-500 hover:text-gray-200 transition-colors">
              <Download size={16} />
            </button>
          )}

          {/* 生成按钮 */}
          <button
            onClick={handleGenerate}
            disabled={isGenerating || !prompt}
            className="w-[34px] h-[34px] rounded-full bg-fuchsia-600 hover:bg-fuchsia-500 disabled:opacity-40 flex items-center justify-center shadow-lg shadow-fuchsia-900/40 transition-all active:scale-95"
          >
            {isGenerating
              ? <Loader2 size={16} className="animate-spin text-white" />
              : <ArrowUp size={16} strokeWidth={2.5} className="text-white" />
            }
          </button>

        </div>

        {/* 生成错误 */}
        {genError && <p className="px-4 pb-3 text-red-400 text-[12px]">{genError}</p>}

        {/* 隐藏 input */}
        <input type="file" ref={refImageInputRef} className="hidden" accept="image/*" multiple onChange={handleRefImageUpload} />
      </div>
    )}
  </div>
);
```

- [ ] **Step 2: 验证 TypeScript 无报错**

```bash
npx tsc --noEmit 2>&1 | head -30
```

期望：无 TS 错误。

- [ ] **Step 3: 在浏览器中验证节点可选中、面板出现、三种状态正常切换**

1. 打开 http://localhost:3000，登录，新建项目，添加图片节点
2. 点击节点，面板出现在节点下方
3. 点击「🎨 风格」图标：展开风格面板，显示分类 pill + 模板网格
4. 点击「👥 资产」图标：切换到资产面板，显示角色/场景/道具 Tab
5. 镜头描述框可编辑，失焦后刷新页面数据持久
6. AI 优化按钮在无描述无模板时为灰色，有任一时可点击

- [ ] **Step 4: Commit**

```bash
git add src/components/ImageNode.tsx
git commit -m "feat: complete ImageNode panel redesign — expandable style/asset panels"
```

---

## Self-Review

### Spec Coverage Check

| Spec 需求 | 对应 Task |
|-----------|-----------|
| 紧凑底部栏 + 展开面板 | Task 6 JSX |
| 提示词大文本区 + 上传按钮 | Task 6 输入区 |
| 镜头描述可编辑，失焦持久化 | Task 4 state + Task 6 JSX |
| 风格模板分类 pill + 网格 5 列 | Task 6 风格面板 |
| 模板选中紫色边框，再次点取消 | Task 5 `handleSelectTemplate` + Task 6 JSX |
| 空状态提示「暂无模板」 | Task 6 风格面板条件渲染 |
| 默认 8 个风格模板 seed | Task 1 |
| 资产面板角色/场景/道具 Tab | Task 6 资产面板 |
| 资产点击 → 追加参考图（最多4） | Task 5 `handleAssetClick` |
| 模型选择 Pill | Task 6 底部栏（当前静态，可点击） |
| 比例下拉 | Task 6 底部栏 |
| 清晰度下拉 1K/2K | Task 6 底部栏 |
| 风格/资产图标互斥切换 | Task 4/5 `togglePanel` |
| AI 优化 = style + shot desc | Task 2 后端 + Task 5 `handleOptimizePrompt` |
| 数量 1x-4x | Task 6 底部栏 |
| 下载按钮 | Task 6 底部栏 |
| 生成按钮 | Task 6 底部栏 |
| App.tsx 注入 assets | Task 3 |

### Placeholder Scan
- ✅ 无 TBD/TODO
- ✅ 每步都有完整代码
- ✅ 所有函数名在 Task 5 定义、Task 6 使用时一致

### Type Consistency
- `handleAssetClick(src: string)` — Task 5 定义，Task 6 JSX 调用 `handleAssetClick(asset.src)` ✅
- `handleSelectTemplate(tplId: string)` — Task 5 定义，Task 6 JSX 调用 ✅
- `togglePanel('style' | 'asset')` — Task 5 定义，Task 6 JSX 调用 ✅
- `AssetItem` import 在 Task 4 ✅
- `RATIO_SIZES` 在原文件已有，Task 6 继续使用 ✅
