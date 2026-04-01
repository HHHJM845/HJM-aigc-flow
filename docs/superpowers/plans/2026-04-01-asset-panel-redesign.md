# 资产库分类与界面放大 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign AssetPanel with category sidebar (人物/场景/其他), larger panel size (500px × 85vh), 3-column grid, natural-ratio thumbnails, and per-file category selection on upload.

**Architecture:** Two-file change — add optional `category` field to `AssetItem` in storage.ts, then rewrite AssetPanel.tsx with left sidebar state, pendingFiles queue for serial category assignment, and filtered grid rendering.

**Tech Stack:** React + TypeScript, Tailwind CSS, lucide-react icons

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `src/lib/storage.ts` | **Modify** | Add `category?: 'character' \| 'scene' \| 'other'` to `AssetItem` |
| `src/components/AssetPanel.tsx` | **Rewrite** | New layout, sidebar, upload flow, grid |

---

### Task 1: Add `category` field to `AssetItem`

**Files:**
- Modify: `src/lib/storage.ts`

- [ ] **Step 1: Update the AssetItem interface**

In `src/lib/storage.ts`, replace:

```typescript
export interface AssetItem {
  id: string;
  type: 'image' | 'video';
  src: string;
  name: string;
  createdAt: number;
}
```

With:

```typescript
export interface AssetItem {
  id: string;
  type: 'image' | 'video';
  src: string;
  name: string;
  createdAt: number;
  category?: 'character' | 'scene' | 'other';
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit 2>&1`

Expected: No errors. The field is optional so no existing code breaks.

- [ ] **Step 3: Commit**

```bash
git add src/lib/storage.ts
git commit -m "feat: add optional category field to AssetItem"
```

---

### Task 2: Rewrite AssetPanel

**Files:**
- Rewrite: `src/components/AssetPanel.tsx`

- [ ] **Step 1: Replace the entire file with the new implementation**

Write `src/components/AssetPanel.tsx`:

```tsx
import React, { useRef, useState } from 'react';
import { Upload, X, Image as ImageIcon, Film } from 'lucide-react';
import type { AssetItem } from '../lib/storage';

type ActiveCategory = 'all' | 'character' | 'scene' | 'other';

interface PendingFile {
  src: string;
  name: string;
  type: 'image' | 'video';
}

interface Props {
  assets: AssetItem[];
  onUpload: (items: AssetItem[]) => void;
  onRemove: (id: string) => void;
}

const CATEGORIES: { key: ActiveCategory; label: string }[] = [
  { key: 'all', label: '全部' },
  { key: 'character', label: '人物' },
  { key: 'scene', label: '场景' },
  { key: 'other', label: '其他' },
];

export default function AssetPanel({ assets, onUpload, onRemove }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [activeCategory, setActiveCategory] = useState<ActiveCategory>('all');
  const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? new FileList()) as File[];
    const pending: PendingFile[] = [];
    let processed = 0;
    files.forEach(file => {
      const reader = new FileReader();
      reader.onload = ev => {
        const src = ev.target?.result as string;
        const type: 'image' | 'video' = file.type.startsWith('video') ? 'video' : 'image';
        pending.push({ src, name: file.name, type });
        processed++;
        if (processed === files.length) {
          setPendingFiles(prev => [...prev, ...pending]);
        }
      };
      reader.readAsDataURL(file);
    });
    e.target.value = '';
  };

  const handleSelectCategory = (category: 'character' | 'scene' | 'other') => {
    const file = pendingFiles[0];
    if (!file) return;
    onUpload([{
      id: `asset_${Date.now()}_${Math.random().toString(36).slice(2)}`,
      type: file.type,
      src: file.src,
      name: file.name,
      createdAt: Date.now(),
      category,
    }]);
    setPendingFiles(prev => prev.slice(1));
  };

  const handleDragStart = (e: React.DragEvent, asset: AssetItem) => {
    e.dataTransfer.setData('application/asset-type', asset.type);
    e.dataTransfer.setData('application/asset-src', asset.src);
    e.dataTransfer.setData('application/asset-name', asset.name);
    e.dataTransfer.effectAllowed = 'copy';
  };

  const counts: Record<ActiveCategory, number> = {
    all: assets.length,
    character: assets.filter(a => a.category === 'character').length,
    scene: assets.filter(a => a.category === 'scene').length,
    other: assets.filter(a => a.category === 'other').length,
  };

  const filteredAssets = activeCategory === 'all'
    ? assets
    : assets.filter(a => a.category === activeCategory);

  const currentPending = pendingFiles[0];

  return (
    <div className="absolute left-16 top-1/2 -translate-y-1/2 z-40 w-[500px] max-h-[85vh] bg-[#141414] border border-white/[0.08] rounded-2xl shadow-2xl flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06] flex-shrink-0">
        <span className="text-white text-sm font-medium">资产库</span>
        <button
          onClick={() => fileInputRef.current?.click()}
          className="flex items-center gap-1.5 px-2.5 py-1 bg-white/10 hover:bg-white/15 text-gray-300 rounded-lg text-xs transition-colors"
        >
          <Upload size={11} />
          上传
        </button>
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          accept="image/*,video/*"
          multiple
          onChange={handleFileChange}
        />
      </div>

      {/* Body: sidebar + grid */}
      <div className="flex flex-1 overflow-hidden min-h-0">
        {/* Left sidebar */}
        <div className="flex flex-col gap-1.5 p-2 border-r border-white/[0.05] flex-shrink-0 w-[68px]">
          {CATEGORIES.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setActiveCategory(key)}
              className={`flex flex-col items-center py-2 px-1 rounded-lg text-xs transition-colors ${
                activeCategory === key
                  ? 'bg-[#333] text-white border border-white/20'
                  : 'bg-transparent text-gray-500 hover:text-gray-300 border border-transparent'
              }`}
            >
              <span>{label}</span>
              <span className={`text-[10px] mt-0.5 ${activeCategory === key ? 'text-gray-300' : 'text-gray-600'}`}>
                {counts[key]}
              </span>
            </button>
          ))}
        </div>

        {/* Grid */}
        <div className="flex-1 overflow-y-auto p-3">
          {filteredAssets.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 text-gray-600 text-xs text-center gap-2">
              <ImageIcon size={28} className="opacity-30" />
              <p>{activeCategory === 'all' ? '上传素材或从画布生成图片\n后将在这里显示' : '该分类暂无素材'}</p>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              {filteredAssets.map(asset => (
                <div
                  key={asset.id}
                  draggable
                  onDragStart={e => handleDragStart(e, asset)}
                  className="relative group rounded-xl overflow-hidden border border-white/10 cursor-grab active:cursor-grabbing bg-black/30"
                >
                  {asset.type === 'image' ? (
                    <img
                      src={asset.src}
                      alt={asset.name}
                      className="w-full h-auto object-contain rounded-xl"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="w-full aspect-video flex items-center justify-center bg-gray-800">
                      <Film size={24} className="text-gray-500" />
                    </div>
                  )}
                  {/* Type badge */}
                  <div className="absolute top-1.5 left-1.5 px-1.5 py-0.5 bg-black/60 rounded text-[9px] text-white/70 font-medium uppercase">
                    {asset.type === 'image' ? 'IMAGE' : 'VIDEO'}
                  </div>
                  {/* Remove button */}
                  <button
                    onClick={() => onRemove(asset.id)}
                    className="absolute top-1.5 right-1.5 w-5 h-5 bg-black/60 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500/70"
                  >
                    <X size={10} className="text-white" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Category selection overlay — shown when pendingFiles has items */}
      {currentPending && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/70 backdrop-blur-sm rounded-2xl">
          <div className="bg-[#1c1c1c] border border-white/10 rounded-xl p-4 shadow-2xl min-w-[180px]">
            <p className="text-gray-400 text-xs mb-1 text-center">选择分类</p>
            <p className="text-gray-500 text-[10px] mb-3 text-center truncate max-w-[160px]">{currentPending.name}</p>
            <div className="flex flex-col gap-2">
              <button
                onClick={() => handleSelectCategory('character')}
                className="flex items-center gap-2 px-3 py-2 bg-white/5 hover:bg-white/10 rounded-lg text-sm text-gray-200 transition-colors"
              >
                <span>👤</span> 人物
              </button>
              <button
                onClick={() => handleSelectCategory('scene')}
                className="flex items-center gap-2 px-3 py-2 bg-white/5 hover:bg-white/10 rounded-lg text-sm text-gray-200 transition-colors"
              >
                <span>🏞</span> 场景
              </button>
              <button
                onClick={() => handleSelectCategory('other')}
                className="flex items-center gap-2 px-3 py-2 bg-white/5 hover:bg-white/10 rounded-lg text-sm text-gray-200 transition-colors"
              >
                <span>📦</span> 其他
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit 2>&1`

Expected: Zero errors.

- [ ] **Step 3: Verify dev build passes**

Run: `npm run build 2>&1 | tail -10`

Expected: `✓ built in X.XXs` with no errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/AssetPanel.tsx
git commit -m "feat: redesign AssetPanel with category sidebar, larger size, natural-ratio thumbnails"
```

---

### Task 3: Deploy to Server

- [ ] **Step 1: Push to GitHub**

```bash
git push origin main
```

- [ ] **Step 2: Deploy via SSH**

Create `deploy_run.cjs` at project root:

```js
const { Client } = require('./node_modules/ssh2');
const conn = new Client();
const cmd = `cd /home/HJM-aigc-flow && git pull origin main && npm install && npm run build && pm2 restart aigc-flow && pm2 list`;
conn.on('ready', () => {
  conn.exec(cmd, (err, stream) => {
    if (err) { console.error(err); conn.end(); return; }
    stream.on('data', d => process.stdout.write(d.toString()));
    stream.stderr.on('data', d => process.stderr.write(d.toString()));
    stream.on('close', () => conn.end());
  });
});
conn.on('error', e => console.error(e.message));
conn.connect({ host: '218.244.158.35', port: 22, username: 'root', password: 'Huang_21254875', readyTimeout: 30000, keepaliveInterval: 10000 });
```

Run: `node deploy_run.cjs`

Expected: `pm2 restart aigc-flow` succeeds, process shows `online`.

- [ ] **Step 3: Clean up**

```bash
rm deploy_run.cjs
```

---

## Smoke Test Checklist

After deployment, open `http://218.244.158.35:3001` and go to the canvas view:

1. **Panel size**: Click assets icon → panel should be noticeably larger (500px wide)
2. **Sidebar visible**: Four buttons on the left — 全部 / 人物 / 场景 / 其他, each showing count
3. **Upload + category popup**: Click 上传 → select an image → category overlay appears over the panel
4. **Assign category**: Click 人物 → image appears in grid, count under 人物 increments
5. **Filter works**: Click 人物 in sidebar → only 人物 assets shown
6. **Multi-file**: Upload 3 files at once → category popup appears 3 times in sequence
7. **Natural ratio**: Upload a portrait image (e.g. 9:16) → thumbnail shows tall, not cropped to 16:9
8. **Drag to canvas**: Drag an asset onto the canvas → ImageNode created as before
9. **Delete**: Hover an asset → X button appears → click → asset removed
10. **Empty state**: Switch to 场景 with no scene assets → "该分类暂无素材" shown
