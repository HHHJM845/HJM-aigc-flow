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

export function createDefaultStageNodeData(): Omit<StageNodeData, 'onUpdate' | 'onDelete'> {
  return {
    label: '导演工作区',
    activeCameraId: 'cam-a',
    scene: {
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
    },
  }
}
