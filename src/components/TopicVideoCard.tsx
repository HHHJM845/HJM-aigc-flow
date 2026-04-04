// src/components/TopicVideoCard.tsx
import React, { useState } from 'react';
import { ExternalLink } from 'lucide-react';

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

const PLATFORM_LABEL: Record<string, { label: string; cls: string }> = {
  bilibili:    { label: 'B站',   cls: 'bg-blue-500/20 text-blue-300' },
  xiaohongshu: { label: '小红书', cls: 'bg-red-500/20 text-red-300' },
  douyin:      { label: '抖音',   cls: 'bg-[#484848]/60 text-[#acabaa]' },
};

function fmt(n: number): string {
  if (n >= 10000) return `${(n / 10000).toFixed(1)}w`;
  return n.toLocaleString();
}

export interface Props {
  video: VideoItem;
}

export default function TopicVideoCard({ video }: Props) {
  const [expanded, setExpanded] = useState(false);
  const p = PLATFORM_LABEL[video.platform] ?? PLATFORM_LABEL.bilibili;

  return (
    <div className="group relative bg-[#0e0e0e] p-3 rounded-lg border border-[#484848]/10 hover:border-[#c6c6c7]/30 transition-all">
      <div className="flex gap-3">
        {/* Portrait thumbnail */}
        <div className="w-20 h-24 rounded bg-[#191a1a] overflow-hidden flex-shrink-0">
          {video.thumbnail ? (
            <img
              src={video.thumbnail}
              alt={video.title}
              className="w-full h-full object-cover grayscale opacity-60 group-hover:grayscale-0 group-hover:opacity-100 transition-all"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <span className="material-symbols-outlined text-[#484848] text-2xl">videocam</span>
            </div>
          )}
        </div>

        {/* Info */}
        <div className="flex flex-col justify-between py-1 flex-1 min-w-0">
          <div>
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium mb-1.5 inline-block ${p.cls}`}>
              {p.label}
            </span>
            <a
              href={video.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs font-bold leading-snug line-clamp-2 text-[#e7e5e4] hover:text-[#fbf9f8] transition-colors flex items-start gap-1"
              title={video.title}
            >
              {video.title}
              <ExternalLink size={9} className="flex-shrink-0 text-[#767575] mt-0.5" />
            </a>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[10px] text-[#acabaa] flex items-center gap-1">
              <span className="material-symbols-outlined text-[12px]">play_arrow</span>
              {fmt(video.views)}
            </span>
            <button
              onClick={() => setExpanded(v => !v)}
              className="text-[10px] font-bold text-[#c6c6c7] px-2 py-1 rounded bg-[#c6c6c7]/10 hover:bg-[#c6c6c7] hover:text-[#3f4041] transition-all"
              style={{ fontFamily: 'Inter' }}
            >
              深度分析
            </button>
          </div>
        </div>
      </div>

      {/* Expanded panel */}
      {expanded && (
        <div className="mt-3 p-3 rounded-xl bg-[#191a1a] border border-[#484848]/15 space-y-2">
          <div>
            <p className="text-[11px] text-[#c6c6c7] font-medium mb-1" style={{ fontFamily: 'Inter' }}>✦ 爆款原因</p>
            <p className="text-xs text-[#acabaa] leading-relaxed">{video.analysis}</p>
          </div>
          {video.topComments.length > 0 && (
            <div>
              <p className="text-[11px] text-[#767575] font-medium mb-1" style={{ fontFamily: 'Inter' }}>代表评论</p>
              <ul className="space-y-1">
                {video.topComments.map((c, i) => (
                  <li key={i} className="text-xs text-[#767575] leading-relaxed">&ldquo;{c}&rdquo;</li>
                ))}
              </ul>
            </div>
          )}
          <div>
            <p className="text-[11px] text-[#767575] font-medium mb-1" style={{ fontFamily: 'Inter' }}>内容简介</p>
            <p className="text-xs text-[#767575] leading-relaxed">{video.brief}</p>
          </div>
        </div>
      )}
    </div>
  );
}
