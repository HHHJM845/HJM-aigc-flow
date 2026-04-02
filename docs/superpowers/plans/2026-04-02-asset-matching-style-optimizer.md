# Asset Matching & Style Optimizer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add AI-powered asset auto-matching (when importing storyboard to canvas, AI detects character/scene names and sets referenceImage on matching nodes) and per-node style selector + AI prompt optimizer in ImageNode.

**Architecture:** Two server routes (`/api/match-assets`, `/api/optimize-prompt`) use the existing Doubao text API. Frontend: AssetPanel gains inline name editing; ImageNode gains a style tag row + AI optimize button; App.tsx wires the match-assets call after `rowsToNodes()`.

**Tech Stack:** React + TypeScript (frontend), Express + Doubao ARK text API (backend), existing `IMAGE_API_KEY` env var.

---

## File Map

| File | Action | What changes |
|------|--------|-------------|
| `src/components/AssetPanel.tsx` | Modify | `onRename` prop, inline name editing UI, name display under each asset |
| `src/components/ImageNode.tsx` | Modify | `selectedStyle`/`customStyle`/`optimizing` state, style tag row, AI optimize button |
| `src/App.tsx` | Modify | `handleAssetRename` callback, `onRename` on AssetPanel, `handleImportFromBreakdown` calls match-assets |
| `server/routes/match-assets.ts` | Create | AI asset-to-row matching route |
| `server/routes/optimize-prompt.ts` | Create | AI prompt optimization route |
| `server/index.ts` | Modify | Register 2 new routes |

---

## Task 1: Add inline asset rename to AssetPanel

**Files:**
- Modify: `src/components/AssetPanel.tsx`

- [ ] **Step 1: Add `onRename` to Props interface**

Read `src/components/AssetPanel.tsx` first. Then replace the Props interface:

```ts
interface Props {
  assets: AssetItem[];
  onUpload: (items: AssetItem[]) => void;
  onRemove: (id: string) => void;
  onRename: (id: string, name: string) => void;
}
```

- [ ] **Step 2: Add onRename to destructured props and editing state**

Replace the function signature line:
```ts
export default function AssetPanel({ assets, onUpload, onRemove, onRename }: Props) {
```

After `const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([]);`, add:
```ts
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
```

- [ ] **Step 3: Add name display + inline editing to each asset card**

In the grid, find each asset's `<div key={asset.id} ...>` card. It currently ends with the remove button `</div>`. After the remove button div (but before the card's closing `</div>`), add a name row:

```tsx
                  {/* Asset name — click to rename */}
                  <div
                    className="px-1.5 py-1 bg-black/40"
                    onMouseDown={e => e.stopPropagation()}
                  >
                    {editingId === asset.id ? (
                      <input
                        autoFocus
                        value={editingName}
                        onChange={e => setEditingName(e.target.value)}
                        onBlur={() => {
                          onRename(asset.id, editingName.trim() || asset.name);
                          setEditingId(null);
                        }}
                        onKeyDown={e => {
                          if (e.key === 'Enter') {
                            onRename(asset.id, editingName.trim() || asset.name);
                            setEditingId(null);
                          }
                          if (e.key === 'Escape') setEditingId(null);
                        }}
                        className="w-full bg-transparent text-[10px] text-white/80 outline-none border-b border-white/30 leading-snug"
                        onClick={e => e.stopPropagation()}
                      />
                    ) : (
                      <p
                        className="text-[10px] text-white/40 truncate cursor-pointer hover:text-white/70 leading-snug"
                        title={`${asset.name} (点击重命名)`}
                        onClick={e => {
                          e.stopPropagation();
                          setEditingId(asset.id);
                          setEditingName(asset.name);
                        }}
                      >
                        {asset.name}
                      </p>
                    )}
                  </div>
```

- [ ] **Step 4: Commit**

```bash
git add src/components/AssetPanel.tsx
git commit -m "feat: add inline asset rename to AssetPanel"
```

---

## Task 2: Wire asset rename in App.tsx

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1: Add handleAssetRename callback**

Read `src/App.tsx` lines 455–475 to confirm the location of `handleAssetRemove`. After `handleAssetRemove`, add:

```ts
  const handleAssetRename = useCallback((id: string, name: string) => {
    setAssets(prev => {
      const updated = prev.map(a => a.id === id ? { ...a, name } : a);
      onSaveAssets(updated);
      return updated;
    });
  }, [onSaveAssets]);
```

- [ ] **Step 2: Pass onRename to AssetPanel**

Find the `<AssetPanel` JSX (around line 723):
```tsx
            <AssetPanel
              assets={assets}
              onUpload={handleAssetUpload}
              onRemove={handleAssetRemove}
            />
```
Replace with:
```tsx
            <AssetPanel
              assets={assets}
              onUpload={handleAssetUpload}
              onRemove={handleAssetRemove}
              onRename={handleAssetRename}
            />
```

- [ ] **Step 3: Verify TypeScript builds**

```bash
npm run build 2>&1 | head -20
```

Expected: no TypeScript errors.

- [ ] **Step 4: Commit**

```bash
git add src/App.tsx
git commit -m "feat: wire asset rename in App.tsx"
```

---

## Task 3: Create /api/match-assets server route

**Files:**
- Create: `server/routes/match-assets.ts`

- [ ] **Step 1: Create the file**

Create `server/routes/match-assets.ts`:

```ts
import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';

const router = Router();
const ARK_BASE = 'https://ark.cn-beijing.volces.com/api/v3';
const TEXT_MODEL = 'doubao-pro-32k';

router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { rows, assets } = req.body as {
      rows: { id: string; description: string }[];
      assets: { id: string; name: string; category?: string }[];
    };

    if (!rows?.length || !assets?.length) {
      return res.json({ matches: [] });
    }

    const apiKey = process.env.IMAGE_API_KEY;
    if (!apiKey) return res.status(500).json({ error: '服务端未配置 IMAGE_API_KEY' });

    const assetList = assets
      .map(a => `- ID: ${a.id} | 名称: ${a.name} | 类别: ${a.category ?? '未分类'}`)
      .join('\n');
    const rowList = rows
      .map(r => `- ID: ${r.id} | 描述: ${r.description}`)
      .join('\n');

    const userPrompt = `你是分镜资产匹配专家。根据资产库和分镜描述，找出每个分镜最匹配的主要角色或场景资产。

资产库：
${assetList}

分镜描述：
${rowList}

匹配规则：
- 只匹配描述中明确出现的角色名或场景名（精确、部分或近义词匹配均可）
- 每个分镜最多匹配一个资产（选最突出的）
- 无法确定时不返回该分镜

只返回JSON，格式：{"matches": [{"rowId": "...", "assetId": "..."}]}`;

    const upstream = await fetch(`${ARK_BASE}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: TEXT_MODEL,
        messages: [{ role: 'user', content: userPrompt }],
        temperature: 0,
      }),
    });

    if (!upstream.ok) {
      const err = await upstream.text();
      console.error('[match-assets] upstream error:', err);
      return res.status(502).json({ error: `AI API error: ${upstream.status}` });
    }

    const data = await upstream.json() as { choices: { message: { content: string } }[] };
    const content = data.choices?.[0]?.message?.content ?? '{"matches":[]}';

    // Extract JSON — AI may wrap output in ```json ... ```
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return res.json({ matches: [] });

    const result = JSON.parse(jsonMatch[0]) as { matches: { rowId: string; assetId: string }[] };
    res.json(result);
  } catch (err) {
    next(err);
  }
});

export default router;
```

- [ ] **Step 2: Commit**

```bash
git add server/routes/match-assets.ts
git commit -m "feat: add /api/match-assets server route"
```

---

## Task 4: Create /api/optimize-prompt server route

**Files:**
- Create: `server/routes/optimize-prompt.ts`

- [ ] **Step 1: Create the file**

Create `server/routes/optimize-prompt.ts`:

```ts
import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';

const router = Router();
const ARK_BASE = 'https://ark.cn-beijing.volces.com/api/v3';
const TEXT_MODEL = 'doubao-pro-32k';

router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { description, style, label } = req.body as {
      description: string;
      style?: string;
      label?: string;
    };

    if (!description?.trim()) {
      return res.status(400).json({ error: '请提供画面描述' });
    }

    const apiKey = process.env.IMAGE_API_KEY;
    if (!apiKey) return res.status(500).json({ error: '服务端未配置 IMAGE_API_KEY' });

    const styleText = style?.trim() ? `画风：${style}` : '';
    const labelText = label?.trim() ? `镜头信息：${label}` : '';

    const userPrompt = `你是专业的AI图像生成提示词工程师。根据分镜画面描述和画风，生成一段优化的图像生成提示词。

要求：
- 语言：中文
- 长度：50-150字
- 包含：画面主体、构图、光线氛围、画风关键词
- 只输出提示词本身，不要加任何解释或标题

画面描述：${description}
${styleText}
${labelText}`.trim();

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

export default router;
```

- [ ] **Step 2: Commit**

```bash
git add server/routes/optimize-prompt.ts
git commit -m "feat: add /api/optimize-prompt server route"
```

---

## Task 5: Register new routes in server/index.ts

**Files:**
- Modify: `server/index.ts`

- [ ] **Step 1: Add imports**

Read `server/index.ts`. After the line:
```ts
import exportVideoRouter from './routes/export-video.js';
```
Add:
```ts
import matchAssetsRouter from './routes/match-assets.js';
import optimizePromptRouter from './routes/optimize-prompt.js';
```

- [ ] **Step 2: Register routes**

After `app.use('/api/export-video', exportVideoRouter);`, add:
```ts
app.use('/api/match-assets', matchAssetsRouter);
app.use('/api/optimize-prompt', optimizePromptRouter);
```

- [ ] **Step 3: Commit**

```bash
git add server/index.ts
git commit -m "feat: register match-assets and optimize-prompt routes"
```

---

## Task 6: Add style selector and AI optimize button to ImageNode

**Files:**
- Modify: `src/components/ImageNode.tsx`

- [ ] **Step 1: Add STYLE_PRESETS constant**

Read `src/components/ImageNode.tsx`. After the `RATIO_SIZES` constant (around line 16), add:

```ts
const STYLE_PRESETS = ['写实', '动漫', '油画', '水彩', '赛博朋克', '中国水墨', '素描', '3D渲染', '皮克斯风格'] as const;
```

- [ ] **Step 2: Add style and optimizing state**

In the component body, after `const [genError, setGenError] = useState('');` (around line 38), add:

```ts
  const [selectedStyle, setSelectedStyle] = useState<string>(data.style ?? '');
  const [customStyle, setCustomStyle] = useState<string>('');
  const [optimizing, setOptimizing] = useState(false);
```

- [ ] **Step 3: Add handleOptimizePrompt function**

After the existing state declarations (before the `allRefImages` or `fileInputRef` lines), add:

```ts
  const handleOptimizePrompt = async () => {
    if (!data.shotDescription) return;
    const style = selectedStyle || customStyle;
    setOptimizing(true);
    try {
      const resp = await fetch('/api/optimize-prompt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          description: data.shotDescription,
          style,
          label: data.label,
        }),
      });
      if (resp.ok) {
        const result = await resp.json() as { prompt: string };
        setPrompt(result.prompt);
      }
    } catch {
      // Silent fail — user can retry
    } finally {
      setOptimizing(false);
    }
  };
```

- [ ] **Step 4: Add style selector row before the prompt textarea**

Find the "提示词输入区" comment and its surrounding code (around lines 343–357):
```tsx
          {/* 2. 提示词输入区 */}
          <div className="flex items-start gap-4">
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleGenerate();
                }
              }}
              placeholder="描述任何你想生成的内容"
              className="flex-1 bg-transparent border-none text-[16px] text-gray-200 placeholder-gray-600 focus:outline-none resize-none min-h-[80px] py-1 leading-relaxed"
            />
          </div>
```

Replace with:
```tsx
          {/* Style selector */}
          <div
            className="flex flex-wrap gap-1.5 items-center"
            onMouseDown={e => e.stopPropagation()}
          >
            {STYLE_PRESETS.map(style => (
              <button
                key={style}
                onClick={() => {
                  const newStyle = selectedStyle === style ? '' : style;
                  setSelectedStyle(newStyle);
                  setCustomStyle('');
                  data.onUpdate?.(id, { style: newStyle });
                }}
                className={`px-2 py-0.5 rounded-full text-[11px] border transition-colors ${
                  selectedStyle === style
                    ? 'bg-violet-600/80 border-violet-500 text-white'
                    : 'bg-white/5 border-white/10 text-white/50 hover:text-white/80'
                }`}
              >
                {style}
              </button>
            ))}
            <input
              value={customStyle}
              onChange={e => {
                setCustomStyle(e.target.value);
                setSelectedStyle('');
                data.onUpdate?.(id, { style: e.target.value });
              }}
              placeholder="自定义画风"
              className="flex-1 min-w-[80px] bg-white/5 border border-white/10 rounded-full px-3 py-0.5 text-[11px] text-white/70 placeholder-white/25 outline-none focus:border-white/30"
            />
          </div>

          {/* 2. 提示词输入区 */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-gray-500 font-medium uppercase tracking-wide">提示词</span>
              <button
                onClick={handleOptimizePrompt}
                disabled={optimizing || !data.shotDescription}
                className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-violet-600/60 hover:bg-violet-600/80 disabled:opacity-40 text-[11px] text-white transition-colors"
              >
                {optimizing
                  ? <Loader2 size={10} className="animate-spin" />
                  : <span>✨</span>
                }
                {optimizing ? '优化中…' : 'AI优化'}
              </button>
            </div>
            <div className="flex items-start gap-4">
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleGenerate();
                  }
                }}
                placeholder="描述任何你想生成的内容"
                className="flex-1 bg-transparent border-none text-[16px] text-gray-200 placeholder-gray-600 focus:outline-none resize-none min-h-[80px] py-1 leading-relaxed"
              />
            </div>
          </div>
```

- [ ] **Step 5: Verify TypeScript builds**

```bash
npm run build 2>&1 | head -20
```

Expected: no TypeScript errors.

- [ ] **Step 6: Commit**

```bash
git add src/components/ImageNode.tsx
git commit -m "feat: add style selector and AI optimize button to ImageNode"
```

---

## Task 7: Update handleImportFromBreakdown to call match-assets

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1: Make handleImportFromBreakdown async and add match call**

Read `src/App.tsx` lines 216–223. Replace `handleImportFromBreakdown`:

```ts
  const handleImportFromBreakdown = useCallback(async (rows: StoryboardRow[], ratio: string, cardW: number, cardH: number) => {
    setStoryboardRows(rows);
    onSaveRows(rows);
    const newNodes = rowsToNodes(rows, cardW, cardH, ratio);
    setNodes(newNodes);
    setEdges([]);
    setActiveView('canvas');

    // AI asset matching — runs in background after nodes appear
    if (assets.length > 0) {
      try {
        const resp = await fetch('/api/match-assets', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            rows: rows.map(r => ({ id: r.id, description: r.description ?? '' })),
            assets: assets.map(a => ({ id: a.id, name: a.name, category: a.category })),
          }),
        });
        if (resp.ok) {
          const { matches } = await resp.json() as { matches: { rowId: string; assetId: string }[] };
          const assetMap = new Map(assets.map(a => [a.id, a]));
          setNodes(prev => prev.map(node => {
            const match = matches.find(m => `storyboard-${m.rowId}` === node.id);
            if (match) {
              const asset = assetMap.get(match.assetId);
              if (asset) return { ...node, data: { ...node.data, referenceImage: asset.src } };
            }
            return node;
          }));
        }
      } catch {
        // Silent fail — asset matching is best-effort
      }
    }
  }, [setNodes, setEdges, onSaveRows, assets]);
```

- [ ] **Step 2: Verify TypeScript builds**

```bash
npm run build 2>&1 | head -20
```

Expected: no TypeScript errors. If there are TypeScript errors related to the `assets` variable not being in scope, check where `assets` state is declared (around line 146) and ensure `handleImportFromBreakdown` is in the same component function scope.

- [ ] **Step 3: Commit**

```bash
git add src/App.tsx
git commit -m "feat: call match-assets API on breakdown import"
```

---

## Task 8: Push and deploy

- [ ] **Step 1: Push to GitHub**

```bash
git push origin main
```

- [ ] **Step 2: Deploy to server**

```bash
ssh root@218.244.158.35 "cd /home/HJM-aigc-flow && git pull origin main && npm run build 2>&1 | tail -5 && pm2 restart aigc-flow"
```

- [ ] **Step 3: Verify server running**

```bash
ssh root@218.244.158.35 "pm2 status aigc-flow"
```

Expected: status `online`.
