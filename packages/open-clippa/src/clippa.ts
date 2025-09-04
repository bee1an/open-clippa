import type { MaybeArray } from 'type-aide'
import type { Performer } from './performer'
import { Train } from '@clippa/timeline'
import { Director, Stage, Theater } from './canvas'
import { Timeline } from './timeline'

export class Clippa {
  theater = new Theater()
  stage: Stage
  director: Director
  timeline: Timeline
  ready: Promise<void>

  constructor() {
    this.stage = new Stage()
    this.director = new Director({ stage: this.stage, theater: this.theater })

    this.timeline = new Timeline()

    this.ready = Promise.all([this.stage.ready, this.timeline.ready]) as any

    this.timeline.on('play', () => {
      this.director.play()
    })
    this.timeline.on('pause', () => {
      this.director.pause()
    })
    this.timeline.on('seeked', (time) => {
      this.director.seek(time)
    })
  }

  /**
   * 雇佣表演者
   */
  async hire(p: Performer): Promise<void> {
    this.theater.hire(p)

    this.timeline.addTrainByZIndex(new Train(p), p.zIndex)
  }

  /**
   * 解雇表演者
   */
  fire(p: Performer): void {
    this.theater.fire(p)
  }

  show(performers: MaybeArray<Performer>): void {
    this.stage.add(performers)
  }

  hide(performers: MaybeArray<Performer>): void {
    this.stage.remove(performers)
  }

  play(): void {
    this.timeline.play()
  }

  pause(): void {
    this.timeline.pause()
  }

  seek(time: number): void {
    this.timeline.seek(time)
  }
}
