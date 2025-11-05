import type {
  InputVideoTrack,
  VideoSample,
} from 'mediabunny'
import type { FederatedPointerEvent } from 'pixi.js'
import type { Performer, PerformerOption } from '../performer'
import { EventBus, transformSrc } from '@clippa/utils'
import {
  ALL_FORMATS,
  Input,
  UrlSource,
  VideoSampleSink,
} from 'mediabunny'
import { Sprite, Texture } from 'pixi.js'
import { PlayState, ShowState } from '../performer'

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

  private _input?: Input
  private _videoTrack: InputVideoTrack | null = null
  private _videoSink?: VideoSampleSink
  private _loader?: Promise<void>

  /**
   * 帧缓存：time (in ms) -> { frame: VideoFrame }
   */
  private _frameCache: Map<number, { frame: any }> = new Map()

  /**
   * 最后渲染的时间（避免重复渲染同一帧）
   */
  private _lastRenderedTime: number = -1

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

    // 提取并渲染当前时间的帧
    this._renderFrameAtTime(time)
  }

  pause(time: number): void {
    this.update(time)

    if (this.playState === PlayState.PAUSED)
      return

    this.playState = PlayState.PAUSED
  }

  /**
   * seek 待执行任务（单个任务而非队列）
   */
  private _seekTask: { time: number, resolve: () => void, reject: (error: unknown) => void } | null = null
  private _isSeeking: boolean = false
  async seek(time: number): Promise<void> {
    if (time < 0 || time > this.duration)
      return

    // 清空待执行任务，始终只保留最新的 seek 请求
    this._seekTask = null

    // 创建 Promise 并添加到任务
    const { promise, resolve, reject } = Promise.withResolvers<void>()
    this._seekTask = { time, resolve, reject }

    // 开始处理任务
    this._processSeekTask()

    return promise
  }

  /**
   * 处理 seek 任务
   */
  private async _processSeekTask(): Promise<void> {
    // 如果正在执行或任务为空，直接返回
    if (this._isSeeking || !this._seekTask || !this._seekTask)
      return

    this._isSeeking = true

    try {
      const { time, resolve } = this._seekTask

      // 更新当前时间
      this.currentTime = time

      // 执行 seek（等待帧提取和渲染完成）
      await this._renderFrameAtTime(time)

      resolve()

      this._seekTask = null

      this._isSeeking = false
    }
    catch (error) {
      console.error('Seek error:', error)
      this._seekTask = null
      this._isSeeking = false
    }
  }

  /**
   * 在指定时间渲染帧
   */
  private async _renderFrameAtTime(time: number): Promise<void> {
    // 避免重复渲染同一帧
    if (time === this._lastRenderedTime && this._sprite?.texture) {
      return
    }

    try {
      // 检查缓存
      const cacheKey = Math.round(time)
      let frameData = this._frameCache.get(cacheKey)

      // 如果缓存不存在，从 mediabunny 获取
      if (!frameData) {
        const videoSample = await this._getVideoSampleAtTime(time)

        if (!videoSample) {
          return
        }

        // 转换为 VideoFrame
        const videoFrame = videoSample.toVideoFrame()

        // 缓存帧数据
        frameData = { frame: videoFrame }
        this._frameCache.set(cacheKey, frameData)

        // 关闭 VideoSample（保留 VideoFrame）
        videoSample.close()
      }

      // 创建或更新纹理
      if (this._sprite) {
        const texture = Texture.from(frameData.frame)

        // 销毁旧纹理
        if (this._sprite.texture) {
          this._sprite.texture.destroy(true)
        }

        this._sprite.texture = texture
        this._lastRenderedTime = time
      }
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
      return sample || null
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
    // 清理帧缓存
    for (const [, frameData] of this._frameCache) {
      frameData.frame.close()
    }
    this._frameCache.clear()

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
      if (this._sprite.texture) {
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
}
