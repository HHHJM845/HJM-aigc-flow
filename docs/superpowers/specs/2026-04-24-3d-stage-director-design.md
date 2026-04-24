# 3D 导演台设计文档

**日期**: 2026-04-24  
**状态**: 待实现

## 目标

在画布（React Flow）中新增 `stageNode` 节点类型，提供一个全屏 3D 场景编辑器，让导演可以直接在三维空间中设置机位、摆放角色、调整朝向和场景布局。编辑器关闭时自动生成当前激活机位的渲染截图，作为缩略图显示在画布节点卡片上，让设计师无需打开编辑器即可直接看到空间布局意图，从源头消除沟通偏差。

## 技术选型

- **3D 渲染**: `@react-three/fiber`（R3F）+ `@react-three/drei`
  - 与现有 React 19 + TypeScript 技术栈无缝融合
  - drei 提供 OrbitControls、GLB 模型加载、骨骼动画等开箱即用能力
  - 缩略图截图通过 `gl.domElement.toDataURL('image/png')` 实现
- **依赖新增**: `@react-three/fiber`, `@react-three/drei`, `three`, `@types/three`

## 数据模型

### TypeScript 类型（`src/lib/stageTypes.ts`）

```typescript
export type PoseId =
  | 'idle' | 'point' | 'sit' | 'walk'
  | 'arms_up' | 'shrug' | 'cross_arms' | 'handshake' | 'phone'

export type CharacterType = 'simple' | 'advanced'

export interface StageCharacter {
  id: string
  name: string            // 显示名，如"主角 1"
  type: CharacterType     // simple=普通假人, advanced=高级假人
  pose: PoseId            // 当前姿态（simple 类型固定为 idle）
  position: [number, number, number]  // X Y Z（世界坐标）
  rotation: number        // Y 轴朝向角度（度，0-360）
  scale: number           // 整体缩放比例（默认 1.0）
}

export interface StageCamera {
  id: string
  name: string            // 如"A机位"、"A机位 反打"
  position: [number, number, number]
  target: [number, number, number]   // 相机看向的点
  fov: number             // 视野角（默认 50）
}

export interface StageScene {
  bgColor: string         // 舞台底色（hex）
  bgImage?: string        // 背景图 URL（可选）
  characters: StageCharacter[]
  cameras: StageCamera[]
}

export interface StageNodeData {
  label: string
  preview?: string        // base64 PNG，当前激活机位截图
  activeCameraId: string  // 当前预览的机位 ID
  scene: StageScene
}
```

### 节点存储

`StageNodeData` 存储于 XY Flow 节点的 `node.data` 字段。通过现有的 `handleUpdateNode()` 写入，跟随项目 autosave（3 秒防抖）持久化到 localStorage 和服务端。

## 文件结构

### 新增文件

| 文件 | 职责 |
|------|------|
| `src/lib/stageTypes.ts` | TypeScript 类型定义 |
| `src/components/StageNode.tsx` | 画布节点卡片 UI |
| `src/components/StageEditorModal.tsx` | 全屏 3D 编辑器 Modal 容器 |
| `src/components/stage/SceneCanvas.tsx` | R3F Canvas，负责 3D 渲染主循环 |
| `src/components/stage/CharacterObject.tsx` | 单个角色的 3D 对象，含骨骼动画 |
| `src/components/stage/CameraRig.tsx` | 机位相机，含标签浮层 |
| `src/components/stage/Inspector.tsx` | 右侧检查器面板 |
| `src/components/stage/PoseLibrary.ts` | 9 个预设姿态的骨骼关节数据 |
| `src/components/stage/Toolbar.tsx` | 左侧工具栏 |
| `public/models/simple-mannequin.glb` | 普通假人 GLB 模型（无骨骼，仅站立姿态；可使用 Mixamo 或 ReadyPlayerMe 免费资源，或用 Three.js 程序化生成简单几何体组合） |
| `public/models/advanced-mannequin.glb` | 高级假人 GLB 模型（含人形骨骼 Humanoid rig，与 POSES 中的关节名映射；推荐 Mixamo 标准骨骼命名） |

### 修改文件

| 文件 | 改动 |
|------|------|
| `src/App.tsx` | 注册 `stageNode` 节点类型；在右键菜单中新增"3D 导演台"创建入口 |
| `src/lib/storage.ts` | `Project` 类型无需改动（stageData 已在 `node.data` 内） |

## 组件设计

### StageNode（节点卡片）

节点卡片固定宽度 380px（有预览时）/ 240px（无预览时），显示：
- 顶部：节点类型标签 + 菜单按钮
- 统计行：**角色数**（高级假人数量）/ **对象数**（场景中所有角色总数，含普通+高级假人）/ **机位数** + 进度条
- 底部左：标题"导演工作区" + 副文本 + "打开 →"按钮
- 底部右（有预览时）：140px 宽的 3D 缩略图（PNG DataURL）

点击"打开 →"或双击节点卡片，挂载 `StageEditorModal`。

### StageEditorModal（全屏编辑器）

`position: fixed; inset: 0` 覆盖整个视口，z-index 高于 React Flow 画布。结构：

```
┌─ Header ──────────────────────────────────────┐
│ 标题 + 统计  [导演视角] [机位预览]  [✕]        │
├─ Camera Tabs ─────────────────────────────────┤
│ [A机位] [A机位 反打] [+ 新增机位]              │
├─ Left Toolbar ─┬─ SceneCanvas ─┬─ Inspector ──┤
│ 工具图标列      │  R3F 3D 渲染   │ 选中对象属性  │
│ (44px)         │  (flex:1)     │ (220px)      │
└────────────────┴───────────────┴──────────────┘
```

关闭流程：
1. 切换到 `activeCameraId` 对应相机
2. 渲染一帧，调用 `gl.domElement.toDataURL('image/png')`
3. 调用 `onUpdate(nodeId, { ...data, preview: dataUrl })` 写回节点
4. 卸载 Modal

### SceneCanvas（3D 渲染）

R3F `<Canvas>` 组件，包含：
- `<ambientLight>` + `<directionalLight>` 基础光照
- `<gridHelper>` 地面网格
- `<OrbitControls>` 导演视角下启用；机位预览模式下禁用，相机锁定到 `StageCamera` 参数
- 机位预览模式下叠加三分线 SVG（绝对定位于 Canvas 上方）
- 遍历 `scene.characters` 渲染 `<CharacterObject>`
- 遍历 `scene.cameras` 渲染 `<CameraRig>`

### CharacterObject（角色对象）

- 加载对应 GLB 模型（`simple-mannequin.glb` 或 `advanced-mannequin.glb`）
- 应用 `position` / `rotation` / `scale`
- 点击时触发 `onSelect(character.id)`，显示青色选中圆环（底部圆盘 mesh）
- 导演视角下支持地面平面拖拽（`useGesture` 或 Drei `DragControls`）更新 X/Z
- 姿态切换：从 `PoseLibrary` 读取目标骨骼旋转，`useFrame` 中以 0.3s lerp 插值

### PoseLibrary（姿态数据）

```typescript
type JointName = 'spine' | 'leftArm' | 'rightArm' | 'leftLeg' | 'rightLeg' | ...
type PoseData = Record<JointName, [number, number, number]>  // Euler XYZ（弧度）

export const POSES: Record<PoseId, PoseData> = {
  idle: { spine: [0,0,0], leftArm: [0,0,-0.3], ... },
  point: { spine: [0,0,0], rightArm: [0,0,1.2], ... },
  // ...
}
```

### Inspector（检查器）

选中角色时显示：
- 角色类型标签（普通假人 / 高级假人）
- 角色名（可编辑 inline）
- 姿态选择器（高级假人专属）：网格展示姿态图标，点击切换
- 位置与朝向：X / Y / Z / 朝向 / 整体缩放，各含数字显示 + range slider

选中机位时显示：
- 机位名（可编辑）
- FOV 滑块
- "设为当前视角"按钮（从 OrbitControls 当前相机位置更新机位参数）

未选中时显示提示文字。

### CameraRig（机位对象）

- 非激活机位：渲染小型相机 mesh + 悬浮数字标签
- 激活机位（机位预览模式）：将 R3F 主相机的 position/target/fov 设为该机位参数
- 点击相机 mesh：切换激活机位

## 工具栏功能

| 图标 | 功能 |
|------|------|
| 撤销 | 撤销最近一步场景操作（局部 history stack，最多 50 步）|
| 背景 | 打开背景设置面板（底色选择 / 上传图片）|
| 添加角色 | Popover：直接添加 / 阵列 / 随机分布，选择普通假人或高级假人 |
| 自动布局 | 将所有角色均匀分布在舞台中央区域 |
| 新增机位 | 在当前导演视角位置创建新机位 |
| 可见性 | 切换选中对象显示/隐藏 |
| 删除 | 删除选中对象 |
| 重置相机 | 将导演视角相机复位到默认位置 |
| 清空场景 | 清除所有角色和机位（二次确认）|

## 姿态库（9 个预设，第一版）

| ID | 中文名 | 适用 |
|----|--------|------|
| `idle` | 自然站立 | 普通 + 高级 |
| `point` | 手指指向 | 高级 |
| `sit` | 坐姿 | 高级 |
| `walk` | 行走 | 高级 |
| `arms_up` | 双臂抬起 | 高级 |
| `shrug` | 耸肩 | 高级 |
| `cross_arms` | 交叉双臂 | 高级 |
| `handshake` | 握手姿势 | 高级 |
| `phone` | 打电话 | 高级 |

## 集成点

### App.tsx

```typescript
const nodeTypes = {
  imageNode: ImageNode,
  textNode: TextNode,
  videoNode: VideoNode,
  boardNode: BoardNode,
  commentNode: CommentNode,
  stageNode: StageNode,   // 新增
}
```

右键菜单（ContextMenu）新增入口：`3D 导演台`，点击后以默认空场景创建 `stageNode`。

### 初始节点数据

```typescript
const defaultStageData: StageNodeData = {
  label: '导演工作区',
  preview: undefined,
  activeCameraId: 'cam-a',
  scene: {
    bgColor: '#0d1b2a',
    characters: [],
    cameras: [{
      id: 'cam-a',
      name: 'A机位',
      position: [0, 3, 8],
      target: [0, 1, 0],
      fov: 50,
    }],
  },
}
```

## 边界情况

- **无机位时**：关闭编辑器不执行截图，`preview` 保持 undefined，节点卡片显示空状态。
- **截图尺寸**：固定输出 480×270（16:9），截图前临时调整 canvas 尺寸，截图后恢复。
- **模型加载失败**：降级为占位几何体（BoxGeometry + MeshStandardMaterial）。
- **普通假人姿态**：Inspector 不显示姿态选择器，强制使用 `idle` 姿态。
- **撤销边界**：撤销栈仅作用于编辑器内的场景操作，不与画布全局 undo 共用。

## 不在此版本范围内

- 机位截图连线到 ImageNode / VideoNode 作为 AI 生成参考（后续版本）
- 自定义 3D 模型导入（glTF / OBJ）
- 角色服装/颜色定制
- 多人实时协同编辑 3D 场景
- 场景动画 / 关键帧时间轴
