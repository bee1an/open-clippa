import type {
  InputVideoTrack,
} from 'mediabunny'
import {
  ALL_FORMATS,
  Input,
  UrlSource,
  VideoSampleSink,
} from 'mediabunny'

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
  input!: Input
  videoTrack: InputVideoTrack | null = null

  private _loadingPromise: Promise<void> | null = null

  constructor(private _url: string) {
    this.load()
  }

  async load(): Promise<void> {
    if (!this._loadingPromise) {
      this._loadingPromise = this._doLoad()
    }

    await this._loadingPromise
  }

  private async _doLoad(): Promise<void> {
    this.input = new Input({
      formats: ALL_FORMATS,
      source: new UrlSource(this._url),
    })

    // 获取视频轨道
    this.videoTrack = await this.input.getPrimaryVideoTrack()
  }

  private _frameCache: { [time: number]: Promise<Tick> } = {}
  private _videoSink: VideoSampleSink | null = null

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
      this._frameCache[time] = this._extractFrame(time)
    }

    return this._frameCache[time]
  }

  private async _extractFrame(time: number): Promise<Tick> {
    if (!this.videoTrack) {
      throw new Error('视频轨道未找到')
    }

    // 转换时间为秒
    const timeInSeconds = time / 1_000_000

    // 创建视频采样器（如果不存在）
    if (!this._videoSink) {
      this._videoSink = new VideoSampleSink(this.videoTrack)
    }

    try {
      // 获取指定时间的视频采样
      const videoSample = await this._videoSink.getSample(timeInSeconds)

      if (!videoSample) {
        return { audio: [], state: 'done' }
      }

      // 转换为 VideoFrame
      const videoFrame = await videoSample.toVideoFrame()

      // 关闭采样以释放资源
      videoSample.close()

      return {
        video: videoFrame,
        audio: [],
        state: 'success',
      }
    }
    catch (error) {
      console.error('提取帧时出错:', error)
      return { audio: [], state: 'done' }
    }
  }

  /**
   * 获取视频元数据信息
   */
  async getVideoMetadata(): Promise<VideoMetadata> {
    await this.load()

    if (!this.videoTrack) {
      throw new Error('视频轨道未找到')
    }

    // 获取音频轨道
    const audioTrack = await this.input.getPrimaryAudioTrack()

    // 获取视频信息
    const duration = await this.videoTrack.computeDuration()
    const displayWidth = this.videoTrack.displayWidth
    const displayHeight = this.videoTrack.displayHeight

    return {
      width: displayWidth,
      height: displayHeight,
      duration: duration * 1_000_000, // 转换为微秒
      audioSampleRate: audioTrack?.sampleRate || 44100,
      audioChanCount: audioTrack?.numberOfChannels || 0,
      hasAudio: !!audioTrack,
    }
  }
}
