import {
  BufferTarget,
  Mp4OutputFormat,
  Output,
  VideoSample,
  VideoSampleSource,
} from 'mediabunny'

export interface CanvasExportOptions {
  /** 要导出的 HTML Canvas 元素，作为视频帧的来源 */
  canvas: HTMLCanvasElement
  /** 更新下一帧内容的异步函数，在导出过程中每一帧都会调用此函数 */
  nextFrame: () => (Promise<void> | void)
  /** 视频总时长，单位为毫秒 */
  duration: number
  /** 视频帧率，即每秒的帧数 */
  frameRate: number
  /** 视频编码器类型，默认为 'avc'，可选值：'avc'(H.264)、'vp9'、'av1'、'hevc'(H.265) */
  codec?: 'avc' | 'vp9' | 'av1' | 'hevc'
  /** 视频比特率，单位为比特/秒，用于控制视频质量和文件大小 */
  bitrate?: number
  /** 视频质量预设，会影响默认比特率：'low'(低质量)、'medium'(中等质量)、'high'(高质量) */
  quality?: 'low' | 'medium' | 'high'
}

/**
 * 质量预设映射
 */
export class QualityPresets {
  static low = 1_000_000
  static medium = 5_000_000
  static high = 10_000_000

  static getBitrate(quality: 'low' | 'medium' | 'high'): number {
    switch (quality) {
      case 'low': return this.low
      case 'medium': return this.medium
      case 'high': return this.high
      default: return this.medium
    }
  }
}

export class CanvasExport {
  private _canvas: HTMLCanvasElement
  private _nextFrame: () => (Promise<void> | void)
  private _totalFrames: number
  private _frameRate: number
  private _duration: number
  private _codec: 'avc' | 'vp9' | 'av1' | 'hevc'
  private _bitrate: number

  constructor(options: CanvasExportOptions) {
    this._canvas = options.canvas
    this._nextFrame = options.nextFrame
    this._totalFrames = Math.floor((options.duration / 1000) * options.frameRate)
    this._frameRate = options.frameRate
    this._duration = options.duration

    // 设置编解码器和比特率
    this._codec = options.codec || 'avc'
    this._bitrate = options.bitrate || QualityPresets.getBitrate(options.quality || 'medium')
  }

  /**
   * 导出为视频 Blob，使用 VideoFrame 和 VideoSampleSource 方法
   */
  async export(): Promise<Blob> {
    if (!this._checkBrowserSupport()) {
      throw new Error('当前浏览器不支持 WebCodecs API')
    }

    const output = new Output({
      format: new Mp4OutputFormat({ fastStart: 'in-memory' }),
      target: new BufferTarget(),
    })

    // 创建 VideoSampleSource
    const videoSampleSource = new VideoSampleSource({
      codec: this._codec,
      bitrate: this._bitrate,
    })

    output.addVideoTrack(videoSampleSource)
    await output.start()

    const frameDuration = 1000000 / this._frameRate // 微秒

    for (let i = 0; i < this._totalFrames; i++) {
      // 更新 canvas
      await this._nextFrame()

      // 将 Canvas 转换为 VideoFrame
      const videoFrame = new VideoFrame(this._canvas, {
        timestamp: i * frameDuration,
      })

      // 创建 VideoSample
      const videoSample = new VideoSample(videoFrame)

      // 添加到视频源
      await videoSampleSource.add(videoSample)

      // 释放资源
      videoSample.close()
      videoFrame.close()
    }

    await output.finalize()

    const arrayBuffer = output.target.buffer
    if (!arrayBuffer) {
      throw new Error('生成视频失败：空缓冲区')
    }
    const blob = new Blob([arrayBuffer], { type: 'video/mp4' })

    return blob
  }

  /**
   * 下载视频文件
   */
  async download(filename: string = 'canvas-video.mp4'): Promise<void> {
    try {
      const blob = await this.export()

      // 创建下载链接
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)

      // 清理 URL
      setTimeout(() => URL.revokeObjectURL(url), 100)
    }
    catch (error) {
      console.error('视频导出失败:', error)
      throw error
    }
  }

  /**
   * 检查浏览器支持
   */
  private _checkBrowserSupport(): boolean {
    return (
      typeof VideoFrame !== 'undefined'
      && typeof VideoEncoder !== 'undefined'
      && typeof MediaRecorder !== 'undefined'
    )
  }

  /**
   * 获取支持的编解码器
   */
  static async getSupportedCodecs(): Promise<string[]> {
    const mediabunnyCodecs: ('avc' | 'vp9' | 'av1' | 'hevc')[] = ['avc', 'vp9', 'av1', 'hevc']
    const supported: string[] = []

    // 映射到 WebCodecs 编解码器名称进行检测
    const webCodecsMapping: Record<string, string> = {
      avc: 'avc1',
      vp9: 'vp09',
      av1: 'av01',
      hevc: 'hev1',
    }

    for (const codec of mediabunnyCodecs) {
      try {
        const webCodec = webCodecsMapping[codec]
        const support = await VideoEncoder.isConfigSupported({
          codec: webCodec,
          width: 1280,
          height: 720,
          bitrate: 5_000_000,
          framerate: 30,
        })

        if (support.supported) {
          supported.push(codec)
        }
      }
      catch {
        // 忽略不支持的编解码器
      }
    }

    return supported
  }
}
