import type { Theater } from './theater'

export interface DirectorOption {
  theater?: Theater
}

export class Director {
  theater!: Theater

  currentTime: number = 0

  duration: number = 0

  constructor(option: DirectorOption) {
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
