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

export interface Props {
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
                  <li key={i} className="text-xs text-gray-400 leading-relaxed">
                    &ldquo;{c}&rdquo;
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
