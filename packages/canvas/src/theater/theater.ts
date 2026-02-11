import type { Performer } from '@clippc/performer'
import type { TheaterEvents } from './events'
import { EventBus } from '@clippc/utils'

export class Theater extends EventBus<TheaterEvents> {
  /**
   * 表演者集合
   */
  private _performers: Performer[] = []
  get performers(): Performer[] {
    return this._performers
  }

  constructor() {
    super()
  }

  /**
   * 雇佣表演者
   */
  hire(p: Performer): void {
    this._performers.push(p)
    this.emit('hire', p)
  }

  /**
   * 解雇表演者
   */
  fire(p: Performer): void {
    this._performers = this._performers.filter(item => item !== p)
  }

  /**
   * 过滤出当前时间段的表演者
   */
  filterPerformerByTime(time: number): Performer[] {
    return this._performers.filter(item => item.start <= time && time < item.start + item.duration)
  }
}
