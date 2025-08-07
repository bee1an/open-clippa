import type { Sprite } from 'pixi.js'

export interface Performer {
  start: number
  duration: number
  sprite?: Sprite
}

export interface PerformerOption {
  start: number
  duration: number
}
