// src/components/StageNode.tsx
import { useState, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { type NodeProps } from '@xyflow/react'
import type { StageNodeData } from '../lib/stageTypes'
import StageEditorModal from './StageEditorModal'

export default function StageNode({ id, data }: NodeProps) {
  const stageData = data as unknown as StageNodeData
  const [editorOpen, setEditorOpen] = useState(false)

  const handleOpen = useCallback(() => setEditorOpen(true), [])

  const handleClose = useCallback((updatedData: Partial<StageNodeData>) => {
    setEditorOpen(false)
    if (stageData.onUpdate) {
      stageData.onUpdate(id, updatedData)
    }
  }, [id, stageData])

  const advancedCount = stageData.scene.characters.filter(c => c.type === 'advanced').length
  const totalCount = stageData.scene.characters.length
  const cameraCount = stageData.scene.cameras.length

  return (
    <>
      <div
        className="bg-[#1e2a3a] border border-[#2a3a5c] rounded-2xl overflow-hidden shadow-2xl"
        style={{ width: stageData.preview ? 380 : 240, minHeight: 160 }}
        onDoubleClick={handleOpen}
      >
        {/* 顶部标签行 */}
        <div className="flex items-center gap-2 px-3 pt-3 pb-2">
          <span className="bg-[#313244] text-cyan-400 text-xs px-2.5 py-0.5 rounded-lg font-medium">
            ⬛ 3D 导演台
          </span>
          <div className="ml-auto">
            <button className="w-6 h-6 flex items-center justify-center bg-[#2a3a5c] rounded-md text-gray-300 hover:bg-[#3a4a6c] transition-colors text-xs">
              ⋯
            </button>
          </div>
        </div>

        {/* 统计行 */}
        <div className="mx-3 mb-2 bg-[#0f1629] rounded-xl px-3 py-2 border border-[#2a3a5c]">
          <div className="flex justify-between text-xs text-gray-400 mb-1.5">
            <span>角色 {advancedCount}</span>
            <span>对象 {totalCount}</span>
            <span>机位 {cameraCount}</span>
          </div>
          <div className="bg-[#313244] rounded-full h-1 overflow-hidden">
            {totalCount > 0 && (
              <div
                className="bg-gradient-to-r from-cyan-400 to-blue-400 h-full rounded-full transition-all"
                style={{ width: `${Math.min(100, totalCount * 15)}%` }}
              />
            )}
          </div>
        </div>

        {/* 底部：标题 + 预览图 */}
        <div className="flex">
          <div className="flex-1 px-3 pb-3">
            <div className="text-sm font-bold text-gray-100 mb-0.5">{stageData.label}</div>
            <div className="text-xs text-gray-500 mb-3">场景、人物、机位统一进入这里调整。</div>
            <button
              onClick={handleOpen}
              className="bg-gray-200 hover:bg-white text-[#1e1e2e] text-xs font-semibold px-4 py-1.5 rounded-full transition-colors"
            >
              打开 →
            </button>
          </div>

          {/* 3D 缩略图预览 */}
          {stageData.preview && (
            <div className="w-[140px] flex-shrink-0 border-l border-dashed border-[#2a3a5c] overflow-hidden">
              <img
                src={stageData.preview}
                alt="3D 场景预览"
                className="w-full h-full object-cover"
                style={{ minHeight: 110 }}
              />
            </div>
          )}
        </div>
      </div>

      {editorOpen && createPortal(
        <StageEditorModal
          _nodeId={id}
          data={stageData}
          onClose={handleClose}
        />,
        document.body
      )}
    </>
  )
}
