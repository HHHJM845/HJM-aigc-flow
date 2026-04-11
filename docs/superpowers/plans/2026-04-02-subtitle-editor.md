# Subtitle Editor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "字幕编辑" tab that lets users manually create/position subtitle blocks on a video timeline, edit text, AI-generate lines from script + frames, and export SRT.

**Architecture:** New `SubtitleView` component manages all subtitle state locally and persists via `onSave` callback — same pattern as `VideoView`. The `Project` model gains a `subtitles: SubtitleEntry[]` field (backwards-compatible default `[]`). A new Express route `/api/subtitle-generate` calls Doubao Vision Pro 32k with captured key frames and script text.

**Tech Stack:** React 19 + TypeScript + Tailwind CSS v4, Express.js, Doubao Vision Pro 32k (`doubao-vision-pro-32k`) via Volcengine ARK API, Canvas API for frame extraction, browser Blob API for SRT download.

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `src/lib/storage.ts` | Modify | Add `SubtitleEntry` interface + `Project.subtitles` field |
| `src/components/BottomTabBar.tsx` | Modify | Add `'subtitle'` to `ActiveView`, add tab |
| `server/routes/subtitle-generate.ts` | Create | Call Doubao Vision Pro, return subtitle text lines |
| `server/index.ts` | Modify | Register `/api/subtitle-generate` route |
| `src/components/SubtitleView.tsx` | Create | Complete subtitle editor (video, list, timeline, AI, SRT) |
| `src/App.tsx` | Modify | Import SubtitleView, add state/handlers/render block/props |

---

## Task 1: Data Layer — storage.ts

**Files:**
- Modify: `src/lib/storage.ts`

- [ ] **Step 1: Add `SubtitleEntry` interface and `subtitles` field to `Project`**

Open `src/lib/storage.ts`. After the `VideoOrderItem` interface (line 26), insert:

```typescript
export interface SubtitleEntry {
  id: string;
  startMs: number;   // ms from start of concatenated timeline
  endMs: number;
  text: string;
}
```

Then in the `Project` interface, add `subtitles` after `videoOrder`:

```typescript
export interface Project {
  id: string;
  name: string;
  thumbnail?: string;
  createdAt: number;
  updatedAt: number;
  storyboardRows: StoryboardRow[];
  nodes: Node[];
  edges: Edge[];
  assets: AssetItem[];
  generationHistory: HistoryItem[];
  storyboardOrder: string[];
  videoOrder: VideoOrderItem[];
  subtitles: SubtitleEntry[];   // ← new
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run:
```bash
npm run lint
```
Expected: no errors (existing code never accesses `subtitles`, so no breakage). If you see "'subtitles' does not exist on type 'Project'" errors in App.tsx they'll be resolved in Task 5.

- [ ] **Step 3: Commit**

```bash
git add src/lib/storage.ts
git commit -m "feat: add SubtitleEntry type and Project.subtitles field"
```

---

## Task 2: Navigation — BottomTabBar.tsx

**Files:**
- Modify: `src/components/BottomTabBar.tsx`

- [ ] **Step 1: Export `ActiveView` and add `'subtitle'` tab**

Replace the entire file content:

```tsx
import React from 'react';

export type ActiveView = 'canvas' | 'storyboard' | 'breakdown' | 'video' | 'subtitle';

interface Props {
  activeView: ActiveView;
  onViewChange: (view: ActiveView) => void;
}

export default function BottomTabBar({ activeView, onViewChange }: Props) {
  const tabs: { key: ActiveView; label: string }[] = [
    { key: 'breakdown', label: '剧本拆解' },
    { key: 'canvas', label: '无限画布' },
    { key: 'storyboard', label: '分镜管理' },
    { key: 'video', label: '视频管理' },
    { key: 'subtitle', label: '字幕编辑' },
  ];

  return (
    <div
      className="absolute bottom-5 left-1/2 -translate-x-1/2 z-50 flex items-center gap-1 p-1 rounded-full border border-white/10 shadow-2xl"
      style={{ background: 'rgba(28,28,28,0.92)', backdropFilter: 'blur(12px)' }}
    >
      {tabs.map(({ key, label }) => (
        <button
          key={key}
          onClick={() => onViewChange(key)}
          className={`px-5 py-1.5 rounded-full text-[13px] font-medium transition-all duration-200 ${
            activeView === key
              ? 'bg-white/15 text-white'
              : 'text-white/40 hover:text-white/70'
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Verify**

```bash
npm run lint
```
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/BottomTabBar.tsx
git commit -m "feat: add subtitle tab to bottom nav"
```

---

## Task 3: Backend Route — subtitle-generate

**Files:**
- Create: `server/routes/subtitle-generate.ts`
- Modify: `server/index.ts`

- [ ] **Step 1: Create `server/routes/subtitle-generate.ts`**

```typescript
import { Router } from 'express';

const router = Router();
const ARK_BASE = 'https://ark.cn-beijing.volces.com/api/v3';
const VISION_MODEL = 'doubao-vision-pro-32k';

router.post('/', async (req, res, next) => {
  try {
    const { frames, storyboardText } = req.body as {
      frames: string[];
      storyboardText: string;
    };

    if (!Array.isArray(frames) || frames.length === 0) {
      return res.status(400).json({ error: '请提供视频关键帧' });
    }

    const apiKey = process.env.IMAGE_API_KEY;
    if (!apiKey) return res.status(500).json({ error: '服务端未配置 IMAGE_API_KEY' });

    console.log('[subtitle-generate] frames:', frames.length, 'model:', VISION_MODEL);

    const upstream = await fetch(`${ARK_BASE}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: VISION_MODEL,
        messages: [
          {
            role: 'user',
            content: [
              ...frames.map((f: string) => ({
                type: 'image_url',
                image_url: { url: f },
              })),
              {
                type: 'text',
                text: `以下是视频关键帧和对应剧本内容：\n${storyboardText}\n\n请根据画面和剧本生成人物对话字幕。每行一句，格式严格为"角色名：台词"，不含序号、时间码或其他内容。`,
              },
            ],
          },
        ],
        max_tokens: 1024,
      }),
    });

    if (!upstream.ok) {
      const text = await upstream.text();
      console.error('[subtitle-generate] upstream error:', upstream.status, text);
      return res.status(upstream.status).json({
        error: `字幕生成失败(${upstream.status}): ${text.slice(0, 300)}`,
      });
    }

    const json = await upstream.json() as {
      choices?: { message?: { content?: string } }[];
    };
    const content = json.choices?.[0]?.message?.content?.trim() || '';
    const subtitles = content
      .split('\n')
      .map((line: string) => line.trim())
      .filter(Boolean);

    res.json({ subtitles });
  } catch (err) {
    next(err);
  }
});

export default router;
```

- [ ] **Step 2: Register the route in `server/index.ts`**

Add the import after the existing imports (after `analyzeRouter` line):

```typescript
import subtitleGenerateRouter from './routes/subtitle-generate.js';
```

Add the route registration after `app.use('/api/analyze', analyzeRouter);`:

```typescript
app.use('/api/subtitle-generate', subtitleGenerateRouter);
```

- [ ] **Step 3: Verify**

```bash
npm run lint
```
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add server/routes/subtitle-generate.ts server/index.ts
git commit -m "feat: add /api/subtitle-generate route using Doubao Vision Pro"
```

---

## Task 4: SubtitleView Component

**Files:**
- Create: `src/components/SubtitleView.tsx`

This is the main deliverable. Write the complete file in one step.

- [ ] **Step 1: Create `src/components/SubtitleView.tsx`**

```tsx
import React, { useState, useRef, useEffect, useCallback } from 'react';
import type { VideoOrderItem, SubtitleEntry } from '../lib/storage';
import type { StoryboardRow } from '../lib/api';

interface Props {
  videoOrder: VideoOrderItem[];
  storyboardRows: StoryboardRow[];
  initialSubtitles: SubtitleEntry[];
  projectName: string;
  onSave: (subtitles: SubtitleEntry[]) => void;
}

function newId() {
  return `sub_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

function msToDisplay(ms: number): string {
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  const rem = ms % 1000;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')},${String(rem).padStart(3, '0')}`;
}

function exportSRT(subtitles: SubtitleEntry[], projectName: string) {
  const sorted = [...subtitles].sort((a, b) => a.startMs - b.startMs);
  const lines = sorted.map((s, i) =>
    `${i + 1}\n${msToDisplay(s.startMs)} --> ${msToDisplay(s.endMs)}\n${s.text}`
  );
  const blob = new Blob([lines.join('\n\n')], { type: 'text/plain' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `字幕_${projectName}.srt`;
  a.click();
}

export default function SubtitleView({
  videoOrder,
  storyboardRows,
  initialSubtitles,
  projectName,
  onSave,
}: Props) {
  const [subtitles, setSubtitles] = useState<SubtitleEntry[]>(initialSubtitles);
  const [currentClipIndex, setCurrentClipIndex] = useState(0);
  const [clipDurations, setClipDurations] = useState<number[]>([]);
  const [currentMs, setCurrentMs] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [activeSubtitleId, setActiveSubtitleId] = useState<string | null>(null);
  const [isEditingOverlay, setIsEditingOverlay] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [thumbnails, setThumbnails] = useState<string[][]>([]);

  const videoRef = useRef<HTMLVideoElement>(null);
  const timelineRef = useRef<HTMLDivElement>(null);

  // Drag state for subtitle blocks on timeline
  const dragState = useRef<{
    type: 'move' | 'left' | 'right';
    subtitleId: string;
    startX: number;
    startMs: number;
    startEndMs: number;
  } | null>(null);

  // Derived: cumulative clip offsets and total duration
  const clipOffsets: number[] = [];
  let totalMsAcc = 0;
  for (const d of clipDurations) {
    clipOffsets.push(totalMsAcc);
    totalMsAcc += d;
  }
  const totalMs = totalMsAcc;

  const activeSubtitle = subtitles.find(s => s.id === activeSubtitleId) ?? null;
  const currentOverlaySubtitle =
    subtitles.find(s => s.startMs <= currentMs && s.endMs >= currentMs) ?? null;

  const saveSubtitles = useCallback(
    (next: SubtitleEntry[]) => {
      setSubtitles(next);
      onSave(next);
    },
    [onSave]
  );

  // ── px ↔ ms helpers ──────────────────────────────────────
  const msFromPx = useCallback(
    (px: number): number => {
      if (!timelineRef.current || totalMs === 0) return 0;
      return (px / timelineRef.current.clientWidth) * totalMs;
    },
    [totalMs]
  );

  // ── Seek to global ms ────────────────────────────────────
  const seekToMs = useCallback(
    (ms: number) => {
      if (clipDurations.length === 0) return;
      // Recompute offsets locally (clipOffsets above is a render-time value)
      const offsets: number[] = [];
      let acc = 0;
      for (const d of clipDurations) {
        offsets.push(acc);
        acc += d;
      }
      let idx = 0;
      for (let i = offsets.length - 1; i >= 0; i--) {
        if (ms >= offsets[i]) { idx = i; break; }
      }
      const localMs = ms - (offsets[idx] ?? 0);
      if (idx !== currentClipIndex) {
        setCurrentClipIndex(idx);
        // video src will be set by the useEffect below; seek after load
        setTimeout(() => {
          if (videoRef.current) videoRef.current.currentTime = localMs / 1000;
        }, 250);
      } else {
        if (videoRef.current) videoRef.current.currentTime = localMs / 1000;
      }
      setCurrentMs(ms);
    },
    [clipDurations, currentClipIndex]
  );

  // ── Video event handlers ──────────────────────────────────
  const handleTimeUpdate = useCallback(() => {
    const el = videoRef.current;
    if (!el) return;
    const offset = clipOffsets[currentClipIndex] ?? 0;
    setCurrentMs(offset + Math.round(el.currentTime * 1000));
  }, [currentClipIndex, clipOffsets]);

  const handleVideoEnded = useCallback(() => {
    if (currentClipIndex < videoOrder.length - 1) {
      setCurrentClipIndex(prev => prev + 1);
    } else {
      setIsPlaying(false);
    }
  }, [currentClipIndex, videoOrder.length]);

  // When clip index changes, load the new video src
  useEffect(() => {
    const el = videoRef.current;
    if (!el || !videoOrder[currentClipIndex]) return;
    el.src = videoOrder[currentClipIndex].url;
    el.load();
    if (isPlaying) el.play().catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentClipIndex]);

  // ── Frame extraction ──────────────────────────────────────
  async function captureFrame(videoEl: HTMLVideoElement, timeSec: number): Promise<string> {
    return new Promise(resolve => {
      const canvas = document.createElement('canvas');
      canvas.width = 160;
      canvas.height = 90;
      const ctx = canvas.getContext('2d')!;
      const onSeeked = () => {
        ctx.drawImage(videoEl, 0, 0, 160, 90);
        resolve(canvas.toDataURL('image/jpeg', 0.7));
        videoEl.removeEventListener('seeked', onSeeked);
      };
      videoEl.addEventListener('seeked', onSeeked);
      videoEl.currentTime = timeSec;
    });
  }

  async function extractThumbnails(videoEl: HTMLVideoElement, clipIndex: number) {
    const dur = videoEl.duration;
    if (!dur || dur === Infinity) return;
    const tw = timelineRef.current?.clientWidth ?? 800;
    const count = Math.max(4, Math.ceil(tw / 80));
    const frames: string[] = [];
    for (let i = 0; i < count; i++) {
      const t = ((i + 0.5) / count) * dur;
      const frame = await captureFrame(videoEl, t);
      frames.push(frame);
    }
    setThumbnails(prev => {
      const next = [...prev];
      next[clipIndex] = frames;
      return next;
    });
    // Restore playback position
    if (videoEl === videoRef.current) {
      const localMs = currentMs - (clipOffsets[currentClipIndex] ?? 0);
      videoEl.currentTime = Math.max(0, localMs / 1000);
    }
  }

  const handleLoadedMetadata = useCallback(
    (index: number) => {
      const el = videoRef.current;
      if (!el) return;
      setClipDurations(prev => {
        const next = [...prev];
        next[index] = Math.round(el.duration * 1000);
        return next;
      });
      extractThumbnails(el, index);
    },
    // extractThumbnails is stable (defined in component body, uses refs)
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const togglePlay = () => {
    const el = videoRef.current;
    if (!el) return;
    if (isPlaying) { el.pause(); setIsPlaying(false); }
    else { el.play().catch(() => {}); setIsPlaying(true); }
  };

  // ── Subtitle CRUD ─────────────────────────────────────────
  const addSubtitle = useCallback(
    (atMs?: number) => {
      const start = Math.max(0, atMs ?? currentMs);
      const entry: SubtitleEntry = { id: newId(), startMs: start, endMs: start + 3000, text: '' };
      const next = [...subtitles, entry];
      saveSubtitles(next);
      setActiveSubtitleId(entry.id);
      setTimeout(() => {
        const input = document.querySelector(
          `[data-subtitle-id="${entry.id}"] input`
        ) as HTMLInputElement | null;
        if (input) input.focus();
      }, 60);
    },
    [currentMs, subtitles, saveSubtitles]
  );

  const updateSubtitleText = useCallback(
    (id: string, text: string) => {
      saveSubtitles(subtitles.map(s => (s.id === id ? { ...s, text } : s)));
    },
    [subtitles, saveSubtitles]
  );

  const deleteSubtitle = useCallback(
    (id: string) => {
      saveSubtitles(subtitles.filter(s => s.id !== id));
      if (activeSubtitleId === id) setActiveSubtitleId(null);
    },
    [subtitles, saveSubtitles, activeSubtitleId]
  );

  // ── Timeline drag ─────────────────────────────────────────
  const handleBlockMouseDown = useCallback(
    (e: React.MouseEvent, id: string, type: 'move' | 'left' | 'right') => {
      e.stopPropagation();
      const sub = subtitles.find(s => s.id === id);
      if (!sub) return;
      dragState.current = {
        type,
        subtitleId: id,
        startX: e.clientX,
        startMs: sub.startMs,
        startEndMs: sub.endMs,
      };
    },
    [subtitles]
  );

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      const ds = dragState.current;
      if (!ds || !timelineRef.current || totalMs === 0) return;
      const dx = e.clientX - ds.startX;
      const dms = (dx / timelineRef.current.clientWidth) * totalMs;
      setSubtitles(prev =>
        prev.map(s => {
          if (s.id !== ds.subtitleId) return s;
          if (ds.type === 'move') {
            const dur = ds.startEndMs - ds.startMs;
            const newStart = Math.max(0, Math.min(totalMs - dur, ds.startMs + dms));
            return { ...s, startMs: Math.round(newStart), endMs: Math.round(newStart + dur) };
          }
          if (ds.type === 'left') {
            const newStart = Math.max(0, Math.min(ds.startEndMs - 500, ds.startMs + dms));
            return { ...s, startMs: Math.round(newStart) };
          }
          // right
          const newEnd = Math.max(ds.startMs + 500, Math.min(totalMs, ds.startEndMs + dms));
          return { ...s, endMs: Math.round(newEnd) };
        })
      );
    };
    const onUp = () => {
      if (dragState.current) {
        dragState.current = null;
        // Persist final positions after drag
        setSubtitles(prev => { onSave(prev); return prev; });
      }
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    return () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
  }, [totalMs, onSave]);

  // ── Timeline click handlers ───────────────────────────────
  const handleTrackClick = useCallback(
    (e: React.MouseEvent) => {
      if (!timelineRef.current || totalMs === 0) return;
      const target = e.target as HTMLElement;
      if (target.closest('[data-sub-block]')) return;
      const rect = timelineRef.current.getBoundingClientRect();
      const px = e.clientX - rect.left;
      addSubtitle(Math.round(msFromPx(px)));
    },
    [addSubtitle, msFromPx, totalMs]
  );

  const handleRulerClick = useCallback(
    (e: React.MouseEvent) => {
      if (!timelineRef.current || totalMs === 0) return;
      const rect = timelineRef.current.getBoundingClientRect();
      const px = e.clientX - rect.left;
      seekToMs(Math.round(msFromPx(px)));
    },
    [seekToMs, msFromPx, totalMs]
  );

  // ── AI generation ─────────────────────────────────────────
  const handleGenerateSubtitles = async () => {
    if (isGenerating) return;
    setIsGenerating(true);
    try {
      const frames: string[] = [];
      for (let i = 0; i < videoOrder.length; i++) {
        const dur = (clipDurations[i] ?? 0) / 1000;
        if (dur <= 0) continue;
        const tempVid = document.createElement('video');
        tempVid.src = videoOrder[i].url;
        tempVid.crossOrigin = 'anonymous';
        tempVid.muted = true;
        await new Promise<void>(r => {
          tempVid.onloadedmetadata = () => r();
          tempVid.load();
        });
        frames.push(await captureFrame(tempVid, tempVid.duration * 0.25));
        frames.push(await captureFrame(tempVid, tempVid.duration * 0.75));
      }
      const storyboardText = storyboardRows
        .map(r => `[镜头${r.index}] ${r.description || ''}`)
        .join('\n');
      const res = await fetch('/api/subtitle-generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ frames, storyboardText }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: { subtitles: string[] } = await res.json();
      const newEntries: SubtitleEntry[] = (data.subtitles ?? [])
        .filter(Boolean)
        .map(text => ({ id: newId(), startMs: 0, endMs: 3000, text }));
      saveSubtitles([...subtitles, ...newEntries]);
    } catch (err) {
      console.error('[subtitle-generate]', err);
    } finally {
      setIsGenerating(false);
    }
  };

  // ── Ruler marks ───────────────────────────────────────────
  const rulerMarks: { ms: number; label: string; major: boolean }[] = [];
  if (totalMs > 0) {
    const intervals = [1000, 2000, 5000, 10000, 30000, 60000, 300000];
    const tw = timelineRef.current?.clientWidth ?? 800;
    const targetCount = tw / 80;
    let interval = intervals[intervals.length - 1];
    for (const iv of intervals) {
      if (totalMs / iv <= targetCount * 2) { interval = iv; break; }
    }
    for (let ms = 0; ms <= totalMs; ms += interval / 2) {
      const major = ms % interval === 0;
      const m = Math.floor(ms / 60000);
      const s = Math.floor((ms % 60000) / 1000);
      rulerMarks.push({
        ms,
        label: `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`,
        major,
      });
    }
  }

  const playheadPct = totalMs > 0 ? (currentMs / totalMs) * 100 : 0;

  // ── Empty state ───────────────────────────────────────────
  if (videoOrder.length === 0) {
    return (
      <div className="absolute inset-0 flex items-center justify-center bg-[#0e0e0e]">
        <p className="text-white/30 text-sm">请先在「视频管理」中添加视频片段</p>
      </div>
    );
  }

  // ── Render ────────────────────────────────────────────────
  return (
    <div
      className="absolute inset-0 flex flex-col bg-[#0e0e0e] overflow-hidden"
      style={{ paddingBottom: 56 }}
    >
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-white/[0.06] flex-shrink-0">
        <div className="flex items-center gap-3">
          <span className="text-[13px] font-medium text-white">字幕编辑</span>
          <span className="text-[11px] text-white/30">
            {videoOrder.length}个片段 · 共 {msToDisplay(totalMs)}
          </span>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleGenerateSubtitles}
            disabled={isGenerating}
            className="px-3 py-1 rounded-md text-[11px] text-white disabled:opacity-50 cursor-pointer"
            style={{ background: 'linear-gradient(135deg, #7c3aed, #4f46e5)' }}
          >
            {isGenerating ? '生成中…' : '✨ AI 生成字幕'}
          </button>
          <button
            onClick={() => exportSRT(subtitles, projectName)}
            className="px-3 py-1 rounded-md text-[11px] text-white/70 cursor-pointer"
            style={{ background: 'rgba(255,255,255,0.08)' }}
          >
            导出 SRT
          </button>
        </div>
      </div>

      {/* Main area */}
      <div className="flex flex-1 overflow-hidden min-h-0">
        {/* Video panel */}
        <div className="flex-[1.5] flex flex-col border-r border-white/[0.06] min-h-0">
          <div className="flex-1 bg-[#050505] flex items-center justify-center min-h-0">
            <div
              className="relative"
              style={{
                width: '88%',
                aspectRatio: '16/9',
                background: '#111',
                borderRadius: 6,
                overflow: 'hidden',
              }}
            >
              <video
                ref={videoRef}
                className="w-full h-full object-contain"
                src={videoOrder[currentClipIndex]?.url}
                onLoadedMetadata={() => handleLoadedMetadata(currentClipIndex)}
                onTimeUpdate={handleTimeUpdate}
                onEnded={handleVideoEnded}
                onPlay={() => setIsPlaying(true)}
                onPause={() => setIsPlaying(false)}
                playsInline
              />
              {/* Subtitle overlay */}
              <div className="absolute bottom-[6%] left-1/2 -translate-x-1/2 w-[86%] text-center">
                {currentOverlaySubtitle &&
                  (isEditingOverlay && activeSubtitle?.id === currentOverlaySubtitle.id ? (
                    <textarea
                      autoFocus
                      className="bg-black/85 text-white px-5 py-2 rounded text-[17px] font-medium text-center w-full resize-none outline-none"
                      value={activeSubtitle.text}
                      rows={2}
                      onChange={e => updateSubtitleText(activeSubtitle.id, e.target.value)}
                      onBlur={() => setIsEditingOverlay(false)}
                    />
                  ) : (
                    <span
                      className="inline-block bg-black/85 text-white px-5 py-2 rounded text-[17px] font-medium cursor-text"
                      onClick={() => {
                        setActiveSubtitleId(currentOverlaySubtitle.id);
                        setIsEditingOverlay(true);
                      }}
                    >
                      {currentOverlaySubtitle.text || (
                        <span className="opacity-30">（无字幕文字）</span>
                      )}
                    </span>
                  ))}
              </div>
            </div>
          </div>

          {/* Video controls */}
          <div className="flex items-center gap-2 px-3 py-1.5 bg-[#0d0d0d] border-t border-white/[0.05] flex-shrink-0">
            <button
              onClick={togglePlay}
              className="w-6 h-6 bg-white/10 rounded-full flex items-center justify-center text-[10px] flex-shrink-0 cursor-pointer"
            >
              {isPlaying ? '⏸' : '▶'}
            </button>
            <span className="text-[11px] text-white/40 font-mono">{msToDisplay(currentMs)}</span>
            <div
              className="flex-1 h-[3px] bg-[#2a2a2a] rounded-sm relative cursor-pointer"
              onClick={e => {
                const rect = e.currentTarget.getBoundingClientRect();
                seekToMs(Math.round(((e.clientX - rect.left) / rect.width) * totalMs));
              }}
            >
              <div
                className="h-full bg-white/60 rounded-sm"
                style={{ width: `${playheadPct}%` }}
              />
              <div
                className="absolute top-1/2 w-2.5 h-2.5 bg-white rounded-full pointer-events-none"
                style={{ left: `${playheadPct}%`, transform: 'translate(-50%, -50%)' }}
              />
            </div>
            <span className="text-[11px] text-white/40 font-mono">{msToDisplay(totalMs)}</span>
          </div>
        </div>

        {/* Subtitle list panel */}
        <div className="w-[270px] flex flex-col min-h-0 flex-shrink-0">
          <div className="flex items-center justify-between px-3 py-2 border-b border-white/[0.06] flex-shrink-0">
            <span className="text-[11px] text-white/40">
              字幕列表 · {subtitles.length}条
            </span>
            <button
              onClick={() => addSubtitle()}
              className="text-white/40 hover:text-white/70 text-lg leading-none cursor-pointer"
            >
              ＋
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-2 flex flex-col gap-1">
            {[...subtitles].sort((a, b) => a.startMs - b.startMs).map(s => (
              <div
                key={s.id}
                data-subtitle-id={s.id}
                onClick={() => {
                  setActiveSubtitleId(s.id);
                  seekToMs(s.startMs);
                }}
                className={`px-2.5 py-2 rounded-lg border cursor-pointer ${
                  s.id === activeSubtitleId
                    ? 'border-white/20 bg-[#1c1c1c]'
                    : 'border-white/[0.05] bg-[#141414]'
                }`}
              >
                <div className="flex items-center gap-1 mb-1.5">
                  <span className="text-[10px] text-white/40 font-mono bg-[#1e1e1e] px-1.5 py-0.5 rounded">
                    {msToDisplay(s.startMs)}
                  </span>
                  <span className="text-[9px] text-white/25">→</span>
                  <span className="text-[10px] text-white/40 font-mono bg-[#1e1e1e] px-1.5 py-0.5 rounded">
                    {msToDisplay(s.endMs)}
                  </span>
                  <button
                    onClick={e => { e.stopPropagation(); deleteSubtitle(s.id); }}
                    className="ml-auto text-[10px] text-white/20 hover:text-red-400 cursor-pointer"
                  >
                    ✕
                  </button>
                </div>
                <input
                  className="bg-transparent border-none outline-none text-[12px] text-white/80 w-full"
                  value={s.text}
                  placeholder="输入字幕文字…"
                  onChange={e => updateSubtitleText(s.id, e.target.value)}
                  onClick={e => e.stopPropagation()}
                />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Timeline */}
      <div
        className="flex-shrink-0 bg-[#080808] border-t border-white/[0.06] flex flex-col"
        style={{ height: 210 }}
      >
        {/* Ruler */}
        <div
          className="h-6 bg-[#111] border-b border-white/[0.04] relative flex-shrink-0 overflow-hidden cursor-pointer"
          onClick={handleRulerClick}
        >
          {rulerMarks.map(({ ms, label, major }) => (
            <div
              key={ms}
              className="absolute bottom-0 flex flex-col items-center"
              style={{ left: `${totalMs > 0 ? (ms / totalMs) * 100 : 0}%` }}
            >
              {major && (
                <span className="absolute bottom-3 text-[9px] text-white/30 whitespace-nowrap -translate-x-1/2 select-none">
                  {label}
                </span>
              )}
              <div className={`w-px ${major ? 'h-2 bg-white/20' : 'h-1 bg-white/10'}`} />
            </div>
          ))}
        </div>

        {/* Tracks */}
        <div
          ref={timelineRef}
          className="relative flex-1 overflow-hidden"
          onClick={handleTrackClick}
        >
          {/* Video thumbnail track */}
          <div className="absolute top-2 left-0 right-0 flex" style={{ height: 90 }}>
            {videoOrder.map((clip, ci) => {
              const dur = clipDurations[ci] ?? 0;
              const widthPct = totalMs > 0 ? (dur / totalMs) * 100 : 0;
              const clipThumbs = thumbnails[ci] ?? [];
              return (
                <div
                  key={clip.id}
                  className="relative flex-shrink-0 overflow-hidden rounded-sm"
                  style={{ width: `${widthPct}%`, height: 90 }}
                >
                  {clipThumbs.length > 0 ? (
                    <div className="flex h-full">
                      {clipThumbs.map((src, ti) => (
                        <img
                          key={ti}
                          src={src}
                          alt=""
                          className="h-full flex-shrink-0 object-cover"
                          style={{ width: `${100 / clipThumbs.length}%` }}
                        />
                      ))}
                    </div>
                  ) : (
                    <div className="w-full h-full bg-[#1a2a3a] flex items-center justify-center">
                      <span className="text-[10px] text-white/20 select-none">{clip.label}</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Subtitle blocks track */}
          <div className="absolute left-0 right-0 bottom-3" style={{ height: 44 }}>
            {subtitles.map((s, idx) => {
              const palette = [
                { bg: 'rgba(59,130,246,0.25)', border: 'rgba(59,130,246,0.7)', text: '#93c5fd' },
                { bg: 'rgba(234,88,12,0.25)', border: 'rgba(234,88,12,0.7)', text: '#fdba74' },
                { bg: 'rgba(34,197,94,0.25)', border: 'rgba(34,197,94,0.7)', text: '#86efac' },
                { bg: 'rgba(168,85,247,0.25)', border: 'rgba(168,85,247,0.7)', text: '#d8b4fe' },
              ];
              const c = palette[idx % palette.length];
              const leftPct = totalMs > 0 ? (s.startMs / totalMs) * 100 : 0;
              const widthPct = totalMs > 0 ? ((s.endMs - s.startMs) / totalMs) * 100 : 0;
              return (
                <div
                  key={s.id}
                  data-sub-block="1"
                  className="absolute h-full rounded flex items-center px-2 text-[11px] overflow-hidden whitespace-nowrap select-none"
                  style={{
                    left: `${leftPct}%`,
                    width: `${Math.max(widthPct, 0.5)}%`,
                    background: c.bg,
                    border: `1px solid ${c.border}`,
                    color: c.text,
                    cursor: 'grab',
                    outline:
                      s.id === activeSubtitleId ? `2px solid ${c.border}` : 'none',
                    outlineOffset: 1,
                  }}
                  onMouseDown={e => handleBlockMouseDown(e, s.id, 'move')}
                  onClick={e => {
                    e.stopPropagation();
                    setActiveSubtitleId(s.id);
                    seekToMs(s.startMs);
                  }}
                >
                  {/* Left resize handle */}
                  <div
                    className="absolute left-0 top-0 bottom-0 w-1.5 cursor-ew-resize"
                    onMouseDown={e => {
                      e.stopPropagation();
                      handleBlockMouseDown(e, s.id, 'left');
                    }}
                  />
                  <span className="truncate">{s.text || '（空白）'}</span>
                  {/* Right resize handle */}
                  <div
                    className="absolute right-0 top-0 bottom-0 w-1.5 cursor-ew-resize"
                    onMouseDown={e => {
                      e.stopPropagation();
                      handleBlockMouseDown(e, s.id, 'right');
                    }}
                  />
                </div>
              );
            })}
          </div>

          {/* Playhead */}
          <div
            className="absolute top-0 bottom-0 pointer-events-none"
            style={{ left: `${playheadPct}%`, width: 1, background: 'rgba(255,255,255,0.8)', zIndex: 10 }}
          >
            <span
              className="absolute text-[9px] text-white select-none"
              style={{ top: -14, left: '50%', transform: 'translateX(-50%)' }}
            >
              ▼
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
npm run lint
```
Expected: no errors. Common issues to check:
- `StoryboardRow` has `index` and `description` fields — confirm in `src/lib/api.ts` if lint fails on those accesses.

- [ ] **Step 3: Commit**

```bash
git add src/components/SubtitleView.tsx
git commit -m "feat: add SubtitleView component with timeline, drag, AI generation, SRT export"
```

---

## Task 5: Wire Up in App.tsx

**Files:**
- Modify: `src/App.tsx`

Four places need editing: imports, Flow props type, Flow body (state + render), App body (state + handlers + Flow props).

- [ ] **Step 1: Update imports at top of `src/App.tsx`**

Add `SubtitleEntry` to the storage import (line ~44):

```typescript
import {
  createProject,
  extractThumbnail,
  type Project,
  type AssetItem,
  type HistoryItem,
  type VideoOrderItem,
  type SubtitleEntry,
} from './lib/storage';
```

Add SubtitleView import after VideoView import:

```typescript
import SubtitleView from './components/SubtitleView';
```

Import `ActiveView` type from BottomTabBar (the type is now exported):

```typescript
import BottomTabBar, { type ActiveView } from './components/BottomTabBar';
```

- [ ] **Step 2: Update Flow component props type**

Find the props destructuring block of the `Flow` function (starts around line 107). Add two new props:

```typescript
  initialVideoOrder: VideoOrderItem[];
  onSaveVideoOrder: (order: VideoOrderItem[]) => void;
  initialSubtitles: SubtitleEntry[];          // ← new
  onSaveSubtitles: (s: SubtitleEntry[]) => void; // ← new
  externalNodes?: Node[] | null;
```

- [ ] **Step 3: Update `activeView` state type inside Flow**

Find (around line 129):
```typescript
const [activeView, setActiveView] = useState<'canvas' | 'storyboard' | 'breakdown' | 'video'>('canvas');
```

Replace with:
```typescript
const [activeView, setActiveView] = useState<ActiveView>('canvas');
```

- [ ] **Step 4: Add subtitle render block inside Flow's return JSX**

After the video manager view block (the `</div>` that closes the video view around line 802), add:

```tsx
      {/* Subtitle editor view */}
      <div
        className="absolute inset-0"
        style={{
          opacity: activeView === 'subtitle' ? 1 : 0,
          transform: activeView === 'subtitle' ? 'translateY(0)' : 'translateY(8px)',
          transition: 'opacity 300ms ease-out, transform 300ms ease-out',
          pointerEvents: activeView === 'subtitle' ? 'auto' : 'none',
        }}
      >
        <SubtitleView
          videoOrder={videoOrder}
          storyboardRows={storyboardRows}
          initialSubtitles={initialSubtitles}
          projectName=""
          onSave={onSaveSubtitles}
        />
      </div>
```

Note: `projectName` will be threaded in the next step; leave as `""` for now.

- [ ] **Step 5: Thread `projectName` into Flow**

Add `projectName: string` to Flow's props type and destructuring. Pass it to the `SubtitleView` above:
```tsx
projectName={projectName}
```

- [ ] **Step 6: Add subtitle state + handlers in the `App` component**

In the `App` function body, after the `canvasInitialVideoOrder` state line, add:

```typescript
const [canvasInitialSubtitles, setCanvasInitialSubtitles] = useState<SubtitleEntry[]>([]);
```

In `handleNewProject`, after `setCanvasInitialVideoOrder([])`, add:
```typescript
setCanvasInitialSubtitles([]);
```

In `handleOpenProject`, after `setCanvasInitialVideoOrder(project.videoOrder || [])`, add:
```typescript
setCanvasInitialSubtitles(project.subtitles ?? []);
```

Add save handler after `handleVideoOrderSave`:
```typescript
const handleSubtitlesSave = (subtitles: SubtitleEntry[]) => {
  if (!currentProject) return;
  const updated = { ...currentProject, subtitles, updatedAt: Date.now() };
  setCurrentProject(updated);
  wsSaveProject(updated);
};
```

- [ ] **Step 7: Pass new props to `<Flow>`**

In the `<Flow ... />` JSX (around line 937), add:

```tsx
          initialSubtitles={canvasInitialSubtitles}
          onSaveSubtitles={handleSubtitlesSave}
          projectName={currentProject?.name ?? ''}
```

- [ ] **Step 8: Verify**

```bash
npm run lint
```
Expected: no errors.

- [ ] **Step 9: Commit**

```bash
git add src/App.tsx
git commit -m "feat: wire SubtitleView into App — state, handlers, render block"
```

---

## Task 6: Browser Smoke Test

No automated test runner is set up in this project. Verify manually in the dev server.

- [ ] **Step 1: Start dev server**

```bash
npm run dev:all
```

- [ ] **Step 2: Open app, open or create a project**

Navigate to `http://localhost:3000`.

- [ ] **Step 3: Verify bottom tab bar shows "字幕编辑"**

Expected: 5 tabs visible — 剧本拆解 / 无限画布 / 分镜管理 / 视频管理 / **字幕编辑**.

- [ ] **Step 4: Click "字幕编辑" with no videos**

Expected: "请先在「视频管理」中添加视频片段" message.

- [ ] **Step 5: Add a video in 视频管理, then click 字幕编辑**

Expected: video player renders, thumbnail track populates after a few seconds.

- [ ] **Step 6: Click ＋ to add a subtitle block**

Expected: new entry appears in subtitle list with empty text input focused. A block appears on timeline at current playhead position.

- [ ] **Step 7: Type text in subtitle input, press play**

Expected: subtitle text overlays video at the correct time.

- [ ] **Step 8: Drag subtitle block on timeline**

Expected: block moves, startMs/endMs update in list panel.

- [ ] **Step 9: Click "导出 SRT"**

Expected: `.srt` file downloads with correct content.

- [ ] **Step 10: Reload page, reopen project**

Expected: subtitles persisted correctly.

---

## Task 7: Deploy to Server

- [ ] **Step 1: Build frontend**

```bash
npm run build
```
Expected: `dist/` directory created with no errors.

- [ ] **Step 2: Push to GitHub**

```bash
git push origin main
```

- [ ] **Step 3: SSH to server and pull + restart**

```bash
ssh root@218.244.158.35
cd /path/to/project   # adjust to actual server path
git pull origin main
npm install --production
pm2 restart all
```

- [ ] **Step 4: Verify on production URL**

Open the production URL and repeat the smoke test (Task 6 steps 3–10).

---

## Self-Review

### Spec coverage check

| Spec section | Covered by task |
|---|---|
| 二. SubtitleEntry type + Project.subtitles | Task 1 ✓ |
| 三. BottomTabBar 'subtitle' tab | Task 2 ✓ |
| 四. Overall layout (video+list+timeline) | Task 4 ✓ |
| 五. Video playback + virtual concat + clip switching | Task 4 ✓ |
| 五. Subtitle overlay + click-to-edit | Task 4 ✓ |
| 六. Timeline ruler | Task 4 ✓ |
| 六. Frame thumbnails via Canvas | Task 4 ✓ |
| 六. Subtitle blocks — click, drag move, resize edges | Task 4 ✓ |
| 六. Click empty timeline → new block | Task 4 ✓ |
| 六. ＋ button → new block at currentMs | Task 4 ✓ |
| 七. AI generate via /api/subtitle-generate | Tasks 3 + 4 ✓ |
| 七. Doubao Vision Pro 32k + IMAGE_API_KEY | Task 3 ✓ |
| 八. SRT export | Task 4 ✓ |
| App.tsx wiring | Task 5 ✓ |

### Placeholder scan

No TBD, TODO, "similar to", or vague steps found.

### Type consistency

- `SubtitleEntry` defined in Task 1, imported by SubtitleView (Task 4) and App.tsx (Task 5) ✓
- `ActiveView` exported from BottomTabBar (Task 2), imported in App.tsx (Task 5) ✓
- `onSave: (subtitles: SubtitleEntry[]) => void` prop name matches `onSaveSubtitles` at call site — internally aliased correctly ✓
- `captureFrame` defined in SubtitleView body, called in `extractThumbnails` and `handleGenerateSubtitles` ✓
