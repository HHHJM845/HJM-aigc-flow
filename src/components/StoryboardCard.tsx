import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface Props {
  id: string;
  index: number;
  imageSrc?: string | null;
}

export default function StoryboardCard({ id, index, imageSrc }: Props) {
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
      className={`bg-[#1a1a1a] rounded-xl overflow-hidden border cursor-grab active:cursor-grabbing select-none transition-shadow duration-150 ${
        isDragging
          ? 'border-white/30 shadow-2xl scale-[1.04]'
          : 'border-white/8 hover:border-white/15'
      }`}
    >
      {/* Image area: 16:9 */}
      <div className="relative w-full" style={{ paddingBottom: '56.25%' }}>
        <div className="absolute inset-0">
          {imageSrc ? (
            <img
              src={imageSrc}
              alt={`分镜 ${index}`}
              className="w-full h-full object-cover pointer-events-none"
            />
          ) : (
            <div className="w-full h-full bg-[#242424] flex items-center justify-center text-white/10 text-sm">
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
