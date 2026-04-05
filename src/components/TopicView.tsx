// src/components/TopicView.tsx
import React, { useState, useRef, useEffect } from 'react';
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

const PLATFORMS: { key: Platform; label: string }[] = [
  { key: 'bilibili',    label: 'B站' },
  { key: 'xiaohongshu', label: '小红书' },
  { key: 'douyin',      label: '抖音' },
];

const SUGGESTION_TAGS = ['高成功率', '潜力黑马', '话题常青', '互动率高', '高潜力', '长尾型'];

function fmt(n: number): string {
  if (n >= 10000) return `${(n / 10000).toFixed(1)}w`;
  return n.toLocaleString();
}

interface Props {
  initialDraft?: string;
  initialKeyword?: string;
  onSaveDraft: (text: string) => void;
  onImportToBreakdown: (text: string) => void;
}

export default function TopicView({ initialDraft = '', initialKeyword = '', onSaveDraft, onImportToBreakdown }: Props) {
  const [keyword, setKeyword] = useState(initialKeyword);
  const [platforms, setPlatforms] = useState<Platform[]>(['bilibili', 'xiaohongshu', 'douyin']);
  const [loading, setLoading] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState('');
  const [results, setResults] = useState<TopicResults | null>(null);
  const [error, setError] = useState('');
  const [draft, setDraft] = useState(initialDraft);
  const abortRef = useRef<AbortController | null>(null);
  const autoTriggered = useRef(false);

  // Reset auto-trigger guard when keyword prop changes so each new navigation triggers fresh analysis
  useEffect(() => {
    autoTriggered.current = false;
  }, [initialKeyword]);

  // Auto-trigger search when navigated from homepage with a keyword
  useEffect(() => {
    if (initialKeyword && !autoTriggered.current) {
      autoTriggered.current = true;
      setKeyword(initialKeyword);
      // Pass keyword directly to avoid stale closure (state update is async)
      setTimeout(() => handleAnalyze(initialKeyword), 100);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialKeyword]);

  const togglePlatform = (p: Platform) => {
    setPlatforms(prev =>
      prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p]
    );
  };

  const handleAnalyze = async (kwOverride?: string) => {
    const kw = (kwOverride ?? keyword).trim();
    if (!kw || loading) return;
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
        body: JSON.stringify({ keyword: kw, platforms }),
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

  const hasResults = results !== null;

  return (
    <div className="absolute inset-0 flex flex-col bg-black overflow-hidden">

      {/* Search section */}
      <div className="flex-shrink-0 flex flex-col items-center gap-4 px-8 pt-6 pb-5 border-b border-white/[0.06]">
        {/* Platform toggles */}
        <div className="flex bg-[#0d0d0d] p-1 rounded-full border border-white/[0.06]">
          {PLATFORMS.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => togglePlatform(key)}
              className={`px-7 py-2 rounded-full text-sm transition-all ${
                platforms.includes(key)
                  ? 'bg-[#e0e0e0]/10 text-[#e0e0e0] border border-[#e0e0e0]/20'
                  : 'text-white/40 hover:text-[#e0e0e0]'
              }`}
              style={{ fontFamily: 'Inter' }}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Search input */}
        <div className="relative w-full max-w-3xl">
          <span className="material-symbols-outlined absolute left-5 top-1/2 -translate-y-1/2 text-white/40">search</span>
          <input
            value={keyword}
            onChange={e => setKeyword(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAnalyze()}
            placeholder="输入关键词、博主名或话题趋势..."
            className="w-full bg-[#0d0d0d] border-none rounded-xl py-4 pl-14 pr-32 text-base focus:ring-1 focus:ring-white focus:outline-none placeholder:text-white/20 text-[#e0e0e0] transition-all"
            style={{ fontFamily: 'Manrope' }}
          />
          <button
            onClick={handleAnalyze}
            disabled={loading || !keyword.trim()}
            className="absolute right-3 top-1/2 -translate-y-1/2 bg-[#e0e0e0] text-[#1a1a1a] px-5 py-2 rounded-lg text-sm font-bold hover:bg-white transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
            style={{ fontFamily: 'Inter' }}
          >
            {loading ? <Loader2 size={14} className="animate-spin" /> : null}
            {loading ? (loadingMsg || '分析中…') : '开始分析'}
          </button>
        </div>
        {error && <p className="text-red-400 text-xs" style={{ fontFamily: 'Inter' }}>{error}</p>}
      </div>

      {/* 3-column grid */}
      <div className="flex-1 min-h-0 grid grid-cols-12 gap-5 p-5 pb-[88px] overflow-hidden">

        {/* Left: stats + video list */}
        <aside className="col-span-3 flex flex-col gap-4 overflow-hidden">
          {/* Stats */}
          <div className="flex-shrink-0 rounded-xl p-5 space-y-4" style={{ background: '#0d0d0d', border: '1px solid rgba(255,255,255,0.06)' }}>
            <h3 className="text-[10px] uppercase tracking-widest text-white/40" style={{ fontFamily: 'Inter' }}>核心数据指标</h3>
            {[
              { label: '平均播放', value: results?.summary ? fmt(results.summary.avgViews) : '—', up: !!results },
              { label: '平均点赞', value: results?.summary ? fmt(results.summary.avgLikes) : '—', up: !!results },
              { label: '平均收藏', value: results?.summary ? fmt(results.summary.avgFavorites) : '—', up: false },
            ].map(({ label, value, up }) => (
              <div key={label} className="p-3 bg-[#080808] rounded-lg border border-white/[0.06]">
                <p className="text-[10px] text-white/40 mb-1" style={{ fontFamily: 'Inter' }}>{label}</p>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-bold text-[#e0e0e0]" style={{ fontFamily: 'Manrope' }}>{value}</span>
                  {results && up && <span className="text-[10px] text-emerald-500" style={{ fontFamily: 'Inter' }}>↑</span>}
                </div>
              </div>
            ))}
          </div>

          {/* Video list */}
          <div className="flex-1 rounded-xl flex flex-col overflow-hidden min-h-0" style={{ background: '#0d0d0d', border: '1px solid rgba(255,255,255,0.06)' }}>
            <div className="flex-shrink-0 px-5 pt-5 pb-2 flex justify-between items-center">
              <h3 className="text-[10px] uppercase tracking-widest text-white/40" style={{ fontFamily: 'Inter' }}>热门视频列表</h3>
              <span className="material-symbols-outlined text-white/20 text-[18px]">filter_list</span>
            </div>

            <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-2">
              {!hasResults && !loading && (
                <div className="flex flex-col items-center justify-center h-32 gap-3">
                  <span className="material-symbols-outlined text-4xl text-white/20">travel_explore</span>
                  <p className="text-white/20 text-xs text-center" style={{ fontFamily: 'Inter' }}>输入关键词后<br />热门视频将显示在这里</p>
                </div>
              )}
              {loading && !hasResults && (
                <div className="flex flex-col items-center justify-center h-32 gap-2">
                  <Loader2 size={22} className="animate-spin text-[#767575]" />
                  <p className="text-[#767575] text-xs" style={{ fontFamily: 'Inter' }}>{loadingMsg}</p>
                </div>
              )}
              {results?.videos?.map((v, i) => (
                <TopicVideoCard key={i} video={v} />
              ))}
            </div>
          </div>
        </aside>

        {/* Center: AI report + suggestions */}
        <section className="col-span-6 flex flex-col gap-4 overflow-y-auto">
          {/* Recipe / insight */}
          <div className="flex-shrink-0 rounded-xl p-7" style={{ background: '#0d0d0d', border: '1px solid rgba(255,255,255,0.06)' }}>
            <div className="flex items-center gap-3 mb-5">
              <span className="material-symbols-outlined text-[#e0e0e0]" style={{ fontVariationSettings: "'FILL' 1" }}>auto_awesome</span>
              <h2 className="text-base font-bold text-[#e0e0e0]" style={{ fontFamily: 'Manrope' }}>
                {hasResults ? 'AI 洞察报告' : '今日爆款配方'}
              </h2>
            </div>

            {(results?.insight || loading) ? (
              <div>
                {results?.insight ? (
                  <p className="text-lg leading-relaxed text-[#e0e0e0]/90 font-light italic" style={{ fontFamily: 'Manrope' }}>
                    {results.insight}
                    {loading && <span className="inline-block w-1.5 h-4 bg-white/40 animate-pulse ml-0.5 align-text-bottom" />}
                  </p>
                ) : (
                  <div className="space-y-2.5">
                    {[70, 90, 60, 80].map((w, i) => (
                      <div key={i} className="h-3 bg-[#1a1a1a] rounded-full animate-pulse" style={{ width: `${w}%` }} />
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div>
                <p className="text-lg leading-relaxed text-[#e0e0e0]/90 font-light italic" style={{ fontFamily: 'Manrope' }}>
                  「技术焦虑」+「具体解决方案」+「可视化冲突」是当前的流量密码。
                  <span className="text-[#e0e0e0] font-medium not-italic"> 建议采用：第一人称叙事 + 宏大命题的小切口进入。</span>
                </p>
                <div className="mt-6 flex flex-wrap gap-2.5">
                  {['#视觉对比', '#硬核科普', '#沉浸式音效'].map(tag => (
                    <span key={tag} className="px-3.5 py-1.5 bg-[#1a1a1a] rounded-full text-[11px] border border-white/[0.06] text-white/40" style={{ fontFamily: 'Inter' }}>{tag}</span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Suggestion cards */}
          {results?.suggestions && results.suggestions.length > 0 ? (
            <div className="grid grid-cols-2 gap-4">
              {results.suggestions.map((s, i) => (
                <div
                  key={i}
                  className="rounded-xl p-5 flex flex-col justify-between group hover:border-[#e0e0e0]/20 transition-all border border-transparent"
                  style={{ background: '#0d0d0d', border: '1px solid rgba(255,255,255,0.06)' }}
                >
                  <div>
                    <div className="flex justify-between items-start mb-4">
                      <span className="bg-[#e0e0e0]/10 text-[#e0e0e0] px-2 py-0.5 rounded text-[10px] font-bold" style={{ fontFamily: 'Inter' }}>
                        {SUGGESTION_TAGS[i % SUGGESTION_TAGS.length]}
                      </span>
                      <span className="material-symbols-outlined text-white/20 group-hover:text-[#e0e0e0] transition-colors text-[18px]">tips_and_updates</span>
                    </div>
                    <h4 className="font-bold text-[#e0e0e0] mb-2 text-sm" style={{ fontFamily: 'Manrope' }}>{s.title}</h4>
                    <p className="text-[11px] text-white/40 leading-relaxed line-clamp-2" style={{ fontFamily: 'Inter' }}>{s.reason}</p>
                  </div>
                  <button
                    onClick={() => handleAdopt(s.title)}
                    className="mt-5 w-full py-2 bg-[#1a1a1a] hover:bg-[#e0e0e0] hover:text-[#1a1a1a] rounded-lg text-[11px] font-semibold transition-all flex items-center justify-center gap-2 text-[#e0e0e0]"
                    style={{ fontFamily: 'Inter' }}
                  >
                    <span className="material-symbols-outlined text-[16px]">add_task</span>
                    采用该建议
                  </button>
                </div>
              ))}
            </div>
          ) : (
            /* Empty state suggestion skeleton cards */
            <div className="grid grid-cols-2 gap-4">
              {[
                { tag: '高成功率', icon: 'tips_and_updates', title: '2024 AI 工具完全指南', desc: '针对普通用户的生产力提升，对比主流工具的真实体验。' },
                { tag: '潜力黑马', icon: 'trending_up', title: '极简数字生活挑战', desc: '记录移除社交媒体7天后的心理与生活变化，主打情感共鸣。' },
                { tag: '话题常青', icon: 'history', title: '重访：十年前的技术预测', desc: '挖掘老内容，对比当今现实，探讨技术发展的必然性。' },
                { tag: '互动率高', icon: 'forum', title: '评论区由你决定下一期', desc: '建立博主与粉丝的深度联结，通过投票确定下一期选题。' },
              ].map(({ tag, icon, title, desc }) => (
                <div
                  key={title}
                  className="rounded-xl p-5 flex flex-col justify-between opacity-40"
                  style={{ background: '#0d0d0d', border: '1px solid rgba(255,255,255,0.06)' }}
                >
                  <div>
                    <div className="flex justify-between items-start mb-4">
                      <span className="bg-[#e0e0e0]/10 text-[#e0e0e0] px-2 py-0.5 rounded text-[10px] font-bold" style={{ fontFamily: 'Inter' }}>{tag}</span>
                      <span className="material-symbols-outlined text-white/20 text-[18px]">{icon}</span>
                    </div>
                    <h4 className="font-bold text-[#e0e0e0] mb-2 text-sm" style={{ fontFamily: 'Manrope' }}>{title}</h4>
                    <p className="text-[11px] text-white/40 leading-relaxed" style={{ fontFamily: 'Inter' }}>{desc}</p>
                  </div>
                  <div className="mt-5 w-full py-2 bg-[#1a1a1a] rounded-lg text-[11px] font-semibold text-center text-white/40" style={{ fontFamily: 'Inter' }}>
                    {loading ? <Loader2 size={12} className="animate-spin mx-auto" /> : '搜索后解锁'}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Right: draft editor */}
        <aside className="col-span-3 flex flex-col overflow-hidden">
          <TopicIdeaEditor
            value={draft}
            onChange={setDraft}
            onSave={() => onSaveDraft(draft)}
            onImportToBreakdown={() => onImportToBreakdown(draft)}
          />
        </aside>
      </div>
    </div>
  );
}
