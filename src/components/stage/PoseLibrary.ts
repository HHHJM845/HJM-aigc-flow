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
