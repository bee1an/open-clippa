// TODO IRenderLayer is internal
import type { ContainerChild, FederatedPointerEvent, IRenderLayer } from 'pixi.js'
import { EventBus } from 'open-clippa'
import { Container, Graphics } from 'pixi.js'

export const SCROLLBAR_WIDTH = 10
export const SCROLLBAR_HEIGHT = 10
export const RAIL_COLOR = 'transparent'
export const TRIGGER_COLOR = '#78787f'

export type Anyfn = (...args: any[]) => any // TODO

export interface ScrollBarConfig {
  /**
   * 滚动条轨道颜色
   */
  railColor?: string
  /**
   * 滚动条触发器颜色
   */
  triggerColor?: string
  /**
   * 滚动条高度
   */
  barHeight?: number
  /**
   * 滚动条宽度
   */
  barWidth?: number
  /**
   * 滚动条显示/隐藏的滞回像素阈值
   * 用于避免在阈值附近频繁切换造成抖动
   */
  hysteresisPx?: number
}

export interface ScrollBoxOption {
  /**
   * 可视区域宽度
   */
  viewportWidth?: number
  /**
   * 可视区域高度
   */
  viewportHeight?: number
  /**
   * 是否禁用x轴方向
   */
  hideXBar?: boolean
  /**
   * 是否禁用y轴方向
   */
  hideYBar?: boolean

  scrollMore?: { x?: number, y?: number }

  /**
   * 滚动条配置
   */
  scrollbar?: ScrollBarConfig
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

  toggleXBarVisible: [boolean]

  toggleYBarVisible: [boolean]

  scroll: [{ x: number, y: number }]
}

class ContainerProxy<C extends ContainerChild = ContainerChild> extends Container<C> {
  constructor(private _proxy: any) { super() }

  rawAddChild<U extends (C | IRenderLayer)[]>(...children: U): U[0] {
    return super.addChild(...children)
  }

  addChild<U extends (C | IRenderLayer)[]>(...children: U): U[0] {
    return this._proxy.addChild(...children)
  }

  rawRemoveChild<U extends (C | IRenderLayer)[]>(...children: U): U[0] {
    return super.removeChild(...children)
  }

  removeChild<U extends (C | IRenderLayer)[]>(...children: U): U[0] {
    return this._proxy.removeChild(...children)
  }
}

export class ScrollBox extends EventBus<ScrollBoxEvents> {
  /**
   * 最外层元素, 包含容器和滚动条
   */
  container: ContainerProxy

  /**
   * 容器, 将内容添加到这个容器
   *
   * 内部监听这个容器子节点新增, 删除, 动态修改width和height
   */
  private _wrapper: Container

  /**
   * 透明背景层，用于捕获wheel事件
   */
  private _background: Graphics | null = null

  get offsetX(): number {
    return this._wrapper.x
  }

  get offsetY(): number {
    return this._wrapper.y
  }

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
  /**
   * 是否禁用x轴方向
   */
  hideXBar: boolean
  /**
   * 是否禁用y轴方向
   */
  hideYBar: boolean

  isXBarVisible: boolean = false

  isYBarVisible: boolean = false

  scrollMore?: { x?: number, y?: number }

  /**
   * 滚动条配置
   */
  scrollbarConfig: ScrollBarConfig

  /**
   * 获取滚动条轨道颜色
   */
  get railColor(): string {
    return this.scrollbarConfig.railColor ?? RAIL_COLOR
  }

  /**
   * 获取滚动条触发器颜色
   */
  get triggerColor(): string {
    return this.scrollbarConfig.triggerColor ?? TRIGGER_COLOR
  }

  /**
   * 获取滚动条高度
   */
  get barHeight(): number {
    return this.scrollbarConfig.barHeight ?? SCROLLBAR_HEIGHT
  }

  /**
   * 获取滚动条宽度
   */
  get barWidth(): number {
    return this.scrollbarConfig.barWidth ?? SCROLLBAR_WIDTH
  }

  /**
   * 获取滞回像素阈值
   */
  get hysteresisPx(): number {
    return this.scrollbarConfig.hysteresisPx ?? 12
  }

  constructor(option?: ScrollBoxOption) {
    option ??= {}

    super()

    this._wrapper = new Container()

    this.container = new ContainerProxy(this._wrapper)

    this.viewportWidth = option.viewportWidth ?? 0
    this.viewportHeight = option.viewportHeight ?? 0
    this.hideXBar = option.hideXBar ?? false
    this.hideYBar = option.hideYBar ?? false
    this.scrollMore = option.scrollMore

    // 初始化滚动条配置
    this.scrollbarConfig = {
      railColor: option.scrollbar?.railColor ?? RAIL_COLOR,
      triggerColor: option.scrollbar?.triggerColor ?? TRIGGER_COLOR,
      barHeight: option.scrollbar?.barHeight ?? SCROLLBAR_HEIGHT,
      barWidth: option.scrollbar?.barWidth ?? SCROLLBAR_WIDTH,
      hysteresisPx: option.scrollbar?.hysteresisPx ?? 12,
    }

    this.container.rawAddChild(this._wrapper)

    this._wrapper.on('childAdded', () => {
      // this._updateSize(this._wrapper.width, this._wrapper.height)
    })

    this._wrapper.on('childRemoved', () => {
      // this._updateSize(this._wrapper.width, this._wrapper.height)
    })

    // 确保容器能接收事件
    this.container.eventMode = 'static'

    this._createBackground()

    this._bindEvents()

    this.render()
  }

  private _viewportMask?: Graphics

  private _createBackground(): void {
    this._background = new Graphics()
    this._updateBackground()
    this.container.addChildAt(this._background, 0) // 添加到底层
  }

  private _updateBackground(): void {
    if (!this._background)
      return

    this._background.clear()
    this._background
      .rect(0, 0, this.viewportWidth || 100, this.viewportHeight || 100)
      .fill({ color: 0x000000, alpha: 0 })
  }

  private _drawView(): void {
    if (!this.viewportWidth || !this.viewportHeight)
      return

    if (this._viewportMask) {
      this.container.rawRemoveChild(this._viewportMask)
    }

    const w = this.viewportWidth
    const h = this.viewportHeight

    const view = new Graphics()
    this._viewportMask = view
    view.rect(0, 0, w, h)
    view.fill('transparent')
    this.container.mask = view
    this.container.rawAddChild(view)
  }

  private _drawScrollbarHelper(option: DrawScrollBarHelperOption): [Container, Graphics] {
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
    trigger.roundRect(0, 0, barOption[2], barOption[3])
    const [x, y] = barOption
    trigger.x = x
    trigger.y = y
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

    return [scrollbar, trigger]
  }

  private _scrollbarXBar?: Container
  private _scrollbarXTrigger?: Graphics
  private _drawScrollXBar(): void {
    if (!this.viewportWidth)
      return

    if (this._scrollbarXBar) {
      this.container.rawRemoveChild(this._scrollbarXBar)
    }

    const prevVisible = this.isXBarVisible
    const nextVisible = !this.hideXBar && (
      prevVisible
        ? this.width > this.viewportWidth - this.hysteresisPx
        : this.width > this.viewportWidth + this.hysteresisPx
    )
    this.isXBarVisible = nextVisible

    if (prevVisible !== nextVisible) {
      this.emit('toggleXBarVisible', nextVisible)
    }

    if (!this.isXBarVisible) {
      return
    }

    const scrollMore = this.scrollMore?.x ?? 0

    const stepRatio = this.viewportWidth / (this.width + scrollMore)

    let x: number
    const move = (e: { x: number }): void => {
      const dx = e.x - x!

      // 基于trigger移动的距离转换为实际滚动距离
      const scrollMore = this.scrollMore?.x ?? 0
      const stepRatio = this.viewportWidth / (this.width + scrollMore)
      const scrollDx = dx / stepRatio

      this._scrollXByDistance(scrollDx)

      x += dx
    }

    const barX = -(this._wrapper.x / this._wrapper.width * this.viewportWidth)

    ;[this._scrollbarXBar, this._scrollbarXTrigger] = this._drawScrollbarHelper({
      rail: [0, this.viewportHeight - this.barHeight, this.viewportWidth, this.barHeight],
      bar: [barX, this.viewportHeight - this.barHeight, stepRatio * this.viewportWidth, this.barHeight, this.barHeight / 2],
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
        move({ x: x + moveX })
      },
    })

    this._scrollbarXBar.visible = !this.hideXBar

    this.container.rawAddChild(this._scrollbarXBar)
  }

  private _scrollbarYBar?: Container
  private _scrollbarYTrigger?: Graphics
  private _drawScrollYBar(): void {
    if (!this.viewportHeight)
      return

    if (this._scrollbarYBar) {
      this.container.rawRemoveChild(this._scrollbarYBar)
    }

    const prevVisible = this.isYBarVisible
    // 计算实际可用的视口高度，考虑X轴滚动条占用的空间
    const availableViewportHeight = this.viewportHeight - (this.isXBarVisible ? this.barHeight : 0)

    // 使用内容高度进行滚动条判断
    const nextVisible = !this.hideYBar && (
      prevVisible
        ? this.height > availableViewportHeight - this.hysteresisPx
        : this.height > availableViewportHeight + this.hysteresisPx
    )
    this.isYBarVisible = nextVisible

    if (prevVisible !== nextVisible) {
      this.emit('toggleYBarVisible', nextVisible)
    }

    if (!this.isYBarVisible) {
      return
    }

    const scrollMore = this.scrollMore?.y ?? 0

    // 使用相同的可用视口高度计算
    const availableViewportHeightForRatio = this.viewportHeight - (this.isXBarVisible ? this.barHeight : 0)
    const stepRatio = availableViewportHeightForRatio / (this.height + scrollMore)

    let y: number
    const move = (e: { y: number }): void => {
      const dy = e.y - y!

      // 基于trigger移动的距离转换为实际滚动距离
      const scrollMore = this.scrollMore?.y ?? 0
      const stepRatio = this.viewportHeight / (this.height + scrollMore)
      const scrollDy = dy / stepRatio

      this._scrollYByDistance(scrollDy)

      y += dy
    }

    const barY = -(this._wrapper.y / this._wrapper.height * this.viewportHeight)

    ;[this._scrollbarYBar, this._scrollbarYTrigger] = this._drawScrollbarHelper({
      rail: [this.viewportWidth - this.barWidth, 0, this.barWidth, this.viewportHeight],
      bar: [this.viewportWidth - this.barWidth, barY, this.barWidth, stepRatio * this.viewportHeight, this.barWidth / 2],
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
        move({ y: y + moveY })
      },
    })

    this._scrollbarYBar.visible = !this.hideYBar

    this.container.rawAddChild(this._scrollbarYBar)
  }

  private _bindEvents(): void {
    let lockDirection: 'x' | 'y' | null = null
    this.container.on('wheel', (e) => {
      e.preventDefault()

      const absX = Math.abs(e.deltaX)
      const absY = Math.abs(e.deltaY)

      let direction = (absX > absY ? 'x' : 'y') as 'x' | 'y'

      if (lockDirection && absX === absY) {
        /*
          优化触摸板, 体验更佳
          如果滚动距离一样则沿用上一次的滚动方向
          只有当有明显的滚动方向的改变时才会改变
        */
        direction = lockDirection
      }

      if (lockDirection === 'x') {
        this.scroll({ x: e.deltaX })
      }
      else {
        this.scroll({ y: e.deltaY })
      }

      lockDirection = direction
    })
  }

  scroll({ x, y }: { x?: number, y?: number }): void {
    if (typeof x === 'number') {
      this._scrollXByDistance(x)
    }

    if (typeof y === 'number') {
      this._scrollYByDistance(y)
    }
  }

  /**
   * 基于像素距离的水平滚动方法
   */
  private _scrollXByDistance(dx: number): void {
    if (!this.isXBarVisible)
      return

    const scrollMore = this.scrollMore?.x ?? 0
    const stepRatio = this.viewportWidth / (this.width + scrollMore)

    // 计算trigger需要移动的距离
    const triggerDx = dx * stepRatio

    // 获取trigger的当前位置
    if (!this._scrollbarXTrigger)
      return

    const trigger = this._scrollbarXTrigger

    // 限制trigger移动范围
    const newTriggerX = Math.max(
      0,
      Math.min(this.viewportWidth - trigger.width, trigger.x + triggerDx),
    )

    // 计算trigger实际移动的距离
    const actualTriggerDx = newTriggerX - trigger.x

    // 更新trigger位置
    trigger.x = newTriggerX

    // 根据trigger实际移动距离计算wrapper的移动距离
    const wrapperDx = actualTriggerDx / stepRatio

    // 更新wrapper位置
    this._wrapper.x = -newTriggerX / stepRatio

    this.emit('scroll', { x: wrapperDx, y: 0 })
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
    const { width: containerWidth, height: containerHeight } = this._wrapper.getSize()
    if (containerWidth !== this.width || containerHeight !== this.height) {
      this._updateSize(containerWidth, containerHeight)
    }
  }

  updateScrollMore(scrollMore: { x?: number, y?: number }): void {
    const { x, y } = scrollMore

    let needRerender = false
    this.scrollMore ??= {}

    if (typeof x === 'number' && x !== this.scrollMore.x) {
      this.scrollMore.x = x
      needRerender = true
    }

    if (typeof y === 'number' && y !== this.scrollMore.y) {
      this.scrollMore.y = y
      needRerender = true
    }

    needRerender && this.queueRender()
  }

  nextRender(fn?: Anyfn): Promise<void> {
    return new Promise<void>((resolve) => {
      this._wrapper.onRender = () => {
        fn?.()

        // [ ]: https://github.com/pixijs/pixijs/pull/11627
        this._wrapper.onRender = null as any
        resolve()
      }
    })
  }

  /**
   * 基于像素距离的垂直滚动方法
   */
  private _scrollYByDistance(dy: number): void {
    if (!this._scrollbarYTrigger || !this.isYBarVisible)
      return

    const scrollMore = this.scrollMore?.y ?? 0
    const stepRatio = this.viewportHeight / (this.height + scrollMore)

    // 计算trigger需要移动的距离
    const triggerDy = dy * stepRatio

    // 获取trigger的当前位置
    const trigger = this._scrollbarYTrigger

    // 限制trigger移动范围
    const newTriggerY = Math.max(
      0,
      Math.min(this.viewportHeight - trigger.height, trigger.y + triggerDy),
    )

    // 计算trigger实际移动的距离
    const actualTriggerDy = newTriggerY - trigger.y

    // 更新trigger位置
    trigger.y = newTriggerY

    // 根据trigger实际移动距离计算wrapper的移动距离
    const wrapperDy = actualTriggerDy / stepRatio

    // 更新wrapper位置
    this._wrapper.y = -newTriggerY / stepRatio

    this.emit('scroll', { x: 0, y: wrapperDy })
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

    this._updateBackground()
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
    this._updateBackground()
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

  /**
   * 同步渲染方法，在需要确保渲染立即完成时使用
   */
  renderSync(): void {
    this._queueRenderId && cancelAnimationFrame(this._queueRenderId)
    this.render()
  }

  /**
   * 翻到下一页
   */
  turnToNextPage(): void {
    if (!this.isXBarVisible)
      return

    // 直接滚动一个视口宽度的距离
    this._scrollXByDistance(this.viewportWidth)
  }

  /**
   * 翻到上一页
   */
  turnToPrevPage(): void {
    if (!this.isXBarVisible)
      return

    // 直接滚动一个视口宽度的距离
    this._scrollXByDistance(-this.viewportWidth)
  }

  /**
   * 获取当前滚动位置
   */
  getCurrentScrollX(): number {
    return -this._wrapper.x
  }
}
