// src/components/TopicView.tsx
import React, { useState, useRef, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import TopicVideoCard, { type FilmItem } from './TopicVideoCard';
import TopicIdeaEditor from './TopicIdeaEditor';

export interface FilmIdeaSuggestion {
  title: string;
  coreConflict: string;
  genreTag: string;
  referenceStyle: string;
}

export interface FilmSummary {
  filmCount: number;
  dominantMood: string;
  dominantGenre: string;
}

interface FilmResults {
  summary: FilmSummary;
  films: FilmItem[];
  insight: string;
  suggestions: FilmIdeaSuggestion[];
}

type Source = 'cinema' | 'streaming' | 'festival';

const SOURCES: { key: Source; label: string }[] = [
  { key: 'cinema',    label: '院线趋势' },
  { key: 'streaming', label: '流媒体热门' },
  { key: 'festival',  label: '国际影展' },
];

interface Props {
  initialDraft?: string;
  initialKeyword?: string;
  projectId?: string;
  onSaveDraft: (text: string) => void;
  onImportToBreakdown: (text: string) => void;
}

export default function TopicView({ initialDraft = '', initialKeyword = '', projectId, onSaveDraft, onImportToBreakdown }: Props) {
  const [keyword, setKeyword] = useState(initialKeyword);
  const [sources, setSources] = useState<Source[]>(['cinema', 'streaming', 'festival']);
  const [loading, setLoading] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState('');
  const [results, setResults] = useState<FilmResults | null>(null);
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

  const toggleSource = (s: Source) => {
    setSources(prev =>
      prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]
    );
  };

  const handleAnalyze = async (kwOverride?: string) => {
    const kw = (kwOverride ?? keyword).trim();
    if (!kw || loading) return;
    if (sources.length === 0) { setError('请至少选择一个来源'); return; }

    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    setLoading(true);
    setError('');
    setResults(null);
    setLoadingMsg('正在检索影视参考…');

    try {
      const res = await fetch('/api/topic-research', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keyword: kw, sources, projectId }),
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

          if (msg.type === 'films') {
            const d = msg.data as { summary: FilmSummary; films: FilmItem[] };
            setResults({ summary: d.summary, films: d.films, insight: '', suggestions: [] });
            setLoadingMsg('正在提炼创作方向…');
          } else if (msg.type === 'insight_chunk') {
            insightAccum += msg.data as string;
            setResults(prev => prev ? { ...prev, insight: insightAccum } : null);
          } else if (msg.type === 'suggestions') {
            const suggestions = msg.data as FilmIdeaSuggestion[];
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
          {SOURCES.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => toggleSource(key)}
              className={`px-7 py-2 rounded-full text-sm transition-all ${
                sources.includes(key)
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
            placeholder="输入主题、情绪、人物原型或社会议题..."
            className="w-full bg-[#0d0d0d] border-none rounded-xl py-4 pl-14 pr-32 text-base focus:ring-1 focus:ring-white focus:outline-none placeholder:text-white/20 text-[#e0e0e0] transition-all"
            style={{ fontFamily: 'Manrope' }}
          />
          <button
            onClick={() => handleAnalyze()}
            disabled={loading || !keyword.trim()}
            className="absolute right-3 top-1/2 -translate-y-1/2 bg-[#e0e0e0] text-[#1a1a1a] px-5 py-2 rounded-lg text-sm font-bold hover:bg-white transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
            style={{ fontFamily: 'Inter' }}
          >
            {loading ? <Loader2 size={14} className="animate-spin" /> : null}
            {loading ? (loadingMsg || '探索中…') : '探索灵感'}
          </button>
        </div>
        {error && <p className="text-red-400 text-xs" style={{ fontFamily: 'Inter' }}>{error}</p>}
      </div>

      {/* 3-column grid */}
      <div className="flex-1 min-h-0 grid grid-cols-12 gap-5 p-5 pb-[88px] overflow-hidden">

        {/* Left: stats + video list */}
        <aside className="col-span-3 flex flex-col gap-4 overflow-hidden">
          {/* Stats */}
          <div className="flex-shrink-0 rounded-xl p-5 space-y-4" style={{ background: '#1c1c1e', border: '1px solid rgba(255,255,255,0.10)' }}>
            <h3 className="text-[10px] uppercase tracking-widest text-white/40" style={{ fontFamily: 'Inter' }}>题材温度</h3>
            <div className="p-3 bg-[#111113] rounded-lg border border-white/[0.08]">
              <p className="text-[10px] text-white/40 mb-1" style={{ fontFamily: 'Inter' }}>近期参考作品数</p>
              <span className="text-2xl font-bold text-[#e0e0e0]" style={{ fontFamily: 'Manrope' }}>
                {results?.summary ? results.summary.filmCount : '—'}
              </span>
            </div>
            <div className="p-3 bg-[#111113] rounded-lg border border-white/[0.08]">
              <p className="text-[10px] text-white/40 mb-1" style={{ fontFamily: 'Inter' }}>主流情感基调</p>
              <span className="text-lg font-bold text-[#e0e0e0]" style={{ fontFamily: 'Manrope' }}>
                {results?.summary ? results.summary.dominantMood : '—'}
              </span>
            </div>
            <div className="p-3 bg-[#111113] rounded-lg border border-white/[0.08]">
              <p className="text-[10px] text-white/40 mb-1" style={{ fontFamily: 'Inter' }}>高频题材类型</p>
              <span className="text-lg font-bold text-[#e0e0e0]" style={{ fontFamily: 'Manrope' }}>
                {results?.summary ? results.summary.dominantGenre : '—'}
              </span>
            </div>
          </div>

          {/* Video list */}
          <div className="flex-1 rounded-xl flex flex-col overflow-hidden min-h-0" style={{ background: '#1c1c1e', border: '1px solid rgba(255,255,255,0.10)' }}>
            <div className="flex-shrink-0 px-5 pt-5 pb-2 flex justify-between items-center">
              <h3 className="text-[10px] uppercase tracking-widest text-white/40" style={{ fontFamily: 'Inter' }}>参考影片</h3>
              <span className="material-symbols-outlined text-white/20 text-[18px]">filter_list</span>
            </div>

            <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-2">
              {!hasResults && !loading && (
                <div className="flex flex-col items-center justify-center h-32 gap-3">
                  <span className="material-symbols-outlined text-4xl text-white/20">travel_explore</span>
                  <p className="text-white/20 text-xs text-center" style={{ fontFamily: 'Inter' }}>输入主题后<br />参考影片将显示在这里</p>
                </div>
              )}
              {loading && !hasResults && (
                <div className="flex flex-col items-center justify-center h-32 gap-2">
                  <Loader2 size={22} className="animate-spin text-[#767575]" />
                  <p className="text-[#767575] text-xs" style={{ fontFamily: 'Inter' }}>{loadingMsg}</p>
                </div>
              )}
              {results?.films?.map((f, i) => (
                <TopicVideoCard key={i} film={f} />
              ))}
            </div>
          </div>
        </aside>

        {/* Center: AI report + suggestions */}
        <section className="col-span-6 flex flex-col gap-4 overflow-y-auto">
          {/* Recipe / insight */}
          <div className="flex-shrink-0 rounded-xl p-7" style={{ background: '#1c1c1e', border: '1px solid rgba(255,255,255,0.10)' }}>
            <div className="flex items-center gap-3 mb-5">
              <span className="material-symbols-outlined text-[#e0e0e0]" style={{ fontVariationSettings: "'FILL' 1" }}>auto_awesome</span>
              <h2 className="text-base font-bold text-[#e0e0e0]" style={{ fontFamily: 'Manrope' }}>
                {hasResults ? 'AI 创作方向分析' : '创作方向分析'}
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
              <p className="text-lg leading-relaxed text-[#e0e0e0]/90 font-light italic" style={{ fontFamily: 'Manrope' }}>
                探索一个主题，AI 将为你提炼影视创作方向，包括叙事规律、视觉基调与情感内核。
              </p>
            )}
          </div>

          {/* Suggestion cards */}
          {results?.suggestions && results.suggestions.length > 0 ? (
            <div className="grid grid-cols-2 gap-4">
              {results.suggestions.map((s, i) => (
                <div
                  key={i}
                  className="rounded-xl p-5 flex flex-col justify-between group hover:border-[#e0e0e0]/20 transition-all"
                  style={{ background: '#1c1c1e', border: '1px solid rgba(255,255,255,0.10)' }}
                >
                  <div>
                    <div className="flex justify-between items-start mb-4">
                      <span className="bg-[#e0e0e0]/10 text-[#e0e0e0] px-2 py-0.5 rounded text-[10px] font-bold" style={{ fontFamily: 'Inter' }}>
                        {s.genreTag}
                      </span>
                      <span className="material-symbols-outlined text-white/20 group-hover:text-[#e0e0e0] transition-colors text-[18px]">movie_creation</span>
                    </div>
                    <h4 className="font-bold text-[#e0e0e0] mb-2 text-sm" style={{ fontFamily: 'Manrope' }}>{s.title}</h4>
                    <p className="text-[11px] text-white/40 leading-relaxed line-clamp-2" style={{ fontFamily: 'Inter' }}>{s.coreConflict}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-white/20 mt-3 mb-3" style={{ fontFamily: 'Inter' }}>参考风格：{s.referenceStyle}</p>
                    <button
                      onClick={() => handleAdopt(s.title)}
                      className="w-full py-2 bg-[#1a1a1a] hover:bg-[#e0e0e0] hover:text-[#1a1a1a] rounded-lg text-[11px] font-semibold transition-all flex items-center justify-center gap-2 text-[#e0e0e0]"
                      style={{ fontFamily: 'Inter' }}
                    >
                      <span className="material-symbols-outlined text-[16px]">add_task</span>
                      采用该建议
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            /* Empty state suggestion skeleton cards */
            <div className="grid grid-cols-2 gap-4">
              {[
                { genreTag: '短片',   icon: 'movie',             title: '父亲的最后一卷胶片',  coreConflict: '儿子整理遗物时发现从未冲洗的胶卷，面对是否打开的两难' },
                { genreTag: '纪录',   icon: 'video_camera_front', title: '消失的方言',          coreConflict: '一个孩子试图用录音机记录只剩三位老人会说的语言' },
                { genreTag: '品牌片', icon: 'campaign',           title: '凌晨四点的城市工人',  coreConflict: '他们在城市沉睡时劳动，却在城市醒来后隐形' },
                { genreTag: '微电影', icon: 'theaters',           title: '最后一次见她',         coreConflict: '男人准备好了道歉，却发现她早已不在意' },
              ].map(({ genreTag, icon, title, coreConflict }) => (
                <div
                  key={title}
                  className="rounded-xl p-5 flex flex-col justify-between opacity-40"
                  style={{ background: '#1c1c1e', border: '1px solid rgba(255,255,255,0.10)' }}
                >
                  <div>
                    <div className="flex justify-between items-start mb-4">
                      <span className="bg-[#e0e0e0]/10 text-[#e0e0e0] px-2 py-0.5 rounded text-[10px] font-bold" style={{ fontFamily: 'Inter' }}>{genreTag}</span>
                      <span className="material-symbols-outlined text-white/20 text-[18px]">{icon}</span>
                    </div>
                    <h4 className="font-bold text-[#e0e0e0] mb-2 text-sm" style={{ fontFamily: 'Manrope' }}>{title}</h4>
                    <p className="text-[11px] text-white/40 leading-relaxed" style={{ fontFamily: 'Inter' }}>{coreConflict}</p>
                  </div>
                  <div className="mt-5 w-full py-2 bg-[#1a1a1a] rounded-lg text-[11px] font-semibold text-center text-white/40" style={{ fontFamily: 'Inter' }}>
                    {loading ? <Loader2 size={12} className="animate-spin mx-auto" /> : '探索后解锁'}
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
