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
            setResults({ summary: d.summary, videos: d.videos, insight: '', suggestions: [] });
            setLoadingMsg('正在分析爆款规律…');
          } else if (msg.type === 'insight_chunk') {
            insightAccum += msg.data as string;
            setResults(prev => prev ? { ...prev, insight: insightAccum } : null);
          } else if (msg.type === 'suggestions') {
            const suggestions = msg.data as TopicSuggestion[];
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
            placeholder={'输入题材关键词，如\u201c职场穿搭\u201d、\u201c独居生活\u201d\u2026'}
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
