# 3D 导演台 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 React Flow 画布上新增 `stageNode` 节点类型，提供全屏 3D 场景编辑器，让导演设置机位、摆放角色，关闭时自动截图显示在节点卡片上。

**Architecture:** 使用 `@react-three/fiber` (R3F) + `@react-three/drei` 渲染 3D 场景。角色使用 Three.js 程序化几何体构建（无需 GLB 文件）。全屏编辑器以 `position:fixed` Modal 挂载，关闭时通过 `gl.domElement.toDataURL()` 截图写入 `node.data.preview`。

**Tech Stack:** React 19, TypeScript, @react-three/fiber ^8, @react-three/drei ^9, three ^0.170, Tailwind CSS, @xyflow/react

---

## File Map

| 文件 | 操作 | 职责 |
|------|------|------|
| `src/lib/stageTypes.ts` | 新建 | 所有 TypeScript 类型 |
| `src/components/stage/PoseLibrary.ts` | 新建 | 9 个预设姿态骨骼旋转数据 |
| `src/components/stage/CharacterObject.tsx` | 新建 | 程序化假人 + 姿态动画 |
| `src/components/stage/CameraRig.tsx` | 新建 | 机位相机对象 + 悬浮标签 |
| `src/components/stage/SceneCanvas.tsx` | 新建 | R3F Canvas 主渲染，含截图接口 |
| `src/components/stage/Inspector.tsx` | 新建 | 右侧属性检查器 |
| `src/components/stage/Toolbar.tsx` | 新建 | 左侧工具栏 |
| `src/components/StageEditorModal.tsx` | 新建 | 全屏编辑器 Modal 容器 |
| `src/components/StageNode.tsx` | 新建 | 画布节点卡片 UI |
| `src/App.tsx` | 修改 | 注册 stageNode，扩展 onAction |
| `src/components/ContextMenu.tsx` | 修改 | 新增"3D 导演台"菜单入口 |

---

## Task 1: 安装依赖

**Files:**
- Modify: `package.json`

- [ ] **Step 1: 安装 R3F 及 Three.js 依赖**

```bash
cd /c/Users/oldch/Desktop/HJM-aigc-flow-main
npm install @react-three/fiber@^8 @react-three/drei@^9 three@^0.170
npm install --save-dev @types/three@^0.170
```

- [ ] **Step 2: 验证安装成功**

```bash
npm run lint
```

预期：无错误（three 类型已安装，虽然还没用到）

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: install @react-three/fiber, drei, three"
```

---

## Task 2: TypeScript 类型定义

**Files:**
- Create: `src/lib/stageTypes.ts`

- [ ] **Step 1: 创建类型文件**

```typescript
// src/lib/stageTypes.ts

export type PoseId =
  | 'idle' | 'point' | 'sit' | 'walk'
  | 'arms_up' | 'shrug' | 'cross_arms' | 'handshake' | 'phone'

export type CharacterType = 'simple' | 'advanced'

export interface StageCharacter {
  id: string
  name: string
  type: CharacterType
  pose: PoseId
  position: [number, number, number]
  rotation: number      // Y 轴朝向，度（0-360）
  scale: number         // 默认 1.0
}

export interface StageCamera {
  id: string
  name: string
  position: [number, number, number]
  target: [number, number, number]
  fov: number           // 默认 50
}

export interface StageScene {
  bgColor: string
  bgImage?: string
  characters: StageCharacter[]
  cameras: StageCamera[]
}

export interface StageNodeData {
  label: string
  preview?: string        // base64 PNG DataURL
  activeCameraId: string
  scene: StageScene
  onUpdate?: (id: string, data: Partial<StageNodeData>) => void
  onDelete?: (id: string) => void
}

export const DEFAULT_STAGE_SCENE: StageScene = {
  bgColor: '#0d1b2a',
  characters: [],
  cameras: [
    {
      id: 'cam-a',
      name: 'A机位',
      position: [0, 3, 8],
      target: [0, 1, 0],
      fov: 50,
    },
  ],
}

export const DEFAULT_STAGE_NODE_DATA: Omit<StageNodeData, 'onUpdate' | 'onDelete'> = {
  label: '导演工作区',
  preview: undefined,
  activeCameraId: 'cam-a',
  scene: DEFAULT_STAGE_SCENE,
}
```

- [ ] **Step 2: 类型检查**

```bash
npm run lint
```

预期：无错误

- [ ] **Step 3: Commit**

```bash
git add src/lib/stageTypes.ts
git commit -m "feat: add stageTypes TypeScript definitions"
```

---

## Task 3: 姿态库

**Files:**
- Create: `src/components/stage/PoseLibrary.ts`

- [ ] **Step 1: 创建姿态数据文件**

骨骼名称对应 CharacterObject 中 useRef 挂载的 Three.js Group 节点。旋转值为 Euler XYZ（弧度）。

```typescript
// src/components/stage/PoseLibrary.ts
import type { PoseId } from '../../lib/stageTypes'

export type BoneName =
  | 'spine'
  | 'leftShoulder' | 'rightShoulder'
  | 'leftElbow'    | 'rightElbow'
  | 'leftHip'      | 'rightHip'
  | 'leftKnee'     | 'rightKnee'

export type PoseData = Partial<Record<BoneName, [number, number, number]>>

export const IDLE_POSE: Required<Record<BoneName, [number, number, number]>> = {
  spine:          [0,    0, 0],
  leftShoulder:   [0,    0, -0.3],
  rightShoulder:  [0,    0,  0.3],
  leftElbow:      [0,    0, 0],
  rightElbow:     [0,    0, 0],
  leftHip:        [0,    0, 0.05],
  rightHip:       [0,    0, -0.05],
  leftKnee:       [0,    0, 0],
  rightKnee:      [0,    0, 0],
}

export const POSES: Record<PoseId, PoseData> = {
  idle: { ...IDLE_POSE },

  point: {
    ...IDLE_POSE,
    rightShoulder:  [-1.1, 0,  0.2],
    rightElbow:     [ 0.2, 0,  0],
  },

  sit: {
    ...IDLE_POSE,
    spine:          [ 0.1, 0, 0],
    leftHip:        [ 1.4, 0,  0.05],
    rightHip:       [ 1.4, 0, -0.05],
    leftKnee:       [-1.4, 0, 0],
    rightKnee:      [-1.4, 0, 0],
  },

  walk: {
    ...IDLE_POSE,
    leftShoulder:   [ 0.5, 0, -0.3],
    rightShoulder:  [-0.5, 0,  0.3],
    leftHip:        [-0.5, 0,  0.05],
    rightHip:       [ 0.5, 0, -0.05],
    leftKnee:       [ 0.3, 0, 0],
    rightKnee:      [-0.2, 0, 0],
  },

  arms_up: {
    ...IDLE_POSE,
    leftShoulder:   [-1.4, 0, -0.2],
    rightShoulder:  [-1.4, 0,  0.2],
    leftElbow:      [ 0.3, 0, 0],
    rightElbow:     [ 0.3, 0, 0],
  },

  shrug: {
    ...IDLE_POSE,
    leftShoulder:   [-0.4, 0, -0.6],
    rightShoulder:  [-0.4, 0,  0.6],
    leftElbow:      [ 0.9, 0, 0],
    rightElbow:     [ 0.9, 0, 0],
  },

  cross_arms: {
    ...IDLE_POSE,
    leftShoulder:   [ 0.3, 0.5, -0.3],
    rightShoulder:  [ 0.3,-0.5,  0.3],
    leftElbow:      [-0.5, 0, 0],
    rightElbow:     [-0.5, 0, 0],
  },

  handshake: {
    ...IDLE_POSE,
    rightShoulder:  [-0.4, 0,  0.3],
    rightElbow:     [ 1.0, 0, 0],
  },

  phone: {
    ...IDLE_POSE,
    rightShoulder:  [-0.8, 0.3,  0.3],
    rightElbow:     [ 1.3, 0, 0],
  },
}
```

- [ ] **Step 2: 类型检查**

```bash
npm run lint
```

预期：无错误

- [ ] **Step 3: Commit**

```bash
git add src/components/stage/PoseLibrary.ts
git commit -m "feat: add PoseLibrary with 9 preset poses"
```

---

## Task 4: CharacterObject — 程序化假人

**Files:**
- Create: `src/components/stage/CharacterObject.tsx`

每个骨骼 Group 通过 `useRef` 持有引用。`useFrame` 中以 0.3s lerp 插值当前旋转到目标姿态。

- [ ] **Step 1: 创建 CharacterObject 组件**

```tsx
// src/components/stage/CharacterObject.tsx
import { useRef, useEffect, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import * as THREE from 'three'
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

export default function CharacterObject({ character, selected, onSelect, onDragEnd }: CharacterObjectProps) {
  const rootRef = useRef<THREE.Group>(null)
  const boneRefs: Record<BoneName, React.RefObject<THREE.Group>> = {
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
```

- [ ] **Step 2: 类型检查**

```bash
npm run lint
```

预期：无错误

- [ ] **Step 3: Commit**

```bash
git add src/components/stage/CharacterObject.tsx
git commit -m "feat: add procedural CharacterObject with pose interpolation"
```

---

## Task 5: CameraRig — 机位对象

**Files:**
- Create: `src/components/stage/CameraRig.tsx`

- [ ] **Step 1: 创建 CameraRig 组件**

```tsx
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
      <mesh position={[0, 0, -0.16]}>
        <cylinderGeometry args={[0.07, 0.09, 0.12, 12]} rotation={[Math.PI / 2, 0, 0]} />
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
```

- [ ] **Step 2: 类型检查**

```bash
npm run lint
```

预期：无错误

- [ ] **Step 3: Commit**

```bash
git add src/components/stage/CameraRig.tsx
git commit -m "feat: add CameraRig component with director/preview modes"
```

---

## Task 6: SceneCanvas — R3F 主画布

**Files:**
- Create: `src/components/stage/SceneCanvas.tsx`

注意：Canvas 必须设置 `gl={{ preserveDrawingBuffer: true }}` 才能让 `toDataURL()` 返回非空图像。

- [ ] **Step 1: 创建 SceneCanvas**

```tsx
// src/components/stage/SceneCanvas.tsx
import { useRef, useEffect, useCallback } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { OrbitControls, Grid } from '@react-three/drei'
import * as THREE from 'three'
import type { StageScene, StageCamera } from '../../lib/stageTypes'
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
  const activeCamera = scene.cameras.find(c => c.id === activeCameraId)

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
```

- [ ] **Step 2: 类型检查**

```bash
npm run lint
```

预期：无错误

- [ ] **Step 3: Commit**

```bash
git add src/components/stage/SceneCanvas.tsx
git commit -m "feat: add SceneCanvas with R3F, grid, character/camera rendering"
```

---

## Task 7: Inspector — 右侧检查器

**Files:**
- Create: `src/components/stage/Inspector.tsx`

- [ ] **Step 1: 创建 Inspector 组件**

```tsx
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
```

- [ ] **Step 2: 类型检查**

```bash
npm run lint
```

预期：无错误

- [ ] **Step 3: Commit**

```bash
git add src/components/stage/Inspector.tsx
git commit -m "feat: add Inspector panel for character/camera properties"
```

---

## Task 8: Toolbar — 左侧工具栏

**Files:**
- Create: `src/components/stage/Toolbar.tsx`

- [ ] **Step 1: 创建 Toolbar**

```tsx
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
```

- [ ] **Step 2: 类型检查**

```bash
npm run lint
```

预期：无错误

- [ ] **Step 3: Commit**

```bash
git add src/components/stage/Toolbar.tsx
git commit -m "feat: add Toolbar with scene actions"
```

---

## Task 9: StageEditorModal — 全屏编辑器

**Files:**
- Create: `src/components/StageEditorModal.tsx`

这是最复杂的组件，负责整合所有子组件并管理编辑器状态。关闭时执行截图。

- [ ] **Step 1: 创建 StageEditorModal**

```tsx
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
  nodeId: string
  data: StageNodeData
  onClose: (updatedData: Partial<StageNodeData>) => void
}

// 生成唯一 ID
function genId(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
}

export default function StageEditorModal({ nodeId, data, onClose }: StageEditorModalProps) {
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
  const advancedCount = scene.characters.filter(c => c.type === 'advanced').length
  const totalCount = scene.characters.length

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-[#0f1117]"
      style={{ fontFamily: 'system-ui, sans-serif' }}
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
```

- [ ] **Step 2: 类型检查**

```bash
npm run lint
```

预期：无错误

- [ ] **Step 3: Commit**

```bash
git add src/components/StageEditorModal.tsx
git commit -m "feat: add StageEditorModal with full scene state management"
```

---

## Task 10: StageNode — 画布节点卡片

**Files:**
- Create: `src/components/StageNode.tsx`

- [ ] **Step 1: 创建 StageNode**

```tsx
// src/components/StageNode.tsx
import { useState, useCallback } from 'react'
import { type NodeProps } from '@xyflow/react'
import type { StageNodeData } from '../lib/stageTypes'
import StageEditorModal from './StageEditorModal'

export default function StageNode({ id, data }: NodeProps) {
  const stageData = data as StageNodeData
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

      {editorOpen && (
        <StageEditorModal
          nodeId={id}
          data={stageData}
          onClose={handleClose}
        />
      )}
    </>
  )
}
```

- [ ] **Step 2: 类型检查**

```bash
npm run lint
```

预期：无错误

- [ ] **Step 3: Commit**

```bash
git add src/components/StageNode.tsx
git commit -m "feat: add StageNode canvas card with thumbnail preview"
```

---

## Task 11: App.tsx 集成

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/components/ContextMenu.tsx`

- [ ] **Step 1: 在 App.tsx 注册 stageNode**

在 `src/App.tsx` 顶部 import 区域（约第 56 行）添加：

```typescript
import StageNode from './components/StageNode';
```

在 `nodeTypes` 对象（约第 58 行）添加 `stageNode`：

```typescript
const nodeTypes = {
  imageNode: ImageNode,
  textNode: TextNode,
  videoNode: VideoNode,
  boardNode: BoardNode,
  commentNode: CommentNode,
  stageNode: StageNode,   // 新增
};
```

- [ ] **Step 2: 扩展 onAction 处理 stage 动作**

在 `onAction` 回调（约第 857 行）修改如下几处：

`actionLabels` 添加 `stage`：

```typescript
const actionLabels: Record<string, string> = {
  text: '文本生成', image: '图片生成', video: '视频生成', editor: '图片编辑器',
  stage: '导演工作区',   // 新增
};
```

`nodeSizes` 添加 `stage`：

```typescript
const nodeSizes: Record<string, { width: number; height: number }> = {
  image: { width: 380, height: 214 },
  video: { width: 380, height: 214 },
  text:  { width: 380, height: 300 },
  stage: { width: 240, height: 180 },  // 新增
};
```

替换 `newNode` 的构建逻辑（第 865-870 行），以支持 stageNode 的 data 格式。将原来的：

```typescript
    const newNode: Node = {
      id: newNodeId,
      type: action === 'text' ? 'textNode' : action === 'video' ? 'videoNode' : 'imageNode',
      position, width: nw, height: nh,
      data: { label: actionLabels[action] || '新节点', contentType: action, content: null, onPlusClick: handlePlusClick, onUpdate: handleUpdateNode },
    };
```

替换为：

```typescript
    import { DEFAULT_STAGE_NODE_DATA } from './lib/stageTypes';
    // (此 import 移至文件顶部)

    const newNode: Node = action === 'stage'
      ? {
          id: newNodeId,
          type: 'stageNode',
          position, width: nw, height: nh,
          data: {
            ...DEFAULT_STAGE_NODE_DATA,
            onUpdate: handleUpdateNode,
            onDelete: (nid: string) => setNodes(nds => nds.filter(n => n.id !== nid)),
          },
        }
      : {
          id: newNodeId,
          type: action === 'text' ? 'textNode' : action === 'video' ? 'videoNode' : 'imageNode',
          position, width: nw, height: nh,
          data: { label: actionLabels[action] || '新节点', contentType: action, content: null, onPlusClick: handlePlusClick, onUpdate: handleUpdateNode },
        };
```

`DEFAULT_STAGE_NODE_DATA` 的 import 放到文件顶部：

```typescript
import { DEFAULT_STAGE_NODE_DATA } from './lib/stageTypes';
```

- [ ] **Step 3: 扩展 nodesWithHandlers（stageNode 不接受 edge 连接）**

在 `nodesWithHandlers` 的 map 中（约第 883 行），stageNode 直接透传 `onUpdate`：

找到 `nodesWithHandlers` 的 return 块，在各 node.type 分支末尾添加：

```typescript
    if (node.type === 'stageNode') {
      return {
        ...node,
        data: {
          ...node.data,
          onUpdate: handleUpdateNode,
          onDelete: (nid: string) => setNodes(nds => nds.filter(n => n.id !== nid)),
        },
      };
    }
```

将此 `if` 块放在 `return node` 的最末一行的前面（整个 map 函数的最后）。

- [ ] **Step 4: 在 ContextMenu 添加"3D 导演台"入口**

打开 `src/components/ContextMenu.tsx`，在现有 `{!isFromTextNode && !isFromVideoNode && ...}` 块之后，添加：

```tsx
import { Clapperboard } from 'lucide-react';
// （import 移至顶部）

{!isFromTextNode && !isFromVideoNode && (
  <MenuButton icon={<Clapperboard size={18} />} label="3D 导演台" onClick={() => onAction('stage')} />
)}
```

顶部 import 修改为：

```typescript
import { Type, Image as ImageIcon, Video, PenTool, Clapperboard } from 'lucide-react';
```

- [ ] **Step 5: 类型检查**

```bash
npm run lint
```

预期：无错误

- [ ] **Step 6: 启动开发服务器验证**

```bash
npm run dev
```

打开 http://localhost:3000，在画布上右键 → 应看到"3D 导演台"菜单项 → 点击创建节点 → 点击节点上的"打开 →"按钮 → 3D 编辑器全屏打开 → 添加角色和机位 → 关闭后节点卡片右侧出现截图缩略图。

- [ ] **Step 7: Commit**

```bash
git add src/App.tsx src/components/ContextMenu.tsx
git commit -m "feat: integrate stageNode into App and ContextMenu"
```

---

## Self-Review Checklist

经过自检确认以下覆盖：

| Spec 需求 | 实现任务 |
|-----------|----------|
| stageNode 新节点类型 | Task 10 + Task 11 |
| 全屏 3D 编辑器 Modal | Task 9 |
| R3F + drei 渲染 | Task 6 |
| 程序化假人（无 GLB） | Task 4 |
| 9 个预设姿态 | Task 3 + Task 4 |
| 机位相机（A机位/反打/新增） | Task 5 + Task 9 |
| 导演视角 vs 机位预览切换 | Task 6 + Task 9 |
| 三分线叠加 | Task 6 |
| Inspector 检查器 | Task 7 |
| 左侧工具栏 | Task 8 |
| 撤销（50步） | Task 9 |
| 关闭时截图 → node.data.preview | Task 9 + Task 6 |
| 节点卡片含缩略图 | Task 10 |
| 角色/对象/机位计数 | Task 10 |
| 背景颜色设置 | Task 9 |
| 右键菜单入口 | Task 11 |
| 自动布局 | Task 9 |

**类型一致性：** `StageCharacter`, `StageCamera`, `StageScene`, `StageNodeData` 均在 Task 2 定义，所有后续任务均从 `../../lib/stageTypes` 导入，无重复定义。

**已知限制（规格外）：**
- "设为当前导演视角"功能（Task 9）暂用默认值替代，因为从 OrbitControls 读取当前相机状态需要额外的 ref 传递，可在后续迭代完善。
- 简单假人与高级假人共用同一套几何体结构，视觉区分仅靠命名，可后续通过颜色/样式差异区分。
