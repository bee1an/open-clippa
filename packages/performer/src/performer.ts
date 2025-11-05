import type { Sprite } from 'pixi.js'

export interface Performer {
  id: string
  start: number
  duration: number
  zIndex: number
  sprite?: Sprite

  showState: ShowState

  playState: PlayState

  play: (time: number) => void

  update: (time: number) => void

  pause: (time: number) => void

  seek: (time: number) => Promise<void>

  load: () => Promise<void>
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
