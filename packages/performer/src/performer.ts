import type { Filter, Text as PixiText, Sprite } from 'pixi.js'
import type { PerformerAnimationSpec } from './animation'

export interface PerformerBounds {
  x: number
  y: number
  width: number
  height: number
  rotation?: number
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

  setPosition: (x: number, y: number) => void

  setScale: (scaleX: number, scaleY: number) => void

  setRotation: (angle: number) => void
  setAlpha: (alpha: number) => void
  setAnimation: (spec: PerformerAnimationSpec | null) => void
  setFilters: (filters: Filter[] | null) => void
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
