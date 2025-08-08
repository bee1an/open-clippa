import type { Performer } from '@clippa/performer'
import type { MaybeArray } from 'type-aide'
import { EventBus } from '@clippa/utils'
import { Application } from 'pixi.js'

export type TheaterEvents = {
  /**
   * 雇佣
   */
  hire: [Performer]

  /**
   * 延迟添加
   */
  delayedAdd: [Performer]
}

export class Theater extends EventBus<TheaterEvents> {
  private _app!: Application

  /**
   * 表演者集合
   */
  private _performers: Performer[] = []
  get performers(): Performer[] {
    return this._performers
  }

  constructor(siteId: string) {
    super()
    this._initial(siteId)
  }

  private async _initial(siteId: string): Promise<Application> {
    const app = new Application()
    this._app = app

    await app.init()

    const theaterWrapper = document.getElementById(siteId)

    if (theaterWrapper) {
      theaterWrapper.appendChild(app.canvas)
    }
    else {
      console.error('theaterWrapper not found')
    }

    return app
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

  /**
   * 将表演者添加到舞台
   *
   * 如果表演者没有准备好会在表演者加载完成后再尝试添加
   */
  add(
    preformers: MaybeArray<Performer>,
  ): void {
    preformers = Array.isArray(preformers) ? preformers : [preformers]

    preformers.forEach(async (p) => {
      if (p.sprite) {
        this._app.stage.addChild(p.sprite)
      }

      else {
        this.addNotReady(p)
      }
    })
  }

  /**
   * 将表演者从舞台移除
   */
  remove(
    preformers: MaybeArray<Performer>,
  ): void {
    preformers = Array.isArray(preformers) ? preformers : [preformers]

    preformers.forEach((p) => {
      if (p.sprite)
        this._app.stage.removeChild(p.sprite)
    })
  }

  /**
   * 等待表演者加载完成后将表演者交于导演对象处理
   */
  async addNotReady(p: Performer): Promise<void> {
    await p.load()

    this.emit('delayedAdd', p)
  }
}
