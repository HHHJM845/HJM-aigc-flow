// src/components/TopicVideoCard.tsx
import React, { useState } from 'react';
import { ExternalLink } from 'lucide-react';

export interface FilmItem {
  title: string;
  director: string;
  year: number;
  source: 'cinema' | 'streaming' | 'festival';
  externalUrl: string;
  styleTags: string[];
  relevanceReason: string;
  learnDimensions: string[];
}

const SOURCE_LABEL: Record<string, { label: string; cls: string }> = {
  cinema:    { label: '院线',   cls: 'bg-violet-500/20 text-violet-300' },
  streaming: { label: '流媒体', cls: 'bg-emerald-500/20 text-emerald-300' },
  festival:  { label: '影展',   cls: 'bg-amber-500/20 text-amber-300' },
};

export interface Props {
  film: FilmItem;
}

export default function TopicVideoCard({ film }: Props) {
  const [expanded, setExpanded] = useState(false);
  const s = SOURCE_LABEL[film.source] ?? SOURCE_LABEL.cinema;

  return (
    <div className="group relative bg-[#1c1c1e] p-3 rounded-lg border border-white/10 hover:border-[#c6c6c7]/40 transition-all">
      <div className="flex gap-3">
        {/* Icon placeholder (no thumbnail for films) */}
        <div className="w-14 h-16 rounded bg-[#2a2a2e] overflow-hidden flex-shrink-0 flex items-center justify-center">
          <span className="material-symbols-outlined text-[#484848] text-2xl">movie</span>
        </div>

        {/* Info */}
        <div className="flex flex-col justify-between py-1 flex-1 min-w-0">
          <div>
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium mb-1.5 inline-block ${s.cls}`}>
              {s.label}
            </span>
            <div className="text-xs font-bold leading-snug line-clamp-2 text-[#e7e5e4]" title={film.title}>
              《{film.title}》
            </div>
            <div className="text-[10px] text-white/40 mt-0.5">{film.director} · {film.year}</div>
          </div>
          <div className="flex items-center gap-2 mt-1">
            {film.externalUrl && (
              <a
                href={film.externalUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[10px] text-[#acabaa] flex items-center gap-0.5 hover:text-white transition-colors"
              >
                <ExternalLink size={9} /> 详情
              </a>
            )}
            <button
              onClick={() => setExpanded(v => !v)}
              className="text-[10px] font-bold text-[#c6c6c7] px-2 py-1 rounded bg-[#c6c6c7]/10 hover:bg-[#c6c6c7] hover:text-[#3f4041] transition-all"
              style={{ fontFamily: 'Inter' }}
            >
              创作分析
            </button>
          </div>
        </div>
      </div>

      {/* Expanded panel */}
      {expanded && (
        <div className="mt-3 p-3 rounded-xl bg-[#111113] border border-white/10 space-y-3">
          <div>
            <p className="text-[11px] text-[#c6c6c7] font-medium mb-1" style={{ fontFamily: 'Inter' }}>✦ 为何参考</p>
            <p className="text-xs text-[#acabaa] leading-relaxed">{film.relevanceReason}</p>
          </div>
          {film.styleTags.length > 0 && (
            <div>
              <p className="text-[11px] text-[#767575] font-medium mb-1.5" style={{ fontFamily: 'Inter' }}>风格标签</p>
              <div className="flex flex-wrap gap-1">
                {film.styleTags.map((tag, i) => (
                  <span key={i} className="text-[10px] px-2 py-0.5 rounded-full bg-white/[0.06] text-white/50 border border-white/[0.08]">{tag}</span>
                ))}
              </div>
            </div>
          )}
          {film.learnDimensions.length > 0 && (
            <div>
              <p className="text-[11px] text-[#767575] font-medium mb-1.5" style={{ fontFamily: 'Inter' }}>可借鉴维度</p>
              <div className="flex flex-wrap gap-1">
                {film.learnDimensions.map((dim, i) => (
                  <span key={i} className="text-[10px] px-2 py-0.5 rounded-full bg-violet-500/10 text-violet-300 border border-violet-500/20">{dim}</span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
