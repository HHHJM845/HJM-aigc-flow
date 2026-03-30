import React from 'react';
import { BaseEdge, EdgeLabelRenderer, getBezierPath, useReactFlow, type EdgeProps } from '@xyflow/react';
import { X } from 'lucide-react';

export default function CustomEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  markerEnd,
  selected,
  data,
}: EdgeProps) {
  const { setEdges } = useReactFlow();
  const isHighlighted = selected || (data as any)?.isHighlighted;

  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
    curvature: 0.35,
  });

  const onEdgeClick = (evt: React.MouseEvent) => {
    evt.stopPropagation();
    setEdges((edges) => edges.filter((e) => e.id !== id));
  };

  return (
    <>
      {/* Glow layer */}
      <BaseEdge
        path={edgePath}
        interactionWidth={0}
        style={{
          stroke: isHighlighted ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.08)',
          strokeWidth: isHighlighted ? 10 : 5,
          filter: `blur(${isHighlighted ? 5 : 3}px)`,
          pointerEvents: 'none',
          transition: 'stroke 0.25s, stroke-width 0.25s',
        }}
      />
      {/* Main line */}
      <BaseEdge
        path={edgePath}
        markerEnd={markerEnd}
        interactionWidth={20}
        style={{
          stroke: isHighlighted ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.35)',
          strokeWidth: isHighlighted ? 2 : 1.2,
          transition: 'stroke 0.25s, stroke-width 0.25s',
        }}
      />
      {/* Delete button - show when selected */}
      <EdgeLabelRenderer>
        <div
          style={{
            position: 'absolute',
            transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
            pointerEvents: 'all',
            opacity: selected ? 1 : 0,
            transition: 'opacity 0.2s',
            zIndex: selected ? 1000 : 0,
          }}
          className="nodrag nopan"
        >
          <button
            className="w-6 h-6 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center shadow-lg cursor-pointer transition-transform hover:scale-110"
            onClick={onEdgeClick}
            title="删除连线"
          >
            <X size={14} strokeWidth={3} />
          </button>
        </div>
      </EdgeLabelRenderer>
    </>
  );
}
