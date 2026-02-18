import type {
  InputVideoTrack,
  VideoSample,
} from 'mediabunny'
import type { FederatedPointerEvent, Filter } from 'pixi.js'
import type { AnimationLayout, PerformerAnimationSpec, TransformState } from '../animation'
import type { Performer, PerformerOption } from '../performer'
import { EventBus, transformSrc } from '@clippc/utils'
import {
  ALL_FORMATS,
  Input,
  UrlSource,
  VideoSampleSink,
} from 'mediabunny'
import { Sprite, Texture } from 'pixi.js'
import { AnimationController, DEFAULT_TRANSFORM_STATE } from '../animation'
import { PlayState, ShowState } from '../performer'

export interface PerformerClickEvent {
  performer: Video
  canvasX: number
  canvasY: number
  timestamp: number
}

export interface VideoBounds {
  x: number
  y: number
  width: number
  height: number
  rotation?: number
}

export type PerformerEvents = {
  pointerdown: [PerformerClickEvent]
  positionUpdate: [VideoBounds]
}

export interface VideoOption extends PerformerOption {
  id: string
  src: string | File | Blob

  zIndex: number

  sourceDuration?: number

  sourceStart?: number

  width?: number

  height?: number

  x?: number

  y?: number
}

export class Video extends EventBus<PerformerEvents> implements Performer {
  private static readonly _DEFAULT_FRAME_INTERVAL_MS = 1000 / 30
  private static readonly _FRAME_SAMPLE_EPSILON_MS = 1
  private static readonly _SCALE_EPSILON = 1e-6

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

  /**
   * 播放源总时长
   */
  sourceDuration: number = 0

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
    this.sourceDuration = option.sourceDuration ?? option.duration
    this.sourceStart = option.sourceStart ?? 0

    this.load(option)
  }

  private _input?: Input
  private _videoTrack: InputVideoTrack | null = null
  private _videoSink?: VideoSampleSink
  private _loader?: Promise<void>
  private _pendingFilters: Filter[] | null = null
  private _animationController?: AnimationController

  private _frameIntervalMs: number = Video._DEFAULT_FRAME_INTERVAL_MS

  /**
   * 最后渲染的时间（避免重复渲染同一帧）
   */
  private _lastRenderedTime: number = -1

  private _cachedFrame: { key: number, frame: VideoFrame, texture: Texture } | null = null
  private _pendingRenderTime: number | null = null
  private _rendering = false
  private _renderIdleWaiters = new Set<() => void>()

  load(option?: VideoOption): Promise<void> {
    if (this._loader)
      return this._loader

    const { height, width, x, y } = option || {}

    const { promise, reject, resolve } = Promise.withResolvers<void>()

    this._loader = promise

    this._initMediabunny()
      .then(async () => {
        // 创建 Sprite
        if (!this._sprite) {
          this._sprite = new Sprite()
          this.setupSpriteEvents()
        }

        if (this._pendingFilters) {
          this._sprite.filters = this._pendingFilters
        }

        // 设置尺寸和位置
        if (width !== undefined)
          this._sprite.width = width
        if (height !== undefined)
          this._sprite.height = height
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
        console.error('Video load error:', error)
        this.error = true
        this.valid = false
        reject(new Error('video load error'))
      })

    return this._loader
  }

  /**
   * 初始化 mediabunny 相关资源
   */
  private async _initMediabunny(): Promise<void> {
    this._input = new Input({
      formats: ALL_FORMATS,
      source: new UrlSource(this.src),
    })

    // 获取视频轨道
    this._videoTrack = await this._input.getPrimaryVideoTrack()

    if (!this._videoTrack) {
      throw new Error('未找到视频轨道')
    }

    // 检查是否可以解码
    if (!(await this._videoTrack.canDecode())) {
      throw new Error('该视频格式无法在当前环境中解码')
    }

    // 创建视频采样器
    this._videoSink = new VideoSampleSink(this._videoTrack)

    try {
      const stats = await this._videoTrack.computePacketStats(120)
      const fps = stats.averagePacketRate
      if (Number.isFinite(fps) && fps > 0)
        this._frameIntervalMs = 1000 / fps
    }
    catch (error) {
      console.warn('[video] compute packet stats failed, fallback to default frame interval', error)
      this._frameIntervalMs = Video._DEFAULT_FRAME_INTERVAL_MS
    }
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
      this._lastRenderedTime = -1
      return
    }

    if (this.currentTime > this.duration) {
      this.showState = ShowState.PLAYED
      this.playState = PlayState.PAUSED
      return
    }

    this.showState = ShowState.PLAYING
    this._applyAnimationForCurrentTime()

    this._queueFrameRender(this._resolveSourceTime(time))
  }

  pause(time: number): void {
    this.update(time)

    if (this.playState === PlayState.PAUSED)
      return

    this.playState = PlayState.PAUSED
  }

  async seek(time: number): Promise<void> {
    this.currentTime = time
    this._applyAnimationForCurrentTime()
    await this._queueFrameRenderAndWait(this._resolveSourceTime(time))
  }

  async renderFrameAtSourceTime(ms: number): Promise<void> {
    await this._queueFrameRenderAndWait(this._clampSourceTime(ms))
  }

  private _resolveSourceTime(time: number): number {
    return this._clampSourceTime(this.sourceStart + time)
  }

  private _clampSourceTime(time: number): number {
    const max = Math.max(0, this.sourceDuration)
    if (max <= 0)
      return 0

    const safeMax = max > Video._FRAME_SAMPLE_EPSILON_MS
      ? max - Video._FRAME_SAMPLE_EPSILON_MS
      : max

    return Math.min(safeMax, Math.max(0, time))
  }

  private _normalizeRenderTime(time: number): number {
    const clampedTime = this._clampSourceTime(time)
    if (!(this._frameIntervalMs > 0))
      return clampedTime

    const snapped = Math.round(clampedTime / this._frameIntervalMs) * this._frameIntervalMs
    return this._clampSourceTime(snapped)
  }

  private _resolveFrameCacheKey(time: number): number {
    if (this._frameIntervalMs > 0)
      return Math.round(time / this._frameIntervalMs)

    return Math.round(time)
  }

  private _queueFrameRender(time: number): void {
    this._pendingRenderTime = this._normalizeRenderTime(time)
    void this._drainRenderQueue()
  }

  private _queueFrameRenderAndWait(time: number): Promise<void> {
    this._pendingRenderTime = this._normalizeRenderTime(time)
    return new Promise<void>((resolve) => {
      this._renderIdleWaiters.add(resolve)
      void this._drainRenderQueue()
    })
  }

  private _flushRenderIdleWaiters(): void {
    if (this._renderIdleWaiters.size === 0)
      return

    const waiters = [...this._renderIdleWaiters]
    this._renderIdleWaiters.clear()
    waiters.forEach(resolve => resolve())
  }

  private async _drainRenderQueue(): Promise<void> {
    if (this._rendering)
      return

    this._rendering = true
    try {
      while (this._pendingRenderTime !== null) {
        const time = this._pendingRenderTime
        this._pendingRenderTime = null
        await this._renderFrameAtTime(time)
      }
    }
    finally {
      this._rendering = false

      if (this._pendingRenderTime === null)
        this._flushRenderIdleWaiters()

      if (this._pendingRenderTime !== null)
        void this._drainRenderQueue()
    }
  }

  private _resolveCachedTexture(cacheKey: number): Texture | null {
    if (!this._cachedFrame)
      return null

    return this._cachedFrame.key === cacheKey ? this._cachedFrame.texture : null
  }

  private _clearCachedFrame(): void {
    if (!this._cachedFrame)
      return

    if (this._sprite?.texture === this._cachedFrame.texture) {
      this._sprite.texture = Texture.EMPTY
    }

    try {
      this._cachedFrame.texture.destroy(true)
    }
    catch {}

    try {
      this._cachedFrame.frame.close()
    }
    catch {}

    this._cachedFrame = null
  }

  /**
   * 在指定时间渲染帧
   */
  private async _renderFrameAtTime(time: number): Promise<void> {
    if (!this._sprite)
      return

    const normalizedTime = this._normalizeRenderTime(time)
    if (normalizedTime === this._lastRenderedTime && this._sprite.texture)
      return

    try {
      const cacheKey = this._resolveFrameCacheKey(normalizedTime)
      let texture = this._resolveCachedTexture(cacheKey)
      let videoFrame: VideoFrame | null = null

      if (!texture) {
        const videoSample = await this._getVideoSampleAtTime(normalizedTime)
        if (!videoSample)
          return

        videoFrame = videoSample.toVideoFrame()
        videoSample.close()

        texture = Texture.from(videoFrame)
      }

      const sprite = this._sprite
      if (!sprite)
        return

      const preservedSize = {
        width: sprite.width,
        height: sprite.height,
      }

      if (videoFrame) {
        this._clearCachedFrame()
        this._cachedFrame = {
          key: cacheKey,
          frame: videoFrame,
          texture,
        }
      }

      if (sprite.texture !== texture)
        sprite.texture = texture

      if (preservedSize.width > 0)
        sprite.width = preservedSize.width
      if (preservedSize.height > 0)
        sprite.height = preservedSize.height

      this._lastRenderedTime = normalizedTime
    }
    catch (error) {
      console.error('Error rendering frame:', error)
    }
  }

  /**
   * 从 mediabunny 获取指定时间的视频采样
   */
  private async _getVideoSampleAtTime(time: number): Promise<VideoSample | null> {
    if (!this._videoSink) {
      return null
    }

    // 转换时间为秒
    const timeInSeconds = time / 1000

    try {
      const sample = await this._videoSink.getSample(timeInSeconds)
      if (sample)
        return sample

      if (time <= 0)
        return null

      const step = Math.max(Video._FRAME_SAMPLE_EPSILON_MS, this._frameIntervalMs)
      const fallbackOffsets = [step, step * 2]

      for (const offset of fallbackOffsets) {
        const fallbackTime = Math.max(0, time - offset)
        const fallbackSample = await this._videoSink.getSample(fallbackTime / 1000)
        if (fallbackSample)
          return fallbackSample
      }

      return null
    }
    catch (error) {
      console.error('Error getting video sample:', error)
      return null
    }
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

  getBounds(): Required<VideoBounds> {
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

  getBaseBounds(): Required<VideoBounds> {
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

    this._pendingRenderTime = null
    this._flushRenderIdleWaiters()
    this._clearCachedFrame()
    this._lastRenderedTime = -1

    // 关闭 mediabunny 资源

    if (this._input) {
      this._input[Symbol.dispose]()
      this._input = undefined
    }

    this._videoTrack = null
    this._videoSink = undefined

    // 清理 Sprite
    if (this._sprite) {
      this._sprite.removeAllListeners()
      if (this._sprite.texture && this._sprite.texture !== Texture.EMPTY) {
        this._sprite.texture.destroy(true)
      }
      this._sprite.destroy()
      this._sprite = undefined
    }

    // 重置状态
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
    const localWidth = Math.abs(currentScaleX) > Video._SCALE_EPSILON
      ? this._sprite.width / Math.abs(currentScaleX)
      : this._sprite.width
    const localHeight = Math.abs(currentScaleY) > Video._SCALE_EPSILON
      ? this._sprite.height / Math.abs(currentScaleY)
      : this._sprite.height

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
    const localWidth = Math.abs(currentScaleX) > Video._SCALE_EPSILON
      ? this._sprite.width / Math.abs(currentScaleX)
      : this._sprite.width
    const localHeight = Math.abs(currentScaleY) > Video._SCALE_EPSILON
      ? this._sprite.height / Math.abs(currentScaleY)
      : this._sprite.height

    if (
      !Number.isFinite(localWidth) || !Number.isFinite(localHeight)
      || localWidth <= Video._SCALE_EPSILON || localHeight <= Video._SCALE_EPSILON
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
    const relativeScaleX = Math.abs(baseTransform.scaleX) > Video._SCALE_EPSILON
      ? this._sprite.scale.x / baseTransform.scaleX
      : 1
    const relativeScaleY = Math.abs(baseTransform.scaleY) > Video._SCALE_EPSILON
      ? this._sprite.scale.y / baseTransform.scaleY
      : 1
    const safeRelativeScaleX = Math.abs(relativeScaleX) > Video._SCALE_EPSILON ? relativeScaleX : 1
    const safeRelativeScaleY = Math.abs(relativeScaleY) > Video._SCALE_EPSILON ? relativeScaleY : 1

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
