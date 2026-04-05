import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface Props {
  id: string;
  index: number;
  imageSrc?: string | null;
  onRemove?: () => void;
}

export default function StoryboardCard({ id, index, imageSrc, onRemove }: Props) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    zIndex: isDragging ? 50 : undefined,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`group bg-[#0d0d0d] rounded-xl overflow-hidden border cursor-grab active:cursor-grabbing select-none transition-shadow duration-150 ${
        isDragging
          ? 'border-white/30 shadow-2xl scale-[1.04]'
          : 'border-white/8 hover:border-white/15'
      }`}
    >
      {/* Image area: 16:9 */}
      <div className="relative w-full" style={{ paddingBottom: '56.25%' }}>
        {/* 取消勾选按钮 */}
        {onRemove && (
          <button
            className="absolute top-2 right-2 z-20 w-[22px] h-[22px] rounded-full flex items-center justify-center transition-all duration-150 opacity-0 group-hover:opacity-100"
            style={{ background: 'white', boxShadow: '0 2px 6px rgba(0,0,0,0.4)' }}
            onPointerDown={e => e.stopPropagation()}
            onClick={e => { e.stopPropagation(); onRemove(); }}
            title="从分镜中移除"
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M2 6l3 3 5-5" stroke="#111" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        )}
        <div className="absolute inset-0">
          {imageSrc ? (
            <img
              src={imageSrc}
              alt={`分镜 ${index}`}
              className="w-full h-full object-cover pointer-events-none"
            />
          ) : (
            <div className="w-full h-full bg-[#080808] flex items-center justify-center text-white/10 text-sm">
              未生成
            </div>
          )}
        </div>
      </div>

      {/* Index label */}
      <div className="py-2 text-center text-[13px] text-white/40 font-medium">
        {index}
      </div>
    </div>
  );
}
