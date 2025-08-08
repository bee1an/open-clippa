import type { Sprite } from 'pixi.js'

export interface Performer {
  start: number
  duration: number
  sprite?: Sprite

  play: () => void

  pause: () => void

  load: () => Promise<void>
}

export interface PerformerOption {
  start: number
  duration: number
}
