import type { Theater } from './theater'
import { EventBus } from '@clippa/utils'

export interface DirectorOption {
  theater?: Theater
}

export type DirectorEvents = {
  durationChange: [number]
  updateCurrentTime: [number]
}

export class Director extends EventBus<DirectorEvents> {
  theater!: Theater

  private _currentTime: number = 0
  get currentTime(): number {
    return this._currentTime
  }

  set currentTime(value: number) {
    this._currentTime = value
    this.emit('updateCurrentTime', value)
  }

  private _duration: number = 0
  get duration(): number {
    return this._duration
  }

  set duration(value: number) {
    this._duration = value
    this.emit('durationChange', value)
  }

  constructor(option: DirectorOption) {
    super()
    option.theater && this.guidance(option.theater)
  }

  guidance(theater: Theater): void {
    this.theater = theater

    this.theater.on('hire', (performer) => {
      if (performer.start + performer.duration > this.duration) {
        this.duration = performer.start + performer.duration
      }
    })
  }

  action(): void {
    const preformers = this.theater.filterPerformerByTime(this.currentTime)
    this.theater.performance(preformers)
  }

  stop(): void {}
}
