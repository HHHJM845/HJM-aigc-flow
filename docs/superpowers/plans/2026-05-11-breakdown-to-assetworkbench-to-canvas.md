# Breakdown → Asset Workbench → Canvas Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the "导入画布并生成节点" button in BreakdownView with "生成/导入人物场景资产" that navigates to AssetWorkbenchView, then add a "完成 → 导入画布" button in AssetWorkbenchView that batch-imports all storyboard rows as canvas image nodes.

**Architecture:** Three small changes wired together — BreakdownView gets a new prop and updated button, App.tsx adds two callbacks, AssetWorkbenchView gets a new optional prop and bottom button. No new files needed. The existing `handleImportFromBreakdown` logic in App.tsx is reused directly for the canvas import step.

**Tech Stack:** React 18, TypeScript, Tailwind CSS, @xyflow/react, Material Symbols (icon font)

---

## File Map

| File | Action | What changes |
|------|--------|--------------|
| `src/components/BreakdownView.tsx` | Modify | Add `onGoToAssets` prop; change bottom button text, icon, and onClick |
| `src/App.tsx` | Modify | Add `handleGoToAssets` + `handleImportFromAssetWorkbench` callbacks; pass them as props |
| `src/components/AssetWorkbenchView.tsx` | Modify | Add `onImportToCanvas` prop; add "完成 → 导入画布" button at the bottom |

---

## Task 1: Update BreakdownView — new prop + changed button

**Files:**
- Modify: `src/components/BreakdownView.tsx:162-175` (Props interface)
- Modify: `src/components/BreakdownView.tsx:595-608` (bottom button)

- [ ] **Step 1: Add `onGoToAssets` to the Props interface**

  In `src/components/BreakdownView.tsx`, find the `Props` interface (around line 162). Add one line:

  ```ts
  interface Props {
    initialRows?: StoryboardRow[];
    initialScriptText?: string;
    onImport: (rows: StoryboardRow[], ratio: string, cardW: number, cardH: number) => void;
    onRowsChange?: (rows: StoryboardRow[]) => void;
    onScriptChange?: (text: string) => void;
    externalInitText?: string;
    projectId?: string;
    projectName?: string;
    annotations?: AnnotationData[];
    onSnapshotRestore?: (snapshotId: string) => Promise<void>;
    onSaveSnapshot?: (label: string) => Promise<void>;
    annotationSuggestions?: Map<string, AnnotationSuggestion>;
    annotationSuggestionsLoading?: boolean;
    onDismissSuggestion?: (rowId: string, suggestionId: string) => void;
    onApplySuggestion?: (rowId: string, prompt: string, rowIndex: number) => void;
    onGoToAssets?: () => void;   // ← add this line
  }
  ```

- [ ] **Step 2: Update the function signature to destructure `onGoToAssets`**

  Find the `export default function BreakdownView({` line (around line 181). Add `onGoToAssets` to the destructured props:

  ```ts
  export default function BreakdownView({
    initialRows,
    initialScriptText,
    onImport,
    onRowsChange,
    onScriptChange,
    externalInitText,
    projectId,
    projectName,
    annotations = [],
    onSnapshotRestore,
    onSaveSnapshot,
    annotationSuggestions,
    annotationSuggestionsLoading = false,
    onDismissSuggestion,
    onApplySuggestion,
    onGoToAssets,   // ← add this
  }: Props) {
  ```

- [ ] **Step 3: Replace the bottom button (lines ~595–608)**

  Find the `{/* 导入画布按钮 */}` comment block and replace the entire `<button>` with:

  ```tsx
  {/* 生成/导入人物场景资产按钮 */}
  <div className="mt-auto pt-6">
    <button
      onClick={() => {
        onRowsChange?.(rows);
        onGoToAssets?.();
      }}
      disabled={rows.length === 0 || !onGoToAssets}
      className="w-full py-4 rounded-xl bg-[#e0e0e0] text-[#0a0a0a] font-bold tracking-tight glow-button flex items-center justify-center gap-2 hover:bg-white transition-all active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed font-label"
    >
      <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>palette</span>
      生成/导入人物场景资产
      {rows.length > 0 && (
        <div className="w-2 h-2 rounded-full bg-[#1a1a1a] animate-pulse ml-1" />
      )}
    </button>
  </div>
  ```

- [ ] **Step 4: Verify TypeScript compiles**

  ```bash
  cd C:\Users\oldch\Desktop\HJM-aigc-flow-main
  npx tsc --noEmit
  ```

  Expected: no errors related to `BreakdownView.tsx`.

- [ ] **Step 5: Commit**

  ```bash
  git add src/components/BreakdownView.tsx
  git commit -m "feat: replace breakdown bottom button with go-to-assets action"
  ```

---

## Task 2: Add callbacks in App.tsx and wire BreakdownView

**Files:**
- Modify: `src/App.tsx` — add two callbacks, update BreakdownView JSX

- [ ] **Step 1: Add `handleGoToAssets` callback in App.tsx**

  Find `handleImportFromBreakdown` (around line 311). Just above it, add:

  ```ts
  const handleGoToAssets = useCallback(() => {
    setActiveView('assetWorkbench');
  }, []);
  ```

- [ ] **Step 2: Add `handleImportFromAssetWorkbench` callback in App.tsx**

  Immediately after `handleGoToAssets`, add:

  ```ts
  const handleImportFromAssetWorkbench = useCallback(async () => {
    await handleImportFromBreakdown(storyboardRows, '16:9', 380, 214);
  }, [storyboardRows, handleImportFromBreakdown]);
  ```

  > Note: 380×214 is the 16:9 card size defined in `BreakdownView.tsx`'s `CARD_RATIOS`. This is the safe default when no ratio is selected in AssetWorkbench.

- [ ] **Step 3: Pass `onGoToAssets` to BreakdownView in the JSX**

  Find the `<BreakdownView` block (around line 1248). Add one prop:

  ```tsx
  <BreakdownView
    initialRows={storyboardRows}
    initialScriptText={initialScriptText}
    onImport={handleImportFromBreakdown}
    onRowsChange={onSaveRows}
    onScriptChange={onSaveScript}
    externalInitText={breakdownInitText}
    projectId={projectId}
    projectName={projectName}
    annotations={annotations}
    onSnapshotRestore={handleSnapshotRestore}
    onSaveSnapshot={handleSaveSnapshot}
    annotationSuggestions={annotationSuggestions}
    annotationSuggestionsLoading={annotationSuggestionsLoading}
    onDismissSuggestion={onDismissSuggestion}
    onApplySuggestion={onApplySuggestion}
    onGoToAssets={handleGoToAssets}   // ← add this
  />
  ```

- [ ] **Step 4: Verify TypeScript compiles**

  ```bash
  npx tsc --noEmit
  ```

  Expected: no errors.

- [ ] **Step 5: Commit**

  ```bash
  git add src/App.tsx
  git commit -m "feat: add go-to-assets and import-from-assetworkbench handlers in App"
  ```

---

## Task 3: Update AssetWorkbenchView — new prop + "完成 → 导入画布" button

**Files:**
- Modify: `src/components/AssetWorkbenchView.tsx` — Props interface, function signature, bottom button

- [ ] **Step 1: Add `onImportToCanvas` to the Props interface**

  Find `interface Props` (around line 17 in `AssetWorkbenchView.tsx`). Add the new optional prop:

  ```ts
  interface Props {
    cards: AssetWorkbenchCard[];
    onSaveCards: (cards: AssetWorkbenchCard[]) => void;
    onAddAsset: (asset: AssetItem) => void;
    onAddImageNode: (asset: AssetItem) => void;
    onImportToCanvas?: () => void;   // ← add this
  }
  ```

- [ ] **Step 2: Destructure `onImportToCanvas` in the function signature**

  Find `export default function AssetWorkbenchView({` (around line 68). Add:

  ```ts
  export default function AssetWorkbenchView({
    cards,
    onSaveCards,
    onAddAsset,
    onAddImageNode,
    onImportToCanvas,   // ← add this
  }: Props) {
  ```

- [ ] **Step 3: Add the "完成 → 导入画布" button at the bottom of the view**

  Find the closing `</div>` or wrapper of the main content area in `AssetWorkbenchView.tsx`. Add the button just before the component's outermost return closing tag:

  ```tsx
  {onImportToCanvas && (
    <div className="px-4 pb-6 pt-2">
      <button
        onClick={onImportToCanvas}
        className="w-full py-4 rounded-xl bg-[#e0e0e0] text-[#0a0a0a] font-bold tracking-tight glow-button flex items-center justify-center gap-2 hover:bg-white transition-all active:scale-[0.98] font-label"
      >
        <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>auto_fix_high</span>
        完成 → 导入画布
      </button>
    </div>
  )}
  ```

  > The button is only rendered when `onImportToCanvas` is provided, so existing uses of `AssetWorkbenchView` without this prop are unaffected.

- [ ] **Step 4: Wire `onImportToCanvas` in App.tsx's AssetWorkbenchView JSX**

  Find the `<AssetWorkbenchView` block (around line 1303 in `App.tsx`). Add the prop:

  ```tsx
  <AssetWorkbenchView
    cards={assetWorkbenchCards}
    onSaveCards={handleSaveAssetWorkbenchCards}
    onAddAsset={handleAddAsset}
    onAddImageNode={handleAddWorkbenchAssetToCanvas}
    onImportToCanvas={handleImportFromAssetWorkbench}   // ← add this
  />
  ```

- [ ] **Step 5: Verify TypeScript compiles**

  ```bash
  npx tsc --noEmit
  ```

  Expected: no errors.

- [ ] **Step 6: Commit**

  ```bash
  git add src/components/AssetWorkbenchView.tsx src/App.tsx
  git commit -m "feat: add import-to-canvas button in AssetWorkbenchView"
  ```

---

## Task 4: End-to-end verification

- [ ] **Step 1: Start the dev server**

  ```bash
  npm run dev
  ```

- [ ] **Step 2: Test the new flow**

  1. Open a project that has storyboard rows (or generate them via script breakdown)
  2. Navigate to the **分镜列表** (BreakdownView)
  3. Verify the bottom-right button now reads **"生成/导入人物场景资产"** with the `palette` icon
  4. Click it — verify the app navigates to **AssetWorkbench** (人物场景资产 tab)
  5. Scroll to the bottom of AssetWorkbenchView — verify **"完成 → 导入画布"** button is visible
  6. Click "完成 → 导入画布" — verify the app switches to the **canvas view**
  7. Verify the canvas contains one image node per storyboard row, laid out in the same grid as before

- [ ] **Step 3: Verify the old inline "导入画布" buttons still work**

  In BreakdownView, individual row annotation suggestions have inline "导入画布" buttons (around line 449). Click one — verify it still imports that row to canvas directly (unchanged behavior).

- [ ] **Step 4: Verify empty-state disable**

  Open a project with no storyboard rows. Verify the "生成/导入人物场景资产" button is disabled (opacity-40, not clickable).
