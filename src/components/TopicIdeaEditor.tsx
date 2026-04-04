import React from 'react';

interface Props {
  value: string;
  onChange: (text: string) => void;
  onSave: () => void;
  onImportToBreakdown: () => void;
}

export default function TopicIdeaEditor({ value, onChange, onSave, onImportToBreakdown }: Props) {
  return (
    <div className="bg-[#131313] rounded-xl flex-1 flex flex-col overflow-hidden border border-[#484848]/10">
      {/* Header */}
      <div className="p-5 border-b border-[#484848]/10">
        <h3 className="text-[#fbf9f8] font-bold text-base flex items-center gap-2" style={{ fontFamily: 'Manrope' }}>
          <span className="material-symbols-outlined text-[#c6c6c7]">lightbulb</span>
          我的选题想法
        </h3>
      </div>

      {/* Textarea */}
      <div className="flex-1 p-5 relative">
        <textarea
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder="在这里记录你的灵感碎片..."
          className="w-full h-full bg-transparent border-none resize-none text-[#e7e5e4] text-sm focus:ring-0 focus:outline-none leading-relaxed placeholder:text-[#484848]"
          style={{ fontFamily: 'Manrope', minHeight: '120px' }}
        />
        {/* Toolbar */}
        <div className="absolute bottom-5 left-5 right-5 flex justify-between items-center bg-[#191a1a] p-2 rounded-lg border border-[#484848]/10">
          <div className="flex gap-2">
            <span className="material-symbols-outlined text-[#acabaa] hover:text-[#c6c6c7] cursor-pointer text-[18px]">format_bold</span>
            <span className="material-symbols-outlined text-[#acabaa] hover:text-[#c6c6c7] cursor-pointer text-[18px]">format_list_bulleted</span>
            <span className="material-symbols-outlined text-[#acabaa] hover:text-[#c6c6c7] cursor-pointer text-[18px]">image</span>
          </div>
          <span className="text-[10px] text-[#484848]" style={{ fontFamily: 'Inter' }}>自动保存</span>
        </div>
      </div>

      {/* Actions */}
      <div className="p-5 bg-[#191a1a] flex gap-3">
        <button
          onClick={onSave}
          disabled={!value.trim()}
          className="flex-1 py-2 rounded-lg bg-[#252626] text-xs font-bold text-[#e7e5e4] hover:bg-[#2c2c2c] transition-all border border-[#484848]/10 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-1"
          style={{ fontFamily: 'Inter' }}
        >
          <span className="material-symbols-outlined text-[16px]">archive</span> 存档
        </button>
        <button
          onClick={onImportToBreakdown}
          disabled={!value.trim()}
          className="flex-1 py-2 rounded-lg bg-[#c6c6c7] text-[#3f4041] text-xs font-bold hover:bg-[#fbf9f8] transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-1"
          style={{ fontFamily: 'Inter' }}
        >
          <span className="material-symbols-outlined text-[16px]">description</span> 导入脚本
        </button>
      </div>
    </div>
  );
}
