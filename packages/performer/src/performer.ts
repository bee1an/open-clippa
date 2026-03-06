import type { Filter, Text as PixiText, Sprite } from 'pixi.js'
import type { PerformerAnimationSpec } from './animation'

export interface PerformerBounds {
  x: number
  y: number
  width: number
  height: number
  rotation?: number
}

export interface CropInsets {
  left: number
  top: number
  right: number
  bottom: number
}

export interface CropMaskRect {
  x: number
  y: number
  width: number
  height: number
}

export interface ClipShapePoint {
  x: number
  y: number
}

export interface PerformerClipShape {
  id: string
  points: ClipShapePoint[]
}

export interface SourceRenderBounds {
  x: number
  y: number
  width: number
  height: number
  pivotX: number
  pivotY: number
  rotation: number
  alpha: number
}

export type SideCropDirection = 'left' | 'right' | 'top' | 'bottom'
export type CropHandleDirection
  = | 'top-left'
    | 'top-right'
    | 'bottom-left'
    | 'bottom-right'
    | 'top'
    | 'right'
    | 'bottom'
    | 'left'

export interface SideCropResizeInput {
  direction: SideCropDirection
  targetVisibleWidth: number
  targetVisibleHeight: number
}

export interface SideCropResizeResult {
  scaleX: number
  scaleY: number
  crop: CropInsets
}

export interface CropHandleResizeResult {
  crop: CropInsets
  originShiftX: number
  originShiftY: number
}

export interface Performer {
  id: string
  start: number
  duration: number
  zIndex: number
  sprite?: Sprite | PixiText

  showState: ShowState

  playState: PlayState

  play: (time: number) => void

  update: (time: number) => void

  pause: (time: number) => void

  seek: (time: number) => Promise<void>

  load: () => Promise<void>

  containsPoint: (canvasX: number, canvasY: number) => boolean

  getBounds: () => PerformerBounds
  getBaseBounds: () => PerformerBounds

  setPosition: (x: number, y: number) => void

  setScale: (scaleX: number, scaleY: number) => void

  setRotation: (angle: number) => void
  setAlpha: (alpha: number) => void
  setAnimation: (spec: PerformerAnimationSpec | null) => void
  setFilters: (filters: Filter[] | null) => void
  getCropInsets?: () => CropInsets
  setCropInsets?: (crop: Partial<CropInsets> | null) => CropInsets
  clearCrop?: () => CropInsets
  hasCrop?: () => boolean
  getClipShape?: () => PerformerClipShape | null
  setClipShape?: (shape: PerformerClipShape | null) => PerformerClipShape | null
  clearClipShape?: () => PerformerClipShape | null
  hasClipShape?: () => boolean
  getMaskRect?: () => CropMaskRect | null
  applySideCropResize?: (input: SideCropResizeInput) => SideCropResizeResult | null
  applyCropHandleResize?: (
    direction: CropHandleDirection,
    deltaLocalX: number,
    deltaLocalY: number,
    preserveAspectRatio?: boolean,
  ) => CropHandleResizeResult | null
  panCropByLocalDelta?: (deltaLocalX: number, deltaLocalY: number) => CropInsets | null
  panCropByWorldDelta?: (deltaCanvasX: number, deltaCanvasY: number) => CropInsets | null
  getSourceRenderBounds?: () => SourceRenderBounds | null
  syncRenderAssets?: () => void
}

export interface PerformerOption {
  id: string
  start: number
  duration: number
}

/**
 * 演出状态
 */
export enum ShowState {
  UNPLAYED = 'unplayed',
  PLAYING = 'playing',
  PLAYED = 'played',
}

/**
 * 播放状态
 */
export enum PlayState {
  PAUSED = 'paused',
  PLAYING = 'playing',
}
