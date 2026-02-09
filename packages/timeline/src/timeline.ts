import type { Train } from './train'
import { TIMELINE_APP_BACKGROUND_FILL, TIMELINE_LEFT_PADDING } from '@clippa/constants'
import { EventBus, getMsByPx, getPxByMs } from '@clippa/utils'
import { Application, Container } from 'pixi.js'
import { Cursor } from './cursor'
import { Rails } from './rails'
import { Ruler } from './ruler'
import { State } from './state'
import { QueueRun } from './utils'

export type TimlineEvents = {
  play: []
  pause: []
  seeked: [time: number]
  durationChanged: [number]
}

export class Timeline extends EventBus<TimlineEvents> {
  /**
   * pixi application
   */
  app?: Application
  /**
   * ruler instance
   */
  ruler?: Ruler
  /**
   * cursor instance
   */
  cursor?: Cursor
  /**
   * rails instance
   */
  rails?: Rails
  /**
   * outmost container
   */
  container = new Container({ x: TIMELINE_LEFT_PADDING })
  /**
   * ruler and cursor container
   */
  adjuster = new Container({ label: 'adjuster' })
  currentTime: number = 0
  /**
   * timeline global state
   */
  state: State = State.getInstance()
  /**
   * total duration
   */
  duration: number = 0
  /**
   * scale factor
   */
  scale: number = 0.6
  /**
   * 是否播放中
   */
  private _playing: boolean = false
  /**
   * 记录上一次翻页的时间戳，防止连续翻页
   */

  ready: Promise<void>
  private _readyResolve
  /**
   * 播放时间对应的像素
   */
  get currentPx(): number {
    return getPxByMs(this.currentTime, this.state.pxPerMs)
  }

  constructor() {
    super()

    const { promise, resolve } = Promise.withResolvers<void>()
    this.ready = promise
    this._readyResolve = resolve
  }

  /**
   * mount timeline
   *
   * app resize to wrapper, so wrapper is required
   */
  async mount(elementId: string): Promise<void> {
    if (this.app) {
      this._mountWithBindEvents(elementId)
      return
    }

    const app = new Application()
    this.app = app

    const wrapper = this._mountWithBindEvents(elementId)

    await app.init({
      resizeTo: wrapper,
      backgroundColor: TIMELINE_APP_BACKGROUND_FILL,
      height: 250,
      antialias: true,
    })
    this._readyResolve()

    wrapper.appendChild(app.canvas)

    app.stage.addChild(this.container)

    // Sync flush for immediate rendering
    this._updateChildrenSize()

    const queueRun = new QueueRun(async () => {
      // 等待PIXI应用完成resize，确保应用内部尺寸稳定
      app.queueResize()
      // 然后更新子元素尺寸，此时能获取到正确的应用尺寸
      this._updateChildrenSize()
    })

    // https://github.com/pixijs/pixijs/issues/11427
    new ResizeObserver(() => queueRun.queueRun()).observe(wrapper)

    this._createRuler()

    this._createCursor()

    this._createRails()

    this.container.addChild(this.adjuster)
  }

  private _mountWithBindEvents(elementId: string): HTMLElement {
    if (!this.app) {
      throw new Error('app not found')
    }

    const wrapper = document.getElementById(elementId)

    if (!wrapper) {
      throw new Error('wrapper not found')
    }

    // 阻止mac的双指滑动导致的回退操作
    wrapper.addEventListener('pointerenter', () => {
      document.body.style.setProperty('overscroll-behavior', 'none')
      document.documentElement.style.setProperty('overscroll-behavior', 'none')
    })
    wrapper.addEventListener('pointerleave', () => {
      document.body.style.removeProperty('overscroll-behavior')
      document.documentElement.style.removeProperty('overscroll-behavior')
    })

    return wrapper
  }

  /**
   * Update the size of the children components based on the current screen size
   */
  private _updateChildrenSize(): void {
    if (!this.app)
      return

    const screenWidth = this.app.screen.width - TIMELINE_LEFT_PADDING
    const screenHeight = this.app.screen.height

    this.ruler?.updateScreenWidth(screenWidth)

    this.cursor?.updateScreenSize(
      screenWidth,
      screenHeight,
    )

    this.rails?.updateScreenSize(
      screenWidth,
      screenHeight,
    )
  }

  /**
   * Creates a Ruler component and adds it to the adjuster container
   *
   * when the `seek` event trigger then emit cursor seek handler
   */
  private _createRuler(): void {
    this.ruler = new Ruler({
      screenWidth: this.app!.screen.width - TIMELINE_LEFT_PADDING,
      duration: this.duration,
    })
    this.adjuster.addChild(this.ruler.container)

    this.ruler.on('seek', (seekTime: number) => {
      this.seek(seekTime)
    })
  }

  /**
   * Creates a Rails component and adds it to the container
   *
   * when the `scroll` event trigger then update ruler offset x
   */
  private _createRails(): void {
    this.rails = new Rails({
      screenWidth: this.app!.screen.width - TIMELINE_LEFT_PADDING,
      screenHeight: this.app!.screen.height,
      duration: this.duration,
    })

    this.container.addChild(this.rails.container)

    this.rails.on('scroll', () => {
      this.adjuster.x = this.rails!.offsetX

      this.ruler?.updateOffsetX(this.rails!.offsetX)
    })

    this.rails.on('updateDuration', (duration: number) => {
      this.updateDuration(duration)
    })
  }

  /**
   * Creates a Cursor component and adds it to the adjuster container
   */
  private _createCursor(): void {
    this.cursor = new Cursor({
      screenWidth: this.app!.screen.width - TIMELINE_LEFT_PADDING,
      height: this.app!.screen.height,
      duration: this.duration,
    })
    this.adjuster.addChild(this.cursor.container)

    this.cursor.on('seek', (seekTime: number) => {
      this.cursor!.isDragging && this._moveCursorWithScroll()

      this.seek(seekTime, false)
    })
  }

  /**
   * update total duration
   *
   * call ruler `updateDuration` method
   * call rails `updateDuration` method
   * call cursor `updateDuration` method
   */
  updateDuration(duration: number): void {
    this.duration = duration

    this.ruler?.updateDuration(duration)
    this.rails?.updateDuration(duration)
    this.cursor?.updateDuration(duration)

    this.emit('durationChanged', duration)
  }

  private _requestAnimationFrameId?: number
  /** 循环函数 */
  private _start(): void {
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

      // 使用updatePosition方法更新光标位置，避免触发seek事件
      this.cursor!.updatePosition(this.currentTime)

      // 检查是否需要翻页
      this._checkPageTurn()
    })
  }

  play(): void {
    if (this._playing)
      return
    this._playing = true

    this.emit('play')
    this._start()
  }

  private _stop(): void {
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
    this._stop()

    this.emit('pause')
  }

  /**
   * 检查是否需要翻页
   */
  private _checkPageTurn(): void {
    if (this.rails?.isWhetherNearRightEdge(this.currentPx)) {
      this.rails!.scrollBox.turnToNextPage()
    }
  }

  /**
   * 处理cursor拖拽时的滚动
   */
  private _moveCursorWithScroll(): void {
    let scrollDirection = 0

    const scrollMore = this.rails!.scrollBox.scrollMore?.x ?? 0
    const tolerance = 0.1 // 容差值，避免浮点数精度问题

    // 检查是否可以向右滚动（未到达最右边）
    if (this.rails?.isWhetherNearRightEdge(this.currentPx)) {
      // 确保还没有滚动到最右边，使用容差值避免精度问题
      const rightBoundary = -this.rails!.offsetX + this.rails!.scrollBox.viewportWidth
      const contentWidth = this.rails!.scrollBox.width + scrollMore
      if (rightBoundary + tolerance < contentWidth) {
        scrollDirection = 1
      }
    }
    // 检查是否可以向左滚动（未到达最左边）
    else if (this.rails?.isWhetherNearLeftEdge(this.currentPx)) {
      // 确保还没有滚动到最左边，使用容差值避免精度问题
      if (this.rails!.offsetX < -tolerance) {
        scrollDirection = -1
      }
    }

    // 如果不需要滚动则返回
    if (scrollDirection === 0) {
      return
    }

    this.rails?.scrollBox.scroll({ x: scrollDirection })
    requestAnimationFrame(() => {
      this.cursor?.seek(this.currentTime + getMsByPx(scrollDirection, this.state.pxPerMs))
    })
  }

  seek(time: number, withEffect = true): void {
    this._stop()

    this.currentTime = time

    withEffect && this.cursor?.seek(time)

    this.emit('seeked', time)
  }

  addTrainByZIndex(train: Train, zIndex: number): void {
    if (!this.rails) {
      throw new Error('rails not found')
    }

    if (train.start + train.duration > this.duration) {
      this.updateDuration(train.start + train.duration)
    }

    let rail = this.rails.getRailByZIndex(zIndex)

    if (!rail || !rail.canAcceptTrain(train)) {
      rail = this.rails.createRailByZIndex(zIndex, train.railStyle)
    }

    rail.insertTrain(train)
  }
}
