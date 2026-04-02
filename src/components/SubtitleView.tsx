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
}

// ── Timeline constants ────────────────────────────────────────────────────────

const RULER_H = 28;
const THUMB_TRACK_H = 90;
const CLIP_BAR_H = 36;
const SUB_TRACK_H = 48;
const TIMELINE_H = RULER_H + THUMB_TRACK_H + CLIP_BAR_H + SUB_TRACK_H + 16; // ~218px

// ── Component ─────────────────────────────────────────────────────────────────

export default function SubtitleView({
  videoOrder,
  storyboardRows,
  subtitles,
  projectName,
  onSaveSubtitles,
}: Props) {
  // ── Video playback state ──────────────────────────────────────────────────
  const [currentClipIndex, setCurrentClipIndex] = useState(0);
  const [clipDurations, setClipDurations] = useState<number[]>([]);
  const videoRef = useRef<HTMLVideoElement>(null);

  // clipOffsets[i] = sum of durations 0..i-1 in ms
  const clipOffsets = useRef<number[]>([]);
  useEffect(() => {
    const offsets: number[] = [];
    let acc = 0;
    for (const d of clipDurations) {
      offsets.push(acc);
      acc += d;
    }
    clipOffsets.current = offsets;
  }, [clipDurations]);

  const totalMs = clipDurations.reduce((a, b) => a + b, 0);

  const [currentMs, setCurrentMs] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

  // ── Subtitle editing state ────────────────────────────────────────────────
  const [localSubs, setLocalSubs] = useState<SubtitleEntry[]>(subtitles);
  const [focusedSubId, setFocusedSubId] = useState<string | null>(null);
  const [isEditingOverlay, setIsEditingOverlay] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  // Keep local in sync with prop when parent updates
  useEffect(() => {
    setLocalSubs(subtitles);
  }, [subtitles]);

  const save = useCallback((next: SubtitleEntry[]) => {
    setLocalSubs(next);
    onSaveSubtitles(next);
  }, [onSaveSubtitles]);

  // ── Active subtitle at currentMs ──────────────────────────────────────────
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
    const offset = clipOffsets.current[currentClipIndex] ?? 0;
    setCurrentMs(offset + Math.round(vid.currentTime * 1000));
  }, [currentClipIndex]);

  const handleEnded = useCallback(() => {
    if (currentClipIndex < videoOrder.length - 1) {
      setCurrentClipIndex(i => i + 1);
    } else {
      setIsPlaying(false);
    }
  }, [currentClipIndex, videoOrder.length]);

  // Reset video element when clip changes
  useEffect(() => {
    const vid = videoRef.current;
    if (!vid) return;
    vid.currentTime = 0;
    if (isPlaying) vid.play().catch(() => {});
  }, [currentClipIndex]); // eslint-disable-line react-hooks/exhaustive-deps

  const togglePlay = () => {
    const vid = videoRef.current;
    if (!vid) return;
    if (isPlaying) { vid.pause(); setIsPlaying(false); }
    else { vid.play().catch(() => {}); setIsPlaying(true); }
  };

  // Seek to globalMs across clips
  const seekToMs = useCallback((ms: number) => {
    const offsets = clipOffsets.current;
    let targetClip = 0;
    for (let i = offsets.length - 1; i >= 0; i--) {
      if (ms >= offsets[i]) { targetClip = i; break; }
    }
    const localMs = ms - (offsets[targetClip] ?? 0);
    if (targetClip !== currentClipIndex) {
      setCurrentClipIndex(targetClip);
      // After re-render the useEffect will set currentTime = 0, but we want localMs
      // so we store it in a ref
      pendingSeek.current = localMs;
    } else {
      const vid = videoRef.current;
      if (vid) vid.currentTime = localMs / 1000;
    }
    setCurrentMs(ms);
  }, [currentClipIndex]);

  const pendingSeek = useRef<number | null>(null);
  useEffect(() => {
    if (pendingSeek.current !== null) {
      const vid = videoRef.current;
      if (vid) {
        vid.currentTime = (pendingSeek.current) / 1000;
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
    // Scroll list to new item
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
      setTimelineWidth(entries[0].contentRect.width);
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
    if (!e.ctrlKey) return;
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

  const handleSubBlockMouseDown = (
    e: React.MouseEvent,
    sub: SubtitleEntry,
    type: 'move' | 'left' | 'right',
  ) => {
    e.stopPropagation();
    dragState.current = { id: sub.id, type, startX: e.clientX, origStart: sub.startMs, origEnd: sub.endMs };
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
      // Persist final state
      setLocalSubs(prev => {
        onSaveSubtitles(prev);
        return prev;
      });
      // suppress unused - needed for the closure
      void id;
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [msPerPx, totalMs, onSaveSubtitles]);

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

    const captureAt = (t: number) => {
      vid.currentTime = t;
    };

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
    if (clipDurations.length === videoOrder.length && totalMs > 0) {
      videoOrder.forEach((item, i) => {
        if (clipDurations[i] > 0) {
          extractThumbsForClip(i, item.url, clipDurations[i]);
        }
      });
    }
  }, [clipDurations, videoOrder, totalMs]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── AI generate ───────────────────────────────────────────────────────────
  const [aiLoading, setAiLoading] = useState(false);

  const handleAIGenerate = async () => {
    if (videoOrder.length === 0) return;
    setAiLoading(true);
    try {
      // Extract 2 frames per clip (25% and 75%)
      const frames: string[] = [];
      for (const item of videoOrder) {
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
        id: genId(),
        startMs: 0,
        endMs: 3000,
        text,
      }));
      const next = [...localSubs, ...newEntries];
      save(next);
    } catch (err) {
      alert(`AI 生成出错：${String(err)}`);
    } finally {
      setAiLoading(false);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────

  const currentClip = videoOrder[currentClipIndex];

  return (
    <div className="w-full h-full flex flex-col bg-[#0a0a0a] text-white overflow-hidden">

      {/* Top bar */}
      <div className="flex items-center gap-3 px-5 py-3 border-b border-white/8 shrink-0">
        <span className="text-[15px] font-semibold">字幕编辑</span>
        <span className="text-white/40 text-[13px]">{videoOrder.length} 个片段</span>
        {totalMs > 0 && (
          <span className="text-white/40 text-[13px]">总时长 {msToDisplay(totalMs)}</span>
        )}
        <div className="flex-1" />
        <button
          onClick={handleAIGenerate}
          disabled={aiLoading || videoOrder.length === 0}
          className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-violet-600/80 hover:bg-violet-600 disabled:opacity-40 text-[13px] font-medium transition-colors"
        >
          {aiLoading ? '生成中…' : '✨ AI 生成字幕'}
        </button>
        <button
          onClick={() => exportSRT(localSubs, projectName)}
          disabled={localSubs.length === 0}
          className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-white/8 hover:bg-white/12 disabled:opacity-40 text-[13px] font-medium border border-white/10 transition-colors"
        >
          导出 SRT
        </button>
      </div>

      {/* Main area: video + list */}
      <div className="flex flex-1 min-h-0 overflow-hidden">

        {/* Video player */}
        <div className="flex-[1.5] flex flex-col bg-black relative min-w-0">
          {currentClip ? (
            <div className="relative flex-1 flex items-center justify-center">
              <video
                ref={videoRef}
                key={currentClip.url}
                src={currentClip.url}
                className="max-w-full max-h-full"
                style={{ aspectRatio: '16/9' }}
                onLoadedMetadata={handleLoadedMetadata}
                onTimeUpdate={handleTimeUpdate}
                onEnded={handleEnded}
                playsInline
              />
              {/* Subtitle overlay */}
              <div className="absolute bottom-[4%] left-1/2 -translate-x-1/2 w-[90%] text-center z-10">
                {activeSubtitle && (
                  isEditingOverlay ? (
                    <textarea
                      autoFocus
                      className="bg-black/85 text-white px-5 py-2 rounded text-[17px] font-medium text-center w-full resize-none outline-none"
                      value={activeSubtitle.text}
                      onChange={e => updateSubtitleText(activeSubtitle.id, e.target.value)}
                      onBlur={() => setIsEditingOverlay(false)}
                      rows={2}
                    />
                  ) : (
                    <span
                      className="inline-block bg-black/85 text-white px-5 py-2 rounded text-[17px] font-medium cursor-text"
                      onClick={() => setIsEditingOverlay(true)}
                    >
                      {activeSubtitle.text}
                    </span>
                  )
                )}
              </div>
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center text-white/20 text-[13px]">
              暂无视频片段
            </div>
          )}

          {/* Playback controls */}
          <div className="flex items-center gap-3 px-4 py-2 border-t border-white/8 shrink-0">
            <button
              onClick={togglePlay}
              className="w-8 h-8 flex items-center justify-center rounded-lg bg-white/10 hover:bg-white/15 text-[15px]"
            >
              {isPlaying ? '⏸' : '▶'}
            </button>
            <span className="text-[12px] text-white/50 tabular-nums">
              {msToDisplay(currentMs)} / {msToDisplay(totalMs)}
            </span>
          </div>
        </div>

        {/* Subtitle list */}
        <div className="w-[270px] flex flex-col border-l border-white/8 shrink-0">
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/8 shrink-0">
            <span className="text-[13px] font-medium">字幕列表</span>
            <span className="text-white/40 text-[12px]">{localSubs.length} 条</span>
            <button
              onClick={() => addSubtitleAt(currentMs)}
              className="ml-2 w-6 h-6 flex items-center justify-center rounded-md bg-white/8 hover:bg-white/15 text-[15px] leading-none"
              title="在当前时间添加字幕"
            >
              ＋
            </button>
          </div>

          <div ref={listRef} className="flex-1 overflow-y-auto">
            {localSubs.length === 0 ? (
              <div className="text-center text-white/20 text-[12px] mt-8">
                点击时间线或 ＋ 添加字幕
              </div>
            ) : (
              [...localSubs]
                .sort((a, b) => a.startMs - b.startMs)
                .map(sub => (
                  <SubtitleListItem
                    key={sub.id}
                    sub={sub}
                    focused={focusedSubId === sub.id}
                    onFocus={() => {
                      setFocusedSubId(sub.id);
                      seekToMs(sub.startMs);
                    }}
                    onChange={text => updateSubtitleText(sub.id, text)}
                    onRemove={() => removeSubtitle(sub.id)}
                  />
                ))
            )}
          </div>
        </div>

      </div>

      {/* Timeline */}
      <div
        ref={timelineRef}
        className="shrink-0 border-t border-white/8 bg-[#111] select-none"
        style={{ height: TIMELINE_H }}
      >
        {totalMs > 0 ? (
          <div
            ref={scrollRef}
            className="relative w-full h-full overflow-x-auto"
            style={{ scrollbarWidth: 'none' } as React.CSSProperties}
            onWheel={handleTimelineWheel}
          >
          <div className="relative h-full" style={{ width: contentWidth }}>
            {/* Ruler */}
            <div
              className="absolute left-0 right-0 top-0 flex items-end cursor-pointer"
              style={{ height: RULER_H, background: 'rgba(0,0,0,0.4)' }}
              onClick={handleRulerClick}
            >
              <RulerTicks totalMs={totalMs} widthPx={contentWidth} />
            </div>

            {/* Thumbnail track */}
            <div
              className="absolute left-0 right-0 overflow-hidden"
              style={{ top: RULER_H, height: THUMB_TRACK_H, background: '#1a1a1a' }}
            >
              {thumbs.map((t, i) => {
                const clipOffset = clipOffsets.current[t.clipIdx] ?? 0;
                const left = pxFromMs(clipOffset + t.time * 1000);
                return (
                  <img
                    key={i}
                    src={t.dataUrl}
                    className="absolute top-0 object-cover"
                    style={{ left, width: 80, height: THUMB_TRACK_H }}
                    alt=""
                  />
                );
              })}
            </div>

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
              })}
            </div>

            {/* Subtitle track */}
            <div
              className="absolute left-0 right-0 cursor-crosshair"
              style={{ top: RULER_H + THUMB_TRACK_H + CLIP_BAR_H, height: SUB_TRACK_H, background: '#161616' }}
              onDoubleClick={handleTimelineSubtrackClick}
            >
              {localSubs.map(sub => {
                const left = pxFromMs(sub.startMs);
                const width = Math.max(4, pxFromMs(sub.endMs) - left);
                const isFocused = focusedSubId === sub.id;
                return (
                  <div
                    key={sub.id}
                    className={`absolute top-1 bottom-1 rounded flex items-center overflow-hidden text-[10px] text-white/90 ${isFocused ? 'bg-violet-600/80 ring-1 ring-violet-400' : 'bg-sky-700/70'}`}
                    style={{ left, width }}
                    onClick={e => {
                      e.stopPropagation();
                      setFocusedSubId(sub.id);
                      seekToMs(sub.startMs);
                    }}
                    onMouseDown={e => handleSubBlockMouseDown(e, sub, 'move')}
                    title={sub.text}
                  >
                    {/* Left resize handle */}
                    <div
                      className="absolute left-0 top-0 bottom-0 w-2 cursor-w-resize hover:bg-white/20"
                      onMouseDown={e => handleSubBlockMouseDown(e, sub, 'left')}
                    />
                    <span className="px-2 truncate pointer-events-none">{sub.text}</span>
                    {/* Right resize handle */}
                    <div
                      className="absolute right-0 top-0 bottom-0 w-2 cursor-e-resize hover:bg-white/20"
                      onMouseDown={e => handleSubBlockMouseDown(e, sub, 'right')}
                    />
                  </div>
                );
              })}
            </div>

            {/* Playhead */}
            <div
              className="absolute top-0 bottom-0 w-[2px] bg-red-500/80 pointer-events-none"
              style={{ left: pxFromMs(currentMs) }}
            />
          </div>
          </div>
        ) : (
          <div className="flex items-center justify-center h-full text-white/20 text-[12px]">
            {videoOrder.length === 0 ? '请先在视频管理中添加片段' : '加载视频时长中…'}
          </div>
        )}
      </div>

      {/* Spacer so the floating BottomTabBar doesn't cover the timeline */}
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
      className={`px-3 py-2.5 border-b border-white/6 cursor-pointer transition-colors ${focused ? 'bg-violet-900/25' : 'hover:bg-white/4'}`}
      onClick={onFocus}
    >
      <div className="flex items-center justify-between mb-1">
        <span className="text-[11px] text-white/40 tabular-nums">
          {msToDisplay(sub.startMs)} → {msToDisplay(sub.endMs)}
        </span>
        <button
          onClick={e => { e.stopPropagation(); onRemove(); }}
          className="text-white/20 hover:text-red-400 text-[13px] transition-colors"
        >
          ×
        </button>
      </div>
      <textarea
        className="w-full bg-transparent text-[13px] text-white/90 resize-none outline-none focus:text-white"
        rows={2}
        value={sub.text}
        onChange={e => onChange(e.target.value)}
        onClick={e => e.stopPropagation()}
      />
    </div>
  );
}

function RulerTicks({ totalMs, widthPx }: { totalMs: number; widthPx: number }) {
  // Choose tick interval: 1s, 5s, 10s, 30s, 1m, 5m
  const INTERVALS = [1000, 5000, 10000, 30000, 60000, 300000];
  const minTickPx = 40;
  const interval = INTERVALS.find(iv => (iv / totalMs) * widthPx >= minTickPx) ?? INTERVALS[INTERVALS.length - 1];

  const ticks: number[] = [];
  for (let ms = 0; ms <= totalMs; ms += interval) ticks.push(ms);

  return (
    <>
      {ticks.map(ms => {
        const left = (ms / totalMs) * widthPx;
        return (
          <div key={ms} className="absolute bottom-0 flex flex-col items-center" style={{ left }}>
            <span className="text-[9px] text-white/30 mb-0.5">{msToDisplay(ms)}</span>
            <div className="w-px h-2 bg-white/20" />
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
