import type { ICombinatorOpts } from '@webav/av-cliper'
import { Combinator, Log, MP4Clip, OffscreenSprite } from '@webav/av-cliper'

Log.setLogLevel(Log.warn)

export interface VideoExportOptions {
  width?: number
  height?: number
  bitrate?: number
  frameRate?: number
  quality?: 'low' | 'medium' | 'high'
  audio?: boolean
  bgColor?: string
  videoCodec?: string
  metaDataTags?: Record<string, string>
}

export interface VideoExportProgress {
  progress: number
  loaded: number
  total: number
}

export interface VideoExportMetadata {
  width: number
  height: number
  duration: number
  frameRate: number
  hasAudio: boolean
  bitrate: number
  videoCodec: string
}

export class VideoExporter {
  private _combinator: Combinator | null = null
  private _isExporting: boolean = false
  private _exportProgress: VideoExportProgress = { progress: 0, loaded: 0, total: 0 }

  constructor(
    private _videos: any[],
    private _options: VideoExportOptions = {},
  ) {
    this._validateOptions()
  }

  /**
   * 验证导出选项
   */
  private _validateOptions(): void {
    if (!this._videos || this._videos.length === 0) {
      throw new Error('至少需要一个视频进行导出')
    }

    const { width, height, bitrate, frameRate } = this._options

    if (width && (width < 16 || width > 8192)) {
      throw new Error('视频宽度必须在 16-8192 像素之间')
    }

    if (height && (height < 16 || height > 8192)) {
      throw new Error('视频高度必须在 16-8192 像素之间')
    }

    if (bitrate && (bitrate < 1000 || bitrate > 50000000)) {
      throw new Error('比特率必须在 1-50000 kbps 之间')
    }

    if (frameRate && (frameRate < 1 || frameRate > 120)) {
      throw new Error('帧率必须在 1-120 fps 之间')
    }
  }

  /**
   * 检测浏览器兼容性
   */
  static async isSupported(options?: VideoExportOptions): Promise<boolean> {
    try {
      return await Combinator.isSupported({
        videoCodec: options?.videoCodec,
        width: options?.width,
        height: options?.height,
        bitrate: options?.bitrate,
      })
    }
    catch (error) {
      console.warn('WebCodecs API 不支持:', error)
      return false
    }
  }

  /**
   * 获取默认导出选项
   */
  getDefaultOptions(): VideoExportOptions {
    // const firstVideo = this._videos[0] // 保留以供将来使用
    return {
      width: 1920,
      height: 1080,
      bitrate: 5000000, // 5 Mbps
      frameRate: 30,
      quality: 'medium',
      audio: this._options.audio ?? false,
      bgColor: '#000000',
      videoCodec: 'avc1.42E032',
      ...this._options,
    }
  }

  /**
   * 将 Clippa Video 转换为 OffscreenSprite
   */
  private async _convertToOffscreenSprite(video: any): Promise<OffscreenSprite> {
    try {
      // 从Clippa Video获取MP4Clip实例
      const response = await fetch(video.src)
      const body = response.body
      if (!body) {
        throw new Error(`无法加载视频文件: ${video.src}`)
      }
      const mp4Clip = new MP4Clip(body)
      await mp4Clip.ready

      // 创建OffscreenSprite包装MP4Clip
      const offscreenSprite = new OffscreenSprite(mp4Clip)

      // 设置视频时间属性 (转换为微秒)
      offscreenSprite.time = {
        offset: (video.start || 0) * 1000, // 毫秒转微秒，相对于时间轴0点
        duration: (video.duration || 5000) * 1000, // 毫秒转微秒，默认5秒
        playbackRate: 1,
      }

      // 设置视频位置属性（如果有）
      if (video.sprite) {
        offscreenSprite.rect.x = video.sprite.x || 0
        offscreenSprite.rect.y = video.sprite.y || 0
        offscreenSprite.rect.w = video.sprite.width || mp4Clip.meta.width
        offscreenSprite.rect.h = video.sprite.height || mp4Clip.meta.height
      }
      else {
        // 使用默认尺寸
        offscreenSprite.rect.w = mp4Clip.meta.width
        offscreenSprite.rect.h = mp4Clip.meta.height
      }

      return offscreenSprite
    }
    catch (error) {
      console.error('视频转换失败:', error)
      throw new Error(`无法转换视频 ${video.src}: ${error}`)
    }
  }

  /**
   * 计算视频元数据
   */
  getMetadata(): VideoExportMetadata {
    const options = this.getDefaultOptions()

    // 计算时间轴的总时长（从最早开始到最晚结束）
    let timelineStart = Infinity
    let timelineEnd = 0

    for (const video of this._videos) {
      const videoStart = video.start || 0
      const videoEnd = videoStart + (video.duration || 0)

      timelineStart = Math.min(timelineStart, videoStart)
      timelineEnd = Math.max(timelineEnd, videoEnd)
    }

    const totalDuration = timelineEnd - timelineStart

    return {
      width: options.width || 1920,
      height: options.height || 1080,
      duration: totalDuration * 1000, // 毫秒转微秒
      frameRate: options.frameRate || 30,
      hasAudio: options.audio !== false,
      bitrate: options.bitrate || 5000000,
      videoCodec: options.videoCodec || 'avc1.42E032',
    }
  }

  /**
   * 初始化导出器
   */
  private async _initializeExporter(): Promise<void> {
    if (this._combinator) {
      return
    }

    const options = this.getDefaultOptions()

    // 计算时间轴总时长
    let timelineStart = Infinity
    let timelineEnd = 0

    for (const video of this._videos) {
      const videoStart = video.start || 0
      const videoEnd = videoStart + (video.duration || 0)
      timelineStart = Math.min(timelineStart, videoStart)
      timelineEnd = Math.max(timelineEnd, videoEnd)
    }

    const _totalDuration = timelineEnd - timelineStart

    const combinatorOpts: ICombinatorOpts = {
      width: options.width,
      height: options.height,
      bitrate: options.bitrate,
      fps: options.frameRate,
      bgColor: options.bgColor,
      videoCodec: options.videoCodec,
      audio: false,
      metaDataTags: options.metaDataTags,
    }

    this._combinator = new Combinator(combinatorOpts)

    // 添加进度监听器
    this._combinator.on('OutputProgress', (progress: number) => {
      this._exportProgress.progress = progress
    })

    this._combinator.on('error', (error: Error) => {
      console.error('视频导出错误:', error)
      throw error
    })
  }

  /**
   * 添加视频到导出器
   */
  private async _addVideosToCombinator(): Promise<void> {
    for (let i = 0; i < this._videos.length; i++) {
      const video = this._videos[i]
      const sprite = await this._convertToOffscreenSprite(video)

      // 第一个视频设置为主视频，确定总时长
      const isMain = i === 0
      await this._combinator!.addSprite(sprite, { main: isMain })
    }
  }

  /**
   * 将流转换为 Blob
   */
  private async _streamToBlob(stream: ReadableStream<Uint8Array>): Promise<Blob> {
    const chunks: Uint8Array[] = []
    const reader = stream.getReader()
    let totalSize = 0

    while (true) {
      const { done, value } = await reader.read()
      if (done)
        break

      chunks.push(value)
      totalSize += value.length
      this._exportProgress.loaded = totalSize
    }

    this._exportProgress.total = totalSize
    this._exportProgress.progress = 100

    return new Blob(chunks as BlobPart[], { type: 'video/mp4' })
  }

  /**
   * 导出视频
   */
  async export(): Promise<Blob> {
    if (this._isExporting) {
      throw new Error('正在导出中，请等待完成')
    }

    this._isExporting = true
    this._exportProgress = { progress: 0, loaded: 0, total: 0 }

    try {
      // 检测兼容性
      const supported = await VideoExporter.isSupported(this._options)
      if (!supported) {
        throw new Error('当前浏览器不支持 WebCodecs API')
      }

      // 初始化导出器
      await this._initializeExporter()

      // 添加视频
      await this._addVideosToCombinator()

      // 获取视频流
      const stream = this._combinator!.output()

      // 转换为 Blob
      return await this._streamToBlob(stream)
    }
    catch (error) {
      console.error('视频导出失败:', error)
      throw error
    }
    finally {
      this._isExporting = false
      this._cleanup()
    }
  }

  /**
   * 导出并下载视频
   */
  async download(filename?: string): Promise<void> {
    try {
      const blob = await this.export()

      const defaultFilename = `exported-video-${Date.now()}.mp4`
      const downloadFilename = filename || defaultFilename

      // 创建下载链接
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = downloadFilename

      // 触发下载
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)

      // 清理URL
      setTimeout(() => URL.revokeObjectURL(url), 100)
    }
    catch (error) {
      console.error('视频下载失败:', error)
      throw error
    }
  }

  /**
   * 获取导出进度
   */
  getProgress(): VideoExportProgress {
    return { ...this._exportProgress }
  }

  /**
   * 是否正在导出
   */
  isExporting(): boolean {
    return this._isExporting
  }

  /**
   * 取消导出
   */
  cancel(): void {
    if (this._isExporting) {
      this._isExporting = false
      this._cleanup()
    }
  }

  /**
   * 清理资源
   */
  private _cleanup(): void {
    if (this._combinator) {
      this._combinator.destroy()
      this._combinator = null
    }
  }

  /**
   * 销毁导出器，释放资源
   */
  destroy(): void {
    this.cancel()
    this._videos = []
    this._options = {}
  }
}
