# Asset Matching & Style Optimizer Design

**Date:** 2026-04-02
**Status:** Approved

---

## Overview

Two features to enhance the image node generation workflow:

1. **Asset Auto-Matching** — When importing storyboard rows to canvas nodes, AI detects character/scene names in each row's description and automatically sets the matching asset as the node's `referenceImage`.
2. **Style Selector + AI Prompt Optimizer** — Each image node gets a style picker (preset tags + custom input) and an "AI优化" button that rewrites the shot description + chosen style into an optimized generation prompt, filling the prompt textarea for user review before generating.

---

## Feature 1: Asset Auto-Matching

### Asset Renaming

`AssetItem` already has a `name` field (populated from filename on upload). Add inline rename to `AssetPanel`:
- Clicking an asset's name turns it into an `<input>` field
- Blur or Enter saves the new name via the existing `onUpdateAssets` callback
- No data model changes needed

### AI Matching Flow

Triggered during `handleImportFromBreakdown` in `App.tsx`, after `rowsToNodes()` creates the initial nodes:

1. Collect all storyboard rows `{id, description}` and all assets `{id, name, category, src}`
2. POST `/api/match-assets` with `{ rows: [{id, description}], assets: [{id, name, category}] }`
3. AI model inspects each row's description for character/scene names that match asset names (handles partial matches and synonyms)
4. Returns `{ matches: [{rowId: string, assetId: string}] }` — one match per row max (most prominent)
5. Front-end maps each `rowId` → node id (`storyboard-${row.id}`), sets `data.referenceImage = asset.src` on matched nodes
6. Non-matched nodes remain unchanged

Import proceeds immediately (nodes appear on canvas); matching updates `referenceImage` when the response arrives. Show a brief loading indicator on the import button during the API call.

### Server Route: `/api/match-assets`

**File:** `server/routes/match-assets.ts`

Request body:
```ts
{
  rows: { id: string; description: string }[];
  assets: { id: string; name: string; category?: string }[];
}
```

Response:
```ts
{ matches: { rowId: string; assetId: string }[] }
```

System prompt:
```
You are a storyboard asset matcher. Given a list of assets (characters and scenes) and storyboard row descriptions, identify which asset best matches each row.

Rules:
- Match by name appearing in the description (exact, partial, or synonymous)
- Only match character assets to rows that feature that character as primary subject
- Only match scene assets to rows whose primary setting matches the scene name
- Return at most one match per row
- If no clear match, omit that row from results

Return ONLY valid JSON: {"matches": [{"rowId": "...", "assetId": "..."}]}
```

Uses the same AI API key as existing routes (`IMAGE_API_KEY` / `VIDEO_API_KEY`). Uses a text model (not vision).

---

## Feature 2: Style Selector + AI Prompt Optimizer

### Data Model

`ImageNode` data gains one optional field:
```ts
style?: string  // Selected style, e.g. "动漫" or user's custom text
```

This is stored in React Flow node data, which is already persisted via the project save mechanism.

### UI — Style Selector in ImageNode

Located in the node's prompt panel (the area with the textarea), above the prompt input:

**Preset tags** (horizontal scroll row):
`写实` `动漫` `油画` `水彩` `赛博朋克` `中国水墨` `素描` `3D渲染` `皮克斯风格`

- Clicking a tag toggles it selected (highlighted); only one tag selected at a time
- If a selected tag is clicked again, it deselects (clears style)
- A small custom input field at the end of the tag row allows free-text entry
- Entering text in the custom field deselects any preset tag
- The final `style` value = selected preset tag OR custom input text (whichever is active)
- Style is saved to node data on change via `data.onUpdate`

### UI — AI Optimize Button

A `✨ AI优化` button placed inside the prompt textarea area (top-right corner of the textarea):
- Disabled when no `shotDescription` exists on the node
- On click: shows loading spinner, calls POST `/api/optimize-prompt`
- On success: fills the prompt textarea with the returned text
- User can edit the filled text before clicking generate
- On error: shows a brief inline error message

### Server Route: `/api/optimize-prompt`

**File:** `server/routes/optimize-prompt.ts`

Request body:
```ts
{
  description: string;   // node's shotDescription
  style: string;         // selected style (may be empty string)
  shotType?: string;     // e.g. "广角", "特写"
}
```

Response:
```ts
{ prompt: string }
```

System prompt:
```
你是专业的AI图像生成提示词工程师。根据分镜画面描述和画风，生成一段优化的图像生成提示词。

要求：
- 提示词语言：中文
- 长度：50-150字
- 包含：画面主体、构图、光线氛围、画风关键词
- 不要加解释性文字，只输出提示词本身

画面描述：{description}
画风：{style}
镜头类型：{shotType}
```

Uses the same AI API key as existing text-based routes.

---

## Out of Scope

- Multi-asset matching per row (only one `referenceImage` per node)
- Batch AI optimize (all nodes at once)
- Asset categories being auto-detected from asset name
- Saving style as a project-level default
- English prompt output
