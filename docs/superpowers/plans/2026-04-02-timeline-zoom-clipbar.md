# Timeline Zoom & Clip Bar Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Ctrl+scroll zoom to the subtitle timeline and restyle clip bar blocks to look like subtitle blocks.

**Architecture:** All changes in `src/components/SubtitleView.tsx`. Zoom is tracked as state; `pxFromMs`/`msPerPx` derive from `timelineWidth * zoom`. The inner timeline content div becomes a horizontally scrollable container whose width equals `timelineWidth * zoom`.

**Tech Stack:** React, TypeScript, Tailwind CSS

---

## Files

| Action | Path |
|--------|------|
| Modify | `src/components/SubtitleView.tsx` |

---

### Task 1: Zoom state, scroll container, Ctrl+wheel handler

**Files:**
- Modify: `src/components/SubtitleView.tsx`

**Current state of the relevant section (lines ~207–235 and ~543–651):**

```
// Timeline interaction
const timelineRef = useRef<HTMLDivElement>(null);
const [timelineWidth, setTimelineWidth] = useState(800);
// ResizeObserver on timelineRef...
const msPerPx = totalMs > 0 ? totalMs / timelineWidth : 1;
const pxFromMs = (ms) => totalMs > 0 ? (ms / totalMs) * timelineWidth : 0;
```

And the timeline JSX starts with:
```tsx
<div ref={timelineRef} className="shrink-0 border-t ..." style={{ height: TIMELINE_H }}>
  {totalMs > 0 ? (
    <div className="relative w-full h-full overflow-hidden">
      {/* Ruler — passes widthPx={timelineWidth} to RulerTicks */}
      ...
    </div>
  ) : ...}
</div>
```

- [ ] **Step 1: Add `zoom` state and `scrollRef` after `timelineWidth` state**

Find (around line 209):
```ts
const [timelineWidth, setTimelineWidth] = useState(800);
```

Replace with:
```ts
const [timelineWidth, setTimelineWidth] = useState(800);
const [zoom, setZoom] = useState(1.0);
const scrollRef = useRef<HTMLDivElement>(null);
```

- [ ] **Step 2: Replace `msPerPx` and `pxFromMs` to use `contentWidth`**

Find (around line 220–221):
```ts
const msPerPx = totalMs > 0 ? totalMs / timelineWidth : 1;
const pxFromMs = (ms: number) => (totalMs > 0 ? (ms / totalMs) * timelineWidth : 0);
```

Replace with:
```ts
const contentWidth = timelineWidth * zoom;
const msPerPx = totalMs > 0 ? totalMs / contentWidth : 1;
const pxFromMs = (ms: number) => (totalMs > 0 ? (ms / totalMs) * contentWidth : 0);
```

- [ ] **Step 3: Add `handleTimelineWheel` handler after `handleTimelineSubtrackClick`**

Find (around line 235):
```ts
  const handleTimelineSubtrackClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const ms = Math.round(px * msPerPx);
    addSubtitleAt(Math.max(0, Math.min(ms, totalMs)));
  };
```

After this function (before `// Drag state`), insert:
```ts
  const handleTimelineWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    if (!e.ctrlKey) return;
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.15 : 1 / 1.15;
    setZoom(prev => Math.min(8, Math.max(0.25, prev * factor)));
  };
```

- [ ] **Step 4: Restructure the timeline JSX inner container**

Find (around line 549–550):
```tsx
        {totalMs > 0 ? (
          <div className="relative w-full h-full overflow-hidden">
```

Replace with:
```tsx
        {totalMs > 0 ? (
          <div
            ref={scrollRef}
            className="relative w-full h-full overflow-x-auto"
            style={{ scrollbarWidth: 'none' }}
            onWheel={handleTimelineWheel}
          >
          <div className="relative h-full" style={{ width: contentWidth }}>
```

- [ ] **Step 5: Close the extra inner div and update RulerTicks widthPx**

Find the closing `</div>` that closes the `relative w-full h-full` div. It's right before the empty state fallback. The current structure ends with:

```tsx
            {/* Playhead */}
            <div
              className="absolute top-0 bottom-0 w-[2px] bg-red-500/80 pointer-events-none"
              style={{ left: pxFromMs(currentMs) }}
            />
          </div>
        ) : (
```

Replace the closing with two closing divs:
```tsx
            {/* Playhead */}
            <div
              className="absolute top-0 bottom-0 w-[2px] bg-red-500/80 pointer-events-none"
              style={{ left: pxFromMs(currentMs) }}
            />
          </div>
          </div>
        ) : (
```

Also find the RulerTicks call (around line 557):
```tsx
              <RulerTicks totalMs={totalMs} widthPx={timelineWidth} />
```
Replace with:
```tsx
              <RulerTicks totalMs={totalMs} widthPx={contentWidth} />
```

- [ ] **Step 6: Verify in browser**

Open a project with videos in the subtitle editor. Hold Ctrl and scroll up — confirm timeline content stretches horizontally (ruler ticks spread out, subtitle blocks move apart). Scroll down — confirm content compresses back. Confirm horizontal scrollbar appears when zoomed in.

- [ ] **Step 7: Commit**

```bash
git add src/components/SubtitleView.tsx
git commit -m "feat: add Ctrl+scroll zoom to subtitle timeline"
```

---

### Task 2: Clip bar block redesign

**Files:**
- Modify: `src/components/SubtitleView.tsx`

- [ ] **Step 1: Update `CLIP_BAR_H` and `TIMELINE_H`**

Find (around line 53–55):
```ts
const CLIP_BAR_H = 20;
const SUB_TRACK_H = 48;
const TIMELINE_H = RULER_H + THUMB_TRACK_H + CLIP_BAR_H + SUB_TRACK_H + 16; // ~202px
```

Replace with:
```ts
const CLIP_BAR_H = 36;
const SUB_TRACK_H = 48;
const TIMELINE_H = RULER_H + THUMB_TRACK_H + CLIP_BAR_H + SUB_TRACK_H + 16; // ~218px
```

- [ ] **Step 2: Restyle clip bar blocks**

Find the clip bar render block (around lines 592–604):
```tsx
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
```

Replace with:
```tsx
                return (
                  <div
                    key={item.id}
                    className="absolute top-1 bottom-1 rounded flex items-center overflow-hidden"
                    style={{ left, width, background: bg, borderRight: '1px solid rgba(255,255,255,0.06)' }}
                  >
                    {width > 30 && (
                      <span className="text-[10px] text-white/70 px-2 truncate select-none">
                        {item.label || `片段 ${i + 1}`}
                      </span>
                    )}
                  </div>
                );
```

- [ ] **Step 3: Verify in browser**

Open subtitle editor with videos. Confirm:
- Clip bar blocks are taller (36px minus 2px margins = 34px visible) with rounded corners
- Clip labels (from `item.label`) are visible on wide-enough clips
- Style resembles subtitle blocks (rounded, text, solid color)

- [ ] **Step 4: Commit**

```bash
git add src/components/SubtitleView.tsx
git commit -m "feat: restyle clip bar blocks to match subtitle block appearance"
```

---

### Task 3: Push and deploy

- [ ] **Step 1: Push to GitHub**

```bash
git push origin main
```

- [ ] **Step 2: Deploy to server**

```bash
ssh root@218.244.158.35 "cd /home/HJM-aigc-flow && git pull origin main && npm run build 2>&1 | tail -3 && pm2 restart aigc-flow"
```

Expected: `✓ built in ~6s`, PM2 status `online`.
