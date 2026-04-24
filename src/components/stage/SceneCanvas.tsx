// src/components/stage/SceneCanvas.tsx
import { useEffect } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { OrbitControls, Grid } from '@react-three/drei'
import type { StageScene } from '../../lib/stageTypes'
import CharacterObject from './CharacterObject'
import CameraRig from './CameraRig'

// ── 截图接口 ─────────────────────────────────────────
function ScreenshotCapture({ onReady }: { onReady: (fn: () => string) => void }) {
  const { gl, scene, camera } = useThree()
  useEffect(() => {
    onReady(() => {
      gl.render(scene, camera)
      return gl.domElement.toDataURL('image/png')
    })
  }, [gl, scene, camera, onReady])
  return null
}

// ── OrbitControls 代理（导演视角时启用） ──────────────
function DirectorControls({ enabled }: { enabled: boolean }) {
  return (
    <OrbitControls
      enabled={enabled}
      target={[0, 1, 0]}
      minDistance={2}
      maxDistance={30}
      maxPolarAngle={Math.PI / 2}
    />
  )
}

// ── 场景内容 ─────────────────────────────────────────
interface SceneContentProps {
  scene: StageScene
  activeCameraId: string
  viewMode: 'director' | 'camera'
  selectedId: string | null
  onSelect: (id: string | null) => void
  onCharacterMove: (id: string, position: [number, number, number]) => void
  onCameraSelect: (id: string) => void
}

function SceneContent({
  scene, activeCameraId, viewMode, selectedId,
  onSelect, onCharacterMove, onCameraSelect,
}: SceneContentProps) {
  return (
    <>
      <ambientLight intensity={0.6} />
      <directionalLight position={[5, 8, 5]} intensity={1.2} castShadow />
      <directionalLight position={[-5, 3, -5]} intensity={0.3} />

      <Grid
        position={[0, 0, 0]}
        args={[20, 20]}
        cellSize={1}
        cellThickness={0.5}
        cellColor="#2a4060"
        sectionSize={5}
        sectionThickness={1}
        sectionColor="#1e3050"
        fadeDistance={25}
        fadeStrength={1}
        infiniteGrid
      />

      {/* 点击空白取消选中 */}
      <mesh
        position={[0, -0.01, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        onClick={() => onSelect(null)}
      >
        <planeGeometry args={[100, 100]} />
        <meshBasicMaterial transparent opacity={0} />
      </mesh>

      {scene.characters.map(char => (
        <CharacterObject
          key={char.id}
          character={char}
          selected={selectedId === char.id}
          onSelect={onSelect}
          onDragEnd={onCharacterMove}
        />
      ))}

      {scene.cameras.map(cam => (
        <CameraRig
          key={cam.id}
          camera={cam}
          isActive={cam.id === activeCameraId}
          isPreviewMode={viewMode === 'camera'}
          onSelect={onCameraSelect}
        />
      ))}

      <DirectorControls enabled={viewMode === 'director'} />
    </>
  )
}

// ── 三分线叠加层（机位预览模式）──────────────────────
function RuleOfThirds() {
  return (
    <div style={{
      position: 'absolute', inset: 0, pointerEvents: 'none',
      backgroundImage: `
        linear-gradient(rgba(218,165,32,0.35) 1px, transparent 1px),
        linear-gradient(90deg, rgba(218,165,32,0.35) 1px, transparent 1px)
      `,
      backgroundSize: '33.333% 33.333%',
    }} />
  )
}

// ── 主导出 ────────────────────────────────────────────
export interface SceneCanvasProps {
  scene: StageScene
  activeCameraId: string
  viewMode: 'director' | 'camera'
  selectedId: string | null
  onSelect: (id: string | null) => void
  onCharacterMove: (id: string, position: [number, number, number]) => void
  onCameraSelect: (id: string) => void
  onScreenshotReady: (fn: () => string) => void
}

export default function SceneCanvas(props: SceneCanvasProps) {
  const { scene, activeCameraId, viewMode, selectedId, onSelect, onCharacterMove, onCameraSelect, onScreenshotReady } = props

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <Canvas
        gl={{ preserveDrawingBuffer: true, antialias: true }}
        camera={{ position: [0, 4, 10], fov: 50 }}
        shadows
      >
        <ScreenshotCapture onReady={onScreenshotReady} />
        <SceneContent
          scene={scene}
          activeCameraId={activeCameraId}
          viewMode={viewMode}
          selectedId={selectedId}
          onSelect={onSelect}
          onCharacterMove={onCharacterMove}
          onCameraSelect={onCameraSelect}
        />
      </Canvas>
      {viewMode === 'camera' && <RuleOfThirds />}
    </div>
  )
}
