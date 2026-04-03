import React from 'react';
import { Save, ArrowRight } from 'lucide-react';

interface Props {
  value: string;
  onChange: (text: string) => void;
  onSave: () => void;
  onImportToBreakdown: () => void;
}

export default function TopicIdeaEditor({ value, onChange, onSave, onImportToBreakdown }: Props) {
  return (
    <div className="flex-shrink-0 border-t border-white/[0.06] bg-[#0c0c0c]">
      <div className="flex items-center justify-between px-5 py-2.5 border-b border-white/[0.04]">
        <span className="text-[12px] text-gray-500 font-medium">我的选题想法</span>
        <div className="flex items-center gap-2">
          <button
            onClick={onSave}
            disabled={!value.trim()}
            className="flex items-center gap-1.5 px-3 py-1 bg-white/5 hover:bg-white/10 text-gray-400 hover:text-gray-200 rounded-lg text-xs transition-colors border border-white/5 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Save size={11} />
            存档
          </button>
          <button
            onClick={onImportToBreakdown}
            disabled={!value.trim()}
            className="flex items-center gap-1.5 px-3 py-1 bg-white text-black rounded-lg text-xs font-medium hover:bg-gray-200 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          >
            导入拆本
            <ArrowRight size={11} />
          </button>
        </div>
      </div>
      <textarea
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder="在此输入或从右侧点击「采用」填入选题想法，再导入剧本拆解流程…"
        className="w-full h-24 bg-transparent text-gray-200 text-sm leading-relaxed px-5 py-3 focus:outline-none resize-none"
        style={{ fontFamily: 'inherit' }}
      />
    </div>
  );
}
