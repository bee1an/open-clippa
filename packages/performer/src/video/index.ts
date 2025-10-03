import type { FederatedPointerEvent, Texture, TextureSource, VideoResource } from 'pixi.js'
import type { Performer, PerformerOption } from '../performer'
import { EventBus, transformSrc } from '@clippa/utils'
import { Assets, Sprite, VideoSource } from 'pixi.js'
import { PlayState, ShowState } from '../performer'

VideoSource.defaultOptions.autoPlay = false

export interface PerformerClickEvent {
  performer: Video
  canvasX: number
  canvasY: number
  timestamp: number
}

export interface PerformerBounds {
  x: number
  y: number
  width: number
  height: number
  rotation?: number
}

export type PerformerEvents = {
  pointerdown: [PerformerClickEvent]
  positionUpdate: [PerformerBounds]
}

export interface VideoOption extends PerformerOption {
  id: string
  src: string | File | Blob

  zIndex: number

  width?: number

  height?: number

  x?: number

  y?: number
}

export class Video extends EventBus<PerformerEvents> implements Performer {
  id: string
  start: number
  duration: number
  src: string
  protected _sprite?: Sprite
  get sprite(): Sprite | undefined {
    return this._sprite
  }

  valid: boolean = false
  error: boolean = false
  zIndex: number
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
    super()
    const { id, start, duration, src, zIndex } = option

    this.id = id
    this.start = start
    this.duration = duration
    this.zIndex = zIndex
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
        this._sprite = new Sprite(texture)

        width && (this._sprite.width = width)
        height && (this._sprite.height = height)
        x && (this._sprite.x = x)
        y && (this._sprite.y = y)

        this.setupSpriteEvents()
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
    if (!this._sprite)
      return

    if (this.playState === PlayState.PLAYING)
      return

    this.playState = PlayState.PLAYING

    this._sprite.texture.source.resource.play()
  }

  update(time: number): void {
    this.currentTime = time

    if (this.currentTime < 0) {
      this.showState = ShowState.UNPLAYED

      const resource = this._sprite?.texture.source.resource || {} as HTMLVideoElement
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

    if (!this._sprite)
      return

    if (this.playState === 'paused')
      return

    this.playState = PlayState.PAUSED

    this._sprite.texture.source.resource.pause()

    this.seek(time)
  }

  seek(time: number): void {
    if (!this._sprite)
      return

    if (time < 0 || time > this.duration)
      return

    this.currentTime = time

    const resource = this._sprite.texture.source.resource as HTMLVideoElement

    resource.currentTime = (this.currentTime + this.sourceStart) / 1000
  }

  protected setupSpriteEvents(): void {
    if (!this._sprite)
      return

    this._sprite.eventMode = 'static'
    this._sprite.cursor = 'pointer'

    this._sprite.on('pointerdown', this.handleSpriteClick.bind(this))
  }

  protected handleSpriteClick(event: FederatedPointerEvent): void {
    if (!this._sprite)
      return

    const globalPosition = event.global
    const clickEvent: PerformerClickEvent = {
      performer: this,
      canvasX: globalPosition.x,
      canvasY: globalPosition.y,
      timestamp: Date.now(),
    }

    this.emit('pointerdown', clickEvent)
  }

  protected notifyPositionUpdate(): void {
    if (!this._sprite)
      return

    const bounds = this.getBounds()
    this.emit('positionUpdate', bounds)
  }

  containsPoint(canvasX: number, canvasY: number): boolean {
    const bounds = this.getBounds()
    if (bounds.rotation === 0) {
      return canvasX >= bounds.x && canvasX <= bounds.x + bounds.width
        && canvasY >= bounds.y && canvasY <= bounds.y + bounds.height
    }

    const centerX = bounds.x + bounds.width / 2
    const centerY = bounds.y + bounds.height / 2
    const angle = -bounds.rotation * Math.PI / 180

    const cos = Math.cos(angle)
    const sin = Math.sin(angle)

    const dx = canvasX - centerX
    const dy = canvasY - centerY

    const rotatedX = dx * cos - dy * sin
    const rotatedY = dx * sin + dy * cos

    const halfWidth = bounds.width / 2
    const halfHeight = bounds.height / 2

    return Math.abs(rotatedX) <= halfWidth && Math.abs(rotatedY) <= halfHeight
  }

  getBounds(): Required<PerformerBounds> {
    if (!this._sprite) {
      return {
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        rotation: 0,
      }
    }

    return {
      x: this._sprite.x,
      y: this._sprite.y,
      width: this._sprite.width,
      height: this._sprite.height,
      rotation: this._sprite.angle || 0,
    }
  }

  getCanvasPosition(): { x: number, y: number } {
    const bounds = this.getBounds()
    return {
      x: bounds.x + bounds.width / 2,
      y: bounds.y + bounds.height / 2,
    }
  }

  setSprite(sprite: Sprite): void {
    this._sprite = sprite
    this.setupSpriteEvents()
    // 不在这里触发位置更新事件，避免初始化时的不必要事件
  }

  setPosition(x: number, y: number): void {
    if (this._sprite) {
      this._sprite.x = x
      this._sprite.y = y
      this.notifyPositionUpdate()
    }
  }

  setRotation(angle: number): void {
    if (this._sprite) {
      this._sprite.angle = angle
      this.notifyPositionUpdate()
    }
  }

  setScale(scaleX: number, scaleY: number): void {
    if (this._sprite) {
      this._sprite.scale.x = scaleX
      this._sprite.scale.y = scaleY
      this.notifyPositionUpdate()
    }
  }

  destroy(): void {
    if (this._sprite) {
      this._sprite.removeAllListeners()
      this._sprite.destroy()
      this._sprite = undefined
    }
  }
}
