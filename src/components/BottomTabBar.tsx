import React from 'react';

type ActiveView = 'canvas' | 'storyboard' | 'breakdown';

interface Props {
  activeView: ActiveView;
  onViewChange: (view: ActiveView) => void;
}

export default function BottomTabBar({ activeView, onViewChange }: Props) {
  const tabs: { key: ActiveView; label: string }[] = [
    { key: 'breakdown', label: '剧本拆解' },
    { key: 'canvas', label: '无限画布' },
    { key: 'storyboard', label: '分镜管理' },
  ];

  return (
    <div
      className="absolute bottom-5 left-1/2 -translate-x-1/2 z-50 flex items-center gap-1 p-1 rounded-full border border-white/10 shadow-2xl"
      style={{ background: 'rgba(28,28,28,0.92)', backdropFilter: 'blur(12px)' }}
    >
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
