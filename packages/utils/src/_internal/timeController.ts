import { EventBus } from '../eventBus'

export type TimeControllerEvents = {
  updateCurrentTime: [currentTime: number]

  durationChange: [currentTime: number]

  playing: []

  pause: []
}

export class TimeController extends EventBus<TimeControllerEvents> {
  private _playing: boolean = false

  /**
   * 当前播放时间
   *
   * 设置后会触发 updateCurrentTime
   */
  private _currentTime: number = 0
  get currentTime(): number {
    return this._currentTime
  }

  set currentTime(value: number) {
    if (value === this._currentTime)
      return

    this._currentTime = value
    this.emit('updateCurrentTime', value)
  }

  /**
   * 总时长
   *
   * 设置后会触发 durationChange
   */
  private _duration: number = 0
  get duration(): number {
    return this._duration
  }

  set duration(value: number) {
    if (value === this._duration)
      return

    this._duration = value
    this.emit('durationChange', value)
  }

  private _requestAnimationFrameId?: number
  /** 循环函数 */
  private _start(): void {
    this.emit('playing')

    const time = Date.now()

    this._requestAnimationFrameId = requestAnimationFrame(() => {
      const nextTime = Date.now()

      const crt = this.currentTime + (nextTime - time)

      if (crt > this.duration) {
        this.currentTime = this.duration
        this._pause()
      }
      else {
        this.currentTime = crt
        this._start()
      }
    })
  }

  /**
   * 开始
   *
   * 会在剧场对象中过滤出当前时间段的表演者
   */
  play(): void {
    if (this._playing)
      return
    this._playing = true
    this._start()
  }

  private _pause(): void {
    if (!this._playing)
      return
    this._playing = false

    typeof this._requestAnimationFrameId === 'number'
    && cancelAnimationFrame(this._requestAnimationFrameId)
  }

  /**
   * 停止
   */
  pause(): void {
    this._pause()
    this.emit('pause')
  }

  /**
   * 寻帧
   */
  async seek(time: number): Promise<void> {
    this._pause()
    this.currentTime = time
  }
}
