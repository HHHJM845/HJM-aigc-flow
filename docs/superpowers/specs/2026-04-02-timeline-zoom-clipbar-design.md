---
title: Timeline Zoom & Clip Bar Redesign
date: 2026-04-02
status: approved
---

# Timeline Zoom & Clip Bar Redesign

## Overview

Two improvements to `SubtitleView.tsx`:
1. Ctrl+scroll wheel zooms the timeline horizontally
2. Clip bar blocks are restyled to look like subtitle blocks (taller, rounded, labeled)

---

## 1. Ctrl+Scroll Zoom

### State

```ts
const [zoom, setZoom] = useState(1.0); // range: 0.25 – 8.0
```

### Content width

All timeline content (ruler, thumbnail track, clip bar, subtitle track) is rendered inside a new inner div whose width is `timelineWidth * zoom`. The outer timeline div becomes `overflow-x: auto` with a hidden scrollbar (`::-webkit-scrollbar { display: none }`).

A ref tracks the scroll container: `scrollRef = useRef<HTMLDivElement>(null)`.

### pxFromMs update

```ts
const contentWidth = timelineWidth * zoom;
const pxFromMs = (ms: number) => totalMs > 0 ? (ms / totalMs) * contentWidth : 0;
```

`timelineWidth` still comes from ResizeObserver on the outer container (unchanged).

### Wheel handler

Attached to the outer timeline container via `onWheel`:

```ts
const handleTimelineWheel = (e: React.WheelEvent<HTMLDivElement>) => {
  if (!e.ctrlKey) return;
  e.preventDefault();
  const factor = e.deltaY < 0 ? 1.15 : 1 / 1.15;
  setZoom(prev => Math.min(8, Math.max(0.25, prev * factor)));
};
```

### Ruler ticks

`RulerTicks` already receives `totalMs` and `widthPx`. Pass `contentWidth` as `widthPx` instead of `timelineWidth`. Ticks auto-adapt to density.

### Playhead

Playhead left position uses `pxFromMs(currentMs)` — already correct after the formula change.

---

## 2. Clip Bar Redesign

### Height

`CLIP_BAR_H` changes from `20` to `36`.

`TIMELINE_H = RULER_H + THUMB_TRACK_H + CLIP_BAR_H + SUB_TRACK_H + 16 = 28 + 90 + 36 + 48 + 16 = 218px`

### Block styling

Each clip block styled like a subtitle block:

```tsx
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
```

Colors: alternating `#1e3a5f` / `#1a3350` (unchanged).

---

## Timeline Layout (after changes)

```
┌─────────────────────────────────────────┐  RULER_H = 28px
│  00:00   00:01   00:02   00:03          │
├─────────────────────────────────────────┤  THUMB_TRACK_H = 90px
│  [video thumbnails]                     │
├─────────────────────────────────────────┤  CLIP_BAR_H = 36px  ← up from 20
│  [片段1 ████████]  [片段2 ████████]     │
├─────────────────────────────────────────┤  SUB_TRACK_H = 48px
│  [字幕A]        [字幕B]                 │
└─────────────────────────────────────────┘
  Total TIMELINE_H = 28+90+36+48+16 = 218px
```

---

## Files Changed

- `src/components/SubtitleView.tsx` — all changes here

## What Does NOT Change

- Drag resize of subtitle blocks
- Double-click to add subtitle
- Keyboard delete
- Ruler click to seek
- Thumbnail extraction logic
