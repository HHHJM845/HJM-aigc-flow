// src/components/StageEditorModal.tsx
import { useState, useCallback, useRef } from 'react'
import type {
  StageScene, StageCharacter, StageCamera, CharacterType, StageNodeData
} from '../lib/stageTypes'
import SceneCanvas from './stage/SceneCanvas'
import Inspector from './stage/Inspector'
import Toolbar from './stage/Toolbar'

type ViewMode = 'director' | 'camera'

interface StageEditorModalProps {
  _nodeId: string
  data: StageNodeData
  onClose: (updatedData: Partial<StageNodeData>) => void
}

// 生成唯一 ID
function genId(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
}

export default function StageEditorModal({ _nodeId: _nodeId, data, onClose }: StageEditorModalProps) {
  const [scene, setScene] = useState<StageScene>(data.scene)
  const [activeCameraId, setActiveCameraId] = useState(data.activeCameraId)
  const [viewMode, setViewMode] = useState<ViewMode>('camera')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [showBgPanel, setShowBgPanel] = useState(false)
  const [history, setHistory] = useState<StageScene[]>([])

  const screenshotFnRef = useRef<(() => string) | null>(null)

  const pushHistory = useCallback((prev: StageScene) => {
    setHistory(h => [...h.slice(-49), prev])
  }, [])

  // ── 关闭：截图 + 回传 ──────────────────────────────
  const handleClose = useCallback(() => {
    let preview: string | undefined
    if (screenshotFnRef.current && scene.cameras.length > 0) {
      try {
        preview = screenshotFnRef.current()
      } catch {
        preview = undefined
      }
    }
    onClose({ scene, activeCameraId, preview })
  }, [scene, activeCameraId, onClose])

  // ── 角色操作 ───────────────────────────────────────
  const handleAddCharacter = useCallback((type: CharacterType) => {
    const count = scene.characters.length
    const newChar: StageCharacter = {
      id: genId('char'),
      name: type === 'advanced' ? `主角 ${count + 1}` : `路人 ${count + 1}`,
      type,
      pose: 'idle',
      position: [(count % 3) * 1.5 - 1.5, 0, Math.floor(count / 3) * 1.5],
      rotation: 180,
      scale: 1,
    }
    setScene(prev => {
      pushHistory(prev)
      return { ...prev, characters: [...prev.characters, newChar] }
    })
  }, [scene.characters.length, pushHistory])

  const handleCharacterChange = useCallback((id: string, patch: Partial<StageCharacter>) => {
    setScene(prev => ({
      ...prev,
      characters: prev.characters.map(c => c.id === id ? { ...c, ...patch } : c),
    }))
  }, [])

  const handleCharacterMove = useCallback((id: string, position: [number, number, number]) => {
    handleCharacterChange(id, { position })
  }, [handleCharacterChange])

  // ── 机位操作 ───────────────────────────────────────
  const handleAddCamera = useCallback(() => {
    const newCam: StageCamera = {
      id: genId('cam'),
      name: `机位 ${scene.cameras.length + 1}`,
      position: [0, 3, 8],
      target: [0, 1, 0],
      fov: 50,
    }
    setScene(prev => {
      pushHistory(prev)
      return { ...prev, cameras: [...prev.cameras, newCam] }
    })
    setActiveCameraId(newCam.id)
  }, [scene.cameras.length, pushHistory])

  const handleCameraChange = useCallback((id: string, patch: Partial<StageCamera>) => {
    setScene(prev => ({
      ...prev,
      cameras: prev.cameras.map(c => c.id === id ? { ...c, ...patch } : c),
    }))
  }, [])

  // "设为当前导演视角"：TODO 需要从 OrbitControls 读取，暂时重置到默认
  const handleCaptureCameraFromDirector = useCallback((cameraId: string) => {
    handleCameraChange(cameraId, { position: [0, 3, 8], target: [0, 1, 0] })
  }, [handleCameraChange])

  // ── 删除选中 ───────────────────────────────────────
  const handleDeleteSelected = useCallback(() => {
    if (!selectedId) return
    setScene(prev => {
      pushHistory(prev)
      return {
        ...prev,
        characters: prev.characters.filter(c => c.id !== selectedId),
        cameras: prev.cameras.filter(c => c.id !== selectedId),
      }
    })
    setSelectedId(null)
  }, [selectedId, pushHistory])

  // ── 自动布局 ───────────────────────────────────────
  const handleAutoLayout = useCallback(() => {
    setScene(prev => {
      pushHistory(prev)
      const count = prev.characters.length
      const cols = Math.ceil(Math.sqrt(count))
      return {
        ...prev,
        characters: prev.characters.map((c, i) => ({
          ...c,
          position: [
            (i % cols) * 1.8 - (cols - 1) * 0.9,
            0,
            Math.floor(i / cols) * 1.8,
          ] as [number, number, number],
        })),
      }
    })
  }, [pushHistory])

  // ── 撤销 ───────────────────────────────────────────
  const handleUndo = useCallback(() => {
    if (history.length === 0) return
    setScene(history[history.length - 1])
    setHistory(h => h.slice(0, -1))
  }, [history])

  // ── 清空 ───────────────────────────────────────────
  const handleClearScene = useCallback(() => {
    if (!window.confirm('确定清空所有角色和机位吗？')) return
    setScene(prev => {
      pushHistory(prev)
      return { ...prev, characters: [], cameras: [] }
    })
    setSelectedId(null)
  }, [pushHistory])

  // ── 选中对象查找 ───────────────────────────────────
  const selectedCharacter = scene.characters.find(c => c.id === selectedId) ?? null
  const selectedCamera = scene.cameras.find(c => c.id === selectedId) ?? null

  // ── 统计 ───────────────────────────────────────────
  const totalCount = scene.characters.length

  return (
    <div
      className="fixed z-50 flex flex-col bg-[#0f1117] rounded-xl shadow-2xl overflow-hidden border border-[#2a3a5c]"
      style={{ fontFamily: 'system-ui, sans-serif', top: 52, left: 60, right: 16, bottom: 52 }}
    >
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-2.5 bg-[#1e2a3a] border-b border-[#2a3a5c] flex-shrink-0">
        <span className="text-sm font-semibold text-gray-200">3D 导演台</span>
        <span className="text-xs text-gray-500">
          等待背景 · {totalCount} 个对象 · {scene.cameras.length} 个机位
        </span>
        <div className="ml-auto flex items-center gap-2">
          {(['director', 'camera'] as const).map(mode => (
            <button
              key={mode}
              onClick={() => setViewMode(mode)}
              className={`text-xs px-3 py-1 rounded-full transition-colors ${
                viewMode === mode
                  ? 'bg-cyan-400 text-[#1e2a3a] font-semibold'
                  : 'bg-[#313244] text-gray-300 hover:bg-[#414256]'
              }`}
            >
              {mode === 'director' ? '导演视角' : '机位预览'}
            </button>
          ))}
          <button
            onClick={handleClose}
            className="ml-2 w-7 h-7 flex items-center justify-center rounded-full bg-[#313244] text-gray-300 hover:bg-[#4a4a5a] transition-colors text-sm"
          >
            ✕
          </button>
        </div>
      </div>

      {/* Camera Tabs */}
      <div className="flex items-center gap-2 px-4 py-2 bg-[#181825] border-b border-[#2a3a5c] flex-shrink-0 overflow-x-auto">
        {scene.cameras.map(cam => (
          <button
            key={cam.id}
            onClick={() => { setActiveCameraId(cam.id); setSelectedId(cam.id) }}
            className={`text-xs px-3 py-1 rounded-full whitespace-nowrap transition-colors flex-shrink-0 ${
              activeCameraId === cam.id
                ? 'bg-[#f9e2af] text-[#1e1e2e] font-semibold'
                : 'bg-[#313244] text-gray-300 hover:bg-[#414256]'
            }`}
          >
            {cam.name}
          </button>
        ))}
        <button
          onClick={handleAddCamera}
          className="text-xs px-3 py-1 rounded-full bg-[#313244] text-cyan-400 hover:bg-[#414256] transition-colors flex-shrink-0"
        >
          ＋ 新增机位
        </button>
      </div>

      {/* Main area */}
      <div className="flex flex-1 overflow-hidden">
        <Toolbar
          onUndo={handleUndo}
          onOpenBackground={() => setShowBgPanel(p => !p)}
          onAddCharacter={handleAddCharacter}
          onAutoLayout={handleAutoLayout}
          onAddCamera={handleAddCamera}
          onDeleteSelected={handleDeleteSelected}
          onResetCamera={() => {}}
          onClearScene={handleClearScene}
          hasSelection={!!selectedId}
        />

        {/* 3D Canvas */}
        <div className="flex-1 relative overflow-hidden">
          <SceneCanvas
            scene={scene}
            activeCameraId={activeCameraId}
            viewMode={viewMode}
            selectedId={selectedId}
            onSelect={setSelectedId}
            onCharacterMove={handleCharacterMove}
            onCameraSelect={(id) => { setActiveCameraId(id); setSelectedId(id) }}
            onScreenshotReady={(fn) => { screenshotFnRef.current = fn }}
          />
        </div>

        <Inspector
          selectedCharacter={selectedCharacter}
          selectedCamera={selectedCamera}
          onCharacterChange={handleCharacterChange}
          onCameraChange={handleCameraChange}
          onCaptureCameraFromDirector={handleCaptureCameraFromDirector}
        />
      </div>

      {/* 背景面板（叠加在编辑器右侧） */}
      {showBgPanel && (
        <div className="absolute right-[224px] bottom-0 top-[88px] w-[260px] bg-[#1e2a3a] border-l border-[#2a3a5c] p-4 z-10 overflow-y-auto">
          <div className="text-sm font-semibold text-gray-300 mb-1">背景</div>
          <div className="text-xs text-gray-500 mb-4">可上传舞台背景图。</div>
          <div className="text-xs text-gray-400 font-semibold mb-2">舞台底色</div>
          <div className="flex flex-wrap gap-2">
            {['#0d1b2a','#0a0a0a','#0d2a1a','#0a2a0a','#2a1a0a','#2a0a0a','#d0d8e8','#f0e8d8','#ffffff'].map(color => (
              <button
                key={color}
                onClick={() => setScene(prev => ({ ...prev, bgColor: color }))}
                style={{ background: color }}
                className={`w-9 h-9 rounded-xl border-2 transition-all ${
                  scene.bgColor === color ? 'border-cyan-400 scale-110' : 'border-transparent'
                }`}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
