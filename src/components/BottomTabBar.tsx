// src/components/BottomTabBar.tsx
import React from 'react';

export type ActiveView = 'topic' | 'canvas' | 'assets' | 'storyboard' | 'breakdown' | 'video' | 'subtitle' | 'templates';

interface Props {
  activeView: ActiveView;
  onViewChange: (view: ActiveView) => void;
  onGoHome: () => void;
}

interface TabItem {
  key: ActiveView;
  icon: string;
  label: string;
}

const TABS: TabItem[] = [
  { key: 'topic',      icon: 'lightbulb',     label: '选题' },
  { key: 'assets',     icon: 'inventory_2',   label: '资产管理' },
  { key: 'breakdown',  icon: 'description',   label: '剧本拆解' },
  { key: 'canvas',     icon: 'architecture',  label: '无限画布' },
  { key: 'storyboard', icon: 'movie_edit',    label: '分镜管理' },
  { key: 'video',      icon: 'video_library', label: '视频管理' },
  { key: 'subtitle',   icon: 'subtitles',     label: '字幕编辑' },
  { key: 'templates',  icon: 'bookmark_manager', label: '模板库' },
];

export default function BottomTabBar({ activeView, onViewChange, onGoHome }: Props) {
  return (
    <nav
      className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-4 py-3 rounded-full border border-white/10 shadow-2xl"
      style={{ background: 'rgba(26,26,26,0.90)', backdropFilter: 'blur(24px)' }}
    >
      {/* 首页 */}
      <button
        onClick={onGoHome}
        title="返回首页"
        className="w-12 h-12 flex items-center justify-center rounded-full text-[#9f9d9d] hover:text-[#fbf9f8] hover:bg-white/5 transition-all"
      >
        <span className="material-symbols-outlined">home</span>
      </button>

      {/* Tab 项 */}
      {TABS.map(({ key, icon, label }) => {
        const isActive = activeView === key;
        return (
          <button
            key={key}
            onClick={() => onViewChange(key)}
            title={label}
            className={`w-12 h-12 flex items-center justify-center rounded-full transition-all ${
              isActive
                ? 'bg-[#c6c6c7] text-[#1a1a1a] shadow-lg scale-110'
                : 'text-[#9f9d9d] hover:text-[#fbf9f8] hover:bg-white/5'
            }`}
          >
            <span
              className="material-symbols-outlined"
              style={isActive ? { fontVariationSettings: "'FILL' 1" } : undefined}
            >
              {icon}
            </span>
          </button>
        );
      })}
    </nav>
  );
}
