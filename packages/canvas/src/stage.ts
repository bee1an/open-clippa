import type { Performer } from '@clippa/performer'
import type { MaybeArray } from 'type-aide'
import { EventBus } from '@clippa/utils'
import { Application } from 'pixi.js'

export interface InitialOption {
  width?: number

  height?: number

  resolution?: number
}

export type StageEvents = {
  /**
   * 延迟添加
   */
  delayedAdd: [Performer]
}

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

  ready: Promise<void>
  private _readyResolve

  constructor() {
    super()

    const { promise, resolve } = Promise.withResolvers<void>()
    this.ready = promise
    this._readyResolve = resolve
  }

  async init(option: InitialOption): Promise<Application> {
    if (this._app)
      return Promise.resolve(this._app)

    const app = new Application()
    this._app = app

    await app.init(option)
    this._readyResolve()

    return app
  }

  mount(elementId: string): void {
    if (!this._app) {
      throw new Error('app not found')
    }

    const element = document.getElementById(elementId)

    if (!element) {
      throw new Error('element not found')
    }

    element.appendChild(this._app.canvas)
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
