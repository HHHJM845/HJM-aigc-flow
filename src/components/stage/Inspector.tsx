// src/components/stage/Inspector.tsx
import type { StageCharacter, StageCamera } from '../../lib/stageTypes'
import type { PoseId } from '../../lib/stageTypes'
import { POSES } from './PoseLibrary'

const POSE_LABELS: Record<PoseId, string> = {
  idle: '站立', point: '指向', sit: '坐姿', walk: '行走',
  arms_up: '举手', shrug: '耸肩', cross_arms: '抱胸',
  handshake: '握手', phone: '打电话',
}

interface SliderRowProps {
  label: string
  value: number
  min: number
  max: number
  step: number
  onChange: (v: number) => void
}

function SliderRow({ label, value, min, max, step, onChange }: SliderRowProps) {
  return (
    <div className="mb-3">
      <div className="flex justify-between text-xs text-gray-400 mb-1">
        <span>{label}</span>
        <span className="text-cyan-400">{value.toFixed(1)}</span>
      </div>
      <input
        type="range"
        min={min} max={max} step={step}
        value={value}
        onChange={e => onChange(Number(e.target.value))}
        className="w-full h-1 accent-cyan-400 cursor-pointer"
      />
    </div>
  )
}

interface InspectorProps {
  selectedCharacter: StageCharacter | null
  selectedCamera: StageCamera | null
  onCharacterChange: (id: string, patch: Partial<StageCharacter>) => void
  onCameraChange: (id: string, patch: Partial<StageCamera>) => void
  onCaptureCameraFromDirector: (cameraId: string) => void
}

export default function Inspector({
  selectedCharacter, selectedCamera,
  onCharacterChange, onCameraChange, onCaptureCameraFromDirector,
}: InspectorProps) {
  if (!selectedCharacter && !selectedCamera) {
    return (
      <div className="w-[220px] bg-[#181825] border-l border-[#2a3a5c] p-3 flex-shrink-0">
        <div className="text-sm font-semibold text-gray-300 mb-1">检查器</div>
        <div className="text-xs text-gray-500 leading-relaxed">选中角色时调整姿态与体块，选中机位时调整镜头与目标。</div>
      </div>
    )
  }

  if (selectedCharacter) {
    const ch = selectedCharacter
    return (
      <div className="w-[220px] bg-[#181825] border-l border-[#2a3a5c] p-3 flex-shrink-0 overflow-y-auto">
        <div className="text-sm font-semibold text-gray-300 mb-1">检查器</div>

        {/* 角色信息 */}
        <div className="bg-[#1e2a3a] rounded-lg p-2.5 mb-3">
          <div className="text-xs font-semibold text-gray-300">
            {ch.type === 'advanced' ? '高级假人' : '普通假人'}
          </div>
          <div className="text-xs text-cyan-400 font-semibold mt-1">{ch.name}</div>
          <div className="flex gap-1 flex-wrap mt-1.5">
            <span className="bg-[#313244] rounded-full px-2 py-0.5 text-[10px] text-gray-300">
              姿态 {POSE_LABELS[ch.pose]}
            </span>
            <span className="bg-[#313244] rounded-full px-2 py-0.5 text-[10px] text-gray-300">
              朝向 {ch.rotation.toFixed(0)}°
            </span>
          </div>
        </div>

        {/* 高级假人：姿态选择 */}
        {ch.type === 'advanced' && (
          <div className="mb-3">
            <div className="text-xs font-semibold text-gray-400 mb-2">姿态</div>
            <div className="grid grid-cols-3 gap-1">
              {(Object.keys(POSES) as PoseId[]).map(poseId => (
                <button
                  key={poseId}
                  onClick={() => onCharacterChange(ch.id, { pose: poseId })}
                  className={`text-[10px] py-1 px-1 rounded text-center transition-colors ${
                    ch.pose === poseId
                      ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/40'
                      : 'bg-[#313244] text-gray-400 hover:bg-[#414256]'
                  }`}
                >
                  {POSE_LABELS[poseId]}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* 位置与朝向 */}
        <div className="text-xs font-semibold text-gray-400 mb-2">位置与朝向</div>
        <SliderRow label="X" value={ch.position[0]} min={-10} max={10} step={0.1}
          onChange={v => onCharacterChange(ch.id, { position: [v, ch.position[1], ch.position[2]] })} />
        <SliderRow label="Y" value={ch.position[1]} min={-2} max={5} step={0.1}
          onChange={v => onCharacterChange(ch.id, { position: [ch.position[0], v, ch.position[2]] })} />
        <SliderRow label="Z" value={ch.position[2]} min={-10} max={10} step={0.1}
          onChange={v => onCharacterChange(ch.id, { position: [ch.position[0], ch.position[1], v] })} />
        <SliderRow label="朝向" value={ch.rotation} min={0} max={360} step={1}
          onChange={v => onCharacterChange(ch.id, { rotation: v })} />
        <SliderRow label="整体缩放" value={ch.scale} min={0.5} max={2} step={0.01}
          onChange={v => onCharacterChange(ch.id, { scale: v })} />
      </div>
    )
  }

  // 选中机位
  if (selectedCamera) {
    const cam = selectedCamera
    return (
      <div className="w-[220px] bg-[#181825] border-l border-[#2a3a5c] p-3 flex-shrink-0 overflow-y-auto">
        <div className="text-sm font-semibold text-gray-300 mb-1">检查器</div>
        <div className="bg-[#1e2a3a] rounded-lg p-2.5 mb-3">
          <div className="text-xs font-semibold text-cyan-400">{cam.name}</div>
        </div>
        <SliderRow label="FOV" value={cam.fov} min={20} max={100} step={1}
          onChange={v => onCameraChange(cam.id, { fov: v })} />
        <button
          onClick={() => onCaptureCameraFromDirector(cam.id)}
          className="w-full mt-2 text-xs py-2 px-3 rounded-lg bg-[#313244] text-gray-300 hover:bg-[#414256] transition-colors text-left"
        >
          📷 设为当前导演视角
        </button>
        <div className="text-[10px] text-gray-500 mt-1 leading-relaxed">
          将当前导演视角的相机位置和朝向赋给此机位
        </div>
      </div>
    )
  }

  return null
}
