// src/components/stage/Toolbar.tsx
import type { CharacterType } from '../../lib/stageTypes'

interface ToolbarProps {
  onUndo: () => void
  onOpenBackground: () => void
  onAddCharacter: (type: CharacterType) => void
  onAutoLayout: () => void
  onAddCamera: () => void
  onDeleteSelected: () => void
  onResetCamera: () => void
  onClearScene: () => void
  hasSelection: boolean
}

interface ToolBtnProps {
  icon: string
  label: string
  onClick: () => void
  disabled?: boolean
  danger?: boolean
}

function ToolBtn({ icon, label, onClick, disabled, danger }: ToolBtnProps) {
  return (
    <button
      title={label}
      onClick={onClick}
      disabled={disabled}
      className={`
        w-8 h-8 flex items-center justify-center rounded-lg text-base transition-colors
        ${disabled ? 'opacity-30 cursor-not-allowed' : 'hover:bg-white/10 cursor-pointer'}
        ${danger ? 'text-red-400' : 'text-gray-400 hover:text-gray-200'}
      `}
    >
      {icon}
    </button>
  )
}

export default function Toolbar({
  onUndo, onOpenBackground, onAddCharacter, onAutoLayout,
  onAddCamera, onDeleteSelected, onResetCamera, onClearScene, hasSelection,
}: ToolbarProps) {
  return (
    <div className="w-11 bg-[#181825] border-r border-[#2a3a5c] flex flex-col items-center py-2 gap-1 flex-shrink-0">
      <ToolBtn icon="↩" label="撤销" onClick={onUndo} />
      <ToolBtn icon="🖼" label="背景设置" onClick={onOpenBackground} />
      <ToolBtn icon="🧍" label="添加普通假人" onClick={() => onAddCharacter('simple')} />
      <ToolBtn icon="🤖" label="添加高级假人" onClick={() => onAddCharacter('advanced')} />
      <ToolBtn icon="✦" label="自动均匀布局" onClick={onAutoLayout} />
      <ToolBtn icon="📷" label="新增机位" onClick={onAddCamera} />
      <div className="flex-1" />
      <ToolBtn icon="🗑" label="删除选中" onClick={onDeleteSelected} disabled={!hasSelection} danger />
      <ToolBtn icon="↺" label="重置导演视角" onClick={onResetCamera} />
      <ToolBtn icon="◇" label="清空场景" onClick={onClearScene} danger />
    </div>
  )
}
