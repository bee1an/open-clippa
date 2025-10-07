import type { Director } from '@clippa/canvas'
import type {
  ExportError,
  ExporterStatus,
  ExportMetadata,
  ExportOptions,
  ExportProgress,
  ExportResult,
  FrameData,
} from '../types'
import { ProgressTracker } from './ProgressTracker'

/**
 * Canvas导出选项
 */
export interface CanvasExportOptions extends ExportOptions {
  /** Director实例 */
  director: Director
  /** 导出分辨率 */
  resolution?: {
    width: number
    height: number
  }
  /** 帧率 */
  frameRate?: number
  /** 是否包含音频 */
  audio?: boolean
  /** 视频编解码器 */
  videoCodec?: string
  /** 音频编解码器 */
  audioCodec?: string
}

/**
 * Canvas导出器 - 基于Director.seek()的帧捕获实现
 */
export class CanvasExporter {
  private _status: ExporterStatus = 'idle'
  private _progressTracker = new ProgressTracker()
  private _startTime = 0
  private _isDestroyed = false
  private _frameBuffer: FrameData[] = []
  private _encodingFrames = false

  constructor(
    private _director: Director,
    _options: Partial<Omit<CanvasExportOptions, 'director'>> = {},
  ) {
    this._options = { director: this._director, ..._options }
    this._validateOptions()
    this._setupProgressTracking()
  }

  private _options: CanvasExportOptions

  /**
   * 获取导出器状态
   */
  getStatus(): ExporterStatus {
    return this._status
  }

  /**
   * 获取进度追踪器
   */
  getProgressTracker(): ProgressTracker {
    return this._progressTracker
  }

  /**
   * 获取导出进度
   */
  getProgress(): ExportProgress {
    return this._progressTracker.getProgress()
  }

  /**
   * 添加进度事件监听器
   */
  onProgress(listener: (progress: ExportProgress) => void): void {
    this._progressTracker.on('progress', listener)
  }

  /**
   * 添加状态变更监听器
   */
  onStatusChange(listener: (status: ExporterStatus) => void): void {
    this._progressTracker.on('status-change', (_, to) => listener(to))
  }

  /**
   * 验证导出选项
   */
  private _validateOptions(): void {
    if (!this._director) {
      throw new Error('Director实例是必需的')
    }

    if (!this._director.stage || !this._director.stage.app) {
      throw new Error('Director必须已初始化Stage和Application')
    }

    // 验证Director状态
    if (this._director.duration < 0) {
      throw new Error('Director的总时长无效')
    }

    const { resolution, frameRate, bitrate, quality } = this._options

    // 验证分辨率
    if (resolution?.width && (resolution.width < 16 || resolution.width > 8192)) {
      throw new Error('视频宽度必须在 16-8192 像素之间')
    }

    if (resolution?.height && (resolution.height < 16 || resolution.height > 8192)) {
      throw new Error('视频高度必须在 16-8192 像素之间')
    }

    // 验证宽高比合理性
    if (resolution?.width && resolution?.height) {
      const aspectRatio = resolution.width / resolution.height
      if (aspectRatio < 0.1 || aspectRatio > 10) {
        // 宽高比可能不正常
      }
    }

    // 验证帧率
    if (frameRate && (frameRate < 1 || frameRate > 120)) {
      throw new Error('帧率必须在 1-120 fps 之间')
    }

    // 验证比特率
    if (bitrate && (bitrate < 1000 || bitrate > 100000000)) {
      throw new Error('比特率必须在 1kbps-100Mbps 之间')
    }

    // 验证质量设置
    if (quality && !['low', 'medium', 'high'].includes(quality)) {
      throw new Error('质量设置必须是 low、medium 或 high')
    }

    // 验证Canvas尺寸
    const canvas = this._getCanvas()
    if (canvas.width <= 0 || canvas.height <= 0) {
      throw new Error('Canvas尺寸无效')
    }
  }

  /**
   * 设置进度追踪
   */
  private _setupProgressTracking(): void {
    this._progressTracker.on('progress', (data) => {
      if (data.progress === 100 && this._status === 'exporting') {
        this._updateStatus('completed')
      }
    })
  }

  /**
   * 更新状态
   */
  private _updateStatus(newStatus: ExporterStatus): void {
    const oldStatus = this._status
    this._status = newStatus
    this._progressTracker.emit('status-change', oldStatus, newStatus)
  }

  /**
   * 获取Canvas元素
   */
  private _getCanvas(): HTMLCanvasElement {
    return this._director.stage.app.canvas
  }

  /**
   * 获取默认导出选项
   */
  getDefaultOptions(): CanvasExportOptions {
    const canvas = this._getCanvas()
    // Extract director to avoid duplication when spreading options
    const { director, ...otherOptions } = this._options
    return {
      director: this._director,
      resolution: {
        width: this._options.resolution?.width || canvas.width || 1920,
        height: this._options.resolution?.height || canvas.height || 1080,
      },
      frameRate: this._options.frameRate || 30,
      quality: this._options.quality || 'medium',
      audio: this._options.audio ?? false,
      videoCodec: this._options.videoCodec || 'avc1.42E032',
      audioCodec: this._options.audioCodec || 'aac',
      bgColor: this._options.bgColor || '#000000',
      width: this._options.resolution?.width || canvas.width || 1920,
      height: this._options.resolution?.height || canvas.height || 1080,
      ...otherOptions,
    }
  }

  /**
   * 计算导出元数据
   */
  getMetadata(): ExportMetadata {
    const options = this.getDefaultOptions()
    const duration = this._director.duration || 0
    const estimatedSize = (this._options.bitrate || 5000000) * duration / 1000 / 8

    return {
      width: options.resolution!.width,
      height: options.resolution!.height,
      duration: duration * 1000, // 毫秒转微秒
      frameRate: options.frameRate!,
      hasAudio: options.audio!,
      bitrate: this._options.bitrate || 5000000,
      videoCodec: options.videoCodec!,
      audioCodec: options.audioCodec,
      estimatedSize,
    }
  }

  /**
   * 捕获当前Canvas帧
   */
  private _captureFrameSync(): ImageData | null {
    try {
      const canvas = this._getCanvas()
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        throw new Error('无法获取Canvas 2D上下文')
      }

      const options = this.getDefaultOptions()
      return ctx.getImageData(0, 0, options.resolution!.width, options.resolution!.height)
    }
    catch (error) {
      console.error('帧捕获失败:', error)
      return null
    }
  }

  /**
   * 异步捕获帧（等待渲染完成）
   */
  private async _captureFrameAsync(): Promise<ImageData | null> {
    return new Promise((resolve) => {
      // 使用requestAnimationFrame确保渲染完成
      requestAnimationFrame(() => {
        const frameData = this._captureFrameSync()
        resolve(frameData)
      })
    })
  }

  /**
   * Seek并捕获帧
   */
  private async _seekAndCapture(time: number, index: number, retryCount: number = 0): Promise<FrameData | null> {
    const maxRetries = 3

    try {
      // 检查导出状态
      if (this._status !== 'exporting') {
        return null
      }

      // Director seek到指定时间点
      this._director.seek(time)

      // 等待渲染完成并捕获帧
      const imageData = await this._captureFrameAsync()

      if (!imageData) {
        throw new Error(`无法捕获时间点 ${time} 的帧`)
      }

      return {
        imageData,
        timestamp: time * 1000, // 毫秒转微秒
        index,
        width: imageData.width,
        height: imageData.height,
      }
    }
    catch (error) {
      console.error(`捕获帧失败 (时间: ${time}, 索引: ${index}):`, error)

      // 重试机制
      if (retryCount < maxRetries) {
        // 重试捕获帧
        await new Promise(resolve => setTimeout(resolve, 100 * (retryCount + 1)))
        return this._seekAndCapture(time, index, retryCount + 1)
      }

      return null
    }
  }

  /**
   * 计算帧时间点
   */
  private _calculateFrameTimes(duration: number, frameRate: number): number[] {
    const frameInterval = 1000 / frameRate // 毫秒
    const frameTimes: number[] = []

    for (let time = 0; time < duration; time += frameInterval) {
      frameTimes.push(time)
    }

    return frameTimes
  }

  /**
   * 检测浏览器兼容性
   */
  static async isSupported(options?: CanvasExportOptions): Promise<boolean> {
    try {
      // 检查WebCodecs API支持
      if (!globalThis.VideoEncoder || !globalThis.AudioEncoder) {
        return false
      }

      // 检查Canvas支持
      if (!globalThis.HTMLCanvasElement) {
        return false
      }

      // 检查编解码器支持
      const videoCodec = options?.videoCodec || 'avc1.42E032'
      const support = await globalThis.VideoEncoder.isConfigSupported({
        codec: videoCodec,
        width: options?.resolution?.width || 1920,
        height: options?.resolution?.height || 1080,
        bitrate: options?.bitrate || 5000000,
      })

      return !!support.supported
    }
    catch (error) {
      console.warn('Canvas导出器兼容性检查失败:', error)
      return false
    }
  }

  /**
   * 导出视频
   */
  async export(): Promise<ExportResult> {
    if (this._status === 'exporting') {
      throw new Error('正在导出中，请等待完成')
    }

    if (this._isDestroyed) {
      throw new Error('导出器已销毁')
    }

    this._startTime = Date.now()
    this._updateStatus('exporting')
    this._progressTracker.reset()

    try {
      // 检测兼容性
      const supported = await CanvasExporter.isSupported(this._options)
      if (!supported) {
        throw new Error('当前浏览器不支持Canvas导出功能')
      }

      const options = this.getDefaultOptions()
      const duration = this._director.duration || 0

      if (duration <= 0) {
        throw new Error('Director总时长必须大于0')
      }

      this._progressTracker.setStage('preparing', '准备导出...')

      // 计算帧时间点
      const frameTimes = this._calculateFrameTimes(duration, options.frameRate!)
      this._frameBuffer = []
      this._encodingFrames = false

      this._progressTracker.setStage('processing', `捕获 ${frameTimes.length} 帧...`)

      // 批量捕获帧
      for (let i = 0; i < frameTimes.length; i++) {
        // Check if export is still in progress
        if (this._status === 'cancelled' || this._status === 'error') {
          throw new Error('导出已取消或出错')
        }

        const time = frameTimes[i]
        const frameData = await this._seekAndCapture(time, i)

        if (frameData) {
          this._frameBuffer.push(frameData)
        }

        // 更新进度 (捕获阶段占50%)
        const progress = (i + 1) / frameTimes.length * 50
        this._progressTracker.updateProgress({
          progress,
          message: `已捕获 ${i + 1}/${frameTimes.length} 帧`,
        })
      }

      if (this._frameBuffer.length === 0) {
        throw new Error('没有成功捕获任何帧')
      }

      this._progressTracker.setStage('encoding', '编码视频...')

      // 编码帧数据为视频
      const blob = await this._encodeFrames()

      // 创建结果
      const metadata = this.getMetadata()
      const result: ExportResult = {
        blob,
        filename: `canvas-export-${Date.now()}.mp4`,
        mimeType: 'video/mp4',
        size: blob.size,
        metadata,
        exportTime: Date.now() - this._startTime,
      }

      this._updateStatus('completed')
      this._progressTracker.complete()
      this._progressTracker.emit('completed', result)

      return result
    }
    catch (error) {
      this._updateStatus('error')
      const exportError: ExportError = {
        code: 'PROCESSING_ERROR',
        message: error instanceof Error ? error.message : '未知错误',
        details: error,
      }
      this._progressTracker.emit('error', exportError)
      throw error
    }
    finally {
      this._cleanup()
    }
  }

  /**
   * 编码帧数据为视频
   */
  private async _encodeFrames(): Promise<Blob> {
    // TODO: 实现WebCodecs编码
    // 这里先用简单的Canvas录制实现，后续替换为WebCodecs

    return new Promise((resolve, reject) => {
      try {
        const canvas = this._getCanvas()
        const stream = canvas.captureStream(30) // 30fps

        const mediaRecorder = new MediaRecorder(stream, {
          mimeType: 'video/webm;codecs=vp9',
          videoBitsPerSecond: this._options.bitrate || 5000000,
        })

        const chunks: Blob[] = []

        mediaRecorder.ondataavailable = (event) => {
          if (event.data.size > 0) {
            chunks.push(event.data)
          }
        }

        mediaRecorder.onstop = () => {
          const blob = new Blob(chunks, { type: 'video/webm' })
          resolve(blob)
        }

        mediaRecorder.onerror = (event) => {
          reject(new Error(`MediaRecorder错误: ${event}`))
        }

        // 开始录制
        mediaRecorder.start()

        // 播放所有捕获的帧
        this._playbackFrames().then(() => {
          mediaRecorder.stop()
        }).catch(reject)
      }
      catch (error) {
        reject(error)
      }
    })
  }

  /**
   * 回放捕获的帧
   */
  private async _playbackFrames(): Promise<void> {
    const options = this.getDefaultOptions()
    const frameInterval = 1000 / options.frameRate! // 毫秒

    for (let i = 0; i < this._frameBuffer.length; i++) {
      // Check if export is still in progress
      if (this._status === 'cancelled' || this._status === 'error') {
        throw new Error('导出已取消或出错')
      }

      const frame = this._frameBuffer[i]

      // Seek到对应时间点
      this._director.seek(frame.timestamp / 1000) // 微秒转毫秒

      // 等待帧间隔
      if (i < this._frameBuffer.length - 1) {
        await new Promise(resolve => setTimeout(resolve, frameInterval))
      }

      // 更新编码进度 (编码阶段占50%)
      const progress = 50 + ((i + 1) / this._frameBuffer.length) * 50
      this._progressTracker.updateProgress({
        progress,
        message: `编码中 ${i + 1}/${this._frameBuffer.length} 帧`,
      })
    }
  }

  /**
   * 导出并下载视频
   */
  async download(filename?: string): Promise<void> {
    try {
      const result = await this.export()
      const defaultFilename = `canvas-export-${Date.now()}.webm`
      const downloadFilename = filename || defaultFilename

      // 创建下载链接
      const url = URL.createObjectURL(result.blob)
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
   * 取消导出
   */
  cancel(): void {
    if (this._status === 'exporting') {
      this._updateStatus('cancelled')
      try {
        this._progressTracker.emit('cancelled', '用户取消')
      }
      catch (error) {
        console.warn('发送取消事件时出错:', error)
      }
      this._cleanup()
    }
  }

  /**
   * 是否正在导出
   */
  isExporting(): boolean {
    return this._status === 'exporting'
  }

  /**
   * 清理资源
   */
  private _cleanup(): void {
    this._frameBuffer = []
    this._encodingFrames = false
  }

  /**
   * 销毁导出器，释放资源
   */
  destroy(): void {
    this._isDestroyed = true
    this.cancel()

    try {
      if (this._progressTracker && typeof this._progressTracker.destroy === 'function') {
        this._progressTracker.destroy()
      }
    }
    catch (error) {
      console.warn('销毁进度追踪器时出错:', error)
    }

    this._cleanup()
  }
}
