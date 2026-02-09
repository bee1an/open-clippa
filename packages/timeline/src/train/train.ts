import type { Rail } from '../rail'
import type { TrainDragStatus, TrainEvents, TrainOption, TrainRailStyle } from './types'
import {
  DEBUG,
  TIMELINE_RESIZE_HANDLER_FILL,
  TIMELINE_RESIZE_HANDLER_WIDTH,
  TIMELINE_RESIZE_TRIGGER_WIDTH,
  TIMELINE_TRAIN_BORDER_SIZE,
  TIMELINE_TRAIN_HEIGHT,
  TIMELINE_TRAIN_RADIUS,
  TIMELINE_TRAIN_SLOT_FILL,
  TIMELINE_WIDGET_ACTIVE_FILL,
  TIMELINE_WIDGET_HOVER_FILL,
} from '@clippa/constants'
import { drag, EventBus, getMsByPx, getPxByMs } from '@clippa/utils'
import { Container, Graphics, HTMLText, Rectangle } from 'pixi.js'
import { getRailHeightByStyle } from '../rail'
import { State } from '../state'

type TrainCornerRadius = {
  topLeft: number
  topRight: number
  bottomRight: number
  bottomLeft: number
}

export class Train<T extends TrainEvents = TrainEvents> extends EventBus<T> {
  /**
   * id
   */
  id: string
  /**
   * source, for thumbnail
   */
  src?: string
  /**
   * pixi container
   */
  container: Container
  /**
   * width based on the duration
   */
  width: number
  /**
   * x position
   */
  x: number
  /**
   * y position
   */
  y: number
  /**
   * current status when dragging
   */
  dragStatus: TrainDragStatus = 'normal'
  /**
   * global state
   */
  state: State
  /**
   * parent rail
   */
  parent: Rail | null = null
  /**
   * rail visual style
   */
  railStyle: TrainRailStyle
  /**
   * start time(ms)
   */
  start: number
  /**
   * total duration(ms)
   */
  duration: number
  /**
   * train height
   */
  height: number
  /**
   * resizer handler height
   */
  private _resizeHandlerHeight: number
  private _joinLeft: boolean = false
  private _joinRight: boolean = false

  get active(): boolean {
    const state = State.getInstance()
    return state.activeTrain === this
  }

  constructor(option: TrainOption) {
    super()
    this.state = State.getInstance()
    this.state.on('updatedPxPerMs', (pxPerMs) => {
      this.updatePos(getPxByMs(this.start, pxPerMs))
      this.updateWidth(getPxByMs(this.duration, pxPerMs))
    })

    this.id = option.id
    this.x = getPxByMs(option.start, this.state.pxPerMs)
    this.width = getPxByMs(option.duration, this.state.pxPerMs)
    this.start = option.start
    this.duration = option.duration
    this.railStyle = option.railStyle ?? 'default'
    this.height = option.height ?? TIMELINE_TRAIN_HEIGHT
    this._resizeHandlerHeight = this.height / 1.7
    this.y = this._getCenterYInRail()

    this.container = new Container({ x: this.x, y: this.y, label: 'train' })
    this.container.eventMode = 'static'
    this._bindEvents()
    this._drawSlot()

    this._drawWidget()

    this._debugHelper()
  }

  protected _slot!: Container
  private _slotBg!: Graphics
  private _slotMask!: Graphics
  protected _getTrainCornerRadius(): TrainCornerRadius {
    const radius = TIMELINE_TRAIN_RADIUS

    return {
      topLeft: this._joinLeft ? 0 : radius,
      topRight: this._joinRight ? 0 : radius,
      bottomRight: this._joinRight ? 0 : radius,
      bottomLeft: this._joinLeft ? 0 : radius,
    }
  }

  protected _drawRoundedRectByCorner(
    target: Graphics,
    x: number,
    y: number,
    width: number,
    height: number,
    radius: TrainCornerRadius,
  ): void {
    target.roundShape(
      [
        { x, y, radius: radius.topLeft },
        { x: x + width, y, radius: radius.topRight },
        { x: x + width, y: y + height, radius: radius.bottomRight },
        { x, y: y + height, radius: radius.bottomLeft },
      ],
      0,
    )
  }

  private _getResizerCornerRadius(location: 'left' | 'right'): TrainCornerRadius {
    const radius = TIMELINE_TRAIN_RADIUS

    if (location === 'left') {
      const leftRadius = this._joinLeft ? 0 : radius
      return {
        topLeft: leftRadius,
        topRight: 0,
        bottomRight: 0,
        bottomLeft: leftRadius,
      }
    }

    const rightRadius = this._joinRight ? 0 : radius
    return {
      topLeft: 0,
      topRight: rightRadius,
      bottomRight: rightRadius,
      bottomLeft: 0,
    }
  }

  /**
   * draw main container
   */
  private _drawSlot(width = this.width): void {
    if (!width)
      return

    const w = width
    const h = this.height
    const fill = TIMELINE_TRAIN_SLOT_FILL
    const cornerRadius = this._getTrainCornerRadius()

    if (this._slot) {
      this._slotBg
        .clear()
      this._drawRoundedRectByCorner(this._slotBg, 0, 0, w, h, cornerRadius)
      this._slotBg.fill(fill)

      this._slotMask.clear()
      this._drawRoundedRectByCorner(this._slotMask, 0, 0, w, h, cornerRadius)
      this._slotMask.fill('transparent')
      return
    }

    this._slot = new Container({ label: 'slot' })
    this.container.addChild(this._slot)

    this._slot.position.set(0, 0)

    // 创建背景
    this._slotBg = new Graphics()
    this._slot.addChild(this._slotBg)
    this._drawRoundedRectByCorner(this._slotBg, 0, 0, w, h, cornerRadius)
    this._slotBg.fill(fill)

    // 创建mask
    this._slotMask = new Graphics()
    this._slot.addChild(this._slotMask)
    this._drawRoundedRectByCorner(this._slotMask, 0, 0, w, h, cornerRadius)
    this._slotMask.fill('transparent')

    // 设置mask
    this._slot.mask = this._slotMask

    this._slot.eventMode = 'static'
    this._slot.cursor = 'move'
    this._bindSlotDrag(this._slot)
  }

  /**
   * draw a resizer helper
   */
  private _drawResizerHelper(...[x, _, w, h, location = 'left']: [x: number, y: number, w: number, h: number, location?: 'left' | 'right']): [Container, Graphics] {
    const resizer = new Container({ label: `${location}-resizer` })
    resizer.x = x
    resizer.eventMode = 'static'
    resizer.cursor = 'ew-resize'

    const resizerMain = new Graphics()
    resizerMain.eventMode = 'none'
    this._drawRoundedRectByCorner(
      resizerMain,
      0,
      0,
      w,
      h,
      this._getResizerCornerRadius(location),
    )
    resizerMain.fill(this.active ? TIMELINE_WIDGET_ACTIVE_FILL : TIMELINE_WIDGET_HOVER_FILL)
    resizer.addChild(resizerMain)

    const handlerWidth = TIMELINE_RESIZE_HANDLER_WIDTH
    const handlerHeight = this._resizeHandlerHeight
    const handlerRadius = handlerWidth / 2

    const resizerHandler = new Graphics()
    resizerHandler.eventMode = 'none'
    resizerHandler.roundRect(0, 0, handlerWidth, handlerHeight, handlerRadius)
      .fill(TIMELINE_RESIZE_HANDLER_FILL)

    const handlerX = w / 4 - handlerWidth / 2 + (location === 'left' ? 0 : w / 2)
    const handlerY = (h - handlerHeight) / 2
    resizerHandler.position.set(handlerX, handlerY)
    resizer.addChild(resizerHandler)

    // TODO
    /*
      会造成一个bug, mask区域可以触发事件, resizer的可视区域反而不能触发事件
      应该是inverse导致了计算错误
    */
    const maskX = location === 'left' ? w / 2 : 0
    const mask = new Graphics({ label: 'mask' })
    mask.eventMode = 'none'
    mask.rect(maskX, 0, w / 2, h).fill('transparent')
    resizer.addChild(mask)
    resizerMain.setMask({ mask, inverse: true })
    const hitAreaX = location === 'left' ? 0 : w / 2
    resizer.hitArea = new Rectangle(hitAreaX, 0, w / 2, h)

    this._widget.addChild(resizer)
    return [resizer, resizerMain]
  }

  private _leftResizer!: Container
  private _leftResizerMain!: Graphics
  private _rightResizer!: Container
  private _rightResizerMain!: Graphics
  /**
   * include left resizer and right resizer
   */
  private _drawResizer(): void {
    const fillStyle = this.active ? TIMELINE_WIDGET_ACTIVE_FILL : TIMELINE_WIDGET_HOVER_FILL
    const triggerWidth = TIMELINE_RESIZE_TRIGGER_WIDTH

    if (!this._leftResizer) {
      [this._leftResizer, this._leftResizerMain] = this._drawResizerHelper(0, 0, triggerWidth, this.height)
      this._bindLeftResize(this._leftResizer)
    }
    else {
      this._leftResizerMain
        .clear()
      this._drawRoundedRectByCorner(
        this._leftResizerMain,
        0,
        0,
        triggerWidth,
        this.height,
        this._getResizerCornerRadius('left'),
      )
      this._leftResizerMain.fill(fillStyle)
    }

    if (!this._rightResizer) {
      const rightX = Math.max(this.width - triggerWidth, 0)
      ;[this._rightResizer, this._rightResizerMain] = this._drawResizerHelper(
        rightX,
        0,
        triggerWidth,
        this.height,
        'right',
      )
      this._bindRightResize(this._rightResizer)
    }
    else {
      this._rightResizerMain
        .clear()
      this._drawRoundedRectByCorner(
        this._rightResizerMain,
        0,
        0,
        triggerWidth,
        this.height,
        this._getResizerCornerRadius('right'),
      )
      this._rightResizerMain.fill(fillStyle)
    }
  }

  private _borderContainer!: Container
  private _borderMain!: Graphics
  private _borderMask!: Graphics
  /**
   * draw border
   */
  private _drawBorder(): void {
    const { width, height } = this._slot
    const cornerRadius = this._getTrainCornerRadius()

    const update = (): void => {
      this._borderMain
        .clear()
      this._drawRoundedRectByCorner(
        this._borderMain,
        -TIMELINE_TRAIN_BORDER_SIZE,
        -TIMELINE_TRAIN_BORDER_SIZE,
        width + TIMELINE_TRAIN_BORDER_SIZE * 2,
        height + TIMELINE_TRAIN_BORDER_SIZE * 2,
        cornerRadius,
      )
      this._borderMain.fill(this.active ? TIMELINE_WIDGET_ACTIVE_FILL : TIMELINE_WIDGET_HOVER_FILL)

      this._borderMask
        .clear()
      this._drawRoundedRectByCorner(
        this._borderMask,
        0,
        0,
        width,
        height,
        cornerRadius,
      )
      this._borderMask.fill('transparent ')
    }

    if (this._borderContainer) {
      update()

      return
    }

    this._borderContainer = new Container({ label: 'border' })
    this._borderContainer.eventMode = 'none'
    this._widget.addChild(this._borderContainer)

    this._borderMask = new Graphics()
    this._borderContainer.addChild(this._borderMask)

    this._borderMain = new Graphics()
    this._borderContainer.addChild(this._borderMain)

    update()

    this._borderMain.setMask({ mask: this._borderMask, inverse: true })
  }

  private _widget: Container = new Container({ visible: false, label: 'widget' })
  private _drawWidget(): void {
    this._drawResizer()
    this._drawBorder()

    this.container.addChild(this._widget)
  }

  /**
   * 记录拖拽前的状态
   *
   * 如果拖转结束后train的状态是游离态, 那么会将train恢复为这个状态
   * 这里不要y的原因是, y在常态下固定为2
   */
  private _recordWhenDrag: { x: number, parent: Rail } | null = null
  private _getRailHeight(): number {
    return this.parent?.height ?? getRailHeightByStyle(this.railStyle)
  }

  private _getCenterYInRail(): number {
    return (this._getRailHeight() - this.height) / 2
  }

  syncRailY(): void {
    const centerY = this._getCenterYInRail()
    this.y = centerY
    this.container.y = centerY
  }

  private _resolveStartByVisualX(visualX: number): number {
    if (!this.parent)
      return getMsByPx(visualX, this.state.pxPerMs)

    return this.parent.getRawMsByVisualPx(this, visualX)
  }

  /**
   * bind drag event
   */
  private _bindSlotDrag(traget: Container): void {
    drag(traget, {
      down: () => {
        this.state.setTrainDragging(true)
        this.state.setDraggingTrain(this)

        this._recordWhenDrag = {
          x: this.x,
          parent: this.parent!,
        }

        this.emit('moveStart')
      },
      move: (_, { dx, dy }) => {
        const site = { xValue: this.x + dx, yValue: this.y + dy }

        this.emit('beforeMove', site, this)

        if (this.dragStatus !== 'static') {
          // 静态态不允许移动
          this.container.x = Math.max(site.xValue, 0)
        }

        if (this.dragStatus === 'free') {
          // 游离态时将设置y的值
          this.container.y = site.yValue
        }
        else {
          // 否则y为固定值
          this.container.y = this._getCenterYInRail()
        }

        this.x = site.xValue
        this.y = site.yValue

        this.emit('afterMove', this)
      },
      up: () => {
        this.state.setTrainDragging(false)
        this.state.setDraggingTrain(null)

        if (this.dragStatus === 'static') {
          this.updatePos(this.container.x, undefined)

          this.start = this._resolveStartByVisualX(this.x)
        }
        else if (this.dragStatus === 'free') {
          // 如果是游离态, 恢复train为拖拽前的状态
          this._recordWhenDrag!.parent.insertTrain(this)
          this.updatePos(this._recordWhenDrag!.x, this._getCenterYInRail())

          this.start = this._resolveStartByVisualX(this.x)
        }
        else {
          if (this.x !== this.container.x) {
            this.updatePos(this.container.x, undefined)

            this.start = this._resolveStartByVisualX(this.x)
          }
          else {
            const newStart = this._resolveStartByVisualX(this.x)
            if (newStart !== this.start) {
              this.start = newStart
            }
          }
        }

        // 拖拽结束后将y值还原
        this.y = this._getCenterYInRail()
        this.updatePos(undefined, this.y)

        this.updateState('normal')
        this.emit('moveEnd', this)
      },
    })
  }

  /**
   * bind left risize handle
   */
  private _bindLeftResize(traget: Container): void {
    drag(traget, {
      move: (_, { dx }) => {
        const site = {
          wValue: this.width - dx,
          xValue: this.x + dx,
          disdrawable: false,
        }

        this.emit('beforeLeftResize', site, this)

        if (!site.disdrawable) {
          this.container.x = site.xValue
          this.updateWidth(site.wValue)
        }

        this.width = site.wValue
        this.x = site.xValue
      },
      up: () => {
        this.width = this._slot.width
        this.x = this.container.x

        this.start = this._resolveStartByVisualX(this.x)
        this.duration = getMsByPx(this.width, this.state.pxPerMs)
        this.emit('leftResizeEnd', this)
      },
    })
  }

  /**
   * bind right resize handle
   */
  private _bindRightResize(traget: Container): void {
    drag(traget, {
      down: () => {
        this.emit('rightResizeStart', this)
      },
      move: (_, { dx }) => {
        const site = {
          wValue: this.width + dx,
          disdrawable: false,
        }
        this.emit('beforeRightResize', site, this)

        this.width = site.wValue

        if (!site.disdrawable) {
          this._drawSlot()
          this._drawBorder()
          traget.x = this.width - TIMELINE_RESIZE_TRIGGER_WIDTH
        }
      },

      up: () => {
        this.width = this._slot.width
        this.duration = getMsByPx(this.width, this.state.pxPerMs)

        this.emit('rightResizeEnd', this)
      },
    })
  }

  private _pointerIn: boolean = false
  private _bindEvents(): void {
    this.container.on('pointerenter', () => {
      this._widget.visible = true
      this._pointerIn = true
    })
    this.container.on('pointerleave', () => {
      this._pointerIn = false

      if (this.active)
        return

      this._widget.visible = false
    })
    this.container.on('pointerdown', () => {
      this.updateActive(true)
    })
  }

  updateActive(active: boolean): void {
    const state = State.getInstance()

    if (active === (state.activeTrain === this))
      return

    if (active) {
      // 取消上一个选中
      state.activeTrain?.updateActive (false)

      state.setActiveTrain(this)
      this._widget.visible = true
    }
    else if (state.activeTrain === this) {
      state.setActiveTrain(null)
    }

    if (!active && !this._pointerIn) {
      // 取消选中时, 当前鼠标并不在train内部则隐藏widget
      this._widget.visible = false
    }

    this._drawWidget()
  }

  /**
   * update the width of train
   *
   * if `withEffect` is true, the duration will be updated accordingly
   */
  updateWidth(width: number): void {
    if (width === this._slot.width)
      return

    this.width = width

    this._drawSlot()

    this._drawBorder()

    this._rightResizer.x = width - TIMELINE_RESIZE_TRIGGER_WIDTH
  }

  updateJoinState(joinLeft: boolean, joinRight: boolean): void {
    if (this._joinLeft === joinLeft && this._joinRight === joinRight)
      return

    this._joinLeft = joinLeft
    this._joinRight = joinRight

    this._drawSlot()
    this._drawBorder()
    this._drawResizer()
    this._onJoinStateUpdated()
  }

  protected _onJoinStateUpdated(): void {}

  /**
   * Updates the position of train
   *
   * If `withEffect` is true, then the start time of the train will be updated accordingly
   */
  updatePos(x?: number, y?: number): void {
    if (typeof x === 'number') {
      this.x = this.container.x = x
    }

    if (typeof y === 'number') {
      this.y = this.container.y = y
    }
  }

  /**
   * Updates the start time of the train
   *
   * If `withEffect` is true, then the x of the train will be updated accordingly
   */
  // updateStart(start: number, withEffect?: boolean): void {
  //   this.start = start

  //   if (withEffect) {
  //     this.x = this.container.x = getPxByMs(start, this.state.pxPerMs)
  //   }
  // }

  /**
   * Updates the duration of the train
   *
   * If `withEffect` is true, will call `updateWidth`
   */
  // updateDuration(duration: number, withEffect?: boolean): void {
  //   this.duration = duration

  //   if (withEffect) {
  //     this.updateWidth(getPxByMs(duration, this.state.pxPerMs))
  //   }
  // }

  /**
   * 修改状态
   */
  updateState(state: TrainDragStatus): void {
    this.dragStatus = state

    if (state === 'translucent' || state === 'free') {
      this.container.alpha = 0.5
      return
    }

    this.container.alpha = 1
  }

  private _debugText?: HTMLText
  private _debugHelper(): void {
    if (!DEBUG)
      return

    const text = ([
      'id',
      'start',
      'duration',
    ] as const).reduce(
      (str, key) => `${str}<b style="color: red">${key.slice(0, 2)}</b>: ${this[key]} `,
      '',
    )

    if (!this._debugText) {
      this._debugText = new HTMLText({
        text,
        x: 20,
        zIndex: 1,
        style: { fontSize: 12, fill: TIMELINE_WIDGET_ACTIVE_FILL },
        label: 'train-debug',
        eventMode: 'none',
      })
    }
    else {
      this._debugText.text = text
    }

    this.container.addChild(this._debugText)
    this.container.sortChildren()

    requestAnimationFrame(() => {
      this._debugHelper()
    })
  }

  /**
   * Returns a JSON object representing the train.
   */
  toJson(): TrainOption {
    return {
      id: this.id,
      start: this.start,
      duration: this.duration,
      height: this.height,
    }
  }
}
