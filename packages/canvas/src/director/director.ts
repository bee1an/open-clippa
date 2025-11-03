import type { Performer } from '@clippa/performer'
import type { Stage } from '../stage'
import type { Theater } from '../theater'
import type { DirectorEvents } from './events'
import type { DirectorOption } from './option'
import { ShowState } from '@clippa/performer'
import { EventBus } from '@clippa/utils'

export class Director extends EventBus<DirectorEvents> {
  /**
   * 剧场
   */
  theater!: Theater

  /**
   * 舞台
   */
  stage!: Stage

  /**
   * 是否播放中
   */
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

  constructor(option: DirectorOption) {
    super()
    this.guidance(option.stage)
    this.manage(option.theater)
  }

  /**
   * 给当前导演对象绑定剧场对象
   */
  manage(theater: Theater): void {
    this.theater = theater

    this.theater.on('hire', (performer) => {
      if (performer.start + performer.duration > this.duration) {
        this.duration = performer.start + performer.duration
      }

      this.checkPerformerInShowTime(performer) && this.stage.add(performer)
    })
  }

  /**
   * 给导演对象绑定舞台对象
   */
  guidance(stage: Stage): void {
    this.stage = stage

    this.stage.on(
      'delayedAdd',
      (p: Performer): any => this.checkPerformerInShowTime(p) && this.stage.add(p),
    )
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
    this.updatePerformers({ in: (p) => {
      const pCurrentTime = this.currentTime - p.start
      p.playState === 'paused' ? p.play(pCurrentTime) : p.update(pCurrentTime)
    } })

    const time = Date.now()

    this._requestAnimationFrameId = requestAnimationFrame(() => {
      const nextTime = Date.now()

      const crt = this.currentTime + (nextTime - time)

      if (crt > this.duration) {
        this.currentTime = this.duration
        this.pause()
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

  private _stop(cb?: (p: Performer) => void): void {
    if (!this._playing)
      return
    this._playing = false

    typeof this._requestAnimationFrameId === 'number'
    && cancelAnimationFrame(this._requestAnimationFrameId)

    this.stage.performers.forEach((p) => {
      p.pause(this.currentTime - p.start)
      cb?.(p)
    })
  }

  /**
   * 停止
   */
  pause(): void {
    this._stop()
  }

  /**
   * 寻帧
   */
  seek(time: number): void {
    const removeHelper = (p: Performer): void => {
      this.stage.remove(p)
      p.showState = ShowState.UNPLAYED
    }

    this._stop(removeHelper)

    // 暂停时切帧
    this.stage.performers.forEach(removeHelper)

    this.currentTime = time

    this.updatePerformers({
      in: p => p.seek(this.currentTime - p.start),
    })
  }

  /**
   * 根据当前时间更新表演者
   */
  updatePerformers(cb?: {
    in?: (p: Performer) => void
    out?: (p: Performer) => void
  }): void {
    // 使用reduce将表演者按zindex分组, 确保添加顺序从0开始
    this.theater.performers
      .reduce((pre, p) => {
        /**
         * pre是一个二维数组
         * pre[n]表示zindex为n
         */
        if (this.checkPerformerInShowTime(p)) {
          typeof pre[p.zIndex] === 'undefined' && (pre[p.zIndex] = [])
          pre[p.zIndex].push(() => {
            p.showState !== 'playing' && this.stage.add(p)
            cb?.in?.(p)
          })
        }
        else {
          p.showState === 'playing' && this.stage.remove(p)
          // 暂停属于移除出舞台的默认行为
          p.pause(this.currentTime - p.start)
          cb?.out?.(p)
        }
        return pre
      }, [] as (() => void)[][])
      .flat()
      .forEach(cb => cb())
  }
}
