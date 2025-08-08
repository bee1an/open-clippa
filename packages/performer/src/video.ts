import type { Texture, TextureSource, VideoResource } from 'pixi.js'
import type { Performer, PerformerOption } from './performer'
import { transformSrc } from '@clippa/utils'
import { Assets, Sprite } from 'pixi.js'

export interface VideoOption extends PerformerOption {
  src: string | File | Blob
}

export class Video implements Performer {
  start: number
  duration: number
  src: string

  sprite?: Sprite

  valid: boolean = false
  error: boolean = false

  constructor(option: VideoOption) {
    const { start, duration, src } = option

    this.start = start
    this.duration = duration
    this.src = transformSrc(src)

    this.load()
  }

  private _loader?: Promise<void>
  load(): Promise<void> {
    if (this._loader)
      return this._loader

    const { promise, reject, resolve } = Promise.withResolvers<void>()

    this._loader = promise

    Assets.load<Texture<TextureSource<VideoResource>>>({
      src: this.src,
      parser: 'video',
    })
      .then((texture) => {
        this.sprite = new Sprite(texture)
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
}
