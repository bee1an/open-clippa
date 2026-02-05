import type { FederatedPointerEvent, Filter } from 'pixi.js'
import type { Performer, PerformerOption } from '../performer'
import { EventBus, transformSrc } from '@clippa/utils'
import { Sprite, Texture } from 'pixi.js'
import { PlayState, ShowState } from '../performer'

export interface ImageClickEvent {
  performer: Image
  canvasX: number
  canvasY: number
  timestamp: number
}

export interface ImageBounds {
  x: number
  y: number
  width: number
  height: number
  rotation?: number
}

export type ImageEvents = {
  pointerdown: [ImageClickEvent]
  positionUpdate: [ImageBounds]
}

export interface ImageOption extends PerformerOption {
  id: string
  src: string | File | Blob
  zIndex: number
  width?: number
  height?: number
  x?: number
  y?: number
}

export class Image extends EventBus<ImageEvents> implements Performer {
  id: string
  start: number
  duration: number
  src: string
  zIndex: number

  protected _sprite?: Sprite
  get sprite(): Sprite | undefined {
    return this._sprite
  }

  valid: boolean = false
  error: boolean = false

  currentTime: number = 0
  showState: ShowState = ShowState.UNPLAYED
  playState: PlayState = PlayState.PAUSED

  private _loader?: Promise<void>
  private _objectUrl?: string
  private _texture?: Texture
  private _naturalSize?: { width: number, height: number }
  private _pendingFilters: Filter[] | null = null

  constructor(option: ImageOption) {
    super()
    const { id, start, duration, src, zIndex } = option

    this.id = id
    this.start = start
    this.duration = duration
    this.zIndex = zIndex
    this.src = transformSrc(src)

    if (typeof src !== 'string')
      this._objectUrl = this.src

    this.load(option)
  }

  load(option?: ImageOption): Promise<void> {
    if (this._loader)
      return this._loader

    const { height, width, x, y } = option || {}

    const { promise, resolve, reject } = Promise.withResolvers<void>()
    this._loader = promise

    this._loadTexture()
      .then(() => {
        if (!this._sprite) {
          const texture = this._texture
          if (!texture)
            throw new Error('image texture missing')

          this._sprite = new Sprite(texture)
          this.setupSpriteEvents()
        }

        if (this._pendingFilters) {
          this._sprite.filters = this._pendingFilters
        }

        if (width !== undefined)
          this._sprite.width = width
        else if (this._naturalSize)
          this._sprite.width = this._naturalSize.width

        if (height !== undefined)
          this._sprite.height = height
        else if (this._naturalSize)
          this._sprite.height = this._naturalSize.height

        if (x !== undefined)
          this._sprite.x = x
        if (y !== undefined)
          this._sprite.y = y

        this.valid = true
        resolve()
      })
      .catch((error) => {
        console.error('Image load error:', error)
        this.error = true
        this.valid = false
        reject(new Error('image load error'))
      })

    return this._loader
  }

  private async _loadTexture(): Promise<void> {
    if (this._texture)
      return

    const image = await this._loadImage(this.src)
    this._naturalSize = {
      width: image.naturalWidth || image.width,
      height: image.naturalHeight || image.height,
    }

    this._texture = Texture.from(image)
  }

  private _loadImage(src: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const image = new globalThis.Image()
      image.crossOrigin = 'anonymous'
      image.onload = () => resolve(image)
      image.onerror = () => reject(new Error('image load error'))
      image.src = src
    })
  }

  play(time: number): void {
    this.update(time)

    if (this.playState === PlayState.PLAYING)
      return

    this.playState = PlayState.PLAYING
  }

  update(time: number): void {
    this.currentTime = time

    if (this.currentTime < 0) {
      this.showState = ShowState.UNPLAYED
      return
    }

    if (this.currentTime > this.duration) {
      this.showState = ShowState.PLAYED
      this.playState = PlayState.PAUSED
      return
    }

    this.showState = ShowState.PLAYING
  }

  pause(time: number): void {
    this.update(time)

    if (this.playState === PlayState.PAUSED)
      return

    this.playState = PlayState.PAUSED
  }

  async seek(time: number): Promise<void> {
    if (time < 0 || time > this.duration)
      return

    this.currentTime = time
    this.update(time)
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
    const clickEvent: ImageClickEvent = {
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

    const angle = -bounds.rotation * Math.PI / 180

    const cos = Math.cos(angle)
    const sin = Math.sin(angle)

    const dx = canvasX - bounds.x
    const dy = canvasY - bounds.y

    const localX = dx * cos - dy * sin
    const localY = dx * sin + dy * cos

    return localX >= 0 && localX <= bounds.width
      && localY >= 0 && localY <= bounds.height
  }

  getBounds(): Required<ImageBounds> {
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

  setFilters(filters: Filter[] | null): void {
    if (this._sprite) {
      this._sprite.filters = filters
      return
    }

    this._pendingFilters = filters
  }

  destroy(): void {
    if (this._sprite) {
      this._sprite.removeAllListeners()
      if (this._sprite.texture) {
        this._sprite.texture.destroy(true)
      }
      this._sprite.destroy()
      this._sprite = undefined
    }

    if (this._objectUrl) {
      URL.revokeObjectURL(this._objectUrl)
      this._objectUrl = undefined
    }

    this._texture = undefined
    this._naturalSize = undefined

    this.valid = false
    this.error = false
    this.showState = ShowState.UNPLAYED
    this.playState = PlayState.PAUSED
  }
}
