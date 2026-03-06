import {
  ALL_FORMATS,
  AudioBufferSink,
  AudioBufferSource,
  BufferTarget,
  BlobSource,
  Input,
  Mp4OutputFormat,
  Output,
  UrlSource,
  VideoSample,
  VideoSampleSource,
} from 'mediabunny'

export class ExportCanceledError extends Error {
  constructor() {
    super('Export canceled')
    this.name = 'ExportCanceledError'
  }
}

export interface ExportFrameContext {
  frameIndex: number
  totalFrames: number
  timestampMs: number
  timestampUs: number
  frameDurationUs: number
}

export interface CanvasExportOptions {
  /** 要导出的 HTML Canvas 元素，作为视频帧的来源 */
  canvas: HTMLCanvasElement
  /** 更新下一帧内容的异步函数，在导出过程中每一帧都会调用此函数 */
  nextFrame: (context: ExportFrameContext) => (Promise<void> | void)
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
  /** 需要混入导出结果的音频片段 */
  audioTracks?: ExportAudioTrack[]
  /** Export progress callback */
  onProgress?: (progress: ExportProgress) => void
}

export interface ExportAudioTrack {
  id?: string
  source: string | File | Blob
  startMs: number
  durationMs: number
  sourceStartMs?: number
  sourceDurationMs?: number
  waveformPeaks?: number[]
  volume?: number
  muted?: boolean
}

export interface ExportProgress {
  currentFrame: number
  totalFrames: number
  progress: number
  timestamp: number
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
  private _nextFrame: (context: ExportFrameContext) => (Promise<void> | void)
  private _totalFrames: number
  private _frameRate: number
  private _codec: 'avc' | 'vp9' | 'av1' | 'hevc'
  private _bitrate: number
  private _audioTracks: ExportAudioTrack[]
  private _onProgress?: (progress: ExportProgress) => void
  private _canceled: boolean = false
  private _output?: Output

  constructor(options: CanvasExportOptions) {
    const safeFrameRate = Number.isFinite(options.frameRate) && options.frameRate > 0
      ? options.frameRate
      : 30
    const safeDuration = Number.isFinite(options.duration) && options.duration > 0
      ? options.duration
      : 0

    this._canvas = options.canvas
    this._nextFrame = options.nextFrame
    this._totalFrames = Math.max(1, Math.ceil((safeDuration / 1000) * safeFrameRate))
    this._frameRate = safeFrameRate

    // 设置编解码器和比特率
    this._codec = options.codec || 'avc'
    this._bitrate = options.bitrate || QualityPresets.getBitrate(options.quality || 'medium')
    this._audioTracks = options.audioTracks ?? []
    this._onProgress = options.onProgress
  }

  async cancel(): Promise<void> {
    if (this._canceled)
      return

    this._canceled = true

    if (this._output) {
      await this._output.cancel()
    }
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
    this._output = output

    // 创建 VideoSampleSource
    const videoSampleSource = new VideoSampleSource({
      codec: this._codec,
      bitrate: this._bitrate,
    })
    output.addVideoTrack(videoSampleSource)

    const mixedAudioBuffer = await this._renderMixedAudioBuffer()
    let audioBufferSource: AudioBufferSource | null = null
    if (mixedAudioBuffer && mixedAudioBuffer.length > 0) {
      audioBufferSource = new AudioBufferSource({
        codec: 'aac',
        bitrate: 192_000,
      })
      output.addAudioTrack(audioBufferSource)
    }

    await output.start()

    const frameDurationUs = Math.round(1000000 / this._frameRate)

    for (let i = 0; i < this._totalFrames; i++) {
      if (this._canceled) {
        await output.cancel()
        throw new ExportCanceledError()
      }

      const timestampMs = (i * 1000) / this._frameRate
      const timestampUs = Math.round((i * 1000000) / this._frameRate)

      // 更新 canvas
      await this._nextFrame({
        frameIndex: i,
        totalFrames: this._totalFrames,
        timestampMs,
        timestampUs,
        frameDurationUs,
      })

      if (this._canceled) {
        await output.cancel()
        throw new ExportCanceledError()
      }

      // 将 Canvas 转换为 VideoFrame
      const videoFrame = new VideoFrame(this._canvas, {
        timestamp: timestampUs,
        duration: frameDurationUs,
      })

      // 创建 VideoSample
      const videoSample = new VideoSample(videoFrame)

      // 添加到视频源
      await videoSampleSource.add(videoSample)

      // 释放资源
      videoSample.close()
      videoFrame.close()

      if (this._onProgress) {
        const currentFrame = i + 1
        const progress = this._totalFrames > 0 ? currentFrame / this._totalFrames : 1
        const timestamp = currentFrame * (1000 / this._frameRate)
        this._onProgress({
          currentFrame,
          totalFrames: this._totalFrames,
          progress,
          timestamp,
        })
      }
    }

    if (this._canceled) {
      await output.cancel()
      throw new ExportCanceledError()
    }

    if (audioBufferSource && mixedAudioBuffer) {
      await audioBufferSource.add(mixedAudioBuffer)
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

  private async _renderMixedAudioBuffer(): Promise<AudioBuffer | null> {
    const activeTracks = this._audioTracks.filter((track) => {
      if (track.muted)
        return false

      const volume = track.volume ?? 1
      if (!Number.isFinite(volume) || volume <= 0)
        return false

      return Number.isFinite(track.durationMs) && track.durationMs > 0
    })

    if (activeTracks.length === 0)
      return null

    if (
      typeof OfflineAudioContext === 'undefined'
      || typeof AudioBuffer === 'undefined'
    ) {
      throw new Error('当前浏览器不支持离线音频混音')
    }

    const sampleRate = 48_000
    const channelCount = 2
    const length = Math.max(1, Math.ceil((this._totalFrames / this._frameRate) * sampleRate))
    const offlineContext = new OfflineAudioContext({
      numberOfChannels: channelCount,
      length,
      sampleRate,
    })
    const decodedCache = new Map<string | File | Blob, Promise<AudioBuffer | null>>()

    const resolveAudioBuffer = async (source: string | File | Blob): Promise<AudioBuffer | null> => {
      const cached = decodedCache.get(source)
      if (cached)
        return await cached

      const promise = this._decodeAudioBuffer(source)
      decodedCache.set(source, promise)
      return await promise
    }

    for (const track of activeTracks) {
      const decodedBuffer = await resolveAudioBuffer(track.source)
      if (!decodedBuffer || decodedBuffer.length === 0)
        continue

      const startAt = Math.max(0, track.startMs / 1000)
      const sourceOffset = Math.max(0, (track.sourceStartMs ?? 0) / 1000)
      const requestedDuration = Math.max(0, track.durationMs / 1000)
      const sourceWindowDuration = track.sourceDurationMs !== undefined
        ? Math.max(0, track.sourceDurationMs / 1000)
        : requestedDuration
      const sourceAvailableDuration = Math.max(0, decodedBuffer.duration - sourceOffset)
      const clipDuration = Math.min(
        requestedDuration,
        sourceWindowDuration,
        sourceAvailableDuration,
        Math.max(0, (this._totalFrames / this._frameRate) - startAt),
      )

      if (clipDuration <= 0)
        continue

      const sourceNode = offlineContext.createBufferSource()
      sourceNode.buffer = decodedBuffer

      const gainNode = offlineContext.createGain()
      gainNode.gain.value = Math.max(0, Math.min(1, track.volume ?? 1))

      sourceNode.connect(gainNode)
      gainNode.connect(offlineContext.destination)
      sourceNode.start(startAt, sourceOffset, clipDuration)
    }

    return await offlineContext.startRendering()
  }

  private async _decodeAudioBuffer(source: string | File | Blob): Promise<AudioBuffer | null> {
    const input = new Input({
      formats: ALL_FORMATS,
      source: typeof source === 'string' ? new UrlSource(source) : new BlobSource(source),
    })
    const audioTrack = await input.getPrimaryAudioTrack()
    if (!audioTrack)
      return null

    const duration = await audioTrack.computeDuration()
    if (!Number.isFinite(duration) || duration <= 0)
      return null

    const sink = new AudioBufferSink(audioTrack)
    const sampleRate = Math.max(1, Math.round(audioTrack.sampleRate || 48_000))
    const numberOfChannels = Math.max(1, Math.round(audioTrack.numberOfChannels || 2))
    const chunks: Array<{ buffer: AudioBuffer, frameOffset: number }> = []
    let totalFrames = 0

    for await (const wrapped of sink.buffers(0, duration)) {
      const frameOffset = Math.max(0, Math.round(wrapped.timestamp * sampleRate))
      totalFrames = Math.max(totalFrames, frameOffset + wrapped.buffer.length)
      chunks.push({
        buffer: wrapped.buffer,
        frameOffset,
      })
    }

    if (totalFrames <= 0)
      return null

    const mergedBuffer = new AudioBuffer({
      length: totalFrames,
      sampleRate,
      numberOfChannels,
    })

    chunks.forEach(({ buffer, frameOffset }) => {
      for (let channelIndex = 0; channelIndex < numberOfChannels; channelIndex += 1) {
        const sourceChannel = buffer.getChannelData(Math.min(channelIndex, buffer.numberOfChannels - 1))
        const targetChannel = mergedBuffer.getChannelData(channelIndex)
        targetChannel.set(sourceChannel, frameOffset)
      }
    })

    return mergedBuffer
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
