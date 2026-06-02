import React, { useState } from 'react';
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
import { Loader2 } from 'lucide-react';
import type { Node } from '@xyflow/react';
import StoryboardCard from './StoryboardCard';
import ShareDialog from './ShareDialog';

interface Props {
  storyboardOrder: string[];
  nodes: Node[];
  onReorder: (newOrder: string[]) => void;
  onToggle: (nodeId: string) => void;
  onExportToCanvas: () => Promise<void>;
  projectId?: string;
}

export default function StoryboardView({ storyboardOrder, nodes, onReorder, onToggle, onExportToCanvas, projectId }: Props) {
  const [isExporting, setIsExporting] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [shareDialogData, setShareDialogData] = useState<{ shareUrl: string; expiresAt: number } | null>(null);

  const handleShare = async () => {
    if (!projectId || sharing) return;
    setSharing(true);
    try {
      // Send current nodes/order so snapshot uses live state, bypassing autosave debounce
      const res = await fetch(`/api/projects/${projectId}/share`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nodes, storyboardOrder }),
      });
      if (!res.ok) throw new Error('share failed');
      const { url, expiresAt } = await res.json() as { url: string; expiresAt: number };
      setShareDialogData({ shareUrl: url, expiresAt });
    } catch (e) {
      console.error('[share]', e);
    } finally {
      setSharing(false);
    }
  };

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

  const handleExport = async () => {
    setIsExporting(true);
    try {
      await onExportToCanvas();
    } finally {
      setIsExporting(false);
    }
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
    <div className="w-full h-full bg-black flex flex-col overflow-hidden">
      {/* Top bar */}
      <div className="flex items-center justify-between gap-4 px-6 py-4 border-b border-white/6 shrink-0">
        <span className="min-w-0 text-[15px] font-semibold text-white truncate">分镜管理</span>
        <div className="flex min-w-0 flex-wrap items-center justify-end gap-4">
          <span className="text-[12px] text-white/35">
            已选 {storyboardOrder.length} 个镜头
          </span>
          {storyboardOrder.length > 0 && (
            <button
              onClick={handleExport}
              disabled={isExporting}
              className="flex min-h-11 items-center gap-2 rounded-full border border-white/12 bg-[#1c1c1e] px-6 py-3 text-sm font-medium text-[#e0e0e0] transition-all hover:bg-[#252528] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isExporting ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  导出中...
                </>
              ) : (
                '导出到画布'
              )}
            </button>
          )}
          {projectId && (
            <button
              onClick={handleShare}
              disabled={sharing}
              className="flex min-h-11 items-center gap-2 rounded-full bg-[#e0e0e0] px-8 py-3 text-sm font-bold text-[#1a1a1a] transition-all hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              <span className="material-symbols-outlined text-[18px]">share</span>
              {sharing ? '生成中...' : '提交审片'}
            </button>
          )}
        </div>
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
      {shareDialogData && (
        <ShareDialog
          shareUrl={shareDialogData.shareUrl}
          expiresAt={shareDialogData.expiresAt}
          onClose={() => setShareDialogData(null)}
        />
      )}
    </div>
  );
}
