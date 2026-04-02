---
title: Subtitle Timeline Improvements
date: 2026-04-02
status: approved
---

# Subtitle Timeline Improvements

## Overview

Three targeted improvements to `SubtitleView.tsx`:
1. Double-click (not single-click) to add subtitles on the timeline
2. Video clip bar above the subtitle track showing each clip's duration
3. Keyboard delete (`Delete` / `Backspace`) to remove the focused subtitle

---

## 1. Double-click to Add Subtitles

**Current behavior:** Single-click on the subtitle subtrack calls `addSubtitleAt()`.

**New behavior:** Change the subtitle subtrack's `onClick` to `onDoubleClick`. Single-click on an empty area does nothing (no accidental subtitle creation). Double-click creates a subtitle at that time position.

No change to single-click on an existing subtitle block — that still selects/focuses it.

---

## 2. Video Clip Bar

**Position:** Between the thumbnail track and the subtitle track.

**Height:** 20px (`CLIP_BAR_H = 20`). `TIMELINE_H` increases by 20px accordingly.

**Rendering:** For each clip in `videoOrder`, render a colored block proportional to its duration:
- Width = `(clipDurationMs / totalMs) * timelineWidth`
- Left offset = cumulative offset of previous clips (`clipOffsets`)
- Background: alternating colors (`#1e3a5f` / `#1a3350`) to distinguish adjacent clips
- Each block shows the clip index (1-based) as small text on the left if wide enough (>40px)
- Vertical divider line between clips

**Fallback:** If `totalMs === 0` or clip durations not yet loaded, the bar shows as a dark empty strip.

---

## 3. Keyboard Delete for Selected Subtitle

**Focused state:** Already exists (`focusedSubId`). A subtitle is focused/selected when clicked in the list panel or timeline block.

**New behavior:** Add a `keydown` event listener on `window` (active only when `focusedSubId !== null`):
- `Delete` or `Backspace` key → call `removeSubtitle(focusedSubId)`
- Listener is removed when component unmounts or `focusedSubId` changes to null

**Edge case:** If focus is inside a text input (subtitle text editing), the keydown should NOT trigger delete. Check `document.activeElement` tag — skip if it's an `INPUT`, `TEXTAREA`, or `contenteditable`.

---

## Timeline Layout (after changes)

```
┌─────────────────────────────────────────┐  ← RULER_H = 28px
│  00:00   00:01   00:02   00:03          │
├─────────────────────────────────────────┤  ← THUMB_TRACK_H = 90px
│  [video thumbnails]                     │
├─────────────────────────────────────────┤  ← CLIP_BAR_H = 20px  ← NEW
│  [clip 1 ████████] [clip 2 ████████]   │
├─────────────────────────────────────────┤  ← SUB_TRACK_H = 48px
│  [subtitle A]   [subtitle B]            │
└─────────────────────────────────────────┘
  Total TIMELINE_H = 28 + 90 + 20 + 48 + 16 = 202px
```

---

## Files Changed

- `src/components/SubtitleView.tsx` — all changes contained here

## What Does NOT Change

- Drag to move/resize subtitle blocks
- Ruler click to seek
- Subtitle list panel
- AI generate / SRT export
