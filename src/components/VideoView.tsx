import React from 'react';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, X, Download } from 'lucide-react';
import type { VideoOrderItem } from '../lib/storage';

interface Props {
  videoOrder: VideoOrderItem[];
  onReorder: (newOrder: VideoOrderItem[]) => void;
  onRemove: (id: string) => void;
}

function VideoCard({
  item,
  index,
  onRemove,
  onDownload,
}: {
  item: VideoOrderItem;
  index: number;
  onRemove: (id: string) => void;
  onDownload: (url: string, index: number) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: item.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 50 : undefined,
  };

  const padded = String(index + 1).padStart(2, '0');

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`relative bg-[#1a1a1a] border rounded-[10px] overflow-hidden ${
        isDragging ? 'border-white/30 shadow-2xl scale-[1.02]' : 'border-white/[0.08]'
      }`}
    >
      {/* Video area 16:9 */}
      <div className="relative w-full" style={{ aspectRatio: '16/9', background: '#111' }}>
        {item.url ? (
          <video
            src={item.url}
            preload="metadata"
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <span className="text-gray-700 text-sm">▶</span>
          </div>
        )}

        {/* Drag handle — top left */}
        <div
          {...attributes}
          {...listeners}
          className="absolute top-1.5 left-1.5 cursor-grab active:cursor-grabbing text-white/25 hover:text-white/50 transition-colors p-0.5"
        >
          <GripVertical size={14} />
        </div>

        {/* Sequence badge — bottom left */}
        <div className="absolute bottom-1.5 left-1.5 bg-black/70 text-white text-[9px] font-bold px-1.5 py-0.5 rounded">
          {padded}
        </div>

        {/* Remove button — top right */}
        <button
          onClick={() => onRemove(item.id)}
          className="absolute top-1.5 right-1.5 w-5 h-5 bg-black/60 hover:bg-black/80 rounded-full flex items-center justify-center text-gray-500 hover:text-gray-200 transition-colors"
          title="从视频管理中移除"
        >
          <X size={10} />
        </button>
      </div>

      {/* Bottom row */}
      <div className="flex items-center justify-between px-2 py-1.5 gap-2">
        <span className="text-[#aaa] text-[10px] truncate flex-1">{item.label || `视频 ${padded}`}</span>
        <button
          onClick={() => onDownload(item.url, index)}
          className="flex-shrink-0 flex items-center gap-1 px-2 py-1 bg-white/5 hover:bg-white/10 border border-white/[0.08] rounded text-[9px] text-gray-500 hover:text-gray-300 transition-colors"
        >
          <Download size={9} />
          下载
        </button>
      </div>
    </div>
  );
}

export default function VideoView({ videoOrder, onReorder, onRemove }: Props) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = videoOrder.findIndex(v => v.id === active.id);
      const newIndex = videoOrder.findIndex(v => v.id === over.id);
      onReorder(arrayMove(videoOrder, oldIndex, newIndex));
    }
  };

  const handleDownload = (url: string, index: number) => {
    const padded = String(index + 1).padStart(2, '0');
    const a = document.createElement('a');
    a.href = url;
    a.download = `${padded}.mp4`;
    a.click();
  };

  const handleDownloadAll = () => {
    videoOrder.forEach((item, index) => {
      setTimeout(() => handleDownload(item.url, index), index * 200);
    });
  };

  return (
    <div className="absolute inset-0 bg-[#0c0c0c] flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/[0.06] flex-shrink-0">
        <div className="flex items-center gap-2.5">
          <span className="text-white font-medium text-[14px]">视频管理</span>
          <span className="text-gray-600 text-xs">已选 {videoOrder.length} 个视频</span>
        </div>
        {videoOrder.length > 0 && (
          <button
            onClick={handleDownloadAll}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white/[0.08] hover:bg-white/[0.12] border border-white/10 rounded-lg text-gray-300 text-xs transition-colors"
          >
            <Download size={12} />
            全部下载（{videoOrder.length}个）
          </button>
        )}
      </div>

      {/* Grid or empty state */}
      {videoOrder.length === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-gray-600 text-sm text-center leading-relaxed">
            在画布中点击视频节点右上角的勾选按钮<br />即可加入视频管理
          </p>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto p-5">
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={videoOrder.map(v => v.id)} strategy={verticalListSortingStrategy}>
              <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
                {videoOrder.map((item, index) => (
                  <VideoCard
                    key={item.id}
                    item={item}
                    index={index}
                    onRemove={onRemove}
                    onDownload={handleDownload}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        </div>
      )}
    </div>
  );
}
