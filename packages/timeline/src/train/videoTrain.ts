import type { ExtendTrainEvents, ExtendTrainOption } from './types'
import { DEBUG_NO_FRAME } from '@clippa/constants'
import { FrameExtractor } from 'open-clippa'
import { Sprite, Texture } from 'pixi.js'
import { Train } from './train'

// eslint-disable-next-line ts/no-empty-object-type
type VideoTrainEvents = ExtendTrainEvents<{}>

type VideoTrainOption = ExtendTrainOption<{
  src: string
}>

export const VIDEO_TRAIN_HEIGHT = 45

export class VideoTrain extends Train<VideoTrainEvents> {
  frameExctractor: FrameExtractor
  constructor(option: VideoTrainOption) {
    super(Object.assign(option, { height: VIDEO_TRAIN_HEIGHT }))

    this.src = option.src
    this.frameExctractor = new FrameExtractor(this.src)
  }

  async init(): Promise<void> {
    // Fire and forget: generate thumbnails in background to avoid blocking initialization
    this.generateThumnail().catch((e) => {
      console.warn('Generate thumbnail failed', e)
    })
  }

  async generateThumnail(): Promise<void> {
    if (DEBUG_NO_FRAME)
      return

    await this.frameExctractor.load()

    const { width, height, duration } = await this.frameExctractor.getVideoMetadata()

    const singleWidth = (width / height) * this.height

    const count = Math.ceil(this.width / singleWidth)

    // 确保至少生成一个缩略图
    const actualCount = Math.max(1, count)

    let i = 0
    while (i <= actualCount) {
      const time = (duration / actualCount) * i

      // 抽帧必须是同步
      const tick = await this.frameExctractor.getFrameByTime(time)
      if (tick.video) {
        this._append(tick.video, singleWidth, this.height, singleWidth * i)
      }

      i++
    }
  }

  private _append(frame: VideoFrame, w: number, h: number, x: number): void {
    const texture = Texture.from(frame)
    const image = new Sprite(texture)

    image.setSize(w, h)
    image.x = x
    image.y = 0
    image.zIndex = 1
    this._slot.addChild(image)
  }
}
