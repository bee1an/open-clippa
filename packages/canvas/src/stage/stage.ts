import type { Performer } from '@clippa/performer'
import type { MaybeArray } from 'type-aide'
import type { StageEvents } from './events'
import type { StageOption } from './option'
import { EventBus } from '@clippa/utils'
import { Application } from 'pixi.js'

export class Stage extends EventBus<StageEvents> {
  private _app!: Application

  /**
   * 获取PIXI应用实例
   */
  get app(): Application {
    return this._app
  }

  /**
   * 当前处于舞台上的表演者集合
   */
  private _performers: Set<Performer> = new Set()
  get performers(): Set<Performer> {
    return this._performers
  }

  constructor(option: StageOption) {
    super()
    this._initial(option)
  }

  private async _initial(option: StageOption): Promise<Application> {
    const { id } = option

    const app = new Application()
    this._app = app

    await app.init(option)

    const theaterWrapper = document.getElementById(id)

    if (theaterWrapper) {
      theaterWrapper.appendChild(app.canvas)
    }
    else {
      console.error('theaterWrapper not found')
    }

    return app
  }

  /**
   * 将表演者添加到舞台
   *
   * 如果表演者没有准备好会在表演者加载完成后再尝试添加
   */
  add(
    performers: MaybeArray<Performer>,
  ): void {
    performers = Array.isArray(performers) ? performers : [performers]

    performers.forEach(async (p) => {
      this._performers.add(p)

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
    performers: MaybeArray<Performer>,
  ): void {
    performers = Array.isArray(performers) ? performers : [performers]

    performers.forEach((p) => {
      this._performers.delete(p)

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
