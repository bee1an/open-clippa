import type { Texture, TextureSource, VideoResource } from 'pixi.js'
import type { Performer, PerformerOption } from '../performer'
import { transformSrc } from '@clippa/utils'
import { Assets, Sprite, VideoSource } from 'pixi.js'
import { PlayState, ShowState } from '../performer'

VideoSource.defaultOptions.autoPlay = false

export interface VideoOption extends PerformerOption {
  src: string | File | Blob

  width?: number

  height?: number

  x?: number

  y?: number
}

export class Video implements Performer {
  start: number
  duration: number
  src: string
  sprite?: Sprite
  valid: boolean = false
  error: boolean = false

  /**
   * 当前播放时间
   */
  currentTime: number = 0

  /**
   * 播放源开始时间
   */
  sourceStart: number = 0

  showState: ShowState = ShowState.UNPLAYED

  playState: PlayState = PlayState.PAUSED

  constructor(option: VideoOption) {
    const { start, duration, src } = option

    this.start = start
    this.duration = duration
    this.src = transformSrc(src)

    this.load(option)
  }

  private _loader?: Promise<void>
  load(option?: VideoOption): Promise<void> {
    if (this._loader)
      return this._loader

    const { height, width, x, y } = option || {}

    const { promise, reject, resolve } = Promise.withResolvers<void>()

    this._loader = promise

    Assets.load<Texture<TextureSource<VideoResource>>>({
      src: this.src,
      parser: 'video',
    })
      .then((texture) => {
        texture.source.resource.autoplay = false
        this.sprite = new Sprite(texture)
        width && (this.sprite.width = width)
        height && (this.sprite.height = height)
        x && (this.sprite.x = x)
        y && (this.sprite.y = y)
        this.valid = true
        resolve()
      })
      .catch(() => {
        this.error = true
        this.valid = false
        reject(new Error('video load error'))
      })

    return this._loader
  }

  play(time: number): void {
    this.update(time)
    if (!this.sprite)
      return

    if (this.playState === PlayState.PLAYING)
      return

    this.playState = PlayState.PLAYING

    this.sprite.texture.source.resource.play()
  }

  update(time: number): void {
    this.currentTime = time

    if (this.currentTime < 0) {
      this.showState = ShowState.UNPLAYED

      const resource = this.sprite?.texture.source.resource || {} as HTMLVideoElement
      resource.currentTime = 0
      return
    }

    if (this.currentTime > this.duration) {
      this.showState = ShowState.PLAYED
      return
    }

    this.showState = ShowState.PLAYING
  }

  pause(time: number): void {
    this.update(time)

    if (!this.sprite)
      return

    if (this.playState === 'paused')
      return

    this.playState = PlayState.PAUSED

    this.sprite.texture.source.resource.pause()

    this.seek(time)
  }

  seek(time: number): void {
    if (!this.sprite)
      return

    if (time < 0 || time > this.duration)
      return

    this.currentTime = time

    const resource = this.sprite.texture.source.resource as HTMLVideoElement

    resource.currentTime = (this.currentTime + this.sourceStart) / 1000
  }
}
