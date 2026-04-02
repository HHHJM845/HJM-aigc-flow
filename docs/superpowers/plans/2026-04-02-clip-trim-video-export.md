# Clip Trimming & Video Export Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add drag-to-trim on timeline clip blocks (storing trimStart/trimEnd) and a server-side ffmpeg export pipeline that concatenates trimmed clips with burned subtitles.

**Architecture:** Clip trimming is pure frontend — VideoOrderItem gains optional trim fields; SubtitleView uses local state to manage trimmed video order, updates App via callback, which persists through existing sync. Video export is a new Express route that downloads clips, trims with ffmpeg, concatenates, burns SRT subtitles, and streams the MP4 as a download.

**Tech Stack:** React + TypeScript (frontend), Express + fluent-ffmpeg + @ffmpeg-installer/ffmpeg (backend), Node.js built-in `https` for downloading videos, `crypto.randomUUID()` for temp dirs.

---

## File Map

| File | Action | What changes |
|------|--------|-------------|
| `src/lib/storage.ts` | Modify | Add `trimStart?`/`trimEnd?` to `VideoOrderItem` |
| `src/components/SubtitleView.tsx` | Modify | Local videoOrder state, trimmed durations, trim drag handles, export button |
| `src/App.tsx` | Modify | Pass `onUpdateVideoOrder` prop to `SubtitleView` |
| `server/routes/export-video.ts` | Create | ffmpeg export route |
| `server/index.ts` | Modify | Register export-video route |
| `package.json` | Modify | Add fluent-ffmpeg, @ffmpeg-installer/ffmpeg, @types/fluent-ffmpeg |

---

## Task 1: Add trimStart/trimEnd to VideoOrderItem

**Files:**
- Modify: `src/lib/storage.ts:28-33`

- [ ] **Step 1: Update the interface**

In `src/lib/storage.ts`, replace lines 28–33:

```ts
export interface VideoOrderItem {
  id: string;       // e.g. `vid-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
  nodeId: string;   // source VideoNode ID
  url: string;      // snapshotted video URL at time of check
  label: string;    // snapshotted node label at time of check
  trimStart?: number; // ms from clip start, default 0
  trimEnd?: number;   // ms from clip start, default = full clip duration
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/storage.ts
git commit -m "feat: add trimStart/trimEnd to VideoOrderItem"
```

---

## Task 2: Add localVideoOrder state and trimmed duration calculation to SubtitleView

**Files:**
- Modify: `src/components/SubtitleView.tsx`

This task adds local state for video order and rewires `clipOffsets`/`totalMs` to use trimmed durations.

- [ ] **Step 1: Add onUpdateVideoOrder to Props interface**

In `SubtitleView.tsx`, replace the Props interface (lines 41–47):

```ts
interface Props {
  videoOrder: VideoOrderItem[];
  storyboardRows: StoryboardRow[];
  subtitles: SubtitleEntry[];
  projectName: string;
  onSaveSubtitles: (subtitles: SubtitleEntry[]) => void;
  onUpdateVideoOrder: (order: VideoOrderItem[]) => void;
}
```

- [ ] **Step 2: Add onUpdateVideoOrder to destructured props**

Replace the function signature line (line 59):

```ts
export default function SubtitleView({
  videoOrder,
  storyboardRows,
  subtitles,
  projectName,
  onSaveSubtitles,
  onUpdateVideoOrder,
}: Props) {
```

- [ ] **Step 3: Add localVideoOrder state after the existing state declarations**

After line 69 (`const videoRef = useRef<HTMLVideoElement>(null);`), add:

```ts
  // Local video order mirrors prop; updated during trim drag without persisting each pixel
  const [localVideoOrder, setLocalVideoOrder] = useState<VideoOrderItem[]>(videoOrder);
  useEffect(() => { setLocalVideoOrder(videoOrder); }, [videoOrder]);
```

- [ ] **Step 4: Update clipOffsets to use trimmed durations**

Replace the clipOffsets useEffect (lines 73–81):

```ts
  const clipOffsets = useRef<number[]>([]);
  useEffect(() => {
    const offsets: number[] = [];
    let acc = 0;
    for (let i = 0; i < clipDurations.length; i++) {
      offsets.push(acc);
      const item = localVideoOrder[i];
      const trimStart = item?.trimStart ?? 0;
      const trimEnd = item?.trimEnd ?? clipDurations[i];
      acc += Math.max(0, trimEnd - trimStart);
    }
    clipOffsets.current = offsets;
  }, [clipDurations, localVideoOrder]);
```

- [ ] **Step 5: Update totalMs to use trimmed durations**

Replace line 83:

```ts
  const totalMs = clipDurations.reduce((sum, dur, i) => {
    const item = localVideoOrder[i];
    const trimStart = item?.trimStart ?? 0;
    const trimEnd = item?.trimEnd ?? dur;
    return sum + Math.max(0, trimEnd - trimStart);
  }, 0);
```

- [ ] **Step 6: Commit**

```bash
git add src/components/SubtitleView.tsx
git commit -m "feat: add localVideoOrder state and trimmed duration calculation"
```

---

## Task 3: Update video playback to respect trim points

**Files:**
- Modify: `src/components/SubtitleView.tsx`

- [ ] **Step 1: Update handleTimeUpdate to auto-advance at trimEnd**

Replace `handleTimeUpdate` (lines 119–124):

```ts
  const handleTimeUpdate = useCallback(() => {
    const vid = videoRef.current;
    if (!vid) return;
    const item = localVideoOrder[currentClipIndex];
    const trimStartMs = item?.trimStart ?? 0;
    const trimEndSec = (item?.trimEnd ?? (clipDurations[currentClipIndex] ?? 0)) / 1000;
    // Auto-advance when video passes trimEnd
    if (trimEndSec > 0 && vid.currentTime >= trimEndSec) {
      if (currentClipIndex < localVideoOrder.length - 1) {
        setCurrentClipIndex(i => i + 1);
      } else {
        vid.pause();
        setIsPlaying(false);
      }
      return;
    }
    const offset = clipOffsets.current[currentClipIndex] ?? 0;
    setCurrentMs(offset + Math.round(vid.currentTime * 1000 - trimStartMs));
  }, [currentClipIndex, localVideoOrder, clipDurations]);
```

- [ ] **Step 2: Update handleEnded to use localVideoOrder.length**

Replace `handleEnded` (lines 126–132):

```ts
  const handleEnded = useCallback(() => {
    if (currentClipIndex < localVideoOrder.length - 1) {
      setCurrentClipIndex(i => i + 1);
    } else {
      setIsPlaying(false);
    }
  }, [currentClipIndex, localVideoOrder.length]);
```

- [ ] **Step 3: Update the clip-change useEffect to seek to trimStart**

Replace the useEffect at lines 135–140:

```ts
  // Reset video element when clip changes — seek to trimStart
  useEffect(() => {
    const vid = videoRef.current;
    if (!vid) return;
    const trimStartSec = (localVideoOrder[currentClipIndex]?.trimStart ?? 0) / 1000;
    vid.currentTime = trimStartSec;
    if (isPlaying) vid.play().catch(() => {});
  }, [currentClipIndex]); // eslint-disable-line react-hooks/exhaustive-deps
```

- [ ] **Step 4: Update seekToMs to account for trimStart**

Replace `seekToMs` (lines 150–167):

```ts
  const seekToMs = useCallback((ms: number) => {
    const offsets = clipOffsets.current;
    let targetClip = 0;
    for (let i = offsets.length - 1; i >= 0; i--) {
      if (ms >= offsets[i]) { targetClip = i; break; }
    }
    const localMs = ms - (offsets[targetClip] ?? 0);
    const trimStart = localVideoOrder[targetClip]?.trimStart ?? 0;
    const actualTimeSec = (trimStart + localMs) / 1000;
    if (targetClip !== currentClipIndex) {
      setCurrentClipIndex(targetClip);
      pendingSeek.current = localMs; // stored as local-ms; pending handler adds trimStart
    } else {
      const vid = videoRef.current;
      if (vid) vid.currentTime = actualTimeSec;
    }
    setCurrentMs(ms);
  }, [currentClipIndex, localVideoOrder]);
```

- [ ] **Step 5: Update pendingSeek useEffect to add trimStart**

Replace the pendingSeek useEffect (lines 170–179):

```ts
  useEffect(() => {
    if (pendingSeek.current !== null) {
      const vid = videoRef.current;
      if (vid) {
        const trimStart = localVideoOrder[currentClipIndex]?.trimStart ?? 0;
        vid.currentTime = (trimStart + pendingSeek.current) / 1000;
        if (isPlaying) vid.play().catch(() => {});
      }
      pendingSeek.current = null;
    }
  }, [currentClipIndex]); // eslint-disable-line react-hooks/exhaustive-deps
```

- [ ] **Step 6: Update currentClip to use localVideoOrder**

Replace line 422:

```ts
  const currentClip = localVideoOrder[currentClipIndex];
```

- [ ] **Step 7: Update top bar to use localVideoOrder.length**

Replace line 430:

```ts
        <span className="text-white/40 text-[13px]">{localVideoOrder.length} 个片段</span>
```

- [ ] **Step 8: Commit**

```bash
git add src/components/SubtitleView.tsx
git commit -m "feat: update playback to respect trimStart/trimEnd"
```

---

## Task 4: Add clip trim drag handles to the clip bar

**Files:**
- Modify: `src/components/SubtitleView.tsx`

- [ ] **Step 1: Add clipTrimDrag ref after the existing dragState ref (after line 254)**

After the `dragState` ref declaration, add:

```ts
  // Drag state for clip trim handles
  const clipTrimDrag = useRef<{
    id: string;
    side: 'left' | 'right';
    startX: number;
    origTrimStart: number;
    origTrimEnd: number;
    fullDuration: number;
  } | null>(null);
```

- [ ] **Step 2: Add handleClipTrimMouseDown function after handleSubBlockMouseDown**

After the `handleSubBlockMouseDown` function, add:

```ts
  const handleClipTrimMouseDown = (
    e: React.MouseEvent,
    item: VideoOrderItem,
    side: 'left' | 'right',
    clipIdx: number,
  ) => {
    e.stopPropagation();
    const fullDuration = clipDurations[clipIdx] ?? 0;
    clipTrimDrag.current = {
      id: item.id,
      side,
      startX: e.clientX,
      origTrimStart: item.trimStart ?? 0,
      origTrimEnd: item.trimEnd ?? fullDuration,
      fullDuration,
    };
  };
```

- [ ] **Step 3: Add useEffect for clip trim mouse events after the subtitle drag useEffect**

After the existing `useEffect` that handles subtitle drag (the one that ends around line 304), add:

```ts
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      const d = clipTrimDrag.current;
      if (!d) return;
      const dx = e.clientX - d.startX;
      const dMs = Math.round(dx * msPerPx);
      setLocalVideoOrder(prev => prev.map(item => {
        if (item.id !== d.id) return item;
        if (d.side === 'left') {
          const newTrimStart = Math.max(0, Math.min(d.origTrimStart + dMs, d.origTrimEnd - 1000));
          return { ...item, trimStart: newTrimStart };
        } else {
          const newTrimEnd = Math.min(d.fullDuration, Math.max(d.origTrimEnd + dMs, d.origTrimStart + 1000));
          return { ...item, trimEnd: newTrimEnd };
        }
      }));
    };
    const onUp = () => {
      if (!clipTrimDrag.current) return;
      clipTrimDrag.current = null;
      setLocalVideoOrder(prev => {
        onUpdateVideoOrder(prev);
        return prev;
      });
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [msPerPx, onUpdateVideoOrder]);
```

- [ ] **Step 4: Update clip bar rendering to use localVideoOrder with drag handles**

Replace the clip bar `{videoOrder.map(...)}` block (lines 601–620) with:

```tsx
              {localVideoOrder.map((item, i) => {
                const fullDuration = clipDurations[i] ?? 0;
                if (fullDuration === 0) return null;
                const trimStart = item.trimStart ?? 0;
                const trimEnd = item.trimEnd ?? fullDuration;
                const trimmedMs = Math.max(0, trimEnd - trimStart);
                const left = pxFromMs(clipOffsets.current[i] ?? 0);
                const width = pxFromMs(trimmedMs);
                const bg = i % 2 === 0 ? '#1e3a5f' : '#1a3350';
                return (
                  <div
                    key={item.id}
                    className="absolute top-1 bottom-1 rounded flex items-center overflow-hidden"
                    style={{ left, width, background: bg, borderRight: '1px solid rgba(255,255,255,0.06)' }}
                  >
                    {/* Left trim handle */}
                    <div
                      className="absolute left-0 top-0 bottom-0 w-2 cursor-ew-resize hover:bg-white/30 z-10"
                      onMouseDown={e => handleClipTrimMouseDown(e, item, 'left', i)}
                    />
                    {width > 30 && (
                      <span className="text-[10px] text-white/70 px-2 truncate select-none pointer-events-none">
                        {item.label || `片段 ${i + 1}`}
                      </span>
                    )}
                    {/* Right trim handle */}
                    <div
                      className="absolute right-0 top-0 bottom-0 w-2 cursor-ew-resize hover:bg-white/30 z-10"
                      onMouseDown={e => handleClipTrimMouseDown(e, item, 'right', i)}
                    />
                  </div>
                );
              })}
```

- [ ] **Step 5: Update thumbnail extraction to use localVideoOrder**

Replace line 366 (videoOrder.forEach inside the thumb extraction useEffect):

```ts
      localVideoOrder.forEach((item, i) => {
        if (clipDurations[i] > 0) {
          extractThumbsForClip(i, item.url, clipDurations[i]);
        }
      });
```

Also update the condition on line 365:
```ts
    if (clipDurations.length === localVideoOrder.length && totalMs > 0) {
```

- [ ] **Step 6: Update AI generate to use localVideoOrder**

Replace lines 378–379 in handleAIGenerate:

```ts
    if (localVideoOrder.length === 0) return;
    // ...
      for (const item of localVideoOrder) {
```

- [ ] **Step 7: Commit**

```bash
git add src/components/SubtitleView.tsx
git commit -m "feat: add clip bar trim drag handles"
```

---

## Task 5: Wire up onUpdateVideoOrder in App.tsx

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1: Pass onUpdateVideoOrder to SubtitleView**

In `src/App.tsx`, find the `<SubtitleView ...>` JSX block (around line 823). Replace it:

```tsx
        <SubtitleView
          videoOrder={videoOrder}
          storyboardRows={storyboardRows}
          subtitles={subtitles}
          projectName={projectName}
          onSaveSubtitles={(next) => {
            setSubtitles(next);
            onSaveSubtitles(next);
          }}
          onUpdateVideoOrder={(order) => {
            setVideoOrder(order);
            onSaveVideoOrder(order);
          }}
        />
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npm run build 2>&1 | head -20
```

Expected: no TypeScript errors.

- [ ] **Step 3: Commit**

```bash
git add src/App.tsx
git commit -m "feat: wire onUpdateVideoOrder to SubtitleView"
```

---

## Task 6: Install server-side ffmpeg dependencies

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install packages**

```bash
npm install fluent-ffmpeg @ffmpeg-installer/ffmpeg
npm install -D @types/fluent-ffmpeg
```

- [ ] **Step 2: Verify installation**

```bash
node -e "const ffmpegInstaller = require('@ffmpeg-installer/ffmpeg'); console.log(ffmpegInstaller.path);"
```

Expected: prints a path ending in `ffmpeg` or `ffmpeg.exe`.

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "feat: add fluent-ffmpeg and ffmpeg-installer deps"
```

---

## Task 7: Create the export-video server route

**Files:**
- Create: `server/routes/export-video.ts`

- [ ] **Step 1: Create the file**

Create `server/routes/export-video.ts` with this content:

```ts
import { Router } from 'express';
import type { Request, Response } from 'express';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';
import { promises as fs, createWriteStream } from 'fs';
import path from 'path';
import os from 'os';
import https from 'https';
import http from 'http';
import { randomUUID } from 'crypto';

ffmpeg.setFfmpegPath(ffmpegInstaller.path);

interface VideoOrderItem {
  id: string;
  url: string;
  trimStart?: number;
  trimEnd?: number;
}

interface SubtitleEntry {
  id: string;
  startMs: number;
  endMs: number;
  text: string;
}

function msToSRTTime(ms: number): string {
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  const msRem = ms % 1000;
  return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')},${String(msRem).padStart(3,'0')}`;
}

function generateSRT(subtitles: SubtitleEntry[]): string {
  const sorted = [...subtitles].sort((a, b) => a.startMs - b.startMs);
  return sorted.map((s, i) =>
    `${i + 1}\n${msToSRTTime(s.startMs)} --> ${msToSRTTime(s.endMs)}\n${s.text}`
  ).join('\n\n');
}

function downloadFile(url: string, dest: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const file = createWriteStream(dest);
    const client = url.startsWith('https') ? https : http;
    const req = client.get(url, (res) => {
      if (res.statusCode && res.statusCode >= 400) {
        reject(new Error(`Download failed: HTTP ${res.statusCode} for ${url}`));
        return;
      }
      res.pipe(file);
      file.on('finish', () => { file.close(); resolve(); });
    });
    req.on('error', (err) => {
      fs.unlink(dest).catch(() => {});
      reject(err);
    });
  });
}

function trimClip(input: string, output: string, startSec: number, durationSec: number): Promise<void> {
  return new Promise((resolve, reject) => {
    ffmpeg(input)
      .inputOptions([`-ss ${startSec}`])
      .outputOptions([`-t ${durationSec}`])
      .videoCodec('libx264')
      .audioCodec('aac')
      .outputOptions(['-vf scale=trunc(iw/2)*2:trunc(ih/2)*2'])
      .output(output)
      .on('end', () => resolve())
      .on('error', (err) => reject(err))
      .run();
  });
}

function copyClip(input: string, output: string): Promise<void> {
  return new Promise((resolve, reject) => {
    ffmpeg(input)
      .videoCodec('libx264')
      .audioCodec('aac')
      .outputOptions(['-vf scale=trunc(iw/2)*2:trunc(ih/2)*2'])
      .output(output)
      .on('end', () => resolve())
      .on('error', (err) => reject(err))
      .run();
  });
}

function concatClips(concatFile: string, output: string): Promise<void> {
  return new Promise((resolve, reject) => {
    ffmpeg()
      .input(concatFile)
      .inputOptions(['-f concat', '-safe 0'])
      .videoCodec('copy')
      .audioCodec('copy')
      .output(output)
      .on('end', () => resolve())
      .on('error', (err) => reject(err))
      .run();
  });
}

function concatAndBurnSubs(concatFile: string, srtFile: string, output: string): Promise<void> {
  // Escape path for ffmpeg filter (handle colons, backslashes on Windows)
  const escapedSrt = srtFile.replace(/\\/g, '/').replace(/:/g, '\\\\:');
  return new Promise((resolve, reject) => {
    ffmpeg()
      .input(concatFile)
      .inputOptions(['-f concat', '-safe 0'])
      .videoCodec('libx264')
      .audioCodec('aac')
      .outputOptions([`-vf subtitles='${escapedSrt}'`])
      .output(output)
      .on('end', () => resolve())
      .on('error', (err) => reject(err))
      .run();
  });
}

const router = Router();

router.post('/', async (req: Request, res: Response) => {
  const tmpDir = path.join(os.tmpdir(), `export-${randomUUID()}`);
  await fs.mkdir(tmpDir, { recursive: true });

  try {
    const { videoOrder, subtitles, totalMs } = req.body as {
      videoOrder: VideoOrderItem[];
      subtitles: SubtitleEntry[];
      totalMs: number;
    };

    if (!Array.isArray(videoOrder) || videoOrder.length === 0) {
      await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
      return res.status(400).json({ error: '没有视频片段' });
    }

    // Step 1: download and normalize/trim each clip
    const trimmedPaths: string[] = [];
    for (let i = 0; i < videoOrder.length; i++) {
      const item = videoOrder[i];
      const rawPath = path.join(tmpDir, `clip-${i}-raw.mp4`);
      const normalizedPath = path.join(tmpDir, `clip-${i}-norm.mp4`);

      console.log(`[export] downloading clip ${i + 1}/${videoOrder.length}: ${item.url}`);
      await downloadFile(item.url, rawPath);

      const trimStart = item.trimStart ?? 0;
      const trimEnd = item.trimEnd;

      if (trimStart > 0 || trimEnd !== undefined) {
        const startSec = trimStart / 1000;
        // Use a large fallback duration if trimEnd is not set (ffmpeg stops at EOF)
        const durationSec = trimEnd !== undefined
          ? (trimEnd - trimStart) / 1000
          : 99999;
        console.log(`[export] trimming clip ${i + 1}: start=${startSec}s duration=${durationSec}s`);
        await trimClip(rawPath, normalizedPath, startSec, durationSec);
      } else {
        console.log(`[export] normalizing clip ${i + 1} (no trim)`);
        await copyClip(rawPath, normalizedPath);
      }

      trimmedPaths.push(normalizedPath);
    }

    // Step 2: write concat list
    const concatFile = path.join(tmpDir, 'concat.txt');
    const concatContent = trimmedPaths.map(p => `file '${p.replace(/\\/g, '/')}'`).join('\n');
    await fs.writeFile(concatFile, concatContent, 'utf8');

    // Step 3: generate SRT from subtitles within range
    const filteredSubs = (subtitles ?? []).filter(s => s.startMs < totalMs);
    const srtFile = path.join(tmpDir, 'subtitles.srt');
    await fs.writeFile(srtFile, generateSRT(filteredSubs), 'utf8');

    // Step 4: concat + (optionally) burn subtitles
    const outputFile = path.join(tmpDir, 'output.mp4');
    if (filteredSubs.length > 0) {
      console.log(`[export] concatenating ${trimmedPaths.length} clips with ${filteredSubs.length} subtitles`);
      await concatAndBurnSubs(concatFile, srtFile, outputFile);
    } else {
      console.log(`[export] concatenating ${trimmedPaths.length} clips (no subtitles)`);
      await concatClips(concatFile, outputFile);
    }

    // Step 5: stream as download, then cleanup
    const filename = `export-${Date.now()}.mp4`;
    res.download(outputFile, filename, async (err) => {
      if (err && !res.headersSent) {
        console.error('[export] download error', err);
      }
      await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
    });

  } catch (err) {
    console.error('[export] error:', err);
    await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
    if (!res.headersSent) {
      res.status(500).json({ error: String(err) });
    }
  }
});

export default router;
```

- [ ] **Step 2: Commit**

```bash
git add server/routes/export-video.ts
git commit -m "feat: add export-video server route"
```

---

## Task 8: Register the export-video route in server/index.ts

**Files:**
- Modify: `server/index.ts`

- [ ] **Step 1: Add import after existing route imports (after line 12)**

After line 12 (`import subtitleGenerateRouter from './routes/subtitle-generate.js';`), add:

```ts
import exportVideoRouter from './routes/export-video.js';
```

- [ ] **Step 2: Register the route (after line 40)**

After `app.use('/api/subtitle-generate', subtitleGenerateRouter);`, add:

```ts
app.use('/api/export-video', exportVideoRouter);
```

- [ ] **Step 3: Commit**

```bash
git add server/index.ts
git commit -m "feat: register /api/export-video route"
```

---

## Task 9: Add "导出视频" button and export logic to SubtitleView

**Files:**
- Modify: `src/components/SubtitleView.tsx`

- [ ] **Step 1: Add exporting state after the aiLoading state (around line 375)**

After `const [aiLoading, setAiLoading] = useState(false);`, add:

```ts
  const [exporting, setExporting] = useState(false);
```

- [ ] **Step 2: Add handleExportVideo function after handleAIGenerate**

After the closing `};` of `handleAIGenerate`, add:

```ts
  const handleExportVideo = async () => {
    if (localVideoOrder.length === 0 || totalMs === 0) return;
    setExporting(true);
    try {
      const resp = await fetch('/api/export-video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          videoOrder: localVideoOrder,
          subtitles: localSubs,
          totalMs,
        }),
      });
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ error: 'unknown' }));
        alert(`导出失败：${err.error}`);
        return;
      }
      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `export-${Date.now()}.mp4`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      alert(`导出出错：${String(err)}`);
    } finally {
      setExporting(false);
    }
  };
```

- [ ] **Step 3: Add the export button in the top bar**

In the top bar JSX (around line 442–448), after the "导出 SRT" button, add:

```tsx
        <button
          onClick={handleExportVideo}
          disabled={exporting || localVideoOrder.length === 0 || totalMs === 0}
          className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-emerald-700/80 hover:bg-emerald-700 disabled:opacity-40 text-[13px] font-medium border border-white/10 transition-colors"
        >
          {exporting ? '导出中…' : '导出视频'}
        </button>
```

- [ ] **Step 4: Verify TypeScript builds without errors**

```bash
npm run build 2>&1 | head -30
```

Expected: build succeeds with no TypeScript errors.

- [ ] **Step 5: Commit**

```bash
git add src/components/SubtitleView.tsx
git commit -m "feat: add export video button to subtitle editor"
```

---

## Task 10: Local test then push and deploy

- [ ] **Step 1: Run local dev server**

```bash
npm run dev
```

Open `http://localhost:3000` in browser.

- [ ] **Step 2: Manual smoke test — clip trimming**

1. Open a project with video clips in 字幕编辑 view
2. Verify clip bar blocks display correctly
3. Drag the right edge of a clip block leftward — block should shrink and total duration should decrease
4. Drag the left edge rightward — same behavior from the other side
5. Confirm minimum width limit (1 second) prevents handles from crossing

- [ ] **Step 3: Manual smoke test — video export**

1. Click "导出视频" button
2. Button shows "导出中…" while processing
3. Browser triggers `.mp4` download when done
4. Open downloaded file — confirms clips are trimmed correctly and subtitles appear

- [ ] **Step 4: Push to GitHub**

```bash
git push origin main
```

- [ ] **Step 5: Deploy to server**

```bash
ssh root@218.244.158.35 "cd /home/HJM-aigc-flow && git pull origin main && npm install && npm run build 2>&1 | tail -5 && pm2 restart aigc-flow"
```

Note: `npm install` is needed because `fluent-ffmpeg` and `@ffmpeg-installer/ffmpeg` are new dependencies.

- [ ] **Step 6: Verify server is running**

```bash
ssh root@218.244.158.35 "pm2 status aigc-flow"
```

Expected: status shows `online`.
