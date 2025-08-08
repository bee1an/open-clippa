import type { Performer } from '@clippa/performer'
import type { Theater } from '../theater'
import type { DirectorEvents } from './events'
import type { DirectorOption } from './options'
import { EventBus } from '@clippa/utils'

export class Director extends EventBus<DirectorEvents> {
  /**
   * 剧场
   */
  theater!: Theater

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

  constructor(option: DirectorOption) {
    super()
    option.theater && this.guidance(option.theater)
  }

  /**
   * 给当前导演对象绑定剧场对象
   *
   * 自动监听剧场对象的 hire 事件
   */
  guidance(theater: Theater): void {
    this.theater = theater

    const tryAdd = (p: Performer): any => this.checkPerformerInShowTime(p) && this.theater.add(p)

    this.theater.on('hire', (performer) => {
      if (performer.start + performer.duration > this.duration) {
        this.duration = performer.start + performer.duration
      }

      tryAdd(performer)
    })

    this.theater.on('delayedAdd', tryAdd)
  }

  /**
   * 检查表演者是否在当前时间段
   */
  checkPerformerInShowTime(performer: Performer): boolean {
    return this.currentTime >= performer.start && this.currentTime < performer.start + performer.duration
  }

  private _requestAnimationFrameId?: number
  /** 循环函数 */
  private _start(): void {
    const { added, removed } = this.updatePerformers()

    added.forEach(p => p.play())
    removed.forEach(p => p.pause())

    const time = Date.now()

    this._requestAnimationFrameId = requestAnimationFrame(() => {
      const nextTime = Date.now()

      const crt = this.currentTime + (nextTime - time)

      if (crt > this.duration) {
        this.currentTime = this.duration
        this.stop()
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
  action(): void {
    this._start()
  }

  /**
   * 停止
   */
  stop(): void {
    typeof this._requestAnimationFrameId === 'number' && cancelAnimationFrame(this._requestAnimationFrameId)

    const preformers = this.theater.filterPerformerByTime(this.currentTime)

    preformers.forEach((p) => {
      p.pause()
    })
  }

  /**
   * 根据当前时间更新表演者
   */
  updatePerformers(): { added: Performer[], removed: Performer[] } {
    const added: Performer[] = []
    const removed: Performer[] = []

    this.theater.performers.forEach((p) => {
      this.checkPerformerInShowTime(p) ? added.push(p) : removed.push(p)
    })

    return { added, removed }
  }
}
