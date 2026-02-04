import type { MaybeArray } from 'type-aide'
import type { Performer } from './performer'
import { TextTrain, VideoTrain } from '@clippa/timeline'
import { Director, Stage, Theater } from './canvas'
import { Text } from './performer'
import { Timeline } from './timeline'
import { EventBus } from './utils'

export interface ClippaEvents {
  [key: string]: unknown[]
  [key: symbol]: unknown[]
}

export class Clippa extends EventBus<ClippaEvents> {
  theater = new Theater()
  stage: Stage
  director: Director
  timeline: Timeline
  ready: Promise<void>

  constructor() {
    super()
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
    this.timeline.on('seeked', async (time) => {
      await this.director.seek(time)
    })
  }

  /**
   * 雇佣表演者
   */
  async hire(p: Performer): Promise<void> {
    this.theater.hire(p)

    if (p instanceof Text) {
      const train = new TextTrain({
        id: `text-${Date.now()}`,
        start: p.start,
        duration: p.duration,
        label: p.getText(),
        textColor: p.getStyle().fill,
      })
      this.timeline.addTrainByZIndex(train, p.zIndex)
      return
    }

    const performerWithSrc = p as { src?: string }
    if (!performerWithSrc.src)
      return

    // 创建VideoTrain实例，传递必要的参数
    const videoTrain = new VideoTrain({
      id: `video-${Date.now()}`,
      start: p.start,
      duration: p.duration,
      src: performerWithSrc.src,
    })
    this.timeline.addTrainByZIndex(videoTrain, p.zIndex)
    await videoTrain.init()
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
