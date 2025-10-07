import type { FrameData } from '../types'

/**
 * 编码器配置
 */
export interface EncoderConfig {
  /** 视频宽度 */
  width: number
  /** 视频高度 */
  height: number
  /** 视频编解码器 */
  videoCodec?: string
  /** 音频编解码器 */
  audioCodec?: string
  /** 比特率 */
  bitrate?: number
  /** 帧率 */
  frameRate?: number
  /** 关键帧间隔 */
  keyframeInterval?: number
  /** 是否包含音频 */
  audio?: boolean
}

/**
 * 编码进度信息
 */
export interface EncodingProgress {
  /** 已编码帧数 */
  encodedFrames: number
  /** 总帧数 */
  totalFrames: number
  /** 当前进度百分比 */
  progress: number
  /** 当前阶段 */
  stage: 'initializing' | 'encoding' | 'finalizing' | 'completed'
  /** 编码速度（fps） */
  encodingSpeed?: number
  /** 预计剩余时间（秒） */
  estimatedTimeRemaining?: number
}

/**
 * WebAV编码器 - 基于WebCodecs API和@webav/av-cliper的编码实现
 */
export class WebAVEncoder {
  private _config: EncoderConfig
  private _videoEncoder: VideoEncoder | null = null
  private _audioEncoder: AudioEncoder | null = null
  private _encodedChunks: EncodedVideoChunk[] = []
  private _isInitialized = false
  private _isEncoding = false
  private _startTime = 0
  private _encodedFrameCount = 0
  private _totalFrames = 0

  // 输出流管理
  private _outputController: ReadableStreamDefaultController<Uint8Array> | null = null
  private _outputStream: ReadableStream<Uint8Array> | null = null

  constructor(config: EncoderConfig) {
    this._config = {
      videoCodec: 'avc1.42E032',
      audioCodec: 'aac',
      bitrate: 5000000,
      frameRate: 30,
      keyframeInterval: 30,
      audio: false,
      ...config,
    }
  }

  /**
   * 获取配置
   */
  getConfig(): EncoderConfig {
    return { ...this._config }
  }

  /**
   * 检查编解码器支持
   */
  static async checkCodecSupport(codec: string, config: Partial<EncoderConfig>): Promise<boolean> {
    try {
      if (!globalThis.VideoEncoder) {
        return false
      }

      const support = await VideoEncoder.isConfigSupported({
        codec,
        width: config.width || 1920,
        height: config.height || 1080,
        bitrate: config.bitrate || 5000000,
        framerate: config.frameRate || 30,
      })

      return !!support.supported
    }
    catch (error) {
      console.warn(`检查编解码器支持失败 ${codec}:`, error)
      return false
    }
  }

  /**
   * 初始化编码器
   */
  async initialize(): Promise<void> {
    if (this._isInitialized) {
      return
    }

    try {
      this._startTime = Date.now()
      this._encodedFrameCount = 0
      this._encodedChunks = []

      // 创建输出流
      this._outputStream = new ReadableStream({
        start: (controller) => {
          this._outputController = controller
        },
      })

      // 初始化视频编码器
      await this._initializeVideoEncoder()

      // 如果需要音频，初始化音频编码器
      if (this._config.audio) {
        await this._initializeAudioEncoder()
      }

      this._isInitialized = true
    }
    catch (error) {
      console.error('编码器初始化失败:', error)
      throw new Error(`编码器初始化失败: ${error}`)
    }
  }

  /**
   * 初始化视频编码器
   */
  private async _initializeVideoEncoder(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this._videoEncoder = new VideoEncoder({
          output: (chunk: EncodedVideoChunk) => {
            this._handleEncodedChunk(chunk)
          },
          error: (error: Error) => {
            console.error('视频编码错误:', error)
            reject(new Error(`视频编码错误: ${error.message}`))
          },
        })

        const encoderConfig: VideoEncoderConfig = {
          codec: this._config.videoCodec!,
          width: this._config.width,
          height: this._config.height,
          bitrate: this._config.bitrate,
          framerate: this._config.frameRate,
        }

        this._videoEncoder.configure(encoderConfig)
        resolve()
      }
      catch (error) {
        reject(error)
      }
    })
  }

  /**
   * 初始化音频编码器（占位实现）
   */
  private async _initializeAudioEncoder(): Promise<void> {
    // TODO: 实现音频编码器初始化
    // 音频编码器暂未实现
  }

  /**
   * 处理编码后的数据块
   */
  private _handleEncodedChunk(chunk: EncodedVideoChunk): void {
    this._encodedChunks.push(chunk)

    // 将数据写入输出流
    if (this._outputController) {
      const buffer = new ArrayBuffer(chunk.byteLength)
      chunk.copyTo(buffer)
      this._outputController.enqueue(new Uint8Array(buffer))
    }
  }

  /**
   * 编码视频帧
   */
  async encodeVideoFrame(frameData: FrameData, timestamp: number): Promise<void> {
    if (!this._isInitialized) {
      throw new Error('编码器未初始化')
    }

    if (!this._videoEncoder) {
      throw new Error('视频编码器未初始化')
    }

    if (this._videoEncoder.state !== 'configured') {
      throw new Error('视频编码器配置异常')
    }

    try {
      // 创建VideoFrame - 使用ImageData的buffer和正确的初始化对象
      const videoFrame = new VideoFrame(new Uint8Array(frameData.imageData.data.buffer), {
        timestamp, // 微秒
        duration: 1000000 / (this._config.frameRate || 30), // 微秒
        codedWidth: frameData.width,
        codedHeight: frameData.height,
        format: 'RGBA',
      })

      // 编码帧
      this._videoEncoder.encode(videoFrame)
      this._encodedFrameCount++

      // 清理VideoFrame
      videoFrame.close()
    }
    catch (error) {
      console.error('编码视频帧失败:', error)
      throw new Error(`编码视频帧失败: ${error}`)
    }
  }

  /**
   * 批量编码视频帧
   */
  async encodeVideoFrames(frames: FrameData[]): Promise<void> {
    this._totalFrames = frames.length
    this._isEncoding = true

    try {
      for (let i = 0; i < frames.length; i++) {
        if (!this._isEncoding) {
          throw new Error('编码已取消')
        }

        const frame = frames[i]
        const timestamp = frame.timestamp || (i * 1000000 / (this._config.frameRate || 30))

        await this.encodeVideoFrame(frame, timestamp)

        // 添加小延迟避免阻塞主线程
        if (i % 10 === 0) {
          await new Promise(resolve => setTimeout(resolve, 0))
        }
      }
    }
    finally {
      this._isEncoding = false
    }
  }

  /**
   * 获取编码进度
   */
  getEncodingProgress(): EncodingProgress {
    const progress = this._totalFrames > 0
      ? (this._encodedFrameCount / this._totalFrames) * 100
      : 0

    const elapsedTime = Date.now() - this._startTime
    const encodingSpeed = elapsedTime > 0 ? (this._encodedFrameCount / (elapsedTime / 1000)) : 0

    let estimatedTimeRemaining: number | undefined
    if (encodingSpeed > 0 && this._encodedFrameCount < this._totalFrames) {
      const remainingFrames = this._totalFrames - this._encodedFrameCount
      estimatedTimeRemaining = remainingFrames / encodingSpeed
    }

    let stage: EncodingProgress['stage'] = 'initializing'
    if (this._isInitialized && this._isEncoding) {
      stage = 'encoding'
    }
    else if (this._encodedFrameCount >= this._totalFrames && this._totalFrames > 0) {
      stage = 'finalizing'
    }

    return {
      encodedFrames: this._encodedFrameCount,
      totalFrames: this._totalFrames,
      progress,
      stage,
      encodingSpeed,
      estimatedTimeRemaining,
    }
  }

  /**
   * 获取输出流
   */
  getOutputStream(): ReadableStream<Uint8Array> | null {
    return this._outputStream
  }

  /**
   * 完成编码
   */
  async finalize(): Promise<Blob> {
    if (!this._isInitialized) {
      throw new Error('编码器未初始化')
    }

    try {
      // 等待所有编码完成
      if (this._videoEncoder && this._videoEncoder.state === 'configured') {
        await this._videoEncoder.flush()
      }

      // 关闭输出流
      if (this._outputController) {
        this._outputController.close()
      }

      // 收集所有编码数据
      const chunks: Uint8Array[] = []
      if (this._outputStream) {
        const reader = this._outputStream.getReader()
        let result: ReadableStreamReadResult<Uint8Array>

        do {
          result = await reader.read()
          if (!result.done) {
            chunks.push(result.value)
          }
        } while (!result.done)
      }

      // 创建Blob
      const blob = new Blob(chunks, { type: 'video/mp4' })
      return blob
    }
    catch (error) {
      console.error('完成编码失败:', error)
      throw new Error(`完成编码失败: ${error}`)
    }
  }

  /**
   * 取消编码
   */
  cancel(): void {
    this._isEncoding = false

    if (this._videoEncoder) {
      try {
        this._videoEncoder.reset()
      }
      catch (error) {
        console.warn('重置视频编码器失败:', error)
      }
    }

    if (this._audioEncoder) {
      try {
        this._audioEncoder.reset()
      }
      catch (error) {
        console.warn('重置音频编码器失败:', error)
      }
    }

    if (this._outputController) {
      try {
        this._outputController.error(new Error('编码已取消'))
      }
      catch (error) {
        console.warn('关闭输出流失败:', error)
      }
    }
  }

  /**
   * 重置编码器
   */
  reset(): void {
    this.cancel()
    this._encodedChunks = []
    this._encodedFrameCount = 0
    this._totalFrames = 0
    this._isInitialized = false
    this._isEncoding = false
  }

  /**
   * 检查是否已初始化
   */
  isInitialized(): boolean {
    return this._isInitialized
  }

  /**
   * 检查是否正在编码
   */
  isEncoding(): boolean {
    return this._isEncoding
  }

  /**
   * 获取编码器状态
   */
  getStatus(): {
    video: 'unconfigured' | 'configured' | 'closed'
    audio: 'unconfigured' | 'configured' | 'closed'
  } {
    return {
      video: this._videoEncoder?.state || 'unconfigured',
      audio: this._audioEncoder?.state || 'unconfigured',
    }
  }

  /**
   * 销毁编码器
   */
  destroy(): void {
    this.cancel()
    this._videoEncoder = null
    this._audioEncoder = null
    this._outputController = null
    this._outputStream = null
  }
}
