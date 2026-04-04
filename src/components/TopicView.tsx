// src/components/TopicView.tsx
import React, { useState, useRef } from 'react';
import { Loader2 } from 'lucide-react';
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
  { key: 'douyin',      label: '抖音',   color: 'bg-[#484848]/60 text-[#acabaa] border-[#484848]/30' },
];

const SUGGESTION_TAGS = ['高潜力', '稳健型', '爆款预警', '垂直类', '新颖性', '长尾型'];

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
    if (platforms.length === 0) { setError('请至少选择一个平台'); return; }

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
    <div className="absolute inset-0 flex flex-col bg-[#0e0e0e] overflow-hidden">

      {/* Search bar */}
      <div className="flex-shrink-0 flex items-center gap-3 px-6 py-3.5 border-b border-[#484848]/10">
        <div className="flex items-center gap-2 flex-1 bg-[#191a1a] border border-[#484848]/15 rounded-xl px-3 py-2">
          <span className="material-symbols-outlined text-[#767575] text-[18px] flex-shrink-0">search</span>
          <input
            value={keyword}
            onChange={e => setKeyword(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAnalyze()}
            placeholder={'输入题材关键词，如\u201c职场穿搭\u201d、\u201c独居生活\u201d\u2026'}
            className="flex-1 bg-transparent text-[#e7e5e4] text-sm focus:outline-none placeholder:text-[#484848]"
            style={{ fontFamily: 'Manrope' }}
          />
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {PLATFORMS.map(({ key, label, color }) => (
            <button
              key={key}
              onClick={() => togglePlatform(key)}
              className={`px-3 py-1.5 rounded-full text-[12px] font-medium border transition-all ${
                platforms.includes(key)
                  ? color
                  : 'bg-transparent text-[#767575] border-[#484848]/20 hover:border-[#484848]/40'
              }`}
              style={{ fontFamily: 'Inter' }}
            >
              {label}
            </button>
          ))}
        </div>
        <button
          onClick={handleAnalyze}
          disabled={loading || !keyword.trim()}
          className="flex-shrink-0 flex items-center gap-1.5 px-5 py-2 bg-[#c6c6c7] text-[#3f4041] rounded-xl text-sm font-bold hover:bg-[#fbf9f8] transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          style={{ fontFamily: 'Inter' }}
        >
          {loading
            ? <Loader2 size={14} className="animate-spin" />
            : <span className="material-symbols-outlined text-[16px]">search</span>}
          {loading ? (loadingMsg || '分析中…') : '开始分析'}
        </button>
      </div>

      {/* 3-column grid */}
      <div className="flex-1 min-h-0 grid grid-cols-12 gap-0 overflow-hidden pb-[80px]">

        {/* Left: stats + video list */}
        <section className="col-span-3 flex flex-col gap-0 overflow-hidden border-r border-[#484848]/10">
          {/* Stats */}
          {results?.summary ? (
            <div className="flex-shrink-0 p-5 border-b border-[#484848]/10 space-y-4">
              <h3 className="text-[#fbf9f8] font-bold text-base flex items-center gap-2" style={{ fontFamily: 'Manrope' }}>
                <span className="material-symbols-outlined text-[#c6c6c7]">analytics</span>
                视频数据摘要
              </h3>
              <div className="p-4 bg-[#191a1a] rounded-lg">
                <p className="text-[#acabaa] text-[10px] uppercase tracking-widest mb-1" style={{ fontFamily: 'Inter' }}>均播量</p>
                <p className="text-2xl font-black text-[#fbf9f8]" style={{ fontFamily: 'Manrope' }}>{fmt(results.summary.avgViews)}</p>
                <div className="w-full bg-[#484848]/10 h-1 mt-2 rounded-full overflow-hidden">
                  <div className="bg-[#c6c6c7] h-full w-[85%]" />
                </div>
              </div>
              <div className="flex gap-3">
                <div className="flex-1 p-3 bg-[#191a1a] rounded-lg">
                  <p className="text-[#acabaa] text-[10px] uppercase tracking-widest mb-1" style={{ fontFamily: 'Inter' }}>均赞</p>
                  <p className="text-lg font-bold text-[#fbf9f8]" style={{ fontFamily: 'Manrope' }}>{fmt(results.summary.avgLikes)}</p>
                </div>
                <div className="flex-1 p-3 bg-[#191a1a] rounded-lg">
                  <p className="text-[#acabaa] text-[10px] uppercase tracking-widest mb-1" style={{ fontFamily: 'Inter' }}>均藏</p>
                  <p className="text-lg font-bold text-[#fbf9f8]" style={{ fontFamily: 'Manrope' }}>{fmt(results.summary.avgFavorites)}</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex-shrink-0 p-5 border-b border-[#484848]/10">
              <h3 className="text-[#fbf9f8] font-bold text-base flex items-center gap-2" style={{ fontFamily: 'Manrope' }}>
                <span className="material-symbols-outlined text-[#c6c6c7]">analytics</span>
                视频数据摘要
              </h3>
              <p className="text-[#484848] text-xs mt-3" style={{ fontFamily: 'Inter' }}>搜索后显示数据</p>
            </div>
          )}

          {/* Video list */}
          <div className="flex-shrink-0 px-5 pt-5 pb-2">
            <h3 className="text-[#fbf9f8] font-bold text-base flex items-center gap-2" style={{ fontFamily: 'Manrope' }}>
              <span className="material-symbols-outlined text-[#c6c6c7]">trending_up</span>
              近期热点视频
            </h3>
          </div>
          <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-3">
            {!results && !loading && !error && (
              <div className="flex flex-col items-center justify-center h-32 text-[#484848] text-xs text-center gap-2">
                <span className="material-symbols-outlined text-3xl opacity-30">search</span>
                <p>输入关键词开始分析</p>
              </div>
            )}
            {loading && !results && (
              <div className="flex flex-col items-center justify-center h-32 text-[#767575] text-xs gap-2">
                <Loader2 size={24} className="animate-spin" />
                <p>{loadingMsg}</p>
              </div>
            )}
            {error && (
              <div className="flex items-center justify-center h-32">
                <p className="text-red-400 text-xs">{error}</p>
              </div>
            )}
            {results?.videos?.map((v, i) => (
              <TopicVideoCard key={i} video={v} />
            ))}
          </div>
        </section>

        {/* Center: AI report + suggestion cards */}
        <section className="col-span-6 flex flex-col overflow-hidden border-r border-[#484848]/10">
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {/* Report header */}
            <div className="bg-[#191a1a] rounded-xl p-6 relative overflow-hidden">
              <div className="absolute -top-16 -right-16 w-48 h-48 bg-[#c6c6c7]/5 blur-[80px] rounded-full pointer-events-none" />
              <header className="flex justify-between items-end mb-6">
                <div>
                  <h2 className="text-2xl font-black text-[#fbf9f8] tracking-tighter" style={{ fontFamily: 'Manrope' }}>AI 洞察报告</h2>
                  <p className="text-[#acabaa] text-sm mt-1" style={{ fontFamily: 'Inter' }}>基于全网热点趋势生成的爆款策略</p>
                </div>
                {results && (
                  <span className="px-3 py-1 bg-[#252626] rounded-full text-[10px] font-bold text-[#9f9d9d]" style={{ fontFamily: 'Inter' }}>
                    生成时间: 刚刚
                  </span>
                )}
              </header>

              {/* Insight / formula */}
              {(results?.insight || loading) && (
                <div className="bg-[#131313] p-5 rounded-lg border-l-4 border-[#c6c6c7]">
                  <h4 className="text-[#c6c6c7] font-bold text-sm mb-3 flex items-center gap-2" style={{ fontFamily: 'Inter' }}>
                    <span className="material-symbols-outlined text-[16px]">auto_awesome</span>
                    爆款配方
                  </h4>
                  {results?.insight ? (
                    <p className="text-[#e7e5e4] text-sm leading-relaxed whitespace-pre-wrap" style={{ fontFamily: 'Manrope' }}>
                      {results.insight}
                      {loading && <span className="inline-block w-1.5 h-4 bg-[#acabaa] animate-pulse ml-0.5 align-text-bottom" />}
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {[60, 80, 70, 55].map((w, i) => (
                        <div key={i} className="h-3 bg-[#252626] rounded-full animate-pulse" style={{ width: `${w}%` }} />
                      ))}
                    </div>
                  )}
                </div>
              )}

              {!results && !loading && (
                <div className="bg-[#131313] p-5 rounded-lg border-l-4 border-[#484848]/30">
                  <p className="text-[#484848] text-sm" style={{ fontFamily: 'Inter' }}>分析完成后，爆款配方将显示在这里</p>
                </div>
              )}
            </div>

            {/* Suggestion cards grid */}
            {results?.suggestions && results.suggestions.length > 0 && (
              <div className="grid grid-cols-2 gap-4">
                {results.suggestions.map((s, i) => (
                  <div
                    key={i}
                    className="bg-[#1f2020] p-5 rounded-xl border border-[#484848]/5 hover:border-[#484848]/30 transition-all group"
                  >
                    <div className="flex justify-between items-start mb-4">
                      <span className="text-[10px] px-2 py-0.5 bg-[#c6c6c7]/10 text-[#c6c6c7] rounded font-bold" style={{ fontFamily: 'Inter' }}>
                        {SUGGESTION_TAGS[i % SUGGESTION_TAGS.length]}
                      </span>
                      <button
                        onClick={() => handleAdopt(s.title)}
                        className="text-xs font-bold flex items-center gap-1 text-[#acabaa] group-hover:text-[#fbf9f8] transition-colors"
                        style={{ fontFamily: 'Inter' }}
                      >
                        <span className="material-symbols-outlined text-[16px]">add_circle</span> 采用
                      </button>
                    </div>
                    <h5 className="text-[#fbf9f8] font-bold mb-2 text-sm" style={{ fontFamily: 'Manrope' }}>{s.title}</h5>
                    <p className="text-xs text-[#acabaa] line-clamp-2 leading-relaxed" style={{ fontFamily: 'Inter' }}>{s.reason}</p>
                    {s.emotionTag && (
                      <span className="inline-block mt-2 text-[10px] px-2 py-0.5 bg-[#252626] text-[#767575] rounded" style={{ fontFamily: 'Inter' }}>
                        {s.emotionTag}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}

            {results && results.suggestions.length === 0 && loading && (
              <div className="grid grid-cols-2 gap-4">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="bg-[#1f2020] p-5 rounded-xl animate-pulse h-32" />
                ))}
              </div>
            )}
          </div>
        </section>

        {/* Right: idea editor */}
        <section className="col-span-3 flex flex-col gap-4 p-4 overflow-hidden">
          <TopicIdeaEditor
            value={draft}
            onChange={setDraft}
            onSave={() => onSaveDraft(draft)}
            onImportToBreakdown={() => onImportToBreakdown(draft)}
          />
        </section>
      </div>
    </div>
  );
}
