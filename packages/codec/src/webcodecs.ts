import { Log } from '@webav/av-cliper'

Log.setLogLevel(Log.warn)

export interface WebCodecsEncoderOptions {
  codec: string
  width?: number
  height?: number
  bitrate?: number
  frameRate?: number
  hardwareAcceleration?: 'prefer-hardware' | 'prefer-software'
}

export interface MP4MuxerOptions {
  video?: VideoEncoderConfig
  audio?: AudioEncoderConfig
  duration?: number
}

export class WebCodecsEncoder {
  private _videoEncoder: VideoEncoder | null = null
  private _audioEncoder: AudioEncoder | null = null
  private _isInitialized: boolean = false
  private _encoding = false

  constructor(private _options: WebCodecsEncoderOptions) {
    this._validateOptions()
  }

  /**
   * 验证编码器选项
   */
  private _validateOptions(): void {
    const { codec, width, height, bitrate, frameRate } = this._options

    if (!codec) {
      throw new Error('必须指定编解码器')
    }

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
   * 检测浏览器对 WebCodecs API 的支持
   */
  static async isSupported(): Promise<boolean> {
    try {
      return !!(typeof VideoEncoder !== 'undefined'
        && typeof AudioEncoder !== 'undefined'
        && typeof VideoDecoder !== 'undefined'
        && typeof AudioDecoder !== 'undefined')
    }
    catch {
      return false
    }
  }

  /**
   * 检测特定编解码器的支持
   */
  static async isCodecSupported(codec: string, type: 'video' | 'audio' = 'video'): Promise<boolean> {
    try {
      if (type === 'video') {
        const config = {
          codec,
          width: 1920,
          height: 1080,
          bitrate: 5000000,
          framerate: 30,
        }
        const support = await VideoEncoder.isConfigSupported(config)
        return !!support.supported
      }
      else {
        const config = {
          codec,
          sampleRate: 48000,
          numberOfChannels: 2,
          bitrate: 128000,
        }
        const support = await AudioEncoder.isConfigSupported(config)
        return !!support.supported
      }
    }
    catch {
      return false
    }
  }

  /**
   * 获取推荐的视频编解码器配置
   */
  static getRecommendedVideoCodec(): string {
    // 优先使用 H.264，然后依次尝试 H.265, VP9, AV1
    const codecs = [
      'avc1.42E032', // H.264 Baseline
      'avc1.4D4028', // H.264 High
      'hev1.1.6.L93.B0', // H.265
      'vp09.00.10.08', // VP9
      'av01.0.01M.08', // AV1
    ]

    return codecs[0] // 默认返回 H.264
  }

  /**
   * 获取推荐的音频编解码器配置
   */
  static getRecommendedAudioCodec(): string {
    // 优先使用 AAC，然后尝试 Opus
    return 'mp4a.40.2' // AAC-LC
  }

  /**
   * 初始化视频编码器
   */
  async initializeVideoEncoder(config?: Partial<VideoEncoderConfig>): Promise<void> {
    try {
      const defaultConfig: VideoEncoderConfig = {
        codec: this._options.codec || WebCodecsEncoder.getRecommendedVideoCodec(),
        width: this._options.width || 1920,
        height: this._options.height || 1080,
        bitrate: this._options.bitrate || 5000000,
        framerate: this._options.frameRate || 30,
        hardwareAcceleration: this._options.hardwareAcceleration || 'prefer-hardware',
      }

      const finalConfig = { ...defaultConfig, ...config }
      const support = await VideoEncoder.isConfigSupported(finalConfig)

      if (!support.supported) {
        throw new Error(`视频编码器不支持: ${JSON.stringify(finalConfig)}`)
      }

      this._videoEncoder = new VideoEncoder({
        output: this._handleVideoChunk.bind(this),
        error: this._handleVideoError.bind(this),
      })

      this._videoEncoder.configure(finalConfig)
      this._isInitialized = true
    }
    catch (error) {
      console.error('视频编码器初始化失败:', error)
      throw error
    }
  }

  /**
   * 初始化音频编码器
   */
  async initializeAudioEncoder(config?: Partial<AudioEncoderConfig>): Promise<void> {
    try {
      const defaultConfig: AudioEncoderConfig = {
        codec: WebCodecsEncoder.getRecommendedAudioCodec(),
        sampleRate: 48000,
        numberOfChannels: 2,
        bitrate: 128000,
      }

      const finalConfig = { ...defaultConfig, ...config }
      const support = await AudioEncoder.isConfigSupported(finalConfig)

      if (!support.supported) {
        throw new Error(`音频编码器不支持: ${JSON.stringify(finalConfig)}`)
      }

      this._audioEncoder = new AudioEncoder({
        output: this._handleAudioChunk.bind(this),
        error: this._handleAudioError.bind(this),
      })

      this._audioEncoder.configure(finalConfig)
    }
    catch (error) {
      console.error('音频编码器初始化失败:', error)
      throw error
    }
  }

  /**
   * 编码视频帧
   */
  async encodeVideoFrame(frame: VideoFrame, _timestamp: number): Promise<void> {
    if (!this._videoEncoder || !this._isInitialized) {
      throw new Error('视频编码器未初始化')
    }

    try {
      this._encoding = true
      this._videoEncoder.encode(frame)
    }
    catch (error) {
      console.error('视频帧编码失败:', error)
      throw error
    }
  }

  /**
   * 编码音频数据
   */
  async encodeAudioData(data: AudioData, _timestamp: number): Promise<void> {
    if (!this._audioEncoder) {
      throw new Error('音频编码器未初始化')
    }

    try {
      this._encoding = true
      this._audioEncoder.encode(data)
    }
    catch (error) {
      console.error('音频数据编码失败:', error)
      throw error
    }
  }

  /**
   * 处理视频编码块
   */
  private _handleVideoChunk(chunk: EncodedVideoChunk): void {
    // 这里可以处理编码后的视频块
    // 可以传递给 MP4 封装器
    console.error('视频编码块:', chunk.type, chunk.byteLength)
  }

  /**
   * 处理音频编码块
   */
  private _handleAudioChunk(chunk: EncodedAudioChunk): void {
    // 这里可以处理编码后的音频块
    // 可以传递给 MP4 封装器
    console.error('音频编码块:', chunk.type, chunk.byteLength)
  }

  /**
   * 处理视频编码错误
   */
  private _handleVideoError(error: Error): void {
    console.error('视频编码错误:', error)
    throw error
  }

  /**
   * 处理音频编码错误
   */
  private _handleAudioError(error: Error): void {
    console.error('音频编码错误:', error)
    throw error
  }

  /**
   * 刷新编码器队列
   */
  async flush(): Promise<void> {
    if (this._videoEncoder) {
      await this._videoEncoder.flush()
    }
    if (this._audioEncoder) {
      await this._audioEncoder.flush()
    }
    this._encoding = false
  }

  /**
   * 关闭编码器
   */
  async close(): Promise<void> {
    try {
      await this.flush()

      if (this._videoEncoder) {
        this._videoEncoder.close()
        this._videoEncoder = null
      }

      if (this._audioEncoder) {
        this._audioEncoder.close()
        this._audioEncoder = null
      }

      this._isInitialized = false
      this._encoding = false
    }
    catch (error) {
      console.error('编码器关闭失败:', error)
      throw error
    }
  }

  /**
   * 获取编码器状态
   */
  getStatus(): {
    initialized: boolean
    encoding: boolean
    videoEncoderConfig?: any
    audioEncoderConfig?: any
  } {
    return {
      initialized: this._isInitialized,
      encoding: this._encoding,
      videoEncoderConfig: this._videoEncoder?.state === 'configured' ? this._videoEncoder : undefined,
      audioEncoderConfig: this._audioEncoder?.state === 'configured' ? this._audioEncoder : undefined,
    }
  }

  /**
   * 重置编码器
   */
  reset(): void {
    this._encoding = false
    // 注意：WebCodecs API 不支持重置，需要重新创建实例
  }
}

/**
 * MP4 封装器辅助类
 */
export class MP4Muxer {
  private _videoChunks: EncodedVideoChunk[] = []
  private _audioChunks: EncodedAudioChunk[] = []
  private _videoConfig?: VideoDecoderConfig
  private _audioConfig?: AudioDecoderConfig

  constructor(private _options: MP4MuxerOptions = {}) {}

  /**
   * 添加视频编码块
   */
  addVideoChunk(chunk: EncodedVideoChunk, config?: VideoDecoderConfig): void {
    this._videoChunks.push(chunk)
    if (config) {
      this._videoConfig = config
    }
  }

  /**
   * 添加音频编码块
   */
  addAudioChunk(chunk: EncodedAudioChunk, config?: AudioDecoderConfig): void {
    this._audioChunks.push(chunk)
    if (config) {
      this._audioConfig = config
    }
  }

  /**
   * 封装为 MP4 文件
   */
  async mux(): Promise<Blob> {
    // 这里需要使用 mp4box.js 或其他 MP4 封装库
    // 暂时返回空实现
    throw new Error('MP4 封装功能尚未实现，需要集成 mp4box.js')
  }

  /**
   * 清理资源
   */
  clear(): void {
    this._videoChunks = []
    this._audioChunks = []
    this._videoConfig = undefined
    this._audioConfig = undefined
  }

  /**
   * 获取统计信息
   */
  getStats(): {
    videoChunks: number
    audioChunks: number
    totalSize: number
  } {
    const videoSize = this._videoChunks.reduce((size, chunk) => size + chunk.byteLength, 0)
    const audioSize = this._audioChunks.reduce((size, chunk) => size + chunk.byteLength, 0)

    return {
      videoChunks: this._videoChunks.length,
      audioChunks: this._audioChunks.length,
      totalSize: videoSize + audioSize,
    }
  }
}
