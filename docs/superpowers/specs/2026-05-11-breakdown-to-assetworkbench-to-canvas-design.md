# Design: Breakdown → Asset Workbench → Canvas Flow

**Date:** 2026-05-11  
**Status:** Approved

## Overview

Connect the storyboard breakdown step to the asset workbench (character/scene generation), then from the asset workbench allow batch-importing all storyboard shots into the canvas as image nodes — using the same logic as the existing direct import.

## Current Flow

```
BreakdownView → [导入画布并生成节点] → canvas (imageNodes)
```

## New Flow

```
BreakdownView → [生成/导入人物场景资产] → AssetWorkbenchView → [完成 → 导入画布] → canvas (imageNodes)
```

## Affected Files

| File | Change |
|------|--------|
| `src/components/BreakdownView.tsx` | Change bottom button text + behavior |
| `src/components/AssetWorkbenchView.tsx` | Add "完成 → 导入画布" button |
| `src/App.tsx` | Add two callbacks to wire the views together |

## Detailed Changes

### `src/components/BreakdownView.tsx`

- **Button text:** `导入画布并生成节点` → `生成/导入人物场景资产`
- **Button icon:** change to `person` or `palette` material symbol
- **onClick behavior:** call new prop `onGoToAssets()` instead of `handleImport()`
- **Before navigating:** call `onRowsChange?.(rows)` to persist current rows
- **New prop added:** `onGoToAssets: () => void`
- The existing `onImport` prop stays (used by individual row inline buttons at line 449)

### `src/App.tsx`

- **New handler `handleGoToAssets`:**
  ```ts
  const handleGoToAssets = useCallback(() => {
    setActiveView('assetWorkbench');
  }, []);
  ```
  Rows are already in `storyboardRows` state — no need to pass them again.

- **New handler `handleImportFromAssetWorkbench`:**
  Reuses the same logic as `handleImportFromBreakdown` (lines 311–344), reading from `storyboardRows` state directly:
  ```ts
  const handleImportFromAssetWorkbench = useCallback(async () => {
    const r = CARD_RATIOS.find(c => c.ratio === '16:9') ?? CARD_RATIOS[0];
    await handleImportFromBreakdown(storyboardRows, r.ratio, r.w, r.h);
  }, [storyboardRows, handleImportFromBreakdown]);
  ```

- Pass `onGoToAssets={handleGoToAssets}` to `BreakdownView`
- Pass `onImportToCanvas={handleImportFromAssetWorkbench}` to `AssetWorkbenchView`

### `src/components/AssetWorkbenchView.tsx`

- **New prop:** `onImportToCanvas?: () => void`
- **New button** added at the bottom of the view (below existing action area):
  - Full-width, same visual style as BreakdownView's bottom button (`bg-[#e0e0e0] text-[#0a0a0a]`)
  - Text: `完成 → 导入画布`
  - Icon: `auto_fix_high` material symbol
  - Disabled when `onImportToCanvas` is not provided

## Data Flow

```
storyboardRows (App state)
    ↓ already saved when user edits breakdown
BreakdownView button click → onGoToAssets()
    ↓
App: setActiveView('assetWorkbench')
    ↓
User generates character/scene assets in AssetWorkbenchView
    ↓
AssetWorkbenchView "完成 → 导入画布" click → onImportToCanvas()
    ↓
App: rowsToNodes(storyboardRows, ...) → setNodes → setActiveView('canvas')
    ↓ (existing AI asset matching still runs)
Canvas with image nodes
```

## Out of Scope

- Individual row "导入画布" inline buttons in BreakdownView — unchanged
- AssetWorkbench internal logic — unchanged
- Canvas node structure — unchanged (same as current import)
- Storyboard ratio selection: use the ratio stored in BreakdownView state; since AssetWorkbench doesn't have a ratio selector, default to the last-used ratio (already in App state via storyboardRows path, or fallback to 16:9)
