import { Log, MP4Clip, OffscreenSprite } from '@webav/av-cliper'

Log.setLogLevel(Log.warn)

export interface Tick {
  video?: VideoFrame
  audio: Float32Array[]
  state: 'success' | 'done'
}

export interface VideoMetadata {
  width: number
  height: number
  duration: number
  audioSampleRate: number
  audioChanCount: number
  hasAudio: boolean
}

export class FrameExtractor {
  clip!: MP4Clip

  constructor(private _url: string) {
    this.load()
  }

  async load(): Promise<void> {
    if (!this.clip) {
      this.clip = new MP4Clip((await fetch(this._url)).body!)
    }

    await this.clip.ready
  }

  private _frameCache: { [time: number]: Promise<Tick> } = {}
  /**
   * Given a time in microsecond, return the frame at that time.
   *
   * This function is memoized.
   *
   * @param time - the time of the frame to return in ms
   * @returns a promise resolving to the frame at the given time
   */
  async getFrameByTime(time: number): Promise<Tick> {
    await this.load()

    if (!this._frameCache[time]) {
      this._frameCache[time] = this.clip!.tick(time)
    }

    return this._frameCache[time]
  }

  /**
   * 获取视频元数据信息
   */
  getVideoMetadata(): VideoMetadata {
    if (!this.clip) {
      throw new Error('视频未加载，请先调用 load()')
    }

    const meta = this.clip.meta
    return {
      width: meta.width,
      height: meta.height,
      duration: meta.duration,
      audioSampleRate: meta.audioSampleRate,
      audioChanCount: meta.audioChanCount,
      hasAudio: meta.audioChanCount > 0,
    }
  }

  /**
   * 创建 OffscreenSprite 用于视频导出
   */
  async createOffscreenSprite(timeOffset: number = 0, duration?: number): Promise<OffscreenSprite> {
    await this.load()

    // 创建 OffscreenSprite 包装 MP4Clip
    const offscreenSprite = new OffscreenSprite(this.clip)

    // 设置时间属性
    offscreenSprite.time = {
      offset: timeOffset,
      duration: duration || this.clip.meta.duration,
      playbackRate: 1,
    }

    return offscreenSprite
  }

  /**
   * 获取缩略图
   * @param width - 缩略图宽度，默认 100
   * @param opts - 缩略图选项
   * @returns Promise<Array<{ ts: number; img: Blob }>> - 缩略图列表
   */
  async getThumbnails(width?: number, opts?: any): Promise<Array<{ ts: number, img: Blob }>> {
    await this.load()
    return this.clip.thumbnails(width, opts)
  }

  /**
   * 分割视频
   * @param time - 分割时间点（微秒）
   * @returns Promise<[FrameExtractor, FrameExtractor]> - 分割后的两个视频片段
   */
  async split(time: number): Promise<[FrameExtractor, FrameExtractor]> {
    await this.load()
    const [clip1, clip2] = await this.clip.split(time)

    // 创建两个新的 FrameExtractor 实例
    const extractor1 = new FrameExtractor('')
    const extractor2 = new FrameExtractor('')

    // 直接设置 clip 属性
    extractor1.clip = clip1
    extractor2.clip = clip2

    return [extractor1, extractor2]
  }

  /**
   * 克隆视频
   * @returns Promise<FrameExtractor> - 克隆的视频实例
   */
  async clone(): Promise<FrameExtractor> {
    await this.load()
    const clonedClip = await this.clip.clone()

    const extractor = new FrameExtractor('')
    extractor.clip = clonedClip

    return extractor
  }

  /**
   * 检查视频是否已加载
   */
  isLoaded(): boolean {
    return !!this.clip && this.clip.meta.duration > 0
  }

  /**
   * 销毁实例，释放资源
   */
  destroy(): void {
    if (this.clip) {
      this.clip.destroy()
      this.clip = undefined as any
    }
    this._frameCache = {}
  }
}
