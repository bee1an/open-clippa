import { Log, MP4Clip } from '@webav/av-cliper'

Log.setLogLevel(Log.warn)

export interface Tick {
  video?: VideoFrame
  audio: Float32Array[]
  state: 'success' | 'done'
}

export class TickExtractor {
  private _clip?: MP4Clip

  constructor(private _url: string) {}

  async load(): Promise<void> {
    if (!this._clip) {
      this._clip = new MP4Clip((await fetch(this._url)).body!)
    }

    await this._clip.ready
  }

  private _ticksCache: { [time: number]: Promise<Tick> } = {}
  /**
   * Given a time in microsecond, return the frame at that time.
   *
   * This function is memoized.
   *
   * @param time - the time of the frame to return in ms
   * @returns a promise resolving to the frame at the given time
   */
  getTickByTime(time: number): Promise<Tick> {
    if (!this._ticksCache[time]) {
      this._ticksCache[time] = this._clip!.tick(time)
    }

    return this._ticksCache[time]
  }
}
