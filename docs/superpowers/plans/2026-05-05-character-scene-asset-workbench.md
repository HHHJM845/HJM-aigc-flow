# Character Scene Asset Workbench Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Stitch-inspired 角色场景 workspace between 剧本拆解 and 无限画布 where users create character/scene cards, generate image assets, save them to the existing asset library, and reuse them on the canvas.

**Architecture:** Add project-level asset workbench card data, pure helpers for card creation/prompt/asset conversion, a dedicated React view for the three-column workspace, and App integration for persistence and canvas reuse. The view uses existing `/api/generate`, existing `AssetItem` storage, and the same patch-based project save path used by canvas/storyboard/video saves.

**Tech Stack:** React, TypeScript, Vite, Tailwind utility classes, Material Symbols, existing `/api/generate`, existing `AssetItem` and project WebSocket/localStorage sync.

---

## File Structure

- Create `src/lib/assetWorkbench.ts`
  - Defines `AssetWorkbenchCard`, style presets, card factory, prompt composition, card update helper, and `AssetItem` conversion.
- Create `tests/assetWorkbench.test.ts`
  - Covers card defaults, prompt composition, character/scene asset conversion, and status/asset id updates.
- Modify `src/lib/storage.ts`
  - Adds `assetWorkbenchCards` to `Project` and legacy load defaults.
- Modify `tests/projectPatch.test.ts`
  - Ensures canvas saves preserve `assetWorkbenchCards`.
- Modify `src/lib/bottomTabs.ts`
  - Inserts `角色场景` between `剧本拆解` and `无限画布`.
- Modify `src/components/BottomTabBar.tsx`
  - Adds `assetWorkbench` to `ActiveView`.
- Modify `tests/bottomTabOrder.test.ts`
  - Verifies new tab order.
- Create `src/components/AssetWorkbenchView.tsx`
  - Implements the Stitch-inspired three-column UI, card editing, style selection, generation, save to asset library, and add-to-canvas action.
- Modify `src/App.tsx`
  - Imports the view, stores initial cards, passes save/add-asset/add-canvas-node handlers, and renders the new view.

---

### Task 1: Asset Workbench Data Model And Helpers

**Files:**
- Create: `src/lib/assetWorkbench.ts`
- Test: `tests/assetWorkbench.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/assetWorkbench.test.ts`:

```ts
import assert from 'node:assert/strict';
import {
  ASSET_WORKBENCH_STYLES,
  buildAssetWorkbenchPrompt,
  createAssetWorkbenchCard,
  createAssetFromWorkbenchCard,
  markWorkbenchCardSaved,
  type AssetWorkbenchCard,
} from '../src/lib/assetWorkbench';

const character = createAssetWorkbenchCard('character', 1000);
assert.equal(character.kind, 'character');
assert.equal(character.name, '新角色');
assert.equal(character.roleTag, '主角');
assert.equal(character.ratio, '1:1');
assert.equal(character.quality, '2K');
assert.equal(character.status, 'draft');
assert.equal(character.createdAt, 1000);
assert.equal(character.updatedAt, 1000);
assert.ok(ASSET_WORKBENCH_STYLES.some(style => style.id === character.styleId));

const scene = createAssetWorkbenchCard('scene', 1100);
assert.equal(scene.kind, 'scene');
assert.equal(scene.name, '新场景');
assert.equal(scene.roleTag, undefined);
assert.equal(scene.ratio, '16:9');

const editedCharacter: AssetWorkbenchCard = {
  ...character,
  name: '莱恩·格林',
  description: '深圳长大的少年，穿旧夹克，神情敏感但倔强。',
  styleId: 'vintage-comic',
};

const prompt = buildAssetWorkbenchPrompt(editedCharacter);
assert.match(prompt, /character concept art/i);
assert.match(prompt, /莱恩·格林/);
assert.match(prompt, /深圳长大的少年/);
assert.match(prompt, /vintage comic/i);

const generatedCharacter: AssetWorkbenchCard = {
  ...editedCharacter,
  generatedImage: '/uploads/ryan.png',
};
const asset = createAssetFromWorkbenchCard(generatedCharacter, 'asset_1', 1200);
assert.deepEqual(asset, {
  id: 'asset_1',
  type: 'image',
  src: '/uploads/ryan.png',
  name: '莱恩·格林',
  createdAt: 1200,
  category: 'character',
});

const saved = markWorkbenchCardSaved(generatedCharacter, 'asset_1', 1300);
assert.equal(saved.assetId, 'asset_1');
assert.equal(saved.status, 'saved');
assert.equal(saved.updatedAt, 1300);

const generatedScene: AssetWorkbenchCard = {
  ...scene,
  name: '雨夜巷口',
  description: '潮湿街道，霓虹反光，深夜无人。',
  generatedImage: '/uploads/alley.png',
};
const sceneAsset = createAssetFromWorkbenchCard(generatedScene, 'asset_2', 1400);
assert.equal(sceneAsset.category, 'scene');
assert.equal(sceneAsset.name, '雨夜巷口');

assert.throws(
  () => createAssetFromWorkbenchCard({ ...scene, generatedImage: undefined }, 'asset_3', 1500),
  /generated image is required/
);

console.log('asset workbench behavior ok');
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
./node_modules/.bin/tsx tests/assetWorkbench.test.ts
```

Expected: FAIL with module not found for `src/lib/assetWorkbench`.

- [ ] **Step 3: Create the helper module**

Create `src/lib/assetWorkbench.ts`:

```ts
import type { AssetItem } from './storage';

export type AssetWorkbenchKind = 'character' | 'scene';
export type AssetWorkbenchStatus = 'draft' | 'generating' | 'generated' | 'saved' | 'error';
export type AssetWorkbenchRatio = '1:1' | '16:9' | '9:16' | '4:3';
export type AssetWorkbenchQuality = '1K' | '2K' | '4K';

export interface AssetWorkbenchStyle {
  id: string;
  name: string;
  promptPreset: string;
  thumbnail: string;
}

export interface AssetWorkbenchCard {
  id: string;
  kind: AssetWorkbenchKind;
  name: string;
  roleTag?: string;
  description: string;
  referenceImage?: string;
  styleId: string;
  ratio: AssetWorkbenchRatio;
  quality: AssetWorkbenchQuality;
  generatedImage?: string;
  assetId?: string;
  status: AssetWorkbenchStatus;
  errorMessage?: string;
  createdAt: number;
  updatedAt: number;
}

export const ASSET_WORKBENCH_STYLES: AssetWorkbenchStyle[] = [
  {
    id: 'vintage-comic',
    name: '复古漫画',
    promptPreset: 'vintage comic book style, grainy textures, dynamic action lines, muted reds and sepia tones',
    thumbnail: 'https://images.unsplash.com/photo-1612036782180-6f0b6cd846fe?auto=format&fit=crop&w=240&q=80',
  },
  {
    id: 'american-3d',
    name: '美式 3D',
    promptPreset: 'sleek American 3D animation style, smooth surfaces, expressive features, soft global lighting',
    thumbnail: 'https://images.unsplash.com/photo-1635189779577-c0364171fdc7?auto=format&fit=crop&w=240&q=80',
  },
  {
    id: 'cel-shaded',
    name: '三渲二',
    promptPreset: 'modern cel shaded anime style, crisp outlines, vibrant flattened colors, cinematic composition',
    thumbnail: 'https://images.unsplash.com/photo-1618331835717-801e976710b2?auto=format&fit=crop&w=240&q=80',
  },
  {
    id: 'romance-comic',
    name: '女频漫画',
    promptPreset: 'romance comic illustration, delicate linework, soft lighting, elegant color palette',
    thumbnail: 'https://images.unsplash.com/photo-1518893063132-36e46dbe2428?auto=format&fit=crop&w=240&q=80',
  },
  {
    id: 'storybook',
    name: '吉卜力',
    promptPreset: 'lush hand painted storybook animation background, warm atmosphere, watercolor textures',
    thumbnail: 'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=240&q=80',
  },
  {
    id: 'chinese-3d',
    name: '3D 国创',
    promptPreset: 'Chinese 3D animated feature style, detailed costume, cinematic lighting, heroic composition',
    thumbnail: 'https://images.unsplash.com/photo-1528181304800-259b08848526?auto=format&fit=crop&w=240&q=80',
  },
  {
    id: 'jojo',
    name: 'JoJo',
    promptPreset: 'high contrast stylized manga fashion pose, bold colors, dramatic shadows, graphic composition',
    thumbnail: 'https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?auto=format&fit=crop&w=240&q=80',
  },
  {
    id: 'cyberpunk',
    name: '赛博朋克',
    promptPreset: 'vibrant cyberpunk scene, neon reflections, wet pavement, deep shadows, high contrast lighting',
    thumbnail: 'https://images.unsplash.com/photo-1519608487953-e999c86e7455?auto=format&fit=crop&w=240&q=80',
  },
  {
    id: 'ink-wash',
    name: '水墨国风',
    promptPreset: 'modern Chinese ink wash painting style, charcoal and silver brushstrokes, poetic atmosphere',
    thumbnail: 'https://images.unsplash.com/photo-1519681393784-d120267933ba?auto=format&fit=crop&w=240&q=80',
  },
  {
    id: 'painterly-cinema',
    name: '厚涂电影感',
    promptPreset: 'rich painterly cinematic still, layered colors, tactile texture, dramatic film lighting',
    thumbnail: 'https://images.unsplash.com/photo-1518709268805-4e9042af2176?auto=format&fit=crop&w=240&q=80',
  },
];

export function getAssetWorkbenchStyle(styleId: string): AssetWorkbenchStyle {
  return ASSET_WORKBENCH_STYLES.find(style => style.id === styleId) ?? ASSET_WORKBENCH_STYLES[0];
}

export function createAssetWorkbenchCard(
  kind: AssetWorkbenchKind,
  now = Date.now()
): AssetWorkbenchCard {
  return {
    id: `workbench_${now}_${Math.random().toString(36).slice(2, 8)}`,
    kind,
    name: kind === 'character' ? '新角色' : '新场景',
    ...(kind === 'character' ? { roleTag: '主角' } : {}),
    description: '',
    styleId: ASSET_WORKBENCH_STYLES[0].id,
    ratio: kind === 'character' ? '1:1' : '16:9',
    quality: '2K',
    status: 'draft',
    createdAt: now,
    updatedAt: now,
  };
}

export function buildAssetWorkbenchPrompt(card: AssetWorkbenchCard): string {
  const style = getAssetWorkbenchStyle(card.styleId);
  const subject =
    card.kind === 'character'
      ? `character concept art for ${card.name}${card.roleTag ? `, role tag: ${card.roleTag}` : ''}`
      : `environment concept art for ${card.name}`;

  return [
    subject,
    card.description.trim(),
    style.promptPreset,
    'premium dark cinematic production design, high detail, polished visual development sheet',
  ].filter(Boolean).join(', ');
}

export function createAssetFromWorkbenchCard(
  card: AssetWorkbenchCard,
  assetId: string,
  createdAt = Date.now()
): AssetItem {
  if (!card.generatedImage) {
    throw new Error('generated image is required before saving to asset library');
  }

  return {
    id: assetId,
    type: 'image',
    src: card.generatedImage,
    name: card.name.trim() || (card.kind === 'character' ? '未命名角色' : '未命名场景'),
    createdAt,
    category: card.kind === 'character' ? 'character' : 'scene',
  };
}

export function markWorkbenchCardSaved(
  card: AssetWorkbenchCard,
  assetId: string,
  updatedAt = Date.now()
): AssetWorkbenchCard {
  return {
    ...card,
    assetId,
    status: 'saved',
    errorMessage: undefined,
    updatedAt,
  };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run:

```bash
./node_modules/.bin/tsx tests/assetWorkbench.test.ts
```

Expected: PASS with `asset workbench behavior ok`.

- [ ] **Step 5: Commit**

```bash
git add src/lib/assetWorkbench.ts tests/assetWorkbench.test.ts
git commit -m "feat: add asset workbench model"
```

---

### Task 2: Project Persistence

**Files:**
- Modify: `src/lib/storage.ts`
- Modify: `tests/projectPatch.test.ts`
- Test: `tests/projectStorageDefaults.test.ts`

- [ ] **Step 1: Write the failing storage defaults test**

Create `tests/projectStorageDefaults.test.ts`:

```ts
import assert from 'node:assert/strict';
import { createProject, loadProjects } from '../src/lib/storage';

const storage = new Map<string, string>();
Object.defineProperty(globalThis, 'localStorage', {
  value: {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => storage.set(key, value),
    removeItem: (key: string) => storage.delete(key),
  },
  configurable: true,
});

storage.set('hjm_aigc_projects', JSON.stringify([
  {
    id: 'legacy',
    name: '旧项目',
    createdAt: 1,
    updatedAt: 1,
    storyboardRows: [],
    nodes: [],
    edges: [],
    assets: [],
    generationHistory: [],
    storyboardOrder: [],
    videoOrder: [],
  },
]));

const loaded = loadProjects();
assert.equal(loaded.length, 1);
assert.deepEqual(loaded[0].assetWorkbenchCards, []);
assert.deepEqual(loaded[0].topicHistory, []);
assert.deepEqual(loaded[0].members, []);
assert.deepEqual(loaded[0].tags, []);

const fresh = createProject('新项目');
assert.deepEqual(fresh.assetWorkbenchCards, []);

console.log('project storage defaults behavior ok');
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
./node_modules/.bin/tsx tests/projectStorageDefaults.test.ts
```

Expected: FAIL because `assetWorkbenchCards` is undefined.

- [ ] **Step 3: Update storage types and defaults**

Modify `src/lib/storage.ts`:

```ts
import type { AssetWorkbenchCard } from './assetWorkbench';
```

Add to `Project`:

```ts
assetWorkbenchCards: AssetWorkbenchCard[];
```

Update `loadProjects()` default mapping:

```ts
return raw.map(p => ({ members: [], tags: [], topicHistory: [], assetWorkbenchCards: [], ...p }));
```

Update `createProject()` return object:

```ts
assetWorkbenchCards: [],
```

Update the localStorage fallback `lite` object to preserve cards:

```ts
assetWorkbenchCards: project.assetWorkbenchCards.map(card => ({
  ...card,
  referenceImage: undefined,
  generatedImage: card.generatedImage?.startsWith('data:image') ? undefined : card.generatedImage,
})),
```

- [ ] **Step 4: Extend project patch regression test**

Modify `tests/projectPatch.test.ts` project setup:

```ts
assetWorkbenchCards: [
  {
    id: 'workbench-1',
    kind: 'character',
    name: '莱恩',
    roleTag: '主角',
    description: '少年主角',
    styleId: 'vintage-comic',
    ratio: '1:1',
    quality: '2K',
    status: 'saved',
    generatedImage: '/uploads/ryan.png',
    assetId: 'asset-ryan',
    createdAt: 100,
    updatedAt: 120,
  },
],
```

Add assertion:

```ts
assert.deepEqual(updated.assetWorkbenchCards, project.assetWorkbenchCards);
```

- [ ] **Step 5: Run tests**

Run:

```bash
./node_modules/.bin/tsx tests/projectStorageDefaults.test.ts
./node_modules/.bin/tsx tests/projectPatch.test.ts
```

Expected: both PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/storage.ts tests/projectStorageDefaults.test.ts tests/projectPatch.test.ts
git commit -m "feat: persist asset workbench cards"
```

---

### Task 3: Bottom Navigation Entry

**Files:**
- Modify: `src/lib/bottomTabs.ts`
- Modify: `src/components/BottomTabBar.tsx`
- Modify: `tests/bottomTabOrder.test.ts`

- [ ] **Step 1: Update failing bottom tab test**

Modify `tests/bottomTabOrder.test.ts` expected labels:

```ts
assert.deepEqual(labels, [
  '选题',
  '剧本拆解',
  '角色场景',
  '无限画布',
  '分镜管理',
  '视频管理',
  '资产管理',
  '模板库',
]);

assert.equal(labels.indexOf('角色场景'), labels.indexOf('剧本拆解') + 1);
assert.equal(labels.indexOf('角色场景'), labels.indexOf('无限画布') - 1);
assert.equal(labels.indexOf('资产管理'), labels.indexOf('视频管理') + 1);
assert.equal(labels.indexOf('资产管理'), labels.indexOf('模板库') - 1);
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
./node_modules/.bin/tsx tests/bottomTabOrder.test.ts
```

Expected: FAIL because `角色场景` is not present.

- [ ] **Step 3: Add ActiveView key**

Modify `src/components/BottomTabBar.tsx`:

```ts
export type ActiveView =
  | 'topic'
  | 'breakdown'
  | 'assetWorkbench'
  | 'canvas'
  | 'assets'
  | 'storyboard'
  | 'video'
  | 'templates';
```

- [ ] **Step 4: Insert bottom tab**

Modify `src/lib/bottomTabs.ts`:

```ts
export const BOTTOM_TABS: BottomTabItem[] = [
  { key: 'topic',      icon: 'lightbulb',     label: '选题' },
  { key: 'breakdown',  icon: 'description',   label: '剧本拆解' },
  { key: 'assetWorkbench', icon: 'recent_actors', label: '角色场景' },
  { key: 'canvas',     icon: 'architecture',  label: '无限画布' },
  { key: 'storyboard', icon: 'movie_edit',    label: '分镜管理' },
  { key: 'video',      icon: 'video_library', label: '视频管理' },
  { key: 'assets',     icon: 'inventory_2',   label: '资产管理' },
  { key: 'templates',  icon: 'bookmark_manager', label: '模板库' },
];
```

- [ ] **Step 5: Run the test**

Run:

```bash
./node_modules/.bin/tsx tests/bottomTabOrder.test.ts
```

Expected: PASS with `bottom tab order behavior ok`.

- [ ] **Step 6: Commit**

```bash
git add src/lib/bottomTabs.ts src/components/BottomTabBar.tsx tests/bottomTabOrder.test.ts
git commit -m "feat: add character scene tab"
```

---

### Task 4: Build The Asset Workbench View

**Files:**
- Create: `src/components/AssetWorkbenchView.tsx`
- Test indirectly through build and manual browser verification.

- [ ] **Step 1: Create component with typed props**

Create `src/components/AssetWorkbenchView.tsx` with this interface:

```tsx
import React, { useMemo, useState } from 'react';
import {
  ASSET_WORKBENCH_STYLES,
  buildAssetWorkbenchPrompt,
  createAssetFromWorkbenchCard,
  createAssetWorkbenchCard,
  getAssetWorkbenchStyle,
  markWorkbenchCardSaved,
  type AssetWorkbenchCard,
  type AssetWorkbenchKind,
  type AssetWorkbenchRatio,
} from '../lib/assetWorkbench';
import type { AssetItem } from '../lib/storage';

interface Props {
  cards: AssetWorkbenchCard[];
  onSaveCards: (cards: AssetWorkbenchCard[]) => void;
  onAddAsset: (asset: AssetItem) => void;
  onAddImageNode: (asset: AssetItem) => void;
}
```

- [ ] **Step 2: Add local state and card helpers**

Inside the component:

```tsx
export default function AssetWorkbenchView({ cards, onSaveCards, onAddAsset, onAddImageNode }: Props) {
  const [activeKind, setActiveKind] = useState<AssetWorkbenchKind>('character');
  const [selectedId, setSelectedId] = useState(cards[0]?.id ?? null);
  const [generating, setGenerating] = useState(false);
  const [referenceUploading, setReferenceUploading] = useState(false);

  const filteredCards = useMemo(
    () => cards.filter(card => card.kind === activeKind),
    [cards, activeKind]
  );

  const selectedCard =
    cards.find(card => card.id === selectedId) ??
    filteredCards[0] ??
    null;

  const saveCard = (card: AssetWorkbenchCard) => {
    const next = cards.some(item => item.id === card.id)
      ? cards.map(item => item.id === card.id ? card : item)
      : [card, ...cards];
    onSaveCards(next);
    setSelectedId(card.id);
  };

  const addCard = (kind: AssetWorkbenchKind) => {
    const card = createAssetWorkbenchCard(kind);
    onSaveCards([card, ...cards]);
    setActiveKind(kind);
    setSelectedId(card.id);
  };
```

- [ ] **Step 3: Add edit/update actions**

Add these helpers:

```tsx
  const updateSelected = (patch: Partial<AssetWorkbenchCard>) => {
    if (!selectedCard) return;
    saveCard({
      ...selectedCard,
      ...patch,
      status: patch.generatedImage ? 'generated' : selectedCard.status,
      updatedAt: Date.now(),
    });
  };

  const deleteSelected = () => {
    if (!selectedCard) return;
    const next = cards.filter(card => card.id !== selectedCard.id);
    onSaveCards(next);
    const replacement = next.find(card => card.kind === activeKind) ?? next[0] ?? null;
    setSelectedId(replacement?.id ?? null);
  };

  const duplicateSelected = () => {
    if (!selectedCard) return;
    const now = Date.now();
    const copy: AssetWorkbenchCard = {
      ...selectedCard,
      id: `workbench_${now}_${Math.random().toString(36).slice(2, 8)}`,
      name: `${selectedCard.name} 副本`,
      assetId: undefined,
      status: selectedCard.generatedImage ? 'generated' : 'draft',
      createdAt: now,
      updatedAt: now,
    };
    onSaveCards([copy, ...cards]);
    setSelectedId(copy.id);
  };
```

- [ ] **Step 4: Add reference upload**

Use local file data URL for first version:

```tsx
  const handleReferenceUpload = (file: File | undefined) => {
    if (!file || !selectedCard) return;
    if (!file.type.startsWith('image/')) {
      updateSelected({ errorMessage: '请上传图片格式的参考图', status: 'error' });
      return;
    }
    setReferenceUploading(true);
    const reader = new FileReader();
    reader.onload = event => {
      updateSelected({
        referenceImage: event.target?.result as string,
        errorMessage: undefined,
      });
      setReferenceUploading(false);
    };
    reader.onerror = () => {
      updateSelected({ errorMessage: '参考图读取失败', status: 'error' });
      setReferenceUploading(false);
    };
    reader.readAsDataURL(file);
  };
```

- [ ] **Step 5: Add generation**

Use existing `/api/generate`:

```tsx
  const handleGenerate = async () => {
    if (!selectedCard || generating) return;
    const prompt = buildAssetWorkbenchPrompt(selectedCard);
    const started = { ...selectedCard, status: 'generating' as const, errorMessage: undefined, updatedAt: Date.now() };
    saveCard(started);
    setGenerating(true);
    try {
      const body: Record<string, unknown> = {
        prompt,
        ratio: selectedCard.ratio,
        quality: selectedCard.quality,
        count: 1,
      };
      if (selectedCard.referenceImage) body.referenceImages = [selectedCard.referenceImage];
      const resp = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ error: `HTTP ${resp.status}` })) as { error?: string };
        throw new Error(err.error || `生成失败 ${resp.status}`);
      }
      const data = await resp.json() as { urls?: string[]; url?: string };
      const image = data.urls?.[0] ?? data.url;
      if (!image) throw new Error('生成接口没有返回图片');
      saveCard({
        ...started,
        generatedImage: image,
        assetId: undefined,
        status: 'generated',
        updatedAt: Date.now(),
      });
    } catch (err) {
      saveCard({
        ...started,
        status: 'error',
        errorMessage: err instanceof Error ? err.message : '生成失败',
        updatedAt: Date.now(),
      });
    } finally {
      setGenerating(false);
    }
  };
```

- [ ] **Step 6: Add save to asset library and add to canvas**

```tsx
  const handleSaveAsset = () => {
    if (!selectedCard?.generatedImage) return;
    const now = Date.now();
    const assetId = selectedCard.assetId ?? `asset_${now}_${Math.random().toString(36).slice(2)}`;
    const asset = createAssetFromWorkbenchCard(selectedCard, assetId, now);
    onAddAsset(asset);
    saveCard(markWorkbenchCardSaved(selectedCard, assetId, now));
  };

  const handleAddToCanvas = () => {
    if (!selectedCard?.generatedImage) return;
    const now = Date.now();
    const asset = createAssetFromWorkbenchCard(
      selectedCard,
      selectedCard.assetId ?? `asset_${now}_${Math.random().toString(36).slice(2)}`,
      now
    );
    onAddImageNode(asset);
  };
```

- [ ] **Step 7: Implement the Stitch-inspired JSX**

Use this structure:

```tsx
  const style = selectedCard ? getAssetWorkbenchStyle(selectedCard.styleId) : ASSET_WORKBENCH_STYLES[0];
  const promptPreview = selectedCard ? buildAssetWorkbenchPrompt(selectedCard) : '';
  const ratioOptions: AssetWorkbenchRatio[] = ['1:1', '16:9', '9:16', '4:3'];

  return (
    <div className="absolute inset-0 bg-[#0e0e0e] text-[#e7e5e4] flex overflow-hidden" style={{ fontFamily: 'Manrope' }}>
      <aside className="w-[20%] min-w-[260px] bg-[#131313]/85 border-r border-white/[0.06] p-5 flex flex-col gap-6 overflow-y-auto">
        <div className="flex flex-col gap-4">
          <h2 className="text-2xl font-extrabold tracking-tight">素材生成器</h2>
          <div className="flex bg-[#191a1a] rounded-full p-1">
            {(['character', 'scene'] as const).map(kind => (
              <button
                key={kind}
                onClick={() => {
                  setActiveKind(kind);
                  setSelectedId(cards.find(card => card.kind === kind)?.id ?? null);
                }}
                className={`flex-1 py-1.5 text-sm rounded-full transition-colors ${
                  activeKind === kind ? 'bg-[#c6c6c7] text-[#3f4041] font-bold' : 'text-[#acabaa] hover:text-white'
                }`}
              >
                {kind === 'character' ? '角色卡' : '场景卡'}
              </button>
            ))}
          </div>
        </div>

        <button
          onClick={() => addCard(activeKind)}
          className="w-full py-3 rounded-[18px] border border-dashed border-white/15 hover:border-[#c6c6c7]/50 hover:bg-[#1f2020] transition-all flex items-center justify-center gap-2 text-sm font-semibold"
        >
          <span className="material-symbols-outlined text-[18px]">add</span>
          {activeKind === 'character' ? '添加角色' : '添加场景'}
        </button>

        <div className="flex flex-col gap-3">
          <p className="text-[10px] uppercase tracking-widest text-[#acabaa] font-bold px-1">最近生成</p>
          {filteredCards.length === 0 ? (
            <div className="rounded-[18px] border border-white/[0.06] bg-[#191a1a] p-5 text-sm text-white/35">
              添加{activeKind === 'character' ? '角色' : '场景'}卡后会显示在这里
            </div>
          ) : filteredCards.map(card => (
            <button
              key={card.id}
              onClick={() => setSelectedId(card.id)}
              className={`p-3 rounded-[18px] flex gap-3 text-left transition-colors border ${
                selectedCard?.id === card.id ? 'bg-[#2c2c2c] border-white/20' : 'bg-[#1f2020] border-transparent hover:bg-[#252626]'
              }`}
            >
              <div className="w-12 h-12 rounded-[12px] bg-black overflow-hidden shrink-0 flex items-center justify-center">
                {card.generatedImage ? (
                  <img src={card.generatedImage} alt={card.name} className="w-full h-full object-cover" />
                ) : (
                  <span className="material-symbols-outlined text-[#767575]">image</span>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold truncate">{card.name}</span>
                  {card.roleTag && <span className="text-[9px] px-1.5 py-0.5 bg-[#454747] text-[#d0d0d0] rounded">{card.roleTag}</span>}
                </div>
                <span className="text-[10px] text-[#c6c6c7]">{card.status === 'saved' ? '已入库' : card.status === 'generating' ? '生成中' : card.status === 'error' ? '失败' : card.status === 'generated' ? '已生成' : '草稿'}</span>
              </div>
            </button>
          ))}
        </div>
      </aside>

      <section className="flex-1 p-8 flex flex-col gap-8 overflow-y-auto">
        {!selectedCard ? (
          <div className="h-full flex items-center justify-center text-white/35">添加一张角色卡或场景卡开始生成素材</div>
        ) : (
          <>
            <div className="grid grid-cols-[1fr_320px] gap-6">
              <div className="flex flex-col gap-4">
                <label className="text-[10px] font-bold text-[#acabaa] uppercase tracking-widest ml-1">角色/素材名称</label>
                <input
                  value={selectedCard.name}
                  onChange={event => updateSelected({ name: event.target.value, status: selectedCard.generatedImage ? selectedCard.status : 'draft' })}
                  className="bg-[#191a1a] text-[#e7e5e4] border-none rounded-[18px] p-3 focus:ring-1 focus:ring-[#c6c6c7]/50 text-sm outline-none"
                  placeholder="输入名称..."
                />
                {selectedCard.kind === 'character' && (
                  <input
                    value={selectedCard.roleTag ?? ''}
                    onChange={event => updateSelected({ roleTag: event.target.value })}
                    className="bg-[#191a1a] text-[#e7e5e4] border-none rounded-[18px] p-3 focus:ring-1 focus:ring-[#c6c6c7]/50 text-sm outline-none"
                    placeholder="主角 / 配角 / 反派..."
                  />
                )}
                <label className="text-[10px] font-bold text-[#acabaa] uppercase tracking-widest ml-1">描述</label>
                <textarea
                  value={selectedCard.description}
                  onChange={event => updateSelected({ description: event.target.value, status: selectedCard.generatedImage ? selectedCard.status : 'draft' })}
                  className="bg-[#191a1a] text-[#e7e5e4] border-none rounded-[18px] p-3 focus:ring-1 focus:ring-[#c6c6c7]/50 text-sm h-24 resize-none outline-none"
                  placeholder="描述你的创意愿景..."
                />
              </div>
              <label className="bg-[#191a1a] border-2 border-dashed border-white/10 rounded-[18px] flex flex-col items-center justify-center cursor-pointer hover:bg-[#1f2020] transition-all overflow-hidden">
                {selectedCard.referenceImage ? (
                  <img src={selectedCard.referenceImage} alt="参考图" className="w-full h-full object-cover" />
                ) : (
                  <>
                    <span className="material-symbols-outlined text-[#c6c6c7] mb-2">upload_file</span>
                    <span className="text-xs text-[#acabaa]">{referenceUploading ? '读取中...' : '点击上传参考图'}</span>
                  </>
                )}
                <input type="file" accept="image/*" className="hidden" onChange={event => handleReferenceUpload(event.target.files?.[0])} />
              </label>
            </div>

            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <label className="text-[10px] font-bold text-[#acabaa] uppercase tracking-widest ml-1">视觉风格选择</label>
              </div>
              <div className="flex gap-4 overflow-x-auto pb-2">
                {ASSET_WORKBENCH_STYLES.map(item => (
                  <button key={item.id} onClick={() => updateSelected({ styleId: item.id })} className="shrink-0 w-24 flex flex-col gap-2">
                    <div className={`aspect-square rounded-[14px] overflow-hidden border-2 transition-all ${selectedCard.styleId === item.id ? 'border-[#c6c6c7] shadow-[0_0_15px_rgba(198,198,199,0.2)]' : 'border-transparent hover:border-white/20'}`}>
                      <img src={item.thumbnail} alt={item.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    </div>
                    <span className={`text-[10px] font-bold text-center ${selectedCard.styleId === item.id ? 'text-white' : 'text-[#acabaa]'}`}>{item.name}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="flex-1 min-h-[360px] flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <div className="flex gap-2">
                  <button onClick={handleGenerate} disabled={generating} className="bg-[#c6c6c7] text-[#3f4041] px-6 py-2 rounded-full font-bold text-sm flex items-center gap-2 disabled:opacity-50">
                    <span className="material-symbols-outlined text-[18px]">auto_awesome</span>
                    {generating ? '生成中...' : 'AI 生成'}
                  </button>
                  <button onClick={handleGenerate} disabled={generating || !selectedCard.generatedImage} className="bg-[#191a1a] text-[#e7e5e4] px-6 py-2 rounded-full font-bold text-sm hover:bg-[#1f2020] disabled:opacity-40">
                    重新生成
                  </button>
                </div>
                <button onClick={handleSaveAsset} disabled={!selectedCard.generatedImage || selectedCard.status === 'saved'} className="text-[#acabaa] flex items-center gap-2 text-sm font-semibold hover:text-white disabled:opacity-40">
                  <span className="material-symbols-outlined text-[18px]">save</span>
                  保存到资产库
                </button>
              </div>
              {selectedCard.errorMessage && <div className="text-sm text-[#ee7d77]">{selectedCard.errorMessage}</div>}
              <div className="relative flex-1 bg-[#191a1a] rounded-[24px] overflow-hidden border border-white/[0.06] min-h-[360px]">
                {selectedCard.generatedImage ? (
                  <img src={selectedCard.generatedImage} alt={selectedCard.name} className="w-full h-full object-cover opacity-90" />
                ) : (
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-white/30">
                    <span className="material-symbols-outlined text-6xl mb-3">image</span>
                    <span className="text-sm">生成结果会显示在这里</span>
                  </div>
                )}
                {selectedCard.generatedImage && (
                  <button onClick={handleAddToCanvas} className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-[#191a1a]/70 backdrop-blur-2xl text-[#e7e5e4] px-6 py-2.5 rounded-full font-bold text-sm flex items-center gap-2 hover:bg-white/10 border border-white/10">
                    <span className="material-symbols-outlined text-[18px]">brush</span>
                    用于画布
                    <span className="material-symbols-outlined text-[18px] opacity-50">drag_pan</span>
                  </button>
                )}
                {selectedCard.status === 'saved' && (
                  <div className="absolute top-4 right-4 bg-black/60 backdrop-blur-md px-3 py-1 rounded-full border border-white/5 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-[#c6c6c7]" />
                    <span className="text-[10px] font-bold">已入库</span>
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </section>

      <aside className="w-[25%] min-w-[320px] bg-[#131313]/85 border-l border-white/[0.06] p-6 flex flex-col gap-8 overflow-y-auto">
        <div>
          <h3 className="text-lg font-extrabold tracking-tight">参数调节</h3>
          <div className="h-1 w-8 bg-[#c6c6c7] rounded-full mt-2" />
        </div>
        {selectedCard && (
          <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-2">
              <label className="text-[10px] font-bold text-[#acabaa] uppercase tracking-widest">生成类型</label>
              <div className="bg-[#191a1a] p-3 rounded-[14px] text-sm font-semibold">{selectedCard.kind === 'character' ? '角色卡 (Character)' : '场景卡 (Scene)'}</div>
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-[10px] font-bold text-[#acabaa] uppercase tracking-widest">所选风格</label>
              <div className="flex items-center gap-3 bg-[#191a1a] p-2 rounded-[14px]">
                <img src={style.thumbnail} alt={style.name} className="w-8 h-8 rounded-[10px] object-cover" referrerPolicy="no-referrer" />
                <span className="text-sm font-semibold">{style.name}</span>
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-[10px] font-bold text-[#acabaa] uppercase tracking-widest">输出尺寸</label>
              <div className="grid grid-cols-4 gap-2">
                {ratioOptions.map(ratio => (
                  <button key={ratio} onClick={() => updateSelected({ ratio })} className={`p-2 rounded-[12px] text-[10px] font-bold ${selectedCard.ratio === ratio ? 'bg-[#1f2020] border border-[#c6c6c7] text-[#c6c6c7]' : 'bg-[#191a1a] text-[#acabaa]'}`}>{ratio}</button>
                ))}
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-[10px] font-bold text-[#acabaa] uppercase tracking-widest">Prompt 预览</label>
              <div className="bg-black p-4 rounded-[18px] text-[11px] text-[#acabaa] leading-relaxed italic border border-white/[0.06]">{promptPreview}</div>
            </div>
          </div>
        )}
      </aside>
    </div>
  );
}
```

- [ ] **Step 8: Run TypeScript build**

Run:

```bash
/Users/yrxs01/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node ./node_modules/vite/bin/vite.js build
```

Expected: PASS. Large chunk warning is acceptable.

- [ ] **Step 9: Commit**

```bash
git add src/components/AssetWorkbenchView.tsx
git commit -m "feat: build asset workbench view"
```

---

### Task 5: App Integration

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1: Import the new view and types**

Modify imports in `src/App.tsx`:

```ts
import AssetWorkbenchView from './components/AssetWorkbenchView';
import type { AssetWorkbenchCard } from './lib/assetWorkbench';
```

- [ ] **Step 2: Add initial workbench state in App**

Near other canvas initial state:

```ts
const [canvasInitialAssetWorkbenchCards, setCanvasInitialAssetWorkbenchCards] = useState<AssetWorkbenchCard[]>([]);
```

Reset in `handleNewProject` and `handleGoToTopic`:

```ts
setCanvasInitialAssetWorkbenchCards([]);
```

Set in `handleOpenProject`:

```ts
setCanvasInitialAssetWorkbenchCards(project.assetWorkbenchCards || []);
```

- [ ] **Step 3: Add Flow props**

Add to the `Flow` props type:

```ts
initialAssetWorkbenchCards: AssetWorkbenchCard[];
onSaveAssetWorkbenchCards: (cards: AssetWorkbenchCard[]) => void;
```

Destructure in `Flow(...)`:

```ts
initialAssetWorkbenchCards,
onSaveAssetWorkbenchCards,
```

Add local state:

```ts
const [assetWorkbenchCards, setAssetWorkbenchCards] = useState<AssetWorkbenchCard[]>(initialAssetWorkbenchCards);
```

- [ ] **Step 4: Add save handler in App**

Near other save handlers:

```ts
const handleAssetWorkbenchCardsSave = (assetWorkbenchCards: AssetWorkbenchCard[]) => {
  saveCurrentProjectPatch({ assetWorkbenchCards });
};
```

Pass to `Flow`:

```tsx
initialAssetWorkbenchCards={canvasInitialAssetWorkbenchCards}
onSaveAssetWorkbenchCards={handleAssetWorkbenchCardsSave}
```

- [ ] **Step 5: Add Flow-level card save wrapper**

Inside `Flow`:

```ts
const handleSaveAssetWorkbenchCards = useCallback((cards: AssetWorkbenchCard[]) => {
  setAssetWorkbenchCards(cards);
  onSaveAssetWorkbenchCards(cards);
}, [onSaveAssetWorkbenchCards]);
```

- [ ] **Step 6: Add canvas node creation from workbench asset**

Inside `Flow`, reuse the existing node shape:

```ts
const handleAddWorkbenchAssetToCanvas = useCallback((asset: AssetItem) => {
  const center = screenToFlowPosition({
    x: window.innerWidth / 2,
    y: window.innerHeight / 2,
  });
  const newNode: Node = {
    id: `asset-node-${Date.now()}`,
    type: 'imageNode',
    position: { x: center.x - 190, y: center.y - 107 },
    width: 380,
    height: 214,
    data: {
      label: asset.name || '素材',
      contentType: 'image',
      content: [asset.src],
      onPlusClick: handlePlusClick,
      onUpdate: handleUpdateNode,
    },
  };
  setNodes(nds => [...nds, newNode]);
  setActiveView('canvas');
}, [screenToFlowPosition, setNodes, setActiveView, handlePlusClick, handleUpdateNode]);
```

- [ ] **Step 7: Render the new view between breakdown and canvas layers**

Add the new view container near other view containers:

```tsx
<div
  className="absolute inset-0"
  style={{
    opacity: activeView === 'assetWorkbench' ? 1 : 0,
    transform: activeView === 'assetWorkbench' ? 'translateY(0)' : 'translateY(8px)',
    transition: 'opacity 300ms ease-out, transform 300ms ease-out',
    pointerEvents: activeView === 'assetWorkbench' ? 'auto' : 'none',
  }}
>
  <AssetWorkbenchView
    cards={assetWorkbenchCards}
    onSaveCards={handleSaveAssetWorkbenchCards}
    onAddAsset={handleAddAsset}
    onAddImageNode={handleAddWorkbenchAssetToCanvas}
  />
</div>
```

- [ ] **Step 8: Preserve CRLF line endings in `src/App.tsx`**

Run:

```bash
perl -0pi -e 's/\r?\n/\r\n/g' src/App.tsx
```

- [ ] **Step 9: Run focused tests and build**

Run:

```bash
./node_modules/.bin/tsx tests/projectStorageDefaults.test.ts
./node_modules/.bin/tsx tests/projectPatch.test.ts
./node_modules/.bin/tsx tests/bottomTabOrder.test.ts
/Users/yrxs01/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node ./node_modules/vite/bin/vite.js build
```

Expected: all tests PASS and Vite build PASS.

- [ ] **Step 10: Commit**

```bash
git add src/App.tsx
git commit -m "feat: wire asset workbench into app"
```

---

### Task 6: Browser Verification And Polish

**Files:**
- Modify: `src/components/AssetWorkbenchView.tsx` if verification finds layout issues.

- [ ] **Step 1: Start or reuse the dev server**

If no dev server is running:

```bash
/Users/yrxs01/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node ./node_modules/vite/bin/vite.js --host 0.0.0.0 --port 3000
```

Expected: Vite serves on `http://localhost:3000/`.

- [ ] **Step 2: Open the app in the in-app browser**

Use the browser plugin to open:

```text
http://localhost:3000/
```

Expected: app loads without Vite overlay.

- [ ] **Step 3: Navigate to an existing project and open 角色场景**

Manual expected behavior:

- Bottom nav shows `角色场景` between `剧本拆解` and `无限画布`.
- Clicking it opens the three-column workbench.
- No text overlaps at desktop width.
- Left column card list, center editor/preview, and right parameter panel are visible.
- Visual style resembles the Stitch reference: dark atelier panels, glassy side areas, compact labels, style thumbnails, and silver selected states.

- [ ] **Step 4: Verify core card interactions**

Manual checks:

- Add a character card.
- Rename it.
- Set role tag.
- Enter description.
- Switch visual styles.
- Change ratio.
- Duplicate card.
- Delete duplicate card.
- Switch to scene cards and add one scene.

Expected:

- Each change persists while moving between tabs.
- No console errors appear.

- [ ] **Step 5: Verify generation and asset library integration**

Manual checks:

- Generate a character image.
- Click 保存到资产库.
- Navigate to 资产管理.
- Confirm generated asset appears under character category.
- Return to 角色场景.
- Confirm the card status is `已入库`.

Expected:

- Generated image is visible in the workbench.
- Asset appears in existing asset library.
- No duplicate asset is created when saving the same saved card again.

- [ ] **Step 6: Verify canvas reuse**

Manual checks:

- In 角色场景, click 用于画布 on a generated image.
- Confirm app switches to 无限画布.
- Confirm an image node with the generated asset appears near the viewport center.

- [ ] **Step 7: Verify reopen persistence**

Manual checks:

- Go home.
- Reopen the same project.
- Navigate to 角色场景.

Expected:

- Character/scene cards, selected style, generated image, saved asset status, and ratio persist.

- [ ] **Step 8: Fix any visual issues**

If text overflows, controls overlap, or mobile/desktop layout is cramped, adjust `src/components/AssetWorkbenchView.tsx` using these constraints:

```tsx
// Use min widths for the side columns.
<aside className="w-[20%] min-w-[260px] ...">
<aside className="w-[25%] min-w-[320px] ...">

// Keep preview usable.
<div className="relative flex-1 min-h-[360px] ...">

// Keep long names from expanding cards.
<span className="text-xs font-bold truncate">
```

- [ ] **Step 9: Run final verification**

Run:

```bash
./node_modules/.bin/tsx tests/assetWorkbench.test.ts
./node_modules/.bin/tsx tests/projectStorageDefaults.test.ts
./node_modules/.bin/tsx tests/projectPatch.test.ts
./node_modules/.bin/tsx tests/bottomTabOrder.test.ts
/Users/yrxs01/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node ./node_modules/vite/bin/vite.js build
```

Expected: all tests PASS and Vite build PASS.

- [ ] **Step 10: Commit**

```bash
git add src/components/AssetWorkbenchView.tsx
git commit -m "fix: polish asset workbench interactions"
```

If Step 8 required no code changes, skip this commit and record that no polish patch was needed.

---

## Completion Checklist

- [ ] `assetWorkbenchCards` exists on new and legacy projects.
- [ ] Bottom tab order is correct.
- [ ] 角色场景 view opens from bottom nav.
- [ ] User can add character and scene cards.
- [ ] User can select Stitch-style visual presets.
- [ ] User can generate image assets through `/api/generate`.
- [ ] User explicitly saves generated result to asset library.
- [ ] Saved character assets use `category: "character"`.
- [ ] Saved scene assets use `category: "scene"`.
- [ ] Saved assets appear in existing 资产管理 and canvas asset flows.
- [ ] User can add generated asset to canvas as an image node.
- [ ] Reopening a project preserves cards and generated state.
- [ ] Vite build passes.
- [ ] Browser verification confirms no Vite overlay, no obvious console errors, and no major layout overlap.
