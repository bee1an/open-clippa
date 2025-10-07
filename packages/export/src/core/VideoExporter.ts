import type { ICombinatorOpts } from '@webav/av-cliper'
import type {
  ExportError,
  ExporterStatus,
  ExportMetadata,
  ExportOptions,
  ExportProgress,
  ExportResult,
  MediaItem,
} from '../types'

import { Combinator, Log, MP4Clip, OffscreenSprite } from '@webav/av-cliper'
import { MemoryManager } from '../utils/memoryManager'
import { ProgressTracker } from './ProgressTracker'

Log.setLogLevel(Log.warn)

/**
 * 视频导出器 - 基于WebCodecs API的高性能视频导出
 */
export class VideoExporter {
  private _combinator: Combinator | null = null
  private _status: ExporterStatus = 'idle'
  private _progressTracker = new ProgressTracker()
  private _memoryManager = MemoryManager.getInstance()
  private _startTime = 0
  private _isDestroyed = false

  constructor(
    private _mediaItems: MediaItem[],
    private _options: ExportOptions = {},
  ) {
    this._validateOptions()
    this._setupProgressTracking()
  }

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
    if (!this._mediaItems || this._mediaItems.length === 0) {
      throw new Error('至少需要一个媒体项进行导出')
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
   * 设置进度追踪
   */
  private _setupProgressTracking(): void {
    // 监听进度更新，同步状态变更
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
   * 检测浏览器兼容性
   */
  static async isSupported(options?: ExportOptions): Promise<boolean> {
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
  getDefaultOptions(): ExportOptions {
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
   * 将媒体项转换为 OffscreenSprite
   */
  private async _convertToOffscreenSprite(mediaItem: MediaItem): Promise<OffscreenSprite> {
    try {
      let mp4Clip: MP4Clip

      // 处理不同类型的媒体源
      if (typeof mediaItem.src === 'string') {
        const response = await fetch(mediaItem.src)
        const body = response.body
        if (!body) {
          throw new Error(`无法加载媒体文件: ${mediaItem.src}`)
        }
        mp4Clip = new MP4Clip(body)
      }
      else if (mediaItem.src instanceof ReadableStream) {
        mp4Clip = new MP4Clip(mediaItem.src)
      }
      else if (mediaItem.src instanceof ArrayBuffer || mediaItem.src instanceof Uint8Array) {
        const stream = new ReadableStream({
          start(controller) {
            controller.enqueue(new Uint8Array(mediaItem.src as ArrayBuffer | Uint8Array))
            controller.close()
          },
        })
        mp4Clip = new MP4Clip(stream)
      }
      else {
        throw new TypeError('不支持的媒体源类型')
      }

      await mp4Clip.ready

      // 创建OffscreenSprite包装MP4Clip
      const offscreenSprite = new OffscreenSprite(mp4Clip)

      // 设置时间属性 (转换为微秒)
      offscreenSprite.time = {
        offset: (mediaItem.start || 0) * 1000, // 毫秒转微秒
        duration: (mediaItem.duration || 5000) * 1000, // 毫秒转微秒
        playbackRate: mediaItem.playbackRate || 1,
      }

      // 设置位置属性
      if (mediaItem.position) {
        offscreenSprite.rect.x = mediaItem.position.x || 0
        offscreenSprite.rect.y = mediaItem.position.y || 0
        offscreenSprite.rect.w = mediaItem.position.width || mp4Clip.meta.width
        offscreenSprite.rect.h = mediaItem.position.height || mp4Clip.meta.height
      }
      else {
        // 使用默认尺寸
        offscreenSprite.rect.w = mp4Clip.meta.width
        offscreenSprite.rect.h = mp4Clip.meta.height
      }

      return offscreenSprite
    }
    catch (error) {
      console.error('媒体转换失败:', error)
      throw new Error(`无法转换媒体项: ${error}`)
    }
  }

  /**
   * 计算导出元数据
   */
  getMetadata(): ExportMetadata {
    const options = this.getDefaultOptions()

    // 计算时间轴的总时长
    let timelineStart = Infinity
    let timelineEnd = 0

    for (const item of this._mediaItems) {
      const itemStart = item.start || 0
      const itemEnd = itemStart + (item.duration || 0)

      timelineStart = Math.min(timelineStart, itemStart)
      timelineEnd = Math.max(timelineEnd, itemEnd)
    }

    const totalDuration = timelineEnd - timelineStart
    const estimatedSize = (options.bitrate || 5000000) * totalDuration / 1000 / 8 // 粗略估计

    return {
      width: options.width || 1920,
      height: options.height || 1080,
      duration: totalDuration * 1000, // 毫秒转微秒
      frameRate: options.frameRate || 30,
      hasAudio: options.audio !== false,
      bitrate: options.bitrate || 5000000,
      videoCodec: options.videoCodec || 'avc1.42E032',
      estimatedSize,
    }
  }

  /**
   * 初始化导出器
   */
  private async _initializeExporter(): Promise<void> {
    if (this._combinator) {
      return
    }

    this._updateStatus('preparing')
    this._progressTracker.setStage('preparing', '初始化导出器...')

    const options = this.getDefaultOptions()

    // 计算时间轴总时长
    let timelineStart = Infinity
    let timelineEnd = 0

    for (const item of this._mediaItems) {
      const itemStart = item.start || 0
      const itemEnd = itemStart + (item.duration || 0)
      timelineStart = Math.min(timelineStart, itemStart)
      timelineEnd = Math.max(timelineEnd, itemEnd)
    }

    const _totalDuration = timelineEnd - timelineStart

    const combinatorOpts: ICombinatorOpts = {
      width: options.width,
      height: options.height,
      bitrate: options.bitrate,
      fps: options.frameRate,
      bgColor: options.bgColor,
      videoCodec: options.videoCodec,
      audio: options.audio || false,
      metaDataTags: options.metaDataTags,
    }

    this._combinator = new Combinator(combinatorOpts)

    // 添加进度监听器，安全地处理可能的私有成员访问错误
    try {
      this._combinator.on('OutputProgress', (progress: number) => {
        this._progressTracker.updateProgress({ progress })
      })
    }
    catch (progressError) {
      console.warn('添加进度监听器失败:', progressError)
    }

    try {
      this._combinator.on('error', (error: Error) => {
        console.error('视频导出错误:', error)
        this._updateStatus('error')
        this._progressTracker.emit('error', {
          code: 'PROCESSING_ERROR',
          message: error.message,
          details: error,
        })
      })
    }
    catch (errorListenerError) {
      console.warn('添加错误监听器失败:', errorListenerError)
    }
  }

  /**
   * 添加媒体到导出器
   */
  private async _addMediaToCombinator(): Promise<void> {
    this._progressTracker.setStage('processing', '处理媒体文件...')

    for (let i = 0; i < this._mediaItems.length; i++) {
      try {
        const mediaItem = this._mediaItems[i]
        const sprite = await this._convertToOffscreenSprite(mediaItem)

        // 第一个媒体设置为主媒体，确定总时长
        const isMain = i === 0

        // 安全地调用 addSprite，处理可能的私有成员访问错误
        try {
          await this._combinator!.addSprite(sprite, { main: isMain })
        }
        catch (addSpriteError) {
          console.warn('addSprite 调用失败，可能是私有成员访问问题:', addSpriteError)
          // 尝试使用不同的参数或方法
          try {
            await this._combinator!.addSprite(sprite)
          }
          catch (fallbackError) {
            console.warn('备用 addSprite 调用也失败:', fallbackError)
            const errorMessage = addSpriteError instanceof Error ? addSpriteError.message : String(addSpriteError)
            throw new Error(`无法添加媒体到导出器: ${errorMessage}`)
          }
        }

        // 更新进度
        const itemProgress = (i + 1) / this._mediaItems.length * 30 // 处理阶段占30%
        this._progressTracker.updateProgress({ progress: itemProgress })
      }
      catch (error) {
        console.error(`处理第 ${i + 1} 个媒体项时出错:`, error)
        const errorMessage = error instanceof Error ? error.message : String(error)
        throw new Error(`处理媒体项 ${i + 1} 失败: ${errorMessage}`)
      }
    }
  }

  /**
   * 将流转换为 Blob
   */
  private async _streamToBlob(stream: ReadableStream<Uint8Array>): Promise<Blob> {
    this._progressTracker.setStage('encoding', '编码输出...')

    const chunks: Uint8Array[] = []
    const reader = stream.getReader()
    let totalSize = 0

    while (true) {
      const { done, value } = await reader.read()
      if (done)
        break

      chunks.push(value)
      totalSize += value.length

      // 更新进度 (编码阶段占60%，从30%到90%)
      const progress = 30 + (totalSize / (this.getMetadata().estimatedSize || 1000000)) * 60
      this._progressTracker.updateProgress({
        progress: Math.min(progress, 90),
        loaded: totalSize,
        total: this.getMetadata().estimatedSize || totalSize,
      })
    }

    this._progressTracker.updateProgress({
      progress: 100,
      loaded: totalSize,
    })

    return new Blob(chunks as BlobPart[], { type: 'video/mp4' })
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

    // 检查内存使用
    const estimatedSize = this.getMetadata().estimatedSize || 0
    if (!this._memoryManager.hasEnoughMemory(estimatedSize)) {
      console.warn('内存可能不足，导出过程可能较慢')
    }

    this._startTime = Date.now()
    this._updateStatus('exporting')
    this._progressTracker.reset()

    try {
      // 检测兼容性
      const supported = await VideoExporter.isSupported(this._options)
      if (!supported) {
        throw new Error('当前浏览器不支持 WebCodecs API')
      }

      // 初始化导出器
      await this._initializeExporter()

      // 添加媒体
      await this._addMediaToCombinator()
      // 获取视频流
      this._progressTracker.setStage('finalizing', '生成输出流...')
      let stream
      try {
        stream = this._combinator!.output()
      }
      catch (outputError) {
        console.error('获取输出流失败:', outputError)
        const errorMessage = outputError instanceof Error ? outputError.message : String(outputError)
        throw new Error(`无法生成输出流: ${errorMessage}`)
      }

      // 使用内存管理器转换为 Blob
      const memoryEfficientStream = this._memoryManager.createMemoryEfficientStream(stream)
      const blob = await this._memoryManager.streamToBlob(memoryEfficientStream, 'video/mp4')

      // 创建结果
      const metadata = this.getMetadata()
      const result: ExportResult = {
        blob,
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
   * 导出并下载视频
   */
  async download(filename?: string): Promise<void> {
    try {
      const result = await this.export()
      const defaultFilename = `exported-video-${Date.now()}.mp4`
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
    try {
      if (this._combinator) {
        // 安全地清理 combinator，避免私有字段访问问题
        if (typeof this._combinator.destroy === 'function') {
          this._combinator.destroy()
        }
        this._combinator = null
      }
    }
    catch (error) {
      console.warn('清理 combinator 时出错:', error)
      // 即使清理失败，也要继续清理其他资源
      this._combinator = null
    }
  }

  /**
   * 销毁导出器，释放资源
   */
  destroy(): void {
    this._isDestroyed = true
    this.cancel()

    // 安全地销毁进度追踪器
    try {
      if (this._progressTracker && typeof this._progressTracker.destroy === 'function') {
        this._progressTracker.destroy()
      }
    }
    catch (error) {
      console.warn('销毁进度追踪器时出错:', error)
    }

    this._mediaItems = []
    this._options = {}

    // 最后清理 combinator
    this._cleanup()
  }
}
