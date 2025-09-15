import { Log, MP4Clip } from '@webav/av-cliper'

Log.setLogLevel(Log.warn)

export interface Tick {
  video?: VideoFrame
  audio: Float32Array[]
  state: 'success' | 'done'
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
}
