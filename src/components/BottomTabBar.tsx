// src/components/BottomTabBar.tsx
import React from 'react';
import {
  Bookmark,
  Clapperboard,
  DraftingCompass,
  FileText,
  Home,
  Lightbulb,
  Package,
  UserRound,
  Video,
  type LucideIcon,
} from 'lucide-react';
import { BOTTOM_TABS } from '../lib/bottomTabs';

export type ActiveView =
  | 'topic'
  | 'breakdown'
  | 'assetWorkbench'
  | 'canvas'
  | 'assets'
  | 'storyboard'
  | 'video'
  | 'templates';

interface Props {
  activeView: ActiveView;
  onViewChange: (view: ActiveView) => void;
  onGoHome: () => void;
}

const TAB_ICONS: Record<(typeof BOTTOM_TABS)[number]['iconKey'], LucideIcon> = {
  Lightbulb,
  FileText,
  UserRound,
  DraftingCompass,
  Clapperboard,
  Video,
  Package,
  Bookmark,
};

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
        aria-label="返回首页"
        className="w-12 h-12 flex items-center justify-center rounded-full text-[#9f9d9d] hover:text-[#fbf9f8] hover:bg-white/5 transition-all"
      >
        <Home className="h-5 w-5" strokeWidth={2.2} />
      </button>

      {/* Tab 项 */}
      {BOTTOM_TABS.map(({ key, iconKey, label }) => {
        const isActive = activeView === key;
        const Icon = TAB_ICONS[iconKey];
        return (
          <button
            key={key}
            onClick={() => onViewChange(key)}
            title={label}
            aria-label={label}
            className={`w-12 h-12 flex items-center justify-center rounded-full transition-all ${
              isActive
                ? 'bg-[#c6c6c7] text-[#1a1a1a] shadow-lg scale-110'
                : 'text-[#9f9d9d] hover:text-[#fbf9f8] hover:bg-white/5'
            }`}
          >
            <Icon className="h-5 w-5" strokeWidth={isActive ? 2.7 : 2.2} />
          </button>
        );
      })}
    </nav>
  );
}
