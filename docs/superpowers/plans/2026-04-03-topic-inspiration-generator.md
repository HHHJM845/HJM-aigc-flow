# 选题灵感发散器 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "选题" Tab that lets users input a topic keyword, fetches web-searched video data via Doubao ARK API, and outputs an AI-generated "爆款配方" + topic suggestions, with a bottom editor that can save to the project or jump to the breakdown tab pre-filled.

**Architecture:** New bottom tab renders `TopicView` (same CSS opacity pattern as existing views). Backend route `POST /api/topic-research` calls Volcano Engine ARK with `web_search` plugin in two passes — first to gather video data (JSON), then streaming to generate formula + suggestions (SSE). Frontend reads SSE progressively and renders phases as they arrive.

**Tech Stack:** React 19 + TypeScript, Tailwind CSS v4, Lucide React icons, Express + TypeScript server, Volcano Engine ARK API (`doubao-1-5-pro-32k-250115`) with web_search plugin, Server-Sent Events (SSE) for streaming.

---

## File Map

| Action | Path | Responsibility |
|--------|------|----------------|
| Modify | `src/lib/storage.ts` | Add `topicDraft?: string` to `Project` interface |
| Modify | `src/components/BottomTabBar.tsx` | Add `'topic'` to `ActiveView`, add "选题" tab button |
| Modify | `src/components/BreakdownView.tsx` | Accept `externalInitText?: string`, sync to `scriptText` via `useEffect` |
| Create | `src/components/TopicIdeaEditor.tsx` | Bottom textarea + 存档 / 导入拆本 buttons |
| Create | `src/components/TopicVideoCard.tsx` | One video row with expandable deep-analysis panel |
| Create | `src/components/TopicView.tsx` | Three-zone layout, SSE fetch, state management |
| Create | `server/routes/topic-research.ts` | Two-pass ARK API calls, SSE streaming response |
| Modify | `server/index.ts` | Register `/api/topic-research` route |
| Modify | `src/App.tsx` | Wire `topicDraft` save handler, `breakdownInitText` state, pass props to Flow and TopicView |

---

## Task 1: Extend `Project` type with `topicDraft`

**Files:**
- Modify: `src/lib/storage.ts`

- [ ] **Step 1: Add field to Project interface**

In `src/lib/storage.ts`, find the `Project` interface (line ~37) and add `topicDraft` after `subtitles`:

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
  subtitles: SubtitleEntry[];
  topicDraft?: string;           // ← new
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/storage.ts
git commit -m "feat: add topicDraft field to Project type"
```

---

## Task 2: Add `'topic'` tab to BottomTabBar

**Files:**
- Modify: `src/components/BottomTabBar.tsx`

- [ ] **Step 1: Update the `ActiveView` type and tabs array**

Replace the entire file content:

```tsx
// src/components/BottomTabBar.tsx
import React from 'react';

export type ActiveView = 'topic' | 'canvas' | 'assets' | 'storyboard' | 'breakdown' | 'video' | 'subtitle';

interface Props {
  activeView: ActiveView;
  onViewChange: (view: ActiveView) => void;
  onGoHome: () => void;
}

export default function BottomTabBar({ activeView, onViewChange, onGoHome }: Props) {
  const tabs: { key: ActiveView; label: string }[] = [
    { key: 'topic',      label: '✦ 选题' },
    { key: 'assets',     label: '资产管理' },
    { key: 'breakdown',  label: '剧本拆解' },
    { key: 'canvas',     label: '无限画布' },
    { key: 'storyboard', label: '分镜管理' },
    { key: 'video',      label: '视频管理' },
    { key: 'subtitle',   label: '字幕编辑' },
  ];

  return (
    <div
      className="absolute bottom-5 left-1/2 -translate-x-1/2 z-50 flex items-center gap-1 p-1 rounded-full border border-white/10 shadow-2xl"
      style={{ background: 'rgba(28,28,28,0.92)', backdropFilter: 'blur(12px)' }}
    >
      <button
        onClick={onGoHome}
        className="px-4 py-1.5 rounded-full text-[13px] font-medium transition-all duration-200 text-white/40 hover:text-white/70"
        title="返回首页"
      >
        ⌂
      </button>
      <div className="w-px h-4 bg-white/10 mx-0.5" />
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

- [ ] **Step 2: Fix the import in `src/App.tsx`**

The `ActiveView` type was previously a local type in BottomTabBar with no export. Now it's exported. In `src/App.tsx`, find the line:

```typescript
const [activeView, setActiveView] = useState<'canvas' | 'assets' | 'storyboard' | 'breakdown' | 'video' | 'subtitle'>('canvas');
```

Replace with:

```typescript
import { type ActiveView } from './components/BottomTabBar';
// ...
const [activeView, setActiveView] = useState<ActiveView>('canvas');
```

> Note: Add the import at the top of the file with other imports from `./components/BottomTabBar`.

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd C:/Users/oldch/Desktop/HJM-aigc-flow-main/.claude/worktrees/priceless-khayyam
npx tsc --noEmit
```

Expected: no errors (or only pre-existing errors unrelated to BottomTabBar).

- [ ] **Step 4: Commit**

```bash
git add src/components/BottomTabBar.tsx src/App.tsx
git commit -m "feat: add 选题 tab to bottom navigation bar"
```

---

## Task 3: Update `BreakdownView` to accept external pre-fill

**Files:**
- Modify: `src/components/BreakdownView.tsx`

- [ ] **Step 1: Add `externalInitText` prop**

Find the `Props` interface (around line 89) and the component signature. Update both:

```typescript
// ── Props ─────────────────────────────────────────────
interface Props {
  initialRows?: StoryboardRow[];
  onImport: (rows: StoryboardRow[], ratio: string, cardW: number, cardH: number) => void;
  externalInitText?: string;   // ← new: text injected from TopicView's "导入拆本"
}

// ── Main Component ────────────────────────────────────
export default function BreakdownView({ initialRows, onImport, externalInitText }: Props) {
```

- [ ] **Step 2: Add a `useEffect` that syncs `externalInitText` into `scriptText`**

Add this effect right after the existing state declarations (around line 107, after `const fileInputRef` block):

```typescript
// Sync text injected from TopicView
useEffect(() => {
  if (externalInitText) {
    setScriptText(externalInitText);
  }
}, [externalInitText]);
```

- [ ] **Step 3: Commit**

```bash
git add src/components/BreakdownView.tsx
git commit -m "feat: add externalInitText prop to BreakdownView for topic import"
```

---

## Task 4: Create `TopicIdeaEditor` component

**Files:**
- Create: `src/components/TopicIdeaEditor.tsx`

- [ ] **Step 1: Write the component**

```tsx
// src/components/TopicIdeaEditor.tsx
import React from 'react';
import { Save, ArrowRight } from 'lucide-react';

interface Props {
  value: string;
  onChange: (text: string) => void;
  onSave: () => void;
  onImportToBreakdown: () => void;
}

export default function TopicIdeaEditor({ value, onChange, onSave, onImportToBreakdown }: Props) {
  return (
    <div className="flex-shrink-0 border-t border-white/[0.06] bg-[#0c0c0c]">
      <div className="flex items-center justify-between px-5 py-2.5 border-b border-white/[0.04]">
        <span className="text-[12px] text-gray-500 font-medium">我的选题想法</span>
        <div className="flex items-center gap-2">
          <button
            onClick={onSave}
            disabled={!value.trim()}
            className="flex items-center gap-1.5 px-3 py-1 bg-white/5 hover:bg-white/10 text-gray-400 hover:text-gray-200 rounded-lg text-xs transition-colors border border-white/5 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Save size={11} />
            存档
          </button>
          <button
            onClick={onImportToBreakdown}
            disabled={!value.trim()}
            className="flex items-center gap-1.5 px-3 py-1 bg-white text-black rounded-lg text-xs font-medium hover:bg-gray-200 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          >
            导入拆本
            <ArrowRight size={11} />
          </button>
        </div>
      </div>
      <textarea
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder="在此输入或从右侧点击「采用」填入选题想法，再导入剧本拆解流程…"
        className="w-full h-24 bg-transparent text-gray-200 text-sm leading-relaxed px-5 py-3 focus:outline-none resize-none"
        style={{ fontFamily: 'inherit' }}
      />
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/TopicIdeaEditor.tsx
git commit -m "feat: create TopicIdeaEditor component"
```

---

## Task 5: Create `TopicVideoCard` component

**Files:**
- Create: `src/components/TopicVideoCard.tsx`

- [ ] **Step 1: Write the component**

```tsx
// src/components/TopicVideoCard.tsx
import React, { useState } from 'react';
import { ChevronDown, ExternalLink } from 'lucide-react';

export interface VideoItem {
  title: string;
  platform: 'bilibili' | 'xiaohongshu' | 'douyin';
  url: string;
  thumbnail: string;
  views: number;
  likes: number;
  favorites: number;
  brief: string;
  topComments: string[];
  analysis: string;
}

const PLATFORM_LABEL: Record<string, { label: string; color: string }> = {
  bilibili:     { label: 'B站',   color: 'bg-blue-500/20 text-blue-300' },
  xiaohongshu:  { label: '小红书', color: 'bg-red-500/20 text-red-300' },
  douyin:       { label: '抖音',   color: 'bg-gray-500/20 text-gray-300' },
};

function fmt(n: number): string {
  if (n >= 10000) return `${(n / 10000).toFixed(1)}w`;
  return n.toLocaleString();
}

interface Props {
  video: VideoItem;
}

export default function TopicVideoCard({ video }: Props) {
  const [expanded, setExpanded] = useState(false);
  const p = PLATFORM_LABEL[video.platform] ?? PLATFORM_LABEL.bilibili;

  return (
    <div className="border-b border-white/[0.04] last:border-0">
      {/* Main row */}
      <div className="flex items-center gap-3 px-4 py-3 hover:bg-white/[0.02] transition-colors">
        {/* Thumbnail */}
        <div className="flex-shrink-0 w-14 h-10 rounded overflow-hidden bg-white/5">
          {video.thumbnail ? (
            <img src={video.thumbnail} alt="" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-gray-700 text-xs">
              暂无
            </div>
          )}
        </div>

        {/* Title + platform */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-0.5">
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${p.color}`}>
              {p.label}
            </span>
            <a
              href={video.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-gray-300 text-xs truncate hover:text-white transition-colors flex items-center gap-1"
              title={video.title}
            >
              {video.title}
              <ExternalLink size={9} className="flex-shrink-0 text-gray-600" />
            </a>
          </div>
        </div>

        {/* Stats */}
        <div className="flex items-center gap-4 flex-shrink-0 text-[11px] text-gray-500">
          <span title="播放量">▶ {fmt(video.views)}</span>
          <span title="点赞量">👍 {fmt(video.likes)}</span>
          <span title="收藏量">★ {fmt(video.favorites)}</span>
        </div>

        {/* Deep analysis toggle */}
        <button
          onClick={() => setExpanded(v => !v)}
          className="flex-shrink-0 flex items-center gap-1 px-3 py-1 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 rounded-full text-[11px] font-medium transition-colors"
        >
          深度解析
          <ChevronDown size={10} className={`transition-transform ${expanded ? 'rotate-180' : ''}`} />
        </button>
      </div>

      {/* Expanded panel */}
      {expanded && (
        <div className="mx-4 mb-3 p-3 rounded-xl bg-white/[0.03] border border-white/[0.06] space-y-2">
          <div>
            <p className="text-[11px] text-amber-400/80 font-medium mb-1">✦ 爆款原因</p>
            <p className="text-xs text-gray-300 leading-relaxed">{video.analysis}</p>
          </div>
          {video.topComments.length > 0 && (
            <div>
              <p className="text-[11px] text-gray-500 font-medium mb-1">代表评论</p>
              <ul className="space-y-1">
                {video.topComments.map((c, i) => (
                  <li key={i} className="text-xs text-gray-400 leading-relaxed before:content-['"'] after:content-['"']">
                    {c}
                  </li>
                ))}
              </ul>
            </div>
          )}
          <div>
            <p className="text-[11px] text-gray-500 font-medium mb-1">内容简介</p>
            <p className="text-xs text-gray-500 leading-relaxed">{video.brief}</p>
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/TopicVideoCard.tsx
git commit -m "feat: create TopicVideoCard component with expandable deep analysis"
```

---

## Task 6: Create `TopicView` component

**Files:**
- Create: `src/components/TopicView.tsx`

- [ ] **Step 1: Write the component**

```tsx
// src/components/TopicView.tsx
import React, { useState, useRef } from 'react';
import { Search, Loader2 } from 'lucide-react';
import TopicVideoCard, { type VideoItem } from './TopicVideoCard';
import TopicIdeaEditor from './TopicIdeaEditor';

export interface TopicSuggestion {
  title: string;
  reason: string;
  emotionTag: string;
}

export interface VideoSummary {
  avgViews: number;
  avgLikes: number;
  avgFavorites: number;
}

interface TopicResults {
  summary: VideoSummary;
  videos: VideoItem[];
  insight: string;
  suggestions: TopicSuggestion[];
}

type Platform = 'bilibili' | 'xiaohongshu' | 'douyin';

const PLATFORMS: { key: Platform; label: string; color: string }[] = [
  { key: 'bilibili',    label: 'B站',   color: 'bg-blue-500/20 text-blue-300 border-blue-500/30' },
  { key: 'xiaohongshu', label: '小红书', color: 'bg-red-500/20 text-red-300 border-red-500/30' },
  { key: 'douyin',      label: '抖音',   color: 'bg-gray-500/20 text-gray-300 border-gray-500/30' },
];

function fmt(n: number): string {
  if (n >= 10000) return `${(n / 10000).toFixed(1)}w`;
  return n.toLocaleString();
}

interface Props {
  initialDraft?: string;
  onSaveDraft: (text: string) => void;
  onImportToBreakdown: (text: string) => void;
}

export default function TopicView({ initialDraft = '', onSaveDraft, onImportToBreakdown }: Props) {
  const [keyword, setKeyword] = useState('');
  const [platforms, setPlatforms] = useState<Platform[]>(['bilibili', 'xiaohongshu', 'douyin']);
  const [loading, setLoading] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState('');
  const [results, setResults] = useState<TopicResults | null>(null);
  const [error, setError] = useState('');
  const [draft, setDraft] = useState(initialDraft);
  const abortRef = useRef<AbortController | null>(null);

  const togglePlatform = (p: Platform) => {
    setPlatforms(prev =>
      prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p]
    );
  };

  const handleAnalyze = async () => {
    if (!keyword.trim() || loading) return;
    if (platforms.length === 0) {
      setError('请至少选择一个平台');
      return;
    }

    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    setLoading(true);
    setError('');
    setResults(null);
    setLoadingMsg('正在联网搜索相关内容…');

    try {
      const res = await fetch('/api/topic-research', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keyword: keyword.trim(), platforms }),
        signal: ctrl.signal,
      });

      if (!res.ok) {
        const json = await res.json().catch(() => ({ error: `HTTP ${res.status}` })) as { error: string };
        throw new Error(json.error || `请求失败 ${res.status}`);
      }

      if (!res.body) throw new Error('无响应流');

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      const partialResults: Partial<TopicResults> = {};
      let insightAccum = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const payload = line.slice(6).trim();
          if (payload === '[DONE]') break;

          let msg: { type: string; data: unknown };
          try { msg = JSON.parse(payload); } catch { continue; }

          if (msg.type === 'videos') {
            const d = msg.data as { summary: VideoSummary; videos: VideoItem[] };
            partialResults.summary = d.summary;
            partialResults.videos = d.videos;
            setResults({ summary: d.summary, videos: d.videos, insight: '', suggestions: [] });
            setLoadingMsg('正在分析爆款规律…');
          } else if (msg.type === 'insight_chunk') {
            insightAccum += msg.data as string;
            setResults(prev => prev ? { ...prev, insight: insightAccum } : null);
          } else if (msg.type === 'suggestions') {
            const suggestions = msg.data as TopicSuggestion[];
            partialResults.suggestions = suggestions;
            setResults(prev => prev ? { ...prev, suggestions } : null);
          } else if (msg.type === 'error') {
            throw new Error((msg.data as { message: string }).message);
          }
        }
      }
    } catch (err: unknown) {
      if ((err as Error).name === 'AbortError') return;
      setError((err as Error).message || '分析失败，请稍后重试');
    } finally {
      setLoading(false);
      setLoadingMsg('');
    }
  };

  const handleAdopt = (title: string) => {
    setDraft(prev => prev ? `${prev}\n\n${title}` : title);
  };

  return (
    <div className="absolute inset-0 flex flex-col bg-[#0c0c0c] overflow-hidden">

      {/* ── 顶部：输入区 ── */}
      <div className="flex-shrink-0 flex items-center gap-3 px-5 py-3.5 border-b border-white/[0.06]">
        <div className="flex items-center gap-2 flex-1 bg-white/5 border border-white/[0.08] rounded-xl px-3 py-2">
          <Search size={14} className="text-gray-500 flex-shrink-0" />
          <input
            value={keyword}
            onChange={e => setKeyword(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAnalyze()}
            placeholder="输入题材关键词，如"职场穿搭"、"独居生活"…"
            className="flex-1 bg-transparent text-gray-200 text-sm focus:outline-none placeholder:text-gray-600"
          />
        </div>

        {/* Platform toggles */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {PLATFORMS.map(({ key, label, color }) => (
            <button
              key={key}
              onClick={() => togglePlatform(key)}
              className={`px-3 py-1.5 rounded-full text-[12px] font-medium border transition-all ${
                platforms.includes(key)
                  ? color
                  : 'bg-transparent text-gray-600 border-white/10 hover:border-white/20'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <button
          onClick={handleAnalyze}
          disabled={loading || !keyword.trim()}
          className="flex-shrink-0 flex items-center gap-1.5 px-5 py-2 bg-white text-black rounded-xl text-sm font-medium hover:bg-gray-200 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {loading ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
          {loading ? loadingMsg || '分析中…' : '开始分析'}
        </button>
      </div>

      {/* ── 中部：结果区 ── */}
      <div className="flex-1 min-h-0 flex overflow-hidden">

        {/* 左栏：数据概览 + 视频列表 */}
        <div className="w-1/2 flex flex-col border-r border-white/[0.06] overflow-hidden">

          {/* 数据概览 */}
          {results?.summary && (
            <div className="flex-shrink-0 grid grid-cols-3 gap-3 p-4 border-b border-white/[0.06]">
              {[
                { label: '平均播放量', value: fmt(results.summary.avgViews) },
                { label: '平均点赞量', value: fmt(results.summary.avgLikes) },
                { label: '平均收藏量', value: fmt(results.summary.avgFavorites) },
              ].map(({ label, value }) => (
                <div key={label} className="bg-white/[0.04] rounded-xl p-3 border border-white/[0.06]">
                  <p className="text-[11px] text-gray-500 mb-1">{label}</p>
                  <p className="text-lg font-semibold text-white">{value}</p>
                </div>
              ))}
            </div>
          )}

          {/* 视频列表 */}
          <div className="flex-1 overflow-y-auto">
            {!results && !loading && !error && (
              <div className="flex flex-col items-center justify-center h-full text-gray-600">
                <Search size={32} className="mb-3 opacity-30" />
                <p className="text-sm">输入关键词开始分析</p>
              </div>
            )}
            {loading && !results && (
              <div className="flex flex-col items-center justify-center h-full text-gray-600">
                <Loader2 size={28} className="animate-spin mb-3 text-gray-500" />
                <p className="text-sm">{loadingMsg}</p>
              </div>
            )}
            {error && (
              <div className="flex items-center justify-center h-full">
                <p className="text-red-400 text-sm">{error}</p>
              </div>
            )}
            {results?.videos?.map((v, i) => (
              <TopicVideoCard key={i} video={v} />
            ))}
          </div>
        </div>

        {/* 右栏：AI 洞察报告 */}
        <div className="w-1/2 flex flex-col overflow-hidden">
          <div className="flex-shrink-0 px-5 py-3 border-b border-white/[0.06]">
            <span className="text-[13px] font-medium text-white">✦ AI 洞察报告</span>
          </div>
          <div className="flex-1 overflow-y-auto p-5 space-y-5">

            {/* 爆款配方 */}
            {(results?.insight || loading) && (
              <div>
                <p className="text-[12px] text-amber-400/80 font-semibold mb-2 uppercase tracking-wide">爆款配方</p>
                {results?.insight ? (
                  <div className="text-sm text-gray-300 leading-relaxed whitespace-pre-wrap">
                    {results.insight}
                    {loading && <span className="inline-block w-1.5 h-4 bg-gray-400 animate-pulse ml-0.5 align-text-bottom" />}
                  </div>
                ) : (
                  <div className="space-y-2">
                    {[60, 80, 70, 55].map((w, i) => (
                      <div key={i} className="h-3 bg-white/[0.06] rounded-full animate-pulse" style={{ width: `${w}%` }} />
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* 选题建议 */}
            {results?.suggestions && results.suggestions.length > 0 && (
              <div>
                <p className="text-[12px] text-amber-400/80 font-semibold mb-2 uppercase tracking-wide">选题建议</p>
                <div className="space-y-2.5">
                  {results.suggestions.map((s, i) => (
                    <div
                      key={i}
                      className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.06] hover:border-white/10 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-2 mb-1.5">
                        <p className="text-sm font-medium text-white leading-snug">{s.title}</p>
                        <button
                          onClick={() => handleAdopt(s.title)}
                          className="flex-shrink-0 px-2.5 py-0.5 bg-amber-500/15 hover:bg-amber-500/25 text-amber-400 rounded-full text-[11px] font-medium transition-colors"
                        >
                          采用
                        </button>
                      </div>
                      <p className="text-xs text-gray-500 leading-relaxed mb-1.5">{s.reason}</p>
                      <span className="inline-block px-2 py-0.5 bg-white/[0.06] text-gray-400 rounded-full text-[10px]">
                        {s.emotionTag}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Empty state */}
            {!results && !loading && (
              <div className="flex flex-col items-center justify-center h-40 text-gray-700 text-sm">
                分析完成后，爆款配方和选题建议将显示在这里
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── 底部：想法编辑器 ── */}
      <TopicIdeaEditor
        value={draft}
        onChange={setDraft}
        onSave={() => onSaveDraft(draft)}
        onImportToBreakdown={() => onImportToBreakdown(draft)}
      />
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/TopicView.tsx
git commit -m "feat: create TopicView with SSE streaming and three-zone layout"
```

---

## Task 7: Create backend route `server/routes/topic-research.ts`

**Files:**
- Create: `server/routes/topic-research.ts`

- [ ] **Step 1: Write the route**

```typescript
// server/routes/topic-research.ts
import { Router, type Request, type Response } from 'express';

const router = Router();
const ARK_BASE = 'https://ark.cn-beijing.volces.com/api/v3';
const MODEL = 'doubao-1-5-pro-32k-250115';

const PLATFORM_NAMES: Record<string, string> = {
  bilibili: 'B站（bilibili.com）',
  xiaohongshu: '小红书（xiaohongshu.com）',
  douyin: '抖音（douyin.com）',
};

function sseWrite(res: Response, data: object) {
  res.write(`data: ${JSON.stringify(data)}\n\n`);
}

router.post('/', async (req: Request, res: Response) => {
  const { keyword, platforms } = req.body as {
    keyword?: string;
    platforms?: string[];
  };

  if (!keyword?.trim()) {
    return res.status(400).json({ error: '请提供关键词' });
  }

  const selectedPlatforms = (platforms ?? ['bilibili', 'xiaohongshu', 'douyin'])
    .filter((p): p is string => typeof p === 'string');

  const apiKey = process.env.IMAGE_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: '服务端未配置 IMAGE_API_KEY' });
  }

  // SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  try {
    const platformDesc = selectedPlatforms
      .map(p => PLATFORM_NAMES[p] ?? p)
      .join('、');

    // ── Pass 1: Web search for video data ───────────────────
    const searchPrompt = `你是内容研究助手。请搜索"${keyword}"这个题材在${platformDesc}上的热门视频内容。

分析搜索结果，选取 8-12 条最有代表性的视频（优先选播放量、点赞量高的），以纯 JSON 格式返回，不要有任何多余文字、注释或 markdown 代码块，直接返回 JSON：

{
  "summary": {
    "avgViews": <平均播放量数字>,
    "avgLikes": <平均点赞量数字>,
    "avgFavorites": <平均收藏量数字>
  },
  "videos": [
    {
      "title": "<视频标题>",
      "platform": "<bilibili|xiaohongshu|douyin>",
      "url": "<视频链接，如找不到填空字符串>",
      "thumbnail": "<封面图URL，如找不到填空字符串>",
      "views": <播放量数字，估算即可>,
      "likes": <点赞量数字，估算即可>,
      "favorites": <收藏量数字，估算即可>,
      "brief": "<视频内容简介，2-3句>",
      "topComments": ["<评论1>", "<评论2>", "<评论3>"],
      "analysis": "<这条视频爆火的核心原因，重点分析内容切入角度、情绪触发点、标题技巧，2-4句>"
    }
  ]
}`;

    const searchResp = await fetch(`${ARK_BASE}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [{ role: 'user', content: searchPrompt }],
        tools: [{ type: 'web_search', web_search: { enable: true, search_prompt_enabled: true } }],
        temperature: 0.3,
      }),
    });

    if (!searchResp.ok) {
      const text = await searchResp.text();
      sseWrite(res, { type: 'error', data: { message: `搜索服务错误: ${text.slice(0, 200)}` } });
      res.write('data: [DONE]\n\n');
      return res.end();
    }

    const searchJson = await searchResp.json() as {
      choices: { message: { content: string } }[];
    };

    let rawContent = searchJson.choices?.[0]?.message?.content ?? '';
    // Strip markdown code fences if model wrapped the JSON
    rawContent = rawContent.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();

    let videoData: {
      summary: { avgViews: number; avgLikes: number; avgFavorites: number };
      videos: {
        title: string; platform: string; url: string; thumbnail: string;
        views: number; likes: number; favorites: number;
        brief: string; topComments: string[]; analysis: string;
      }[];
    };

    try {
      videoData = JSON.parse(rawContent);
    } catch {
      // Model didn't return clean JSON — extract what we can
      sseWrite(res, {
        type: 'error',
        data: { message: '未找到相关内容，请换词重试（联网搜索结果解析失败）' },
      });
      res.write('data: [DONE]\n\n');
      return res.end();
    }

    if (!videoData.videos?.length) {
      sseWrite(res, {
        type: 'error',
        data: { message: '未找到相关视频内容，请尝试更换关键词或平台' },
      });
      res.write('data: [DONE]\n\n');
      return res.end();
    }

    // Send Phase 1
    sseWrite(res, { type: 'videos', data: videoData });

    // ── Pass 2: Streaming insight + suggestions ───────────────
    const videosText = videoData.videos
      .map((v, i) =>
        `视频${i + 1}：${v.title}（${v.platform}，播放${v.views}，点赞${v.likes}）\n分析：${v.analysis}\n代表评论：${v.topComments.join(' / ')}`
      )
      .join('\n\n');

    const insightPrompt = `根据以下关于"${keyword}"题材的视频研究数据，请完成两个任务：

【视频研究数据】
${videosText}

【任务一：爆款配方】
用简洁要点（每点一行，用•开头）总结该题材爆款内容的共同规律，涵盖：
• 内容切入角度（观众最感兴趣的切入点）
• 情绪钩子类型（触发共鸣/好奇/感动的方式）
• 标题结构规律（高点击标题的写法特征）
• 高频评论诉求（观众在评论区最常表达的需求或情感）

请先输出爆款配方内容，然后在结尾另起一行输出如下格式的 JSON（不要有其他文字）：
===SUGGESTIONS_JSON===
[
  {
    "title": "<建议选题标题，10-20字，有吸引力>",
    "reason": "<为什么这个角度容易引发共鸣，1-2句>",
    "emotionTag": "<单个情绪标签，如：共鸣|感动|涨知识|好奇|争议>"
  }
]
===END===

要求：给出 6-8 个选题建议，覆盖不同角度，避免重复。`;

    const streamResp = await fetch(`${ARK_BASE}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [{ role: 'user', content: insightPrompt }],
        stream: true,
        temperature: 0.7,
      }),
    });

    if (!streamResp.ok || !streamResp.body) {
      sseWrite(res, { type: 'error', data: { message: 'AI 分析服务暂时不可用' } });
      res.write('data: [DONE]\n\n');
      return res.end();
    }

    const reader = streamResp.body.getReader();
    const decoder = new TextDecoder();
    let fullText = '';
    let jsonSent = false;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split('\n');

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const payload = line.slice(6).trim();
        if (payload === '[DONE]') continue;

        let parsed: { choices?: { delta?: { content?: string } }[] };
        try { parsed = JSON.parse(payload); } catch { continue; }

        const delta = parsed.choices?.[0]?.delta?.content ?? '';
        if (!delta) continue;

        fullText += delta;

        // Stream insight portion (before the JSON marker)
        const markerIdx = fullText.indexOf('===SUGGESTIONS_JSON===');
        if (markerIdx === -1) {
          // Still in insight territory — stream the new delta
          sseWrite(res, { type: 'insight_chunk', data: delta });
        } else if (!jsonSent) {
          // We have the marker — extract and parse suggestions
          const jsonStart = markerIdx + '===SUGGESTIONS_JSON==='.length;
          const jsonEnd = fullText.indexOf('===END===', jsonStart);
          if (jsonEnd !== -1) {
            const jsonStr = fullText.slice(jsonStart, jsonEnd).trim();
            try {
              const suggestions = JSON.parse(jsonStr);
              sseWrite(res, { type: 'suggestions', data: suggestions });
              jsonSent = true;
            } catch {
              // Malformed JSON — skip suggestions gracefully
            }
          }
        }
      }
    }

    res.write('data: [DONE]\n\n');
    res.end();
  } catch (err: unknown) {
    if (!res.writableEnded) {
      sseWrite(res, {
        type: 'error',
        data: { message: (err as Error).message || '服务器内部错误' },
      });
      res.write('data: [DONE]\n\n');
      res.end();
    }
  }
});

export default router;
```

- [ ] **Step 2: Commit**

```bash
git add server/routes/topic-research.ts
git commit -m "feat: add topic-research backend route with web_search SSE streaming"
```

---

## Task 8: Register route in `server/index.ts`

**Files:**
- Modify: `server/index.ts`

- [ ] **Step 1: Add import and route registration**

After the last existing import (line 16 `import optimizePromptRouter...`), add:

```typescript
import topicResearchRouter from './routes/topic-research.js';
```

After `app.use('/api/optimize-prompt', optimizePromptRouter);` (line 46), add:

```typescript
app.use('/api/topic-research', topicResearchRouter);
```

- [ ] **Step 2: Commit**

```bash
git add server/index.ts
git commit -m "feat: register /api/topic-research route"
```

---

## Task 9: Wire `TopicView` into App.tsx

**Files:**
- Modify: `src/App.tsx`

This task has multiple sub-steps because App.tsx is the orchestrator.

- [ ] **Step 1: Add TopicView import at the top of `src/App.tsx`**

After `import SubtitleView from './components/SubtitleView';`, add:

```typescript
import TopicView from './components/TopicView';
```

- [ ] **Step 2: Add `breakdownInitText` state and `topicDraft` state to the `Flow` component**

In the `Flow` component, find the `[activeView, setActiveView]` state declaration (line ~138). Add the two new states right after it:

```typescript
const [activeView, setActiveView] = useState<ActiveView>('canvas');
const [topicDraft, setTopicDraft] = useState(initialTopicDraft);
const [breakdownInitText, setBreakdownInitText] = useState('');
```

- [ ] **Step 3: Add the new props to `Flow`'s props interface and function signature**

In the `Flow` function props interface (around line 113), add:

```typescript
initialTopicDraft: string;
onSaveTopicDraft: (draft: string) => void;
```

Update the function signature to destructure these:

```typescript
function Flow({
  // ...existing props...
  initialTopicDraft,
  onSaveTopicDraft,
}: { /* ...existing interface with new fields... */ }) {
```

- [ ] **Step 4: Add the TopicView div before the BottomTabBar render**

Find the `{/* Bottom tab bar */}` comment (line ~963). Before it, insert:

```tsx
{/* Topic inspiration view */}
<div
  className="absolute inset-0"
  style={{
    opacity: activeView === 'topic' ? 1 : 0,
    transform: activeView === 'topic' ? 'translateY(0)' : 'translateY(8px)',
    transition: 'opacity 300ms ease-out, transform 300ms ease-out',
    pointerEvents: activeView === 'topic' ? 'auto' : 'none',
  }}
>
  <TopicView
    initialDraft={topicDraft}
    onSaveDraft={(text) => {
      setTopicDraft(text);
      onSaveTopicDraft(text);
    }}
    onImportToBreakdown={(text) => {
      setBreakdownInitText(text);
      setActiveView('breakdown');
    }}
  />
</div>
```

- [ ] **Step 5: Pass `externalInitText` to `BreakdownView`**

Find the `<BreakdownView` JSX (line ~887). Update it to pass the new prop:

```tsx
<BreakdownView
  initialRows={storyboardRows}
  onImport={handleImportFromBreakdown}
  externalInitText={breakdownInitText}
/>
```

- [ ] **Step 6: Add App-level `topicDraft` state and handler (in root App component)**

In the root `App` component (around line 970+), add state initialization alongside other `canvasInitial*` state. Find where `canvasInitialSubtitles` is declared and add:

```typescript
const [canvasInitialTopicDraft, setCanvasInitialTopicDraft] = useState('');
```

Add the save handler alongside `handleSubtitlesSave`:

```typescript
const handleTopicDraftSave = (draft: string) => {
  if (!currentProject) return;
  const updated = { ...currentProject, topicDraft: draft, updatedAt: Date.now() };
  setCurrentProject(updated);
  wsSaveProject(updated);
};
```

- [ ] **Step 7: Initialize `canvasInitialTopicDraft` when opening a project**

In `handleOpenProject` (line ~1034), add alongside other setters:

```typescript
setCanvasInitialTopicDraft(project.topicDraft ?? '');
```

In `handleNewProject`, add:

```typescript
setCanvasInitialTopicDraft('');
```

- [ ] **Step 8: Pass new props to `<Flow />`**

In the `<Flow ...>` JSX (line ~1114), add:

```tsx
initialTopicDraft={canvasInitialTopicDraft}
onSaveTopicDraft={handleTopicDraftSave}
```

- [ ] **Step 9: Verify TypeScript compiles**

```bash
cd C:/Users/oldch/Desktop/HJM-aigc-flow-main/.claude/worktrees/priceless-khayyam
npx tsc --noEmit
```

Expected: no new type errors.

- [ ] **Step 10: Commit**

```bash
git add src/App.tsx
git commit -m "feat: wire TopicView into Flow, add topicDraft save handler and breakdownInitText"
```

---

## Task 10: Smoke test in dev server

- [ ] **Step 1: Start dev server**

```bash
cd C:/Users/oldch/Desktop/HJM-aigc-flow-main/.claude/worktrees/priceless-khayyam
npm run dev
```

Expected: server starts on port 3001, Vite on port 3000, no compile errors printed.

- [ ] **Step 2: Verify the tab appears**

Open `http://localhost:3000` in browser, open any project. The bottom tab bar should now show **✦ 选题** as the first tab.

- [ ] **Step 3: Verify basic search flow**

1. Click **✦ 选题** tab
2. Type a keyword (e.g. "独居生活")
3. Click **开始分析**
4. Confirm loading indicator appears
5. Confirm video list renders after ~10-30 seconds
6. Confirm AI 洞察 streams in on the right
7. Confirm topic suggestion cards appear

- [ ] **Step 4: Verify deep analysis expand**

Click "深度解析" on any video row → panel expands below the row. Click again → collapses.

- [ ] **Step 5: Verify adopt + import flow**

1. Click "采用" on any suggestion → text appears in bottom editor
2. Click "存档" → no error, button momentarily enabled
3. Click "→ 导入拆本" → view switches to **剧本拆解** tab with text pre-filled in the script textarea

- [ ] **Step 6: Verify persistence**

1. Type in idea editor, click "存档"
2. Refresh page, re-open same project
3. Click **✦ 选题** tab → draft text should still be there

- [ ] **Step 7: Verify no-result error handling**

Search for a very obscure term (e.g. "xyzxyzxyzunknown") → friendly error message appears, no crash.

- [ ] **Step 8: Final commit**

```bash
git add -A
git commit -m "feat: topic inspiration generator — complete integration"
```

---

## Self-Review

**Spec coverage check:**
- ✅ 新增"选题"Tab，排在底部栏最左侧 → Task 2
- ✅ 关键词输入 + 平台多选 → TopicView input zone
- ✅ 豆包 web_search 联网搜索 → Task 7 (topic-research.ts)
- ✅ 爆款配方（流式打字）→ SSE `insight_chunk` events
- ✅ 选题建议 6-8 条，含原因+情绪标签+"采用"按钮 → TopicView right panel
- ✅ 深度解析展开（原地，不弹窗）→ TopicVideoCard expanded panel
- ✅ 数据概览（播放/点赞/收藏均值）→ TopicView left panel
- ✅ 底部想法编辑器 → TopicIdeaEditor
- ✅ 存档 → `onSaveDraft` → `handleTopicDraftSave` → `wsSaveProject`
- ✅ 一键导入拆本 → `breakdownInitText` + `setActiveView('breakdown')`
- ✅ BreakdownView 接收 externalInitText → Task 3
- ✅ 联网无结果友好提示 → error SSE event + frontend error state
- ✅ Project 类型扩展 → Task 1

**Type consistency:**
- `ActiveView` exported from BottomTabBar, imported in App.tsx — consistent
- `VideoItem` exported from TopicVideoCard, used in TopicView — consistent
- `TopicSuggestion`, `VideoSummary` defined in TopicView, used locally — consistent
- `topicDraft?: string` in Project matches save handler `{ ...currentProject, topicDraft: draft }` — consistent

**Placeholder scan:** No TBDs, no "implement later", all code steps have complete implementations.
