import type { ExtendTrainEvents, ExtendTrainOption } from './types'
import { DEBUG_NO_FRAME, TIMELINE_TRAIN_HEIGHT } from '@clippc/constants'
import { getPxByMs } from '@clippc/utils'
import { FrameExtractor } from 'clippc'
import { Container, Sprite, Texture } from 'pixi.js'
import { Train } from './train'

// eslint-disable-next-line ts/no-empty-object-type
type VideoTrainEvents = ExtendTrainEvents<{}>

type VideoTrainOption = ExtendTrainOption<{
  src: string
  sourceStart?: number
}>

export const VIDEO_TRAIN_HEIGHT = TIMELINE_TRAIN_HEIGHT

export class VideoTrain extends Train<VideoTrainEvents> {
  frameExctractor: FrameExtractor
  private _thumbnailLayer: Container
  private _sourceStart: number
  private _thumbnailBaseSourceStart: number
  private _thumbnailRenderVersion: number = 0
  private _zoomRefreshTimer: number = 0

  constructor(option: VideoTrainOption) {
    super(Object.assign(option, { height: VIDEO_TRAIN_HEIGHT }))

    this.src = option.src
    this._sourceStart = Math.max(0, option.sourceStart ?? 0)
    this._thumbnailBaseSourceStart = this._sourceStart
    this.frameExctractor = new FrameExtractor(this.src)

    this._thumbnailLayer = new Container({ label: 'video-train-thumbnails' })
    this._thumbnailLayer.eventMode = 'none'
    this._slot.addChild(this._thumbnailLayer)

    // debounce: wait until zooming stops, then regenerate thumbnails
    this.state.on('updatedPxPerMs', () => {
      clearTimeout(this._zoomRefreshTimer)
      this._zoomRefreshTimer = window.setTimeout(() => {
        this.refreshThumbnails().catch((e) => {
          console.warn('Zoom thumbnail refresh failed', e)
        })
      }, 150)
    })
  }

  async init(): Promise<void> {
    // Fire and forget: generate thumbnails in background to avoid blocking initialization
    this.generateThumnail().catch((e) => {
      console.warn('Generate thumbnail failed', e)
    })
  }

  updateSourceStart(sourceStart: number): void {
    this._sourceStart = Math.max(0, sourceStart)
    this._syncThumbnailOffset()
  }

  async refreshThumbnails(): Promise<void> {
    await this.generateThumnail()
  }

  updateWidth(width: number): void {
    super.updateWidth(width)
    this._syncThumbnailOffset()
  }

  async generateThumnail(): Promise<void> {
    if (DEBUG_NO_FRAME)
      return

    const renderVersion = ++this._thumbnailRenderVersion

    await this.frameExctractor.load()

    const { width, height, duration: sourceDurationUs } = await this.frameExctractor.getVideoMetadata()

    if (renderVersion !== this._thumbnailRenderVersion)
      return

    const singleWidth = (width / height) * this.height

    const count = Math.ceil(this.width / singleWidth)

    // 确保至少生成一个缩略图
    const actualCount = Math.max(1, count)
    const frameWindowStartMs = Math.max(0, this._sourceStart)
    const frameWindowStartUs = Math.min(sourceDurationUs, frameWindowStartMs * 1000)
    const frameWindowEndUs = Math.min(sourceDurationUs, frameWindowStartUs + Math.max(0, this.duration) * 1000)
    const frameWindowDurationUs = Math.max(0, frameWindowEndUs - frameWindowStartUs)

    this._clearThumbnails()
    this._thumbnailBaseSourceStart = frameWindowStartMs

    let i = 0
    while (i <= actualCount) {
      if (renderVersion !== this._thumbnailRenderVersion)
        return

      const ratio = i / actualCount
      const timeUs = frameWindowStartUs + frameWindowDurationUs * ratio

      // 抽帧必须是同步
      const tick = await this.frameExctractor.getFrameByTime(timeUs)

      if (renderVersion !== this._thumbnailRenderVersion)
        return

      if (tick.video) {
        this._append(tick.video, singleWidth, this.height, singleWidth * i)
      }

      i++
    }

    this._syncThumbnailOffset()
  }

  private _clearThumbnails(): void {
    const oldChildren = this._thumbnailLayer.removeChildren()
    oldChildren.forEach((child) => {
      if (child instanceof Sprite)
        child.texture.destroy(true)

      child.destroy()
    })
  }

  private _syncThumbnailOffset(): void {
    const sourceDelta = this._sourceStart - this._thumbnailBaseSourceStart
    this._thumbnailLayer.x = -getPxByMs(sourceDelta, this.state.pxPerMs)
  }

  private _append(frame: VideoFrame, w: number, h: number, x: number): void {
    const texture = Texture.from(frame)
    const image = new Sprite(texture)

    image.setSize(w, h)
    image.x = x
    image.y = 0
    image.zIndex = 1
    image.eventMode = 'none'
    this._thumbnailLayer.addChild(image)
  }
}
