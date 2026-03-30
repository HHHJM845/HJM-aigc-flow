import React, { useState } from 'react';
import { NodeResizer } from '@xyflow/react';

export default function BoardNode({ id, data, selected }: { id: string; data: any; selected?: boolean }) {
  const [isEditingName, setIsEditingName] = useState(false);
  const [name, setName] = useState(data.label || '未命名画板');

  const handleNameSave = () => {
    setIsEditingName(false);
    data.onUpdate?.(id, { label: name });
  };

  return (
    <div className="w-full h-full relative">
      <NodeResizer
        isVisible={selected}
        minWidth={200}
        minHeight={150}
        handleStyle={{ width: 8, height: 8, borderRadius: 2, background: '#555', border: '1px solid #888' }}
        lineStyle={{ borderColor: '#555' }}
      />

      {/* Board background */}
      <div
        className={`w-full h-full rounded-2xl border-2 transition-colors ${
          selected ? 'border-white/25 bg-white/[0.03]' : 'border-white/10 bg-white/[0.015]'
        }`}
      />

      {/* Editable name at top-left */}
      <div className="absolute -top-7 left-1">
        {isEditingName ? (
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            onBlur={handleNameSave}
            onKeyDown={e => {
              if (e.key === 'Enter') handleNameSave();
              e.stopPropagation();
            }}
            className="bg-[#1a1a1a] border border-white/15 text-white text-xs font-medium focus:outline-none px-2 py-0.5 rounded-md min-w-[80px]"
            autoFocus
            onClick={e => e.stopPropagation()}
            onMouseDown={e => e.stopPropagation()}
          />
        ) : (
          <span
            className="text-gray-400 text-xs font-medium cursor-pointer hover:text-gray-200 px-1 py-0.5 rounded hover:bg-white/5 transition-colors select-none"
            onDoubleClick={e => { e.stopPropagation(); setIsEditingName(true); }}
          >
            {name}
          </span>
        )}
      </div>
    </div>
  );
}
