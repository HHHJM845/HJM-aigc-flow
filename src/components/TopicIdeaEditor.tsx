import React from 'react';

interface Props {
  value: string;
  onChange: (text: string) => void;
  onSave: () => void;
  onImportToBreakdown: () => void;
}

export default function TopicIdeaEditor({ value, onChange, onSave, onImportToBreakdown }: Props) {
  return (
    <div className="bg-[#0d0d0d] rounded-xl flex-1 flex flex-col overflow-hidden border border-white/[0.06]">
      {/* Header */}
      <div className="p-5 border-b border-white/[0.06]">
        <h3 className="text-[#e0e0e0] font-bold text-base flex items-center gap-2" style={{ fontFamily: 'Manrope' }}>
          <span className="material-symbols-outlined text-[#e0e0e0]">edit_note</span>
          导演手记
        </h3>
      </div>

      {/* Textarea */}
      <div className="flex-1 p-5 relative">
        <textarea
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder="在这里记录你的创作思路，采用灵感后自动追加…"
          className="w-full h-full bg-transparent border-none resize-none text-[#e0e0e0] text-sm focus:ring-0 focus:outline-none leading-relaxed placeholder:text-white/20"
          style={{ fontFamily: 'Manrope', minHeight: '120px' }}
        />
        {/* Toolbar */}
        <div className="absolute bottom-5 left-5 right-5 flex justify-between items-center bg-[#111] p-2 rounded-lg border border-white/[0.06]">
          <div className="flex gap-2">
            <span className="material-symbols-outlined text-white/40 hover:text-white/70 cursor-pointer text-[18px]">format_bold</span>
            <span className="material-symbols-outlined text-white/40 hover:text-white/70 cursor-pointer text-[18px]">format_list_bulleted</span>
            <span className="material-symbols-outlined text-white/40 hover:text-white/70 cursor-pointer text-[18px]">image</span>
          </div>
          <span className="text-[10px] text-white/20" style={{ fontFamily: 'Inter' }}>自动保存</span>
        </div>
      </div>

      {/* Actions */}
      <div className="p-5 bg-[#111] flex gap-3">
        <button
          onClick={onSave}
          disabled={!value.trim()}
          className="flex-1 py-2 rounded-lg bg-[#1a1a1a] text-xs font-bold text-[#e0e0e0] hover:bg-[#222] transition-all border border-white/[0.08] disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-1"
          style={{ fontFamily: 'Inter' }}
        >
          <span className="material-symbols-outlined text-[16px]">archive</span> 存档
        </button>
        <button
          onClick={onImportToBreakdown}
          disabled={!value.trim()}
          className="flex-1 py-2 rounded-lg bg-[#e0e0e0] text-[#0a0a0a] text-xs font-bold hover:bg-white transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-1"
          style={{ fontFamily: 'Inter' }}
        >
          <span className="material-symbols-outlined text-[16px]">description</span> 导入脚本
        </button>
      </div>
    </div>
  );
}
