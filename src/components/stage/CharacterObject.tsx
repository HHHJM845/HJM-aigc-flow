// src/components/stage/CharacterObject.tsx
/// <reference types="@react-three/fiber" />
import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import * as THREE from 'three'
import type { RefObject } from 'react'
import type { StageCharacter } from '../../lib/stageTypes'
import { POSES, IDLE_POSE, type BoneName } from './PoseLibrary'

const LERP_SPEED = 8  // 约 0.3s 到达目标

interface CharacterObjectProps {
  character: StageCharacter
  selected: boolean
  onSelect: (id: string) => void
  onDragEnd: (id: string, position: [number, number, number]) => void
}

// 灰蓝色假人材质
const BODY_COLOR = '#8090a0'
const JOINT_COLOR = '#99aabb'
const SELECTION_COLOR = '#00e5ff'

export default function CharacterObject({ character, selected, onSelect, onDragEnd: _onDragEnd }: CharacterObjectProps) {
  const rootRef = useRef<THREE.Group>(null)
  const boneRefs: Record<BoneName, RefObject<THREE.Group>> = {
    spine:         useRef<THREE.Group>(null),
    leftShoulder:  useRef<THREE.Group>(null),
    rightShoulder: useRef<THREE.Group>(null),
    leftElbow:     useRef<THREE.Group>(null),
    rightElbow:    useRef<THREE.Group>(null),
    leftHip:       useRef<THREE.Group>(null),
    rightHip:      useRef<THREE.Group>(null),
    leftKnee:      useRef<THREE.Group>(null),
    rightKnee:     useRef<THREE.Group>(null),
  }

  const targetEulers = useMemo<Record<BoneName, THREE.Euler>>(() => {
    const pose = character.type === 'simple' ? IDLE_POSE : (POSES[character.pose] ?? IDLE_POSE)
    return Object.fromEntries(
      (Object.keys(IDLE_POSE) as BoneName[]).map(bone => {
        const rot = (pose as Record<BoneName, [number,number,number]>)[bone] ?? IDLE_POSE[bone]
        return [bone, new THREE.Euler(...rot)]
      })
    ) as Record<BoneName, THREE.Euler>
  }, [character.pose, character.type])

  useFrame((_, delta) => {
    const alpha = 1 - Math.exp(-LERP_SPEED * delta)
    ;(Object.keys(boneRefs) as BoneName[]).forEach(bone => {
      const ref = boneRefs[bone].current
      const target = targetEulers[bone]
      if (!ref) return
      ref.rotation.x += (target.x - ref.rotation.x) * alpha
      ref.rotation.y += (target.y - ref.rotation.y) * alpha
      ref.rotation.z += (target.z - ref.rotation.z) * alpha
    })
  })

  const rotY = (character.rotation * Math.PI) / 180

  return (
    <group
      ref={rootRef}
      position={character.position}
      rotation={[0, rotY, 0]}
      scale={character.scale}
      onClick={(e) => { e.stopPropagation(); onSelect(character.id) }}
    >
      {/* 选中圆环 */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]} visible={selected}>
        <torusGeometry args={[0.35, 0.03, 8, 32]} />
        <meshBasicMaterial color={SELECTION_COLOR} />
      </mesh>

      {/* 骨盆 */}
      <mesh position={[0, 0.42, 0]}>
        <boxGeometry args={[0.28, 0.12, 0.18]} />
        <meshStandardMaterial color={BODY_COLOR} />
      </mesh>

      {/* 脊椎（躯干根节点） */}
      <group ref={boneRefs.spine} position={[0, 0.48, 0]}>
        {/* 躯干 */}
        <mesh position={[0, 0.22, 0]}>
          <boxGeometry args={[0.38, 0.44, 0.22]} />
          <meshStandardMaterial color={BODY_COLOR} />
        </mesh>

        {/* 头颈 */}
        <mesh position={[0, 0.5, 0]}>
          <cylinderGeometry args={[0.05, 0.05, 0.1, 8]} />
          <meshStandardMaterial color={JOINT_COLOR} />
        </mesh>
        <mesh position={[0, 0.62, 0]}>
          <sphereGeometry args={[0.165, 12, 12]} />
          <meshStandardMaterial color={BODY_COLOR} />
        </mesh>

        {/* 左肩 */}
        <group ref={boneRefs.leftShoulder} position={[-0.22, 0.38, 0]}>
          <mesh position={[0, 0, 0]}>
            <sphereGeometry args={[0.07, 8, 8]} />
            <meshStandardMaterial color={JOINT_COLOR} />
          </mesh>
          <mesh position={[0, -0.14, 0]}>
            <cylinderGeometry args={[0.045, 0.045, 0.28, 8]} />
            <meshStandardMaterial color={BODY_COLOR} />
          </mesh>
          {/* 左肘 */}
          <group ref={boneRefs.leftElbow} position={[0, -0.28, 0]}>
            <mesh position={[0, 0, 0]}>
              <sphereGeometry args={[0.055, 8, 8]} />
              <meshStandardMaterial color={JOINT_COLOR} />
            </mesh>
            <mesh position={[0, -0.11, 0]}>
              <cylinderGeometry args={[0.04, 0.04, 0.22, 8]} />
              <meshStandardMaterial color={BODY_COLOR} />
            </mesh>
            {/* 手 */}
            <mesh position={[0, -0.24, 0]}>
              <boxGeometry args={[0.08, 0.07, 0.05]} />
              <meshStandardMaterial color={JOINT_COLOR} />
            </mesh>
          </group>
        </group>

        {/* 右肩 (对称) */}
        <group ref={boneRefs.rightShoulder} position={[0.22, 0.38, 0]}>
          <mesh position={[0, 0, 0]}>
            <sphereGeometry args={[0.07, 8, 8]} />
            <meshStandardMaterial color={JOINT_COLOR} />
          </mesh>
          <mesh position={[0, -0.14, 0]}>
            <cylinderGeometry args={[0.045, 0.045, 0.28, 8]} />
            <meshStandardMaterial color={BODY_COLOR} />
          </mesh>
          <group ref={boneRefs.rightElbow} position={[0, -0.28, 0]}>
            <mesh position={[0, 0, 0]}>
              <sphereGeometry args={[0.055, 8, 8]} />
              <meshStandardMaterial color={JOINT_COLOR} />
            </mesh>
            <mesh position={[0, -0.11, 0]}>
              <cylinderGeometry args={[0.04, 0.04, 0.22, 8]} />
              <meshStandardMaterial color={BODY_COLOR} />
            </mesh>
            <mesh position={[0, -0.24, 0]}>
              <boxGeometry args={[0.08, 0.07, 0.05]} />
              <meshStandardMaterial color={JOINT_COLOR} />
            </mesh>
          </group>
        </group>
      </group>

      {/* 左腿 */}
      <group ref={boneRefs.leftHip} position={[-0.1, 0.42, 0]}>
        <mesh position={[0, 0, 0]}>
          <sphereGeometry args={[0.075, 8, 8]} />
          <meshStandardMaterial color={JOINT_COLOR} />
        </mesh>
        <mesh position={[0, -0.17, 0]}>
          <cylinderGeometry args={[0.055, 0.055, 0.34, 8]} />
          <meshStandardMaterial color={BODY_COLOR} />
        </mesh>
        <group ref={boneRefs.leftKnee} position={[0, -0.34, 0]}>
          <mesh position={[0, 0, 0]}>
            <sphereGeometry args={[0.06, 8, 8]} />
            <meshStandardMaterial color={JOINT_COLOR} />
          </mesh>
          <mesh position={[0, -0.16, 0]}>
            <cylinderGeometry args={[0.048, 0.048, 0.32, 8]} />
            <meshStandardMaterial color={BODY_COLOR} />
          </mesh>
          {/* 脚 */}
          <mesh position={[0, -0.34, 0.04]}>
            <boxGeometry args={[0.1, 0.06, 0.18]} />
            <meshStandardMaterial color={JOINT_COLOR} />
          </mesh>
        </group>
      </group>

      {/* 右腿 (对称) */}
      <group ref={boneRefs.rightHip} position={[0.1, 0.42, 0]}>
        <mesh position={[0, 0, 0]}>
          <sphereGeometry args={[0.075, 8, 8]} />
          <meshStandardMaterial color={JOINT_COLOR} />
        </mesh>
        <mesh position={[0, -0.17, 0]}>
          <cylinderGeometry args={[0.055, 0.055, 0.34, 8]} />
          <meshStandardMaterial color={BODY_COLOR} />
        </mesh>
        <group ref={boneRefs.rightKnee} position={[0, -0.34, 0]}>
          <mesh position={[0, 0, 0]}>
            <sphereGeometry args={[0.06, 8, 8]} />
            <meshStandardMaterial color={JOINT_COLOR} />
          </mesh>
          <mesh position={[0, -0.16, 0]}>
            <cylinderGeometry args={[0.048, 0.048, 0.32, 8]} />
            <meshStandardMaterial color={BODY_COLOR} />
          </mesh>
          <mesh position={[0, -0.34, 0.04]}>
            <boxGeometry args={[0.1, 0.06, 0.18]} />
            <meshStandardMaterial color={JOINT_COLOR} />
          </mesh>
        </group>
      </group>

      {/* 角色名称悬浮标签（选中时显示） */}
      {selected && (
        <Html position={[0, 1.6, 0]} center distanceFactor={6} zIndexRange={[100, 0]}>
          <div style={{
            background: '#1e2a3a',
            color: '#cdd6f4',
            fontSize: '11px',
            padding: '2px 8px',
            borderRadius: '4px',
            whiteSpace: 'nowrap',
            pointerEvents: 'none',
          }}>
            {character.name}
          </div>
        </Html>
      )}
    </group>
  )
}
