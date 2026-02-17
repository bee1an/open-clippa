import type { Performer } from '@clippc/performer'
import type { MaybeArray } from 'type-aide'
import type { CanvasSize } from './layout'
import { EventBus } from '@clippc/utils'
import { Application } from 'pixi.js'
import { normalizeCanvasSize } from './layout'

export interface InitialOption {
  width?: number

  height?: number

  resolution?: number

  antialias?: boolean
}

export type StageEvents = {
  /**
   * 延迟添加
   */
  delayedAdd: [Performer]
}

export class Stage extends EventBus<StageEvents> {
  private _app!: Application
  private _pendingLoads: Set<Performer> = new Set()
  private _size: CanvasSize = { width: 0, height: 0 }

  /**
   * 获取PIXI应用实例
   */
  get app(): Application {
    return this._app
  }

  get size(): CanvasSize {
    return { ...this._size }
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
    app.stage.sortableChildren = true
    this._size = normalizeCanvasSize({
      width: app.renderer.width,
      height: app.renderer.height,
    })
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

  resize(size: CanvasSize): void {
    if (!this._app) {
      throw new Error('app not found')
    }

    const nextSize = normalizeCanvasSize(size)
    this._app.renderer.resize(nextSize.width, nextSize.height)
    this._size = nextSize
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

    performers.forEach((p) => {
      this._performers.add(p)

      if (p.sprite) {
        this._attachSprite(p)
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
      this._pendingLoads.delete(p)

      if (p.sprite && p.sprite.parent === this._app.stage) {
        this._app.stage.removeChild(p.sprite)
        this._app.stage.sortChildren()
      }
    })
  }

  /**
   * 等待表演者加载完成后将表演者交于导演对象处理
   */
  async addNotReady(p: Performer): Promise<void> {
    if (this._pendingLoads.has(p))
      return

    this._pendingLoads.add(p)

    try {
      await p.load()

      if (!this._performers.has(p))
        return

      this.emit('delayedAdd', p)
    }
    catch (error) {
      console.error('Performer load error:', error)
    }
    finally {
      this._pendingLoads.delete(p)
    }
  }

  private _attachSprite(p: Performer): void {
    if (!p.sprite)
      return

    p.sprite.zIndex = p.zIndex

    if (p.sprite.parent !== this._app.stage) {
      this._app.stage.addChild(p.sprite)
    }

    this._app.stage.sortChildren()
  }
}
