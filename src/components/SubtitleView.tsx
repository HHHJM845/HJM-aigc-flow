import React, { useCallback, useEffect, useRef, useState } from 'react';
import type { StoryboardRow } from '../lib/api';
import type { SubtitleEntry, VideoOrderItem } from '../lib/storage';

// ── Helpers ──────────────────────────────────────────────────────────────────

function genId() {
  return `sub_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

function msToDisplay(ms: number): string {
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}

function msToTimecode(ms: number): string {
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  const f = Math.floor((ms % 1000) / 33); // ~30fps
  const pad = (n: number, l = 2) => String(n).padStart(l, '0');
  return h > 0
    ? `${pad(h)}:${pad(m)}:${pad(s)}:${pad(f)}`
    : `${pad(m)}:${pad(s)}:${pad(f)}`;
}

function msToSRTTime(ms: number): string {
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  const ms_ = ms % 1000;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')},${String(ms_).padStart(3, '0')}`;
}

function exportSRT(subtitles: SubtitleEntry[], projectName: string) {
  const sorted = [...subtitles].sort((a, b) => a.startMs - b.startMs);
  const lines = sorted.map((s, i) => {
    return `${i + 1}\n${msToSRTTime(s.startMs)} --> ${msToSRTTime(s.endMs)}\n${s.text}`;
  });
  const blob = new Blob([lines.join('\n\n')], { type: 'text/plain' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `字幕_${projectName}.srt`;
  a.click();
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface Props {
  videoOrder: VideoOrderItem[];
  storyboardRows: StoryboardRow[];
  subtitles: SubtitleEntry[];
  projectName: string;
  onSaveSubtitles: (subtitles: SubtitleEntry[]) => void;
  onUpdateVideoOrder: (order: VideoOrderItem[]) => void;
}

// ── Timeline constants ────────────────────────────────────────────────────────

const RULER_H = 24;
const VIDEO_TRACK_H = 56;
const SUB_TRACK_H = 36;
const AUDIO_TRACK_H = 32;
const TRACK_LABEL_W = 48;

// ── Component ─────────────────────────────────────────────────────────────────

export default function SubtitleView({
  videoOrder,
  storyboardRows,
  subtitles,
  projectName,
  onSaveSubtitles,
  onUpdateVideoOrder,
}: Props) {
  // ── Video playback state ──────────────────────────────────────────────────
  const [currentClipIndex, setCurrentClipIndex] = useState(0);
  const [clipDurations, setClipDurations] = useState<number[]>([]);
  const videoRef = useRef<HTMLVideoElement>(null);

  const [localVideoOrder, setLocalVideoOrder] = useState<VideoOrderItem[]>(videoOrder);
  useEffect(() => { setLocalVideoOrder(videoOrder); }, [videoOrder]);

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

  const totalMs = clipDurations.reduce((sum, dur, i) => {
    const item = localVideoOrder[i];
    const trimStart = item?.trimStart ?? 0;
    const trimEnd = item?.trimEnd ?? dur;
    return sum + Math.max(0, trimEnd - trimStart);
  }, 0);

  const [currentMs, setCurrentMs] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [showControls, setShowControls] = useState(false);

  // ── Subtitle editing state ────────────────────────────────────────────────
  const [localSubs, setLocalSubs] = useState<SubtitleEntry[]>(subtitles);
  const [focusedSubId, setFocusedSubId] = useState<string | null>(null);
  const [isEditingOverlay, setIsEditingOverlay] = useState(false);
  const [rightTab, setRightTab] = useState<'subtitles' | 'clips'>('subtitles');
  const [sideTab, setSideTab] = useState<'media' | 'assets' | 'effects' | 'transitions' | 'text'>('media');
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setLocalSubs(subtitles); }, [subtitles]);

  const save = useCallback((next: SubtitleEntry[]) => {
    setLocalSubs(next);
    onSaveSubtitles(next);
  }, [onSaveSubtitles]);

  const activeSubtitle = localSubs.find(s => s.startMs <= currentMs && currentMs <= s.endMs) ?? null;

  // ── Video metadata & playback ─────────────────────────────────────────────
  const handleLoadedMetadata = useCallback(() => {
    const vid = videoRef.current;
    if (!vid) return;
    const idx = currentClipIndex;
    setClipDurations(prev => {
      const next = [...prev];
      next[idx] = Math.round(vid.duration * 1000);
      return next;
    });
  }, [currentClipIndex]);

  const handleTimeUpdate = useCallback(() => {
    const vid = videoRef.current;
    if (!vid) return;
    const item = localVideoOrder[currentClipIndex];
    const trimStartMs = item?.trimStart ?? 0;
    const trimEndSec = (item?.trimEnd ?? (clipDurations[currentClipIndex] ?? 0)) / 1000;
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

  const handleEnded = useCallback(() => {
    if (currentClipIndex < localVideoOrder.length - 1) {
      setCurrentClipIndex(i => i + 1);
    } else {
      setIsPlaying(false);
    }
  }, [currentClipIndex, localVideoOrder.length]);

  useEffect(() => {
    const vid = videoRef.current;
    if (!vid) return;
    const trimStartSec = (localVideoOrder[currentClipIndex]?.trimStart ?? 0) / 1000;
    vid.currentTime = trimStartSec;
    if (isPlaying) vid.play().catch(() => {});
  }, [currentClipIndex]); // eslint-disable-line react-hooks/exhaustive-deps

  const togglePlay = () => {
    const vid = videoRef.current;
    if (!vid) return;
    if (isPlaying) { vid.pause(); setIsPlaying(false); }
    else { vid.play().catch(() => {}); setIsPlaying(true); }
  };

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
      pendingSeek.current = localMs;
    } else {
      const vid = videoRef.current;
      if (vid) vid.currentTime = actualTimeSec;
    }
    setCurrentMs(ms);
  }, [currentClipIndex, localVideoOrder]);

  const pendingSeek = useRef<number | null>(null);
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

  // ── Subtitle CRUD ─────────────────────────────────────────────────────────
  const addSubtitleAt = useCallback((atMs: number) => {
    const entry: SubtitleEntry = { id: genId(), startMs: atMs, endMs: atMs + 3000, text: '角色：台词' };
    const next = [...localSubs, entry];
    save(next);
    setFocusedSubId(entry.id);
    setTimeout(() => {
      const el = listRef.current?.querySelector(`[data-sub-id="${entry.id}"]`);
      el?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 50);
  }, [localSubs, save]);

  const updateSubtitleText = useCallback((id: string, text: string) => {
    save(localSubs.map(s => s.id === id ? { ...s, text } : s));
  }, [localSubs, save]);

  const updateSubtitleTimes = useCallback((id: string, startMs: number, endMs: number) => {
    save(localSubs.map(s => s.id === id ? { ...s, startMs, endMs } : s));
  }, [localSubs, save]);

  const removeSubtitle = useCallback((id: string) => {
    save(localSubs.filter(s => s.id !== id));
    if (focusedSubId === id) setFocusedSubId(null);
  }, [localSubs, save, focusedSubId]);

  // ── Timeline interaction ──────────────────────────────────────────────────
  const timelineRef = useRef<HTMLDivElement>(null);
  const [timelineWidth, setTimelineWidth] = useState(800);
  const [zoom, setZoom] = useState(1.0);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!timelineRef.current) return;
    const ro = new ResizeObserver(entries => {
      setTimelineWidth(entries[0].contentRect.width - TRACK_LABEL_W);
    });
    ro.observe(timelineRef.current);
    return () => ro.disconnect();
  }, []);

  const contentWidth = timelineWidth * zoom;
  const msPerPx = totalMs > 0 ? totalMs / contentWidth : 1;
  const pxFromMs = (ms: number) => (totalMs > 0 ? (ms / totalMs) * contentWidth : 0);

  const handleRulerClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const ms = Math.round(px * msPerPx);
    seekToMs(Math.max(0, Math.min(ms, totalMs)));
  };

  const handleTimelineSubtrackClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const ms = Math.round(px * msPerPx);
    addSubtitleAt(Math.max(0, Math.min(ms, totalMs)));
  };

  const handleTimelineWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    if (!e.altKey) return;
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.15 : 1 / 1.15;
    setZoom(prev => Math.min(8, Math.max(0.25, prev * factor)));
  };

  // Drag state for subtitle blocks
  const dragState = useRef<{
    id: string;
    type: 'move' | 'left' | 'right';
    startX: number;
    origStart: number;
    origEnd: number;
  } | null>(null);

  // Drag state for clip trim handles
  const clipTrimDrag = useRef<{
    id: string;
    side: 'left' | 'right';
    startX: number;
    origTrimStart: number;
    origTrimEnd: number;
    fullDuration: number;
  } | null>(null);

  const handleSubBlockMouseDown = (
    e: React.MouseEvent,
    sub: SubtitleEntry,
    type: 'move' | 'left' | 'right',
  ) => {
    e.stopPropagation();
    dragState.current = { id: sub.id, type, startX: e.clientX, origStart: sub.startMs, origEnd: sub.endMs };
  };

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

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      const d = dragState.current;
      if (!d) return;
      const dx = e.clientX - d.startX;
      const dMs = Math.round(dx * msPerPx);
      setLocalSubs(prev => prev.map(s => {
        if (s.id !== d.id) return s;
        if (d.type === 'move') {
          const dur = d.origEnd - d.origStart;
          const newStart = Math.max(0, Math.min(d.origStart + dMs, totalMs - dur));
          return { ...s, startMs: newStart, endMs: newStart + dur };
        } else if (d.type === 'left') {
          const newStart = Math.max(0, Math.min(d.origStart + dMs, d.origEnd - 500));
          return { ...s, startMs: newStart };
        } else {
          const newEnd = Math.min(totalMs, Math.max(d.origEnd + dMs, d.origStart + 500));
          return { ...s, endMs: newEnd };
        }
      }));
    };
    const onUp = () => {
      if (!dragState.current) return;
      const id = dragState.current.id;
      dragState.current = null;
      setLocalSubs(prev => { onSaveSubtitles(prev); return prev; });
      void id;
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [msPerPx, totalMs, onSaveSubtitles]);

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
      setLocalVideoOrder(prev => { onUpdateVideoOrder(prev); return prev; });
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [msPerPx, onUpdateVideoOrder]);

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

  // ── Thumbnail extraction ──────────────────────────────────────────────────
  const [thumbs, setThumbs] = useState<{ clipIdx: number; time: number; dataUrl: string }[]>([]);

  const extractThumbsForClip = useCallback((clipIdx: number, url: string, durationMs: number) => {
    const vid = document.createElement('video');
    vid.src = url;
    vid.crossOrigin = 'anonymous';
    vid.muted = true;
    const pxPerThumb = 80;
    const clipPx = (durationMs / totalMs) * timelineWidth;
    const count = Math.max(1, Math.floor(clipPx / pxPerThumb));
    const results: { clipIdx: number; time: number; dataUrl: string }[] = [];
    let done = 0;

    const captureAt = (t: number) => { vid.currentTime = t; };

    const onSeeked = () => {
      const canvas = document.createElement('canvas');
      canvas.width = 80;
      canvas.height = 45;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(vid, 0, 0, 80, 45);
        results.push({ clipIdx, time: vid.currentTime, dataUrl: canvas.toDataURL('image/jpeg', 0.7) });
      }
      done++;
      if (done < count) {
        captureAt(((done / count) * vid.duration));
      } else {
        setThumbs(prev => [...prev.filter(t => t.clipIdx !== clipIdx), ...results]);
        vid.removeEventListener('seeked', onSeeked);
      }
    };

    vid.addEventListener('loadedmetadata', () => {
      if (vid.duration <= 0) return;
      vid.addEventListener('seeked', onSeeked);
      captureAt(vid.duration / (count * 2));
    });
  }, [totalMs, timelineWidth]);

  useEffect(() => {
    if (clipDurations.length === localVideoOrder.length && totalMs > 0) {
      localVideoOrder.forEach((item, i) => {
        if (clipDurations[i] > 0) extractThumbsForClip(i, item.url, clipDurations[i]);
      });
    }
  }, [clipDurations, localVideoOrder, totalMs]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── AI generate ───────────────────────────────────────────────────────────
  const [aiLoading, setAiLoading] = useState(false);
  const [exporting, setExporting] = useState(false);

  const handleAIGenerate = async () => {
    if (localVideoOrder.length === 0) return;
    setAiLoading(true);
    try {
      const frames: string[] = [];
      for (const item of localVideoOrder) {
        const framesForClip = await extractFrames(item.url, [0.25, 0.75]);
        frames.push(...framesForClip);
      }
      const storyboardText = storyboardRows
        .map(r => `[${r.index}] ${r.shotType || ''} ${r.description || ''}`.trim())
        .join('\n');
      const resp = await fetch('/api/subtitle-generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ frames, storyboardText }),
      });
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ error: 'unknown' }));
        alert(`AI 生成失败：${err.error}`);
        return;
      }
      const data = await resp.json() as { subtitles: string[] };
      const newEntries: SubtitleEntry[] = data.subtitles.map(text => ({
        id: genId(), startMs: 0, endMs: 3000, text,
      }));
      save([...localSubs, ...newEntries]);
    } catch (err) {
      alert(`AI 生成出错：${String(err)}`);
    } finally {
      setAiLoading(false);
    }
  };

  const handleExportVideo = async () => {
    if (localVideoOrder.length === 0 || totalMs === 0) return;
    setExporting(true);
    try {
      const resp = await fetch('/api/export-video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ videoOrder: localVideoOrder, subtitles: localSubs, totalMs }),
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

  // ── Render ────────────────────────────────────────────────────────────────

  const currentClip = localVideoOrder[currentClipIndex];

  const sidebarItems = [
    { key: 'media', icon: 'video_library', label: '媒体' },
    { key: 'assets', icon: 'photo_library', label: '资产' },
    { key: 'effects', icon: 'auto_awesome', label: '特效' },
    { key: 'transitions', icon: 'swap_horiz', label: '转场' },
    { key: 'text', icon: 'title', label: '文字' },
  ] as const;

  return (
    <div className="w-full h-full flex flex-col bg-[#0d0d0d] text-white overflow-hidden select-none" style={{ fontFamily: 'Inter, sans-serif' }}>

      {/* ── Top bar ───────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 px-4 py-2.5 border-b border-white/[0.06] bg-[#111] shrink-0">
        {/* Project info */}
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-[#9f9d9d] text-[16px]">movie</span>
          <span className="text-[13px] font-semibold text-[#e0e0e0] truncate max-w-[180px]">{projectName}</span>
          {localVideoOrder.length > 0 && (
            <span className="text-[11px] text-white/30 tabular-nums">
              {localVideoOrder.length} 段 · {msToDisplay(totalMs)}
            </span>
          )}
        </div>

        <div className="flex-1" />

        {/* Actions */}
        <button
          onClick={handleAIGenerate}
          disabled={aiLoading || localVideoOrder.length === 0}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-violet-600/80 hover:bg-violet-600 disabled:opacity-40 text-[12px] font-medium transition-colors"
        >
          <span className="material-symbols-outlined text-[14px]">auto_awesome</span>
          {aiLoading ? '生成中…' : 'AI 字幕'}
        </button>
        <button
          onClick={() => exportSRT(localSubs, projectName)}
          disabled={localSubs.length === 0}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.06] hover:bg-white/10 disabled:opacity-40 text-[12px] font-medium border border-white/8 transition-colors"
        >
          <span className="material-symbols-outlined text-[14px]">subtitles</span>
          SRT
        </button>
        <button
          onClick={handleExportVideo}
          disabled={exporting || localVideoOrder.length === 0 || totalMs === 0}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#e0e0e0] hover:bg-white text-black disabled:opacity-40 text-[12px] font-semibold transition-colors"
        >
          <span className="material-symbols-outlined text-[14px]">download</span>
          {exporting ? '导出中…' : '导出'}
        </button>
      </div>

      {/* ── Middle row: sidebar + preview + right panel ───────────────────── */}
      <div className="flex flex-1 min-h-0 overflow-hidden">

        {/* Left sidebar */}
        <div className="w-[64px] flex flex-col items-center py-3 gap-1 bg-[#0d0d0d] border-r border-white/[0.06] shrink-0">
          {sidebarItems.map(item => (
            <button
              key={item.key}
              onClick={() => setSideTab(item.key)}
              className={`w-12 flex flex-col items-center gap-1 py-2.5 rounded-xl transition-colors ${sideTab === item.key ? 'bg-white/10 text-white' : 'text-white/30 hover:text-white/60 hover:bg-white/5'}`}
            >
              <span className="material-symbols-outlined text-[20px]">{item.icon}</span>
              <span className="text-[9px] font-medium tracking-wide">{item.label}</span>
            </button>
          ))}
        </div>

        {/* Center: video preview */}
        <div
          className="flex-1 flex flex-col bg-black relative min-w-0"
          onMouseEnter={() => setShowControls(true)}
          onMouseLeave={() => setShowControls(false)}
        >
          {/* Video area */}
          <div className="flex-1 flex items-center justify-center relative overflow-hidden">
            {currentClip ? (
              <>
                <video
                  ref={videoRef}
                  key={currentClip.url}
                  src={currentClip.url}
                  className="max-w-full max-h-full"
                  style={{ aspectRatio: '16/9' }}
                  onLoadedMetadata={handleLoadedMetadata}
                  onTimeUpdate={handleTimeUpdate}
                  onEnded={handleEnded}
                  onClick={togglePlay}
                  playsInline
                />

                {/* Subtitle overlay */}
                <div className="absolute bottom-[8%] left-1/2 -translate-x-1/2 w-[88%] text-center pointer-events-none z-10">
                  {activeSubtitle && (
                    isEditingOverlay ? (
                      <textarea
                        autoFocus
                        className="pointer-events-auto bg-black/85 text-white px-5 py-2 rounded-lg text-[16px] font-medium text-center w-full resize-none outline-none"
                        value={activeSubtitle.text}
                        onChange={e => updateSubtitleText(activeSubtitle.id, e.target.value)}
                        onBlur={() => setIsEditingOverlay(false)}
                        rows={2}
                      />
                    ) : (
                      <span
                        className="pointer-events-auto inline-block bg-black/85 text-white px-5 py-2 rounded-lg text-[16px] font-medium cursor-text shadow-lg"
                        onClick={() => setIsEditingOverlay(true)}
                      >
                        {activeSubtitle.text}
                      </span>
                    )
                  )}
                </div>

                {/* Play button overlay (center) */}
                {!isPlaying && (
                  <button
                    onClick={togglePlay}
                    className={`absolute inset-0 flex items-center justify-center transition-opacity duration-200 ${showControls ? 'opacity-100' : 'opacity-0'}`}
                  >
                    <div className="w-14 h-14 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center border border-white/20">
                      <span className="material-symbols-outlined text-white text-[32px] ml-1">play_arrow</span>
                    </div>
                  </button>
                )}
              </>
            ) : (
              <div className="flex flex-col items-center gap-3 text-white/20">
                <span className="material-symbols-outlined text-[48px]">video_library</span>
                <span className="text-[13px]">请先在视频管理中添加片段</span>
              </div>
            )}
          </div>

          {/* Transport bar */}
          <div
            className={`absolute bottom-0 left-0 right-0 flex items-center gap-3 px-5 py-3 bg-gradient-to-t from-black/80 to-transparent transition-opacity duration-200 ${showControls || !isPlaying ? 'opacity-100' : 'opacity-0'}`}
          >
            <button
              onClick={() => seekToMs(Math.max(0, currentMs - 5000))}
              className="text-white/60 hover:text-white transition-colors"
            >
              <span className="material-symbols-outlined text-[20px]">skip_previous</span>
            </button>
            <button
              onClick={togglePlay}
              className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
            >
              <span className="material-symbols-outlined text-[20px]">{isPlaying ? 'pause' : 'play_arrow'}</span>
            </button>
            <button
              onClick={() => seekToMs(Math.min(totalMs, currentMs + 5000))}
              className="text-white/60 hover:text-white transition-colors"
            >
              <span className="material-symbols-outlined text-[20px]">skip_next</span>
            </button>
            <span className="text-[12px] text-white/50 tabular-nums ml-1">
              {msToTimecode(currentMs)}<span className="text-white/20 mx-1">/</span>{msToTimecode(totalMs)}
            </span>
            <div className="flex-1" />
            {/* Clip info */}
            {currentClip && (
              <span className="text-[11px] text-white/30 truncate max-w-[140px]">
                {currentClip.label || `片段 ${currentClipIndex + 1}`}
              </span>
            )}
          </div>
        </div>

        {/* Right panel */}
        <div className="w-[280px] flex flex-col border-l border-white/[0.06] bg-[#0f0f0f] shrink-0">
          {/* Panel tabs */}
          <div className="flex border-b border-white/[0.06] shrink-0">
            {(['subtitles', 'clips'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setRightTab(tab)}
                className={`flex-1 py-2.5 text-[12px] font-medium transition-colors ${rightTab === tab ? 'text-white border-b-2 border-white/60' : 'text-white/30 hover:text-white/60'}`}
              >
                {tab === 'subtitles' ? '字幕' : '片段'}
              </button>
            ))}
          </div>

          {rightTab === 'subtitles' ? (
            <>
              {/* Add subtitle button */}
              <div className="flex items-center justify-between px-4 py-2 border-b border-white/[0.04] shrink-0">
                <span className="text-[11px] text-white/30">{localSubs.length} 条字幕</span>
                <button
                  onClick={() => addSubtitleAt(currentMs)}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white/[0.06] hover:bg-white/10 text-[11px] text-white/70 hover:text-white transition-colors border border-white/[0.06]"
                >
                  <span className="material-symbols-outlined text-[13px]">add</span>
                  添加
                </button>
              </div>
              <div ref={listRef} className="flex-1 overflow-y-auto">
                {localSubs.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full gap-2 text-white/20">
                    <span className="material-symbols-outlined text-[32px]">subtitles</span>
                    <span className="text-[12px]">双击时间轴添加字幕</span>
                  </div>
                ) : (
                  [...localSubs]
                    .sort((a, b) => a.startMs - b.startMs)
                    .map(sub => (
                      <SubtitleListItem
                        key={sub.id}
                        sub={sub}
                        focused={focusedSubId === sub.id}
                        onFocus={() => { setFocusedSubId(sub.id); seekToMs(sub.startMs); }}
                        onChange={text => updateSubtitleText(sub.id, text)}
                        onRemove={() => removeSubtitle(sub.id)}
                      />
                    ))
                )}
              </div>
            </>
          ) : (
            <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-2">
              {localVideoOrder.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full gap-2 text-white/20">
                  <span className="material-symbols-outlined text-[32px]">video_library</span>
                  <span className="text-[12px]">暂无视频片段</span>
                </div>
              ) : (
                localVideoOrder.map((item, i) => {
                  const dur = clipDurations[i] ?? 0;
                  const thumb = thumbs.find(t => t.clipIdx === i);
                  return (
                    <button
                      key={item.id}
                      onClick={() => { setCurrentClipIndex(i); }}
                      className={`flex items-center gap-3 p-2.5 rounded-xl border transition-colors text-left ${i === currentClipIndex ? 'bg-white/10 border-white/20' : 'bg-white/[0.03] border-white/[0.06] hover:bg-white/[0.06]'}`}
                    >
                      <div className="w-14 h-9 rounded-lg bg-[#1a1a1a] overflow-hidden flex-shrink-0">
                        {thumb ? (
                          <img src={thumb.dataUrl} className="w-full h-full object-cover" alt="" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <span className="material-symbols-outlined text-white/20 text-[16px]">movie</span>
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[12px] text-white/80 truncate font-medium">{item.label || `片段 ${i + 1}`}</p>
                        <p className="text-[10px] text-white/30 tabular-nums mt-0.5">{dur > 0 ? msToDisplay(dur) : '加载中…'}</p>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          )}
        </div>

      </div>

      {/* ── Timeline ─────────────────────────────────────────────────────────── */}
      <div className="shrink-0 border-t border-white/[0.06] bg-[#0d0d0d]" style={{ height: 180 }}>
        {/* Toolbar row */}
        <div className="flex items-center gap-2 px-3 py-1.5 border-b border-white/[0.04]">
          <button onClick={() => seekToMs(0)} className="text-white/30 hover:text-white/70 transition-colors">
            <span className="material-symbols-outlined text-[16px]">first_page</span>
          </button>
          <button onClick={togglePlay} className="text-white/30 hover:text-white/70 transition-colors">
            <span className="material-symbols-outlined text-[16px]">{isPlaying ? 'pause' : 'play_arrow'}</span>
          </button>
          <span className="text-[11px] text-white/30 tabular-nums w-[90px]">
            {msToTimecode(currentMs)}
          </span>
          <div className="flex-1" />
          {/* Zoom */}
          <span className="material-symbols-outlined text-[14px] text-white/20">zoom_out</span>
          <input
            type="range"
            min={0.25}
            max={8}
            step={0.05}
            value={zoom}
            onChange={e => setZoom(parseFloat(e.target.value))}
            className="w-20 accent-white/40 cursor-pointer"
          />
          <span className="material-symbols-outlined text-[14px] text-white/20">zoom_in</span>
          <span className="text-[10px] text-white/20 w-8 text-right">{zoom.toFixed(1)}x</span>
        </div>

        {/* Track area */}
        <div
          ref={timelineRef}
          className="flex w-full overflow-hidden"
          style={{ height: 180 - 33 }}
          onWheel={handleTimelineWheel}
        >
          {/* Track labels column */}
          <div className="flex flex-col shrink-0 border-r border-white/[0.06]" style={{ width: TRACK_LABEL_W }}>
            {/* Ruler spacer */}
            <div style={{ height: RULER_H }} className="border-b border-white/[0.04]" />
            {/* V1 label */}
            <div className="flex items-center justify-center border-b border-white/[0.04] text-[9px] text-white/25 font-bold tracking-wider" style={{ height: VIDEO_TRACK_H }}>
              V1
            </div>
            {/* T1 label */}
            <div className="flex items-center justify-center border-b border-white/[0.04] text-[9px] text-white/25 font-bold tracking-wider" style={{ height: SUB_TRACK_H }}>
              T1
            </div>
            {/* A1 label */}
            <div className="flex items-center justify-center text-[9px] text-white/25 font-bold tracking-wider" style={{ height: AUDIO_TRACK_H }}>
              A1
            </div>
          </div>

          {/* Scrollable track content */}
          {totalMs > 0 ? (
            <div
              ref={scrollRef}
              className="relative flex-1 overflow-x-auto"
              style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,255,255,0.1) transparent' } as React.CSSProperties}
            >
              <div className="relative h-full" style={{ width: contentWidth }}>

                {/* Ruler */}
                <div
                  className="absolute left-0 right-0 top-0 cursor-pointer border-b border-white/[0.04]"
                  style={{ height: RULER_H, background: 'rgba(0,0,0,0.3)' }}
                  onClick={handleRulerClick}
                >
                  <RulerTicks totalMs={totalMs} widthPx={contentWidth} />
                </div>

                {/* V1 — Video track (thumbnails + clip bars) */}
                <div
                  className="absolute left-0 right-0 border-b border-white/[0.04] overflow-hidden"
                  style={{ top: RULER_H, height: VIDEO_TRACK_H, background: '#111' }}
                >
                  {/* Thumbnail strip */}
                  {thumbs.map((t, i) => {
                    const clipOffset = clipOffsets.current[t.clipIdx] ?? 0;
                    const left = pxFromMs(clipOffset + t.time * 1000);
                    return (
                      <img
                        key={i}
                        src={t.dataUrl}
                        className="absolute top-0 object-cover opacity-60"
                        style={{ left, width: 80, height: VIDEO_TRACK_H }}
                        alt=""
                      />
                    );
                  })}
                  {/* Clip bars overlay */}
                  {localVideoOrder.map((item, i) => {
                    const fullDuration = clipDurations[i] ?? 0;
                    if (fullDuration === 0) return null;
                    const trimStart = item.trimStart ?? 0;
                    const trimEnd = item.trimEnd ?? fullDuration;
                    const trimmedMs = Math.max(0, trimEnd - trimStart);
                    const left = pxFromMs(clipOffsets.current[i] ?? 0);
                    const width = pxFromMs(trimmedMs);
                    return (
                      <div
                        key={item.id}
                        className="absolute top-0 bottom-0 rounded overflow-hidden flex items-end pb-1"
                        style={{ left, width, borderRight: '2px solid rgba(255,255,255,0.08)', borderLeft: i === currentClipIndex ? '2px solid rgba(255,255,255,0.5)' : '2px solid transparent' }}
                      >
                        {/* Left trim handle */}
                        <div
                          className="absolute left-0 top-0 bottom-0 w-2 cursor-ew-resize hover:bg-white/30 z-10"
                          onMouseDown={e => handleClipTrimMouseDown(e, item, 'left', i)}
                        />
                        {width > 50 && (
                          <span className="text-[9px] text-white/60 px-2 truncate select-none pointer-events-none bg-black/40 rounded mx-1">
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
                </div>

                {/* T1 — Subtitle track */}
                <div
                  className="absolute left-0 right-0 border-b border-white/[0.04] cursor-crosshair"
                  style={{ top: RULER_H + VIDEO_TRACK_H, height: SUB_TRACK_H, background: '#0d0d0d' }}
                  onDoubleClick={handleTimelineSubtrackClick}
                >
                  {localSubs.map(sub => {
                    const left = pxFromMs(sub.startMs);
                    const width = Math.max(4, pxFromMs(sub.endMs) - left);
                    const isFocused = focusedSubId === sub.id;
                    return (
                      <div
                        key={sub.id}
                        className={`absolute top-1 bottom-1 rounded flex items-center overflow-hidden text-[9px] text-white/90 ${isFocused ? 'bg-violet-600/70 ring-1 ring-violet-400/60' : 'bg-[#1a3a6b]/80'}`}
                        style={{ left, width }}
                        onClick={e => { e.stopPropagation(); setFocusedSubId(sub.id); seekToMs(sub.startMs); }}
                        onMouseDown={e => handleSubBlockMouseDown(e, sub, 'move')}
                        title={sub.text}
                      >
                        <div className="absolute left-0 top-0 bottom-0 w-2 cursor-w-resize hover:bg-white/20" onMouseDown={e => handleSubBlockMouseDown(e, sub, 'left')} />
                        <span className="px-2 truncate pointer-events-none">{sub.text}</span>
                        <div className="absolute right-0 top-0 bottom-0 w-2 cursor-e-resize hover:bg-white/20" onMouseDown={e => handleSubBlockMouseDown(e, sub, 'right')} />
                      </div>
                    );
                  })}
                </div>

                {/* A1 — Audio track (visual placeholder) */}
                <div
                  className="absolute left-0 right-0"
                  style={{ top: RULER_H + VIDEO_TRACK_H + SUB_TRACK_H, height: AUDIO_TRACK_H, background: '#0a0a0a' }}
                >
                  {localVideoOrder.map((item, i) => {
                    const fullDuration = clipDurations[i] ?? 0;
                    if (fullDuration === 0) return null;
                    const trimStart = item.trimStart ?? 0;
                    const trimEnd = item.trimEnd ?? fullDuration;
                    const left = pxFromMs(clipOffsets.current[i] ?? 0);
                    const width = pxFromMs(Math.max(0, trimEnd - trimStart));
                    return (
                      <div
                        key={item.id}
                        className="absolute top-1 bottom-1 rounded overflow-hidden"
                        style={{ left, width, background: 'rgba(34,197,94,0.15)', borderLeft: '2px solid rgba(34,197,94,0.3)' }}
                      >
                        {/* Waveform placeholder bars */}
                        <div className="w-full h-full flex items-center gap-px px-1">
                          {Array.from({ length: Math.max(1, Math.floor(width / 4)) }).map((_, k) => (
                            <div
                              key={k}
                              className="flex-1 rounded-full bg-emerald-500/30"
                              style={{ height: `${20 + Math.sin(k * 0.7) * 14}%` }}
                            />
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Playhead */}
                <div
                  className="absolute top-0 bottom-0 pointer-events-none z-20"
                  style={{ left: pxFromMs(currentMs) }}
                >
                  {/* Triangle head */}
                  <div className="absolute top-0 -translate-x-1/2 w-0 h-0 border-l-[5px] border-r-[5px] border-t-[7px] border-l-transparent border-r-transparent border-t-[#ef4444]" />
                  <div className="absolute top-[7px] bottom-0 left-1/2 -translate-x-1/2 w-px bg-red-500/70" />
                </div>

              </div>
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <span className="text-white/20 text-[12px]">
                {localVideoOrder.length === 0 ? '请先在视频管理中添加片段' : '加载视频时长中…'}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Bottom spacer for tab bar */}
      <div className="h-[72px] shrink-0" />

    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function SubtitleListItem({
  sub,
  focused,
  onFocus,
  onChange,
  onRemove,
}: {
  sub: SubtitleEntry;
  focused: boolean;
  onFocus: () => void;
  onChange: (text: string) => void;
  onRemove: () => void;
}) {
  return (
    <div
      data-sub-id={sub.id}
      className={`px-4 py-3 border-b border-white/[0.04] cursor-pointer transition-colors ${focused ? 'bg-violet-900/20 border-l-2 border-l-violet-500' : 'hover:bg-white/[0.03]'}`}
      onClick={onFocus}
    >
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[10px] text-white/30 tabular-nums font-mono">
          {msToDisplay(sub.startMs)} → {msToDisplay(sub.endMs)}
        </span>
        <button
          onClick={e => { e.stopPropagation(); onRemove(); }}
          className="text-white/15 hover:text-red-400 text-[14px] transition-colors w-5 h-5 flex items-center justify-center rounded"
        >
          <span className="material-symbols-outlined text-[14px]">close</span>
        </button>
      </div>
      <textarea
        className="w-full bg-transparent text-[12px] text-white/80 resize-none outline-none focus:text-white leading-relaxed"
        rows={2}
        value={sub.text}
        onChange={e => onChange(e.target.value)}
        onClick={e => e.stopPropagation()}
      />
    </div>
  );
}

function RulerTicks({ totalMs, widthPx }: { totalMs: number; widthPx: number }) {
  const INTERVALS = [1000, 5000, 10000, 30000, 60000, 300000];
  const minTickPx = 50;
  const interval = INTERVALS.find(iv => (iv / totalMs) * widthPx >= minTickPx) ?? INTERVALS[INTERVALS.length - 1];
  const ticks: number[] = [];
  for (let ms = 0; ms <= totalMs; ms += interval) ticks.push(ms);

  return (
    <>
      {ticks.map(ms => {
        const left = (ms / totalMs) * widthPx;
        return (
          <div key={ms} className="absolute top-0 bottom-0 flex flex-col justify-between" style={{ left }}>
            <span className="text-[8px] text-white/20 mt-1 ml-1 tabular-nums">{msToDisplay(ms)}</span>
            <div className="w-px h-3 bg-white/10" />
          </div>
        );
      })}
    </>
  );
}

// ── Frame extraction utility ──────────────────────────────────────────────────

function extractFrames(url: string, positions: number[]): Promise<string[]> {
  return new Promise(resolve => {
    const vid = document.createElement('video');
    vid.src = url;
    vid.crossOrigin = 'anonymous';
    vid.muted = true;
    const results: string[] = [];
    let idx = 0;

    const capture = () => {
      const canvas = document.createElement('canvas');
      canvas.width = 320;
      canvas.height = 180;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(vid, 0, 0, 320, 180);
        results.push(canvas.toDataURL('image/jpeg', 0.7));
      }
      idx++;
      if (idx < positions.length) {
        vid.currentTime = vid.duration * positions[idx];
      } else {
        resolve(results);
      }
    };

    vid.addEventListener('loadedmetadata', () => {
      if (vid.duration <= 0) { resolve([]); return; }
      vid.addEventListener('seeked', capture);
      vid.currentTime = vid.duration * positions[0];
    });

    vid.addEventListener('error', () => resolve([]));
  });
}
