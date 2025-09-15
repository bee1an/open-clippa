import type { ExtendTrainEvents, ExtendTrainOption } from '.'
import { FrameExtractor } from 'open-clippa'
import { Sprite, Texture } from 'pixi.js'
import { Train } from '.'

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
    await this.generateThumnail()
  }

  async generateThumnail(): Promise<void> {
    await this.frameExctractor.load()

    const { width, height, duration } = this.frameExctractor.clip.meta

    const singleWidth = (width / height) * this.height

    const count = Math.ceil(this._slot.width / singleWidth)

    let i = 0
    while (i <= count) {
      await this.frameExctractor.getFrameByTime((duration / count) * i)
        .then((tick) => {
          tick.video && this._append(tick.video, singleWidth, this.height, singleWidth * i)
        })
      i++
    }
  }

  private _append(frame: VideoFrame, w: number, h: number, x: number): void {
    // 创建canvas来绘制VideoFrame
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')!
    ctx.drawImage(frame, 0, 0, w, h)

    // 使用canvas创建texture
    const texture = Texture.from(canvas)
    const image = new Sprite(texture)

    image.setSize(w, h)
    image.x = x
    image.y = 0
    image.zIndex = 1
    this._slot.addChild(image)
  }
}
