import type { CanvasBounds, CanvasSize } from '@clippc/canvas'
import type { MaybeArray } from 'type-aide'
import type { Performer } from './performer'
import { projectBoundsToCanvasBase, remapBoundsForCanvasResize } from '@clippc/canvas'
import { TextTrain, VideoTrain } from '@clippc/timeline'
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
  private canvasLayoutBaseSize: CanvasSize | null = null
  private canvasLayoutBaseBounds = new Map<string, CanvasBounds>()
  private isApplyingCanvasResize = false
  private layoutListenerCleanup = new Map<string, () => void>()

  constructor() {
    super()
    this.stage = new Stage()
    this.director = new Director({ stage: this.stage, theater: this.theater })

    this.timeline = new Timeline()
    this.director.setClockProvider(() => this.timeline.currentTime)

    this.ready = Promise.all([this.stage.ready, this.timeline.ready]) as any

    this.timeline.on('play', () => {
      this.director.play()
    })
    this.timeline.on('pause', () => {
      this.director.currentTime = this.timeline.currentTime
      this.director.pause()
    })
    this.timeline.on('seeked', async (time) => {
      await this.director.seek(time)
    })
    this.timeline.on('currentTimeUpdated', (time) => {
      this.director.currentTime = time
    })
    this.timeline.on('durationChanged', (duration) => {
      this.director.duration = duration
    })
  }

  /**
   * 雇佣表演者
   */
  async hire(p: Performer): Promise<void> {
    this.theater.hire(p)
    this.attachLayoutListener(p)
    this.syncPerformerLayoutBaseFromCurrent(p)

    if (p instanceof Text) {
      const train = new TextTrain({
        id: p.id,
        start: p.start,
        duration: p.duration,
        label: p.getText(),
        variant: 'text',
        textColor: p.getStyle().fill,
      })
      this.timeline.addTrainByZIndex(train, p.zIndex)
      return
    }

    const performerWithSrc = p as { src?: string, sourceStart?: number }
    if (!performerWithSrc.src)
      return

    // 创建VideoTrain实例，传递必要的参数
    const videoTrain = new VideoTrain({
      id: p.id,
      start: p.start,
      duration: p.duration,
      src: performerWithSrc.src,
      sourceStart: performerWithSrc.sourceStart,
    })
    this.timeline.addTrainByZIndex(videoTrain, p.zIndex)
    await videoTrain.init()
  }

  /**
   * 解雇表演者
   */
  fire(p: Performer): void {
    this.theater.fire(p)
    this.detachLayoutListener(p.id)
    this.canvasLayoutBaseBounds.delete(p.id)
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

  getCanvasSize(): CanvasSize {
    return this.stage.size
  }

  resizeCanvas(nextSize: CanvasSize, adaptPerformers: boolean = true): void {
    const previousSize = this.stage.size
    if (adaptPerformers)
      this.ensureCanvasLayoutBaseline(previousSize)

    this.stage.resize(nextSize)

    if (!adaptPerformers)
      return

    const baseSize = this.canvasLayoutBaseSize
    if (!baseSize)
      return

    this.isApplyingCanvasResize = true
    try {
      this.theater.performers.forEach((performer) => {
        const currentBounds = performer.getBaseBounds()
        if (!currentBounds.width || !currentBounds.height)
          return

        let baseBounds = this.canvasLayoutBaseBounds.get(performer.id) ?? null
        if (!baseBounds) {
          baseBounds = this.isSameCanvasSize(previousSize, baseSize)
            ? { ...currentBounds }
            : projectBoundsToCanvasBase(currentBounds, previousSize, baseSize)
          if (!baseBounds)
            return
          this.canvasLayoutBaseBounds.set(performer.id, baseBounds)
        }

        const nextBounds = remapBoundsForCanvasResize(baseBounds, baseSize, this.stage.size)
        if (!nextBounds)
          return

        const currentScaleX = performer.sprite?.scale.x ?? 1
        const currentScaleY = performer.sprite?.scale.y ?? 1
        const widthRatio = currentBounds.width ? nextBounds.width / currentBounds.width : 1
        const heightRatio = currentBounds.height ? nextBounds.height / currentBounds.height : 1

        if (Math.abs(widthRatio - 1) > 1e-6 || Math.abs(heightRatio - 1) > 1e-6) {
          performer.setScale(currentScaleX * widthRatio, currentScaleY * heightRatio)
        }

        if (Math.abs(nextBounds.x - currentBounds.x) > 1e-6 || Math.abs(nextBounds.y - currentBounds.y) > 1e-6) {
          performer.setPosition(nextBounds.x, nextBounds.y)
        }
      })
    }
    finally {
      this.isApplyingCanvasResize = false
    }
  }

  private isSameCanvasSize(left: CanvasSize, right: CanvasSize): boolean {
    return left.width === right.width && left.height === right.height
  }

  private ensureCanvasLayoutBaseline(currentSize: CanvasSize): void {
    if (!this.canvasLayoutBaseSize) {
      this.canvasLayoutBaseSize = { ...currentSize }
    }

    const baseSize = this.canvasLayoutBaseSize
    const activeIds = new Set<string>()
    this.theater.performers.forEach((performer) => {
      activeIds.add(performer.id)

      if (this.canvasLayoutBaseBounds.has(performer.id))
        return

      const currentBounds = performer.getBaseBounds()
      if (!currentBounds.width || !currentBounds.height)
        return

      const baseBounds = this.isSameCanvasSize(currentSize, baseSize)
        ? { ...currentBounds }
        : projectBoundsToCanvasBase(currentBounds, currentSize, baseSize)

      if (baseBounds)
        this.canvasLayoutBaseBounds.set(performer.id, baseBounds)
    })

    Array.from(this.canvasLayoutBaseBounds.keys()).forEach((id) => {
      if (!activeIds.has(id))
        this.canvasLayoutBaseBounds.delete(id)
    })
  }

  private syncPerformerLayoutBaseFromCurrent(performer: Performer, eventBounds?: CanvasBounds): void {
    if (this.isApplyingCanvasResize)
      return

    const baseSize = this.canvasLayoutBaseSize
    if (!baseSize)
      return

    const currentBounds = eventBounds ?? performer.getBaseBounds()
    if (!currentBounds.width || !currentBounds.height)
      return

    const currentSize = this.stage.size
    const nextBaseBounds = this.isSameCanvasSize(currentSize, baseSize)
      ? { ...currentBounds }
      : projectBoundsToCanvasBase(currentBounds, currentSize, baseSize)

    if (nextBaseBounds)
      this.canvasLayoutBaseBounds.set(performer.id, nextBaseBounds)
  }

  private attachLayoutListener(performer: Performer): void {
    this.detachLayoutListener(performer.id)

    const target = performer as unknown as {
      on?: (event: 'positionUpdate', handler: (bounds: CanvasBounds) => void) => void
      off?: (event: 'positionUpdate', handler: (bounds: CanvasBounds) => void) => void
    }
    if (!target.on)
      return

    const handler = (bounds: CanvasBounds): void => {
      this.syncPerformerLayoutBaseFromCurrent(performer, bounds)
    }

    target.on('positionUpdate', handler)
    this.layoutListenerCleanup.set(performer.id, () => {
      target.off?.('positionUpdate', handler)
    })
  }

  private detachLayoutListener(performerId: string): void {
    const cleanup = this.layoutListenerCleanup.get(performerId)
    cleanup?.()
    this.layoutListenerCleanup.delete(performerId)
  }
}
