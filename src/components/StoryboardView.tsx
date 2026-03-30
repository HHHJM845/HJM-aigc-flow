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
  rectSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable';
import type { Node } from '@xyflow/react';
import StoryboardCard from './StoryboardCard';

interface Props {
  storyboardOrder: string[];
  nodes: Node[];
  onReorder: (newOrder: string[]) => void;
  onToggle: (nodeId: string) => void;
}

export default function StoryboardView({ storyboardOrder, nodes, onReorder, onToggle }: Props) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = storyboardOrder.indexOf(String(active.id));
    const newIndex = storyboardOrder.indexOf(String(over.id));
    if (oldIndex === -1 || newIndex === -1) return;
    onReorder(arrayMove(storyboardOrder, oldIndex, newIndex));
  };

  // Build lookup: nodeId → first image src
  const getImageSrc = (nodeId: string): string | null => {
    const node = nodes.find(n => n.id === nodeId);
    if (!node?.data?.content) return null;
    const content = node.data.content as string | string[];
    const first = Array.isArray(content) ? content[0] : content;
    return typeof first === 'string' && first.length > 0 ? first : null;
  };

  return (
    <div className="w-full h-full bg-[#0f0f0f] flex flex-col overflow-hidden">
      {/* Top bar */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-white/6 shrink-0">
        <span className="text-[15px] font-semibold text-white">分镜管理</span>
        <span className="text-[12px] text-white/35">
          已选 {storyboardOrder.length} 个镜头
        </span>
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-y-auto px-6 py-6">
        {storyboardOrder.length === 0 ? (
          <div className="flex items-center justify-center h-full text-white/20 text-[14px]">
            在画布中勾选图片节点，它们会出现在这里
          </div>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext items={storyboardOrder} strategy={rectSortingStrategy}>
              <div className="grid grid-cols-4 gap-4">
                {storyboardOrder.map((nodeId, i) => (
                  <StoryboardCard
                    key={nodeId}
                    id={nodeId}
                    index={i + 1}
                    imageSrc={getImageSrc(nodeId)}
                    onRemove={() => onToggle(nodeId)}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )}
      </div>
    </div>
  );
}
