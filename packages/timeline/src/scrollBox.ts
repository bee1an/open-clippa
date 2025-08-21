import type { FederatedPointerEvent } from 'pixi.js'
import { EventBus } from 'open-clippa'
import { Container, Graphics } from 'pixi.js'

export const SCROLLBAR_WIDTH = 10
export const SCROLLBAR_HEIGHT = 10
export const RAIL_COLOR = '#7d6f7cff'
export const TRIGGER_COLOR = '#d4d3cdff'

export type Anyfn = (...args: any[]) => any // TODO

export interface ScrollBoxOption {
  /**
   * 可视区域宽度
   */
  viewportWidth: number
  /**
   * 可视区域高度
   */
  viewportHeight: number
  railColor?: string
  triggerColor?: string
  barHeight?: number
  barWidth?: number
}

interface DrawScrollBarHelperOption {
  rail: [x: number, y: number, width: number, height: number]
  bar: [x: number, y: number, width: number, height: number, radius: number]
  down: (e: PointerEvent) => void
  move: (e: PointerEvent, scrollbar: Container, bar: Graphics) => void
  click: (e: FederatedPointerEvent, scrollbar: Container, bar: Graphics) => void
}

export type ScrollBoxEvents = {
  render: []
}

export class ScrollBox extends EventBus<ScrollBoxEvents> {
  /**
   * 最外层元素, 包含容器和滚动条
   */
  wrapper: Container = new Container()

  /**
   * 容器, 将内容添加到这个容器
   *
   * 内部监听这个容器子节点新增, 删除, 动态修改width和height
   */
  container: Container = new Container()

  /**
   * 实例宽度
   */
  width: number = 0
  /**
   * 实例高度
   */
  height: number = 0
  /**
   * 可视区域宽度
   */
  viewportWidth: number
  /**
   * 可视区域高度
   */
  viewportHeight: number
  railColor: string
  triggerColor: string
  barHeight: number
  barWidth: number

  constructor(option: ScrollBoxOption) {
    super()
    this.viewportWidth = option.viewportWidth
    this.viewportHeight = option.viewportHeight
    this.railColor = option.railColor || RAIL_COLOR
    this.triggerColor = option.triggerColor || TRIGGER_COLOR
    this.barHeight = option.barHeight || SCROLLBAR_HEIGHT
    this.barWidth = option.barWidth || SCROLLBAR_WIDTH

    this.wrapper.addChild(this.container)

    this.container.on('childAdded', () => {
      this._updateSize(this.container.width, this.container.height)
    })

    this.container.on('childRemoved', () => {
      this._updateSize(this.container.width, this.container.height)
    })

    this.render()
  }

  private _viewportMask?: Graphics
  private _drawView(): void {
    if (!this.viewportWidth || !this.viewportHeight)
      return

    if (this._viewportMask) {
      this.wrapper.removeChild(this._viewportMask)
    }

    const view = new Graphics()
    this._viewportMask = view
    view.rect(0, 0, this.viewportWidth, this.viewportHeight)
    view.fill('transparent')
    this.wrapper.mask = view
    this.wrapper.addChild(view)
  }

  private _drawScrollbarHelper(option: DrawScrollBarHelperOption): Container {
    const { rail: railOption, bar: barOption, down, move, click } = option

    const scrollbar = new Container()
    /* rail */
    const rail = new Graphics()
    rail.rect(...railOption)
    rail.fill(this.railColor)
    rail.eventMode = 'static'
    rail.cursor = 'pointer'

    /* trigger */
    const trigger = new Graphics()
    trigger.roundRect(...barOption)
    trigger.fill(this.triggerColor)
    trigger.eventMode = 'static'
    trigger.cursor = 'pointer'

    /* drag */
    const _move = (e: PointerEvent): void => {
      move(e, scrollbar, trigger)
    }
    const up = (): void => {
      document.removeEventListener('pointermove', _move)
      document.removeEventListener('pointerup', up)
    }
    trigger.on('pointerdown', (e) => {
      down(e)
      document.addEventListener('pointermove', _move)
      document.addEventListener('pointerup', up)
    })

    /* click */
    rail.on('click', (e) => {
      click(e, scrollbar, trigger)
    })

    scrollbar.addChild(rail)
    scrollbar.addChild(trigger)

    return scrollbar
  }

  private _scrollbarXBar?: Container
  private _drawScrollXBar(): void {
    if (!this.viewportWidth)
      return

    if (this._scrollbarXBar) {
      this.wrapper.removeChild(this._scrollbarXBar)
    }

    if (this.width <= this.viewportWidth) {
      return
    }

    const stepRatio = this.viewportWidth / this.width

    let x: number
    const move = (e: { x: number }, _: Container, trigger: Graphics): void => {
      let dx = e.x - x!

      // left limit
      if (trigger.x + dx < 0) {
        dx = -trigger.x
      }

      // right limit
      if (trigger.x + dx + trigger.width > this.viewportWidth) {
        dx = this.viewportWidth - trigger.x - trigger.width
      }

      trigger.x += dx
      this.container.x -= dx / stepRatio

      x += dx
    }
    this._scrollbarXBar = this._drawScrollbarHelper({
      rail: [0, this.viewportHeight - this.barHeight, this.viewportWidth, this.barHeight],
      bar: [0, this.viewportHeight - this.barHeight, stepRatio * this.viewportWidth, this.barHeight, this.barHeight / 2],
      down: (e) => {
        x = e.x
      },
      move,
      click: (e, scrollbar, trigger) => {
        const barCenterX = trigger.x + trigger.width / 2
        const clickX = e.getLocalPosition(scrollbar).x

        // max move size canot than bar width
        const moveX = Math.max(Math.min(clickX - barCenterX, trigger.width), -trigger.width)

        x = trigger.x
        move({ x: x + moveX }, scrollbar, trigger)
      },
    })

    this.wrapper.addChild(this._scrollbarXBar)
  }

  private _scrollbarYBar?: Container
  private _drawScrollYBar(): void {
    if (!this.viewportHeight)
      return

    if (this._scrollbarYBar) {
      this.wrapper.removeChild(this._scrollbarYBar)
    }

    if (this.height <= this.viewportHeight) {
      return
    }

    const stepRatio = this.viewportHeight / this.height

    let y: number
    const move = (e: { y: number }, _: Container, trigger: Graphics): void => {
      let dy = e.y - y!

      // top limit
      if (trigger.y + dy < 0) {
        dy = -trigger.y
      }

      // bottom limit
      if (trigger.y + dy + trigger.height > this.viewportHeight) {
        dy = this.viewportHeight - trigger.y - trigger.height
      }

      trigger.y += dy
      this.container.y -= dy / stepRatio

      y += dy
    }
    this._scrollbarYBar = this._drawScrollbarHelper({
      rail: [this.viewportWidth - this.barWidth, 0, this.barWidth, this.viewportHeight],
      bar: [this.viewportWidth - this.barWidth, 0, this.barWidth, stepRatio * this.viewportHeight, this.barWidth / 2],
      down: (e) => {
        y = e.y
      },
      move,
      click: (e, scrollbar, trigger) => {
        const barCenterY = trigger.y + trigger.height / 2
        const clickY = e.getLocalPosition(scrollbar).y

        // max move size canot than bar width
        const moveY = Math.max(Math.min(clickY - barCenterY, trigger.height), -trigger.height)

        y = trigger.y
        move({ y: y + moveY }, scrollbar, trigger)
      },
    })

    this.wrapper.addChild(this._scrollbarYBar)
  }

  /**
   * Update the size
   */
  private _updateSize(w?: number, h?: number): void {
    if (w) {
      this.width = w
    }
    if (h) {
      this.height = h
    }

    this.queueRender()
  }

  /**
   * Updates the size of the viewport if the size of the container has changed.
   */
  update(): void {
    const { width: containerWidth, height: containerHeight } = this.container.getSize()
    if (containerWidth !== this.width || containerHeight !== this.height) {
      this._updateSize(containerWidth, containerHeight)
    }
  }

  nextRender(fn?: Anyfn): Promise<void> {
    return new Promise<void>((resolve) => {
      this.container.onRender = () => {
        fn?.()

        // [ ]: https://github.com/pixijs/pixijs/pull/11627
        this.container.onRender = null as any
        resolve()
      }
    })
  }

  /**
   * Update the size of the viewport.
   */
  updateViewportSize(w?: number, h?: number): void {
    if (w) {
      this.viewportWidth = w
    }
    if (h) {
      this.viewportHeight = h
    }

    this.queueRender()
  }

  /**
   * Render the view, scrollbars, and viewport
   *
   * @see {@link _drawView}
   * @see {@link _drawScrollXBar}
   * @see {@link _drawScrollYBar}
   */
  render(): void {
    this._drawView()
    this._drawScrollXBar()
    this._drawScrollYBar()

    this.emit('render')
  }

  private _queueRenderId?: number
  /**
   * Queue a render request. This will cancel any previous pending render
   * request and schedule a new one.
   */
  queueRender(): void {
    this._queueRenderId && cancelAnimationFrame(this._queueRenderId)

    this._queueRenderId = requestAnimationFrame(() => this.render())
  }
}
