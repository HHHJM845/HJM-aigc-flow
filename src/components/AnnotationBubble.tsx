import React, { useState } from 'react';

export interface AnnotationData {
  rowId: string;
  status: 'approved' | 'revision' | 'pending';
  comment: string;
  createdAt: number;
}

interface Props {
  annotation: AnnotationData;
}

const STATUS_COLOR: Record<string, string> = {
  approved: 'rgba(80,200,120,0.8)',
  revision: 'rgba(255,140,60,0.8)',
  pending: 'rgba(255,255,255,0.3)',
};

const STATUS_ICON: Record<string, string> = {
  approved: '✓',
  revision: '↩',
  pending: '●',
};

export default function AnnotationBubble({ annotation }: Props) {
  const [expanded, setExpanded] = useState(false);
  const color = STATUS_COLOR[annotation.status];

  return (
    <div className="relative flex-shrink-0" onMouseEnter={() => setExpanded(true)} onMouseLeave={() => setExpanded(false)}>
      <div
        className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold cursor-pointer border"
        style={{ background: `${color}22`, borderColor: color, color }}
      >
        {STATUS_ICON[annotation.status]}
      </div>
      {expanded && annotation.comment && (
        <div
          className="absolute right-0 top-7 z-30 bg-[#1e1e1e] border border-white/10 rounded-xl p-3 shadow-xl w-52"
          style={{ fontFamily: 'Inter' }}
        >
          <div className="flex items-center gap-1.5 mb-1.5">
            <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: color }} />
            <span className="text-[10px] font-bold" style={{ color }}>
              {annotation.status === 'approved' ? '已通过' : '需修改'}
            </span>
          </div>
          <p className="text-[11px] text-white/55 leading-relaxed">{annotation.comment}</p>
        </div>
      )}
    </div>
  );
}
