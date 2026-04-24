// src/components/stage/CameraRig.tsx
import { useEffect } from 'react'
import { useThree } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import * as THREE from 'three'
import type { StageCamera } from '../../lib/stageTypes'

interface CameraRigProps {
  camera: StageCamera
  isActive: boolean
  isPreviewMode: boolean  // 机位预览模式时 true
  onSelect: (id: string) => void
}

export default function CameraRig({ camera, isActive, isPreviewMode, onSelect }: CameraRigProps) {
  const { camera: threeCamera } = useThree()

  // 机位预览模式 + 激活机位：将 Three.js 相机锁定到此机位
  useEffect(() => {
    if (!isPreviewMode || !isActive) return
    const cam = threeCamera as THREE.PerspectiveCamera
    cam.position.set(...camera.position)
    cam.fov = camera.fov
    cam.updateProjectionMatrix()
    cam.lookAt(new THREE.Vector3(...camera.target))
  }, [isPreviewMode, isActive, camera, threeCamera])

  // 导演视角：渲染相机图标 mesh
  if (isPreviewMode) return null

  return (
    <group
      position={camera.position}
      onClick={(e) => { e.stopPropagation(); onSelect(camera.id) }}
    >
      {/* 相机体 */}
      <mesh>
        <boxGeometry args={[0.3, 0.22, 0.2]} />
        <meshStandardMaterial color={isActive ? '#f9e2af' : '#4a5568'} />
      </mesh>
      {/* 镜头 */}
      <mesh position={[0, 0, -0.16]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.07, 0.09, 0.12, 12]} />
        <meshStandardMaterial color="#2d3748" />
      </mesh>
      {/* 数字标签 */}
      <Html center distanceFactor={8} position={[0, 0.3, 0]} zIndexRange={[200, 0]}>
        <div style={{
          background: isActive ? '#f9e2af' : '#1e2a3a',
          color: isActive ? '#1e1e2e' : '#cdd6f4',
          fontSize: '13px',
          fontWeight: '700',
          padding: '3px 10px',
          borderRadius: '6px',
          minWidth: '28px',
          textAlign: 'center',
          pointerEvents: 'none',
        }}>
          {camera.name.match(/\d+/)?.[0] ?? '?'}
        </div>
      </Html>
    </group>
  )
}
