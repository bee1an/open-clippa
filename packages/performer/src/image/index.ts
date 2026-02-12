import type { FederatedPointerEvent, Filter } from 'pixi.js'
import type { AnimationLayout, PerformerAnimationSpec, TransformState } from '../animation'
import type { Performer, PerformerOption } from '../performer'
import { EventBus, transformSrc } from '@clippc/utils'
import { Sprite, Texture } from 'pixi.js'
import { AnimationController, DEFAULT_TRANSFORM_STATE } from '../animation'
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
  private static readonly _SCALE_EPSILON = 1e-6

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
  private _animationController?: AnimationController

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
        this._updateBaseTransform()
        this._applyAnimationForCurrentTime()
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
    this._applyAnimationForCurrentTime()
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

    const bounds = this.getBaseBounds()
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

  getBaseBounds(): Required<ImageBounds> {
    if (!this._sprite) {
      return {
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        rotation: 0,
      }
    }

    const baseTransform = this._resolveBaseTransform()
    const baseSize = this._resolveBaseSize(baseTransform)

    return {
      x: baseTransform.x,
      y: baseTransform.y,
      width: baseSize.width,
      height: baseSize.height,
      rotation: baseTransform.rotation,
    }
  }

  setAnimation(spec: PerformerAnimationSpec | null): void {
    if (!spec) {
      const baseTransform = this._animationController?.baseTransform

      this._animationController?.destroy()
      this._animationController = undefined

      if (baseTransform)
        this._applyTransform(baseTransform)

      return
    }

    if (!this._animationController) {
      this._animationController = new AnimationController(this._getCurrentTransform(), spec)
    }
    else {
      this._animationController.setSpec(spec)
    }

    this._applyAnimationForCurrentTime()
  }

  setPosition(x: number, y: number): void {
    if (!this._sprite)
      return

    if (this._setBaseTransformPatch({ x, y })) {
      this.notifyPositionUpdate()
      return
    }

    this._sprite.x = x
    this._sprite.y = y
    this.notifyPositionUpdate()

    if (!this._animationController?.isApplying)
      this._updateBaseTransform()
  }

  setRotation(angle: number): void {
    if (!this._sprite)
      return

    if (this._setBaseTransformPatch({ rotation: angle })) {
      this.notifyPositionUpdate()
      return
    }

    this._sprite.angle = angle
    this.notifyPositionUpdate()

    if (!this._animationController?.isApplying)
      this._updateBaseTransform()
  }

  setScale(scaleX: number, scaleY: number): void {
    if (!this._sprite)
      return

    if (this._animationController && !this._animationController.isApplying) {
      const nextBaseScale = this._resolveBaseScaleByRender(scaleX, scaleY)
      this._setBaseTransformPatch(nextBaseScale)
      this.notifyPositionUpdate()
      return
    }

    this._sprite.scale.x = scaleX
    this._sprite.scale.y = scaleY
    this.notifyPositionUpdate()

    if (!this._animationController?.isApplying)
      this._updateBaseTransform()
  }

  setAlpha(alpha: number): void {
    if (!this._sprite)
      return

    if (this._setBaseTransformPatch({ alpha }))
      return

    this._sprite.alpha = alpha

    if (!this._animationController?.isApplying)
      this._updateBaseTransform()
  }

  setFilters(filters: Filter[] | null): void {
    if (this._sprite) {
      this._sprite.filters = filters
      return
    }

    this._pendingFilters = filters
  }

  destroy(): void {
    this._animationController?.destroy()
    this._animationController = undefined

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

  private _getCurrentTransform(): TransformState {
    if (!this._sprite) {
      return { ...DEFAULT_TRANSFORM_STATE }
    }

    return {
      x: this._sprite.x,
      y: this._sprite.y,
      scaleX: this._sprite.scale.x,
      scaleY: this._sprite.scale.y,
      rotation: this._sprite.angle || 0,
      alpha: this._sprite.alpha,
    }
  }

  private _resolveBaseTransform(): TransformState {
    if (this._animationController)
      return this._animationController.baseTransform

    return this._getCurrentTransform()
  }

  private _resolveBaseSize(baseTransform: TransformState): { width: number, height: number } {
    if (!this._sprite)
      return { width: 0, height: 0 }

    const currentScaleX = this._sprite.scale.x
    const currentScaleY = this._sprite.scale.y
    const localWidth = Math.abs(currentScaleX) > Image._SCALE_EPSILON
      ? this._sprite.width / Math.abs(currentScaleX)
      : (this._naturalSize?.width ?? this._sprite.width)
    const localHeight = Math.abs(currentScaleY) > Image._SCALE_EPSILON
      ? this._sprite.height / Math.abs(currentScaleY)
      : (this._naturalSize?.height ?? this._sprite.height)

    return {
      width: Math.max(0, Math.abs(localWidth * baseTransform.scaleX)),
      height: Math.max(0, Math.abs(localHeight * baseTransform.scaleY)),
    }
  }

  private _resolveAnimationLayout(): AnimationLayout | undefined {
    if (!this._sprite)
      return undefined

    const currentScaleX = this._sprite.scale.x
    const currentScaleY = this._sprite.scale.y
    const localWidth = Math.abs(currentScaleX) > Image._SCALE_EPSILON
      ? this._sprite.width / Math.abs(currentScaleX)
      : (this._naturalSize?.width ?? this._sprite.width)
    const localHeight = Math.abs(currentScaleY) > Image._SCALE_EPSILON
      ? this._sprite.height / Math.abs(currentScaleY)
      : (this._naturalSize?.height ?? this._sprite.height)

    if (
      !Number.isFinite(localWidth) || !Number.isFinite(localHeight)
      || localWidth <= Image._SCALE_EPSILON || localHeight <= Image._SCALE_EPSILON
    ) {
      return undefined
    }

    return {
      localWidth,
      localHeight,
    }
  }

  private _resolveBaseScaleByRender(scaleX: number, scaleY: number): { scaleX: number, scaleY: number } {
    if (!this._animationController || !this._sprite)
      return { scaleX, scaleY }

    const baseTransform = this._animationController.baseTransform
    const relativeScaleX = Math.abs(baseTransform.scaleX) > Image._SCALE_EPSILON
      ? this._sprite.scale.x / baseTransform.scaleX
      : 1
    const relativeScaleY = Math.abs(baseTransform.scaleY) > Image._SCALE_EPSILON
      ? this._sprite.scale.y / baseTransform.scaleY
      : 1
    const safeRelativeScaleX = Math.abs(relativeScaleX) > Image._SCALE_EPSILON ? relativeScaleX : 1
    const safeRelativeScaleY = Math.abs(relativeScaleY) > Image._SCALE_EPSILON ? relativeScaleY : 1

    return {
      scaleX: scaleX / safeRelativeScaleX,
      scaleY: scaleY / safeRelativeScaleY,
    }
  }

  private _applyTransform(transform: TransformState): void {
    if (!this._sprite)
      return

    this._sprite.x = transform.x
    this._sprite.y = transform.y
    this._sprite.scale.x = transform.scaleX
    this._sprite.scale.y = transform.scaleY
    this._sprite.angle = transform.rotation
    this._sprite.alpha = transform.alpha
  }

  private _updateBaseTransform(): void {
    if (!this._animationController)
      return

    this._animationController.setBaseTransform(this._getCurrentTransform())
  }

  private _setBaseTransformPatch(patch: Partial<TransformState>): boolean {
    if (!this._animationController || this._animationController.isApplying)
      return false

    const baseTransform = this._animationController.baseTransform
    this._animationController.setBaseTransform({
      ...baseTransform,
      ...patch,
    })
    this._applyAnimationForCurrentTime()

    return true
  }

  private _applyAnimationForCurrentTime(): void {
    if (!this._animationController || !this._sprite)
      return

    const layout = this._resolveAnimationLayout()
    this._animationController.apply(
      this.currentTime,
      this.duration,
      (transform) => {
        this._applyTransform(transform)
      },
      layout,
    )
  }
}
