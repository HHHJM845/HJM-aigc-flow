# Clip Trimming & Video Export Design

**Date:** 2026-04-02
**Status:** Approved

---

## Overview

Two related features:
1. **Clip Trimming** — drag edges of video clip blocks in the subtitle timeline to set real trim points (trimStart/trimEnd), affecting playback and total duration
2. **Video Export** — server-side ffmpeg pipeline to concatenate trimmed clips, burn subtitles, and stream the result as a downloadable `.mp4`

---

## Feature 1: Clip Trimming

### Data Model

`VideoOrderItem` in `src/lib/storage.ts` gains two optional fields:

```ts
export interface VideoOrderItem {
  id: string;
  nodeId: string;
  url: string;
  label: string;
  trimStart?: number  // ms from clip start, default 0
  trimEnd?: number    // ms from clip start, default = full clip duration
}
```

Trimmed duration for clip `i`:
```ts
const trimmedDuration = (item.trimEnd ?? clipDurations[i]) - (item.trimStart ?? 0)
```

`clipOffsets` and `totalMs` are both recalculated from trimmed durations. Subtitles outside the new `totalMs` remain in the data but fall off the visible timeline.

### UI — Drag Handles on Clip Bar Blocks

Each clip block in the clip bar gets two drag handles:
- **Left handle:** 8px wide, `cursor: ew-resize`, positioned at `left: 0`. Dragging right increases `trimStart` (can't exceed `trimEnd - 1000ms` minimum).
- **Right handle:** 8px wide, `cursor: ew-resize`, positioned at `right: 0`. Dragging left decreases `trimEnd` (can't go below `trimStart + 1000ms` minimum).

Interaction pattern mirrors existing subtitle block resize (`handleSubBlockMouseDown`):
1. `mousedown` on handle → record drag state (clip id, which handle, start pixel, current trim value)
2. `mousemove` on `document` → compute delta in ms via `msPerPx`, clamp to valid range, call `updateClipTrim(id, trimStart, trimEnd)`
3. `mouseup` on `document` → clear drag state

`updateClipTrim` updates the project state and syncs via the existing WebSocket broadcast.

### Playback

The subtitle editor's video playback (`currentMs`) already maps to clip index and offset. With trimming:
- When the playhead enters clip `i`, the `<video>` element seeks to `trimStart` of that clip
- When `currentMs` reaches the clip's trimmed end, advance to next clip

---

## Feature 2: Video Export

### Frontend

- Add "导出视频" button in the SubtitleView toolbar
- On click: POST `/api/export-video` with body:
  ```ts
  {
    videoOrder: VideoOrderItem[],  // includes trimStart/trimEnd
    subtitles: Subtitle[],         // { id, startMs, endMs, text }[]
    totalMs: number
  }
  ```
- Show loading overlay with progress message during export
- On response: use `URL.createObjectURL` + hidden `<a>` to trigger download of returned blob
- On error: show toast with error message

### Server — `server/routes/export-video.ts`

**Dependencies:**
```
fluent-ffmpeg
@ffmpeg-installer/ffmpeg
```

**Process:**
1. Create a unique temp directory per request (`/tmp/export-{uuid}/`)
2. For each clip in `videoOrder`:
   - Download video URL to `clip-{i}.mp4` in temp dir (via `axios` stream or `https` native module)
   - ffmpeg trim: `-ss {trimStart/1000} -t {trimmedDuration/1000}` → `clip-{i}-trimmed.mp4`
3. Write ffmpeg concat list file: `concat.txt`
4. Generate SRT file from `subtitles` array: `subtitles.srt`
5. ffmpeg concat + burn subtitles:
   ```
   ffmpeg -f concat -safe 0 -i concat.txt -vf subtitles=subtitles.srt -c:v libx264 -c:a aac output.mp4
   ```
6. `res.download('output.mp4', 'export-{timestamp}.mp4')`
7. Cleanup temp directory after response ends

**Error handling:**
- Each ffmpeg step wrapped in try/catch; on error, cleanup temp dir and return 500 with message
- Timeout: no explicit timeout (export duration depends on video length); client shows indefinite loading

**Output:**
- Format: MP4 (H.264 video, AAC audio)
- Resolution: matches first clip's native resolution
- Subtitle style: default ffmpeg `subtitles` filter (white text, bottom-center)

### Server Registration

Add to `server/index.ts`:
```ts
import exportVideoRouter from './routes/export-video';
app.use('/api/export-video', exportVideoRouter);
```

---

## Out of Scope

- Audio mixing across clips
- Custom subtitle styling (font, color, position)
- Progress streaming (WebSocket progress updates during export)
- Uploading result to OSS
- Thumbnail regeneration after trimming
