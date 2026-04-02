# Subtitle Timeline Improvements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Three focused changes to SubtitleView: double-click to add subtitles, video clip bar above the subtitle track, keyboard Delete to remove the focused subtitle.

**Architecture:** All changes are self-contained in `src/components/SubtitleView.tsx`. Timeline layout constants are updated, a new clip-bar render block is inserted between existing tracks, and two event handlers are added/changed.

**Tech Stack:** React, TypeScript, Tailwind CSS

---

## Files

| Action | Path |
|--------|------|
| Modify | `src/components/SubtitleView.tsx` |

---

### Task 1: Double-click to add subtitle

**Files:**
- Modify: `src/components/SubtitleView.tsx` — subtitle subtrack event handler

- [ ] **Step 1: Change `onClick` → `onDoubleClick` on the subtitle subtrack div**

Find this block (around line 564–568):

```tsx
{/* Subtitle track */}
<div
  className="absolute left-0 right-0 cursor-crosshair"
  style={{ top: RULER_H + THUMB_TRACK_H, height: SUB_TRACK_H, background: '#161616' }}
  onClick={handleTimelineSubtrackClick}
>
```

Replace with:

```tsx
{/* Subtitle track */}
<div
  className="absolute left-0 right-0 cursor-crosshair"
  style={{ top: RULER_H + THUMB_TRACK_H + CLIP_BAR_H, height: SUB_TRACK_H, background: '#161616' }}
  onDoubleClick={handleTimelineSubtrackClick}
>
```

> Note: `top` is also updated here to account for `CLIP_BAR_H` which is added in Task 2. Apply both changes together.

- [ ] **Step 2: Verify in browser**

Open the subtitle editor with a video loaded. Single-click on the subtitle track — confirm NO subtitle is created. Double-click — confirm a subtitle IS created at that time position.

- [ ] **Step 3: Commit**

```bash
git add src/components/SubtitleView.tsx
git commit -m "fix: require double-click to add subtitle on timeline"
```

---

### Task 2: Add video clip bar between thumbnail and subtitle tracks

**Files:**
- Modify: `src/components/SubtitleView.tsx` — timeline constants + new render block

- [ ] **Step 1: Add `CLIP_BAR_H` constant and update `TIMELINE_H`**

Find (around line 49–54):

```ts
const RULER_H = 28;
const THUMB_TRACK_H = 90;
const SUB_TRACK_H = 48;
const TIMELINE_H = RULER_H + THUMB_TRACK_H + SUB_TRACK_H + 16; // ~182px
```

Replace with:

```ts
const RULER_H = 28;
const THUMB_TRACK_H = 90;
const CLIP_BAR_H = 20;
const SUB_TRACK_H = 48;
const TIMELINE_H = RULER_H + THUMB_TRACK_H + CLIP_BAR_H + SUB_TRACK_H + 16; // ~202px
```

- [ ] **Step 2: Insert the clip bar render block**

The clip bar goes after the thumbnail track and before the subtitle track. Find the comment `{/* Subtitle track */}` (around line 564) and insert the following block immediately before it:

```tsx
{/* Clip bar */}
<div
  className="absolute left-0 right-0 overflow-hidden"
  style={{ top: RULER_H + THUMB_TRACK_H, height: CLIP_BAR_H, background: '#0d0d0d' }}
>
  {videoOrder.map((item, i) => {
    const clipMs = clipDurations[i] ?? 0;
    if (clipMs === 0) return null;
    const left = pxFromMs(clipOffsets.current[i] ?? 0);
    const width = pxFromMs(clipMs);
    const bg = i % 2 === 0 ? '#1e3a5f' : '#1a3350';
    return (
      <div
        key={item.id}
        className="absolute top-0 bottom-0 flex items-center overflow-hidden"
        style={{ left, width, background: bg, borderRight: '1px solid rgba(255,255,255,0.08)' }}
      >
        {width > 40 && (
          <span className="text-[9px] text-white/50 pl-1 select-none shrink-0">
            {i + 1}
          </span>
        )}
      </div>
    );
  })}
</div>
```

- [ ] **Step 3: Update the subtitle track `top` offset**

The subtitle track's `top` must now account for `CLIP_BAR_H`. This was already shown in Task 1 Step 1 — confirm the subtitle track div reads:

```tsx
style={{ top: RULER_H + THUMB_TRACK_H + CLIP_BAR_H, height: SUB_TRACK_H, background: '#161616' }}
```

- [ ] **Step 4: Verify in browser**

Open subtitle editor with at least one video clip loaded. Confirm:
- A colored bar appears between the thumbnail row and the subtitle row
- Each clip occupies a proportional width in the bar
- The clip index number (1, 2, …) is visible on wider clips
- The subtitle track is still fully visible below the new bar (not overlapping)

- [ ] **Step 5: Commit**

```bash
git add src/components/SubtitleView.tsx
git commit -m "feat: add video clip bar to subtitle timeline"
```

---

### Task 3: Delete focused subtitle with keyboard

**Files:**
- Modify: `src/components/SubtitleView.tsx` — new `useEffect` for keydown listener

- [ ] **Step 1: Add the keydown `useEffect`**

Place this block after the existing drag-state `useEffect` (which ends around line 293) and before the thumbnail extraction section:

```tsx
// ── Keyboard delete ───────────────────────────────────────────────────────
useEffect(() => {
  if (!focusedSubId) return;
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key !== 'Delete' && e.key !== 'Backspace') return;
    const tag = (document.activeElement as HTMLElement)?.tagName?.toLowerCase();
    if (tag === 'input' || tag === 'textarea') return;
    if ((document.activeElement as HTMLElement)?.isContentEditable) return;
    e.preventDefault();
    removeSubtitle(focusedSubId);
  };
  window.addEventListener('keydown', onKeyDown);
  return () => window.removeEventListener('keydown', onKeyDown);
}, [focusedSubId, removeSubtitle]);
```

- [ ] **Step 2: Verify in browser**

1. Load the subtitle editor with a video and at least one subtitle.
2. Click a subtitle block in the timeline — it becomes highlighted (focused).
3. Press `Delete` key — confirm the subtitle is removed from both the timeline and the list.
4. Click inside the subtitle text input in the list panel, press `Backspace` — confirm it only deletes text, NOT the subtitle entry.

- [ ] **Step 3: Commit**

```bash
git add src/components/SubtitleView.tsx
git commit -m "feat: delete focused subtitle with Delete/Backspace key"
```

---

### Task 4: Push and deploy

- [ ] **Step 1: Push to GitHub**

```bash
git push origin main
```

- [ ] **Step 2: Deploy to server**

```bash
ssh root@218.244.158.35 "cd /home/HJM-aigc-flow && git pull origin main && npm run build 2>&1 | tail -3 && pm2 restart aigc-flow"
```

Expected: build completes with `✓ built in ~6s`, PM2 shows `online`.
