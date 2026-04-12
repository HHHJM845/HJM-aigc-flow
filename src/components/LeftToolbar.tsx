import React from 'react';
import { Library, History, Frame, MessageSquare, HelpCircle } from 'lucide-react';

export type ActiveTool = 'board' | 'comment' | null;

interface Props {
  activeTool: ActiveTool;
  showAssets: boolean;
  showHistory: boolean;
  onToolChange: (tool: ActiveTool) => void;
  onToggleAssets: () => void;
  onToggleHistory: () => void;
}

export default function LeftToolbar({
  activeTool, showAssets, showHistory,
  onToolChange, onToggleAssets, onToggleHistory,
}: Props) {
  return (
    <div className="absolute left-4 top-1/2 -translate-y-1/2 z-50 flex flex-col items-center gap-1 bg-[#1a1a1a] border border-white/[0.08] rounded-2xl p-1.5 shadow-xl">
      {/* Asset Library */}
      <button
        onClick={onToggleAssets}
        title="资产库"
        className={`w-9 h-9 flex items-center justify-center rounded-xl transition-colors ${
          showAssets ? 'bg-white/20 text-white' : 'text-gray-400 hover:bg-white/10 hover:text-gray-200'
        }`}
      >
        <Library size={16} />
      </button>

      {/* History */}
      <button
        onClick={onToggleHistory}
        title="历史记录"
        className={`w-9 h-9 flex items-center justify-center rounded-xl transition-colors ${
          showHistory ? 'bg-white/20 text-white' : 'text-gray-400 hover:bg-white/10 hover:text-gray-200'
        }`}
      >
        <History size={16} />
      </button>

      {/* Board Tool */}
      <button
        onClick={() => onToolChange(activeTool === 'board' ? null : 'board')}
        title="画板工具"
        className={`w-9 h-9 flex items-center justify-center rounded-xl transition-colors ${
          activeTool === 'board'
            ? 'bg-blue-500/30 text-blue-400 ring-1 ring-blue-500/40'
            : 'text-gray-400 hover:bg-white/10 hover:text-gray-200'
        }`}
      >
        <Frame size={16} />
      </button>

      {/* Comment Tool */}
      <button
        onClick={() => onToolChange(activeTool === 'comment' ? null : 'comment')}
        title="评论"
        className={`w-9 h-9 flex items-center justify-center rounded-xl transition-colors ${
          activeTool === 'comment'
            ? 'bg-yellow-500/30 text-yellow-400 ring-1 ring-yellow-500/40'
            : 'text-gray-400 hover:bg-white/10 hover:text-gray-200'
        }`}
      >
        <MessageSquare size={16} />
      </button>

      <div className="w-5 h-px bg-white/10 my-0.5" />

      {/* Help */}
      <button
        title="帮助"
        className="w-9 h-9 flex items-center justify-center text-gray-600 hover:text-gray-400 rounded-xl hover:bg-white/5 transition-colors"
      >
        <HelpCircle size={16} />
      </button>

      {/* User Avatar */}
      <div className="w-9 h-9 rounded-full bg-blue-500 flex items-center justify-center text-white text-xs font-bold mt-0.5 cursor-pointer select-none">
        少军
      </div>
    </div>
  );
}
