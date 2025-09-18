import type { Rail } from '../rail'
import type { TrainDragStatus, TrainEvents, TrainOption } from './types'
import {
  TIMELINE_RESIZE_HANDLER_FILL,
  TIMELINE_RESIZE_HANDLER_WIDTH,
  TIMELINE_RESIZE_TRIGGER_WIDTH,
  TIMELINE_TRAIN_BORDER_SIZE,
  TIMELINE_TRAIN_HEIGHT,
  TIMELINE_TRAIN_RADIUS,
  TIMELINE_WIDGET_ACTIVE_FILL,
  TIMELINE_WIDGET_HOVER_FILL,
} from '@clippa/constants'
import { drag, EventBus, getMsByPx, getPxByMs } from '@clippa/utils'
import { Container, Graphics, Text } from 'pixi.js'
import { RAIL_HEIGHT } from '../rail'
import { State } from '../state'

let i = 0
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

  get active(): boolean {
    const state = State.getInstance()
    return state.activeTrain === this
  }

  constructor(option: TrainOption) {
    i++
    super()
    this.state = State.getInstance()
    this.state.on('updatedPxPerMs', (pxPerMs) => {
      this.updatePos(getPxByMs(option.start, pxPerMs))
      this.updateWidth(getPxByMs(option.duration, pxPerMs))
    })

    this.id = option.id
    this.x = getPxByMs(option.start, this.state.pxPerMs)
    this.width = getPxByMs(option.duration, this.state.pxPerMs)
    this.start = option.start
    this.duration = option.duration
    this.height = option.height ?? TIMELINE_TRAIN_HEIGHT
    this._resizeHandlerHeight = this.height / 1.7
    this.y = (RAIL_HEIGHT - this.height) / 2

    this.container = new Container({ x: this.x, y: this.y, label: 'train' })
    this.container.eventMode = 'static'
    this._bindEvents()
    this._drawSlot()

    this._drawWidget()

    const text = new Text({
      text: i,
      x: 20,
      y: this.height / 2 - 8,
      zIndex: 1,
      style: { fontSize: 14, fill: 'gray' },
    })
    this.container.addChild(text)
  }

  protected _slot!: Container
  private _slotBg!: Graphics
  private _slotMask!: Graphics
  /**
   * draw main container
   */
  private _drawSlot(width = this.width): void {
    if (!width)
      return

    const w = width
    const h = this.height
    const fill = '#010101' // any color

    if (this._slot) {
      this._slotBg
        .clear()
        .roundRect(0, 0, w, h, TIMELINE_TRAIN_RADIUS)
        .fill(fill)

      this._slotMask.clear()
        .roundRect(0, 0, w, h, TIMELINE_TRAIN_RADIUS)
        .fill('transparent')
      return
    }

    this._slot = new Container({ label: 'slot' })
    this.container.addChild(this._slot)

    this._slot.position.set(0, 0)

    // 创建背景
    this._slotBg = new Graphics()
    this._slot.addChild(this._slotBg)
    this._slotBg.roundRect(0, 0, w, h, TIMELINE_TRAIN_RADIUS)
      .fill(fill)

    // 创建mask
    this._slotMask = new Graphics()
    this._slot.addChild(this._slotMask)
    this._slotMask.roundRect(0, 0, w, h, TIMELINE_TRAIN_RADIUS)
      .fill('transparent')

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
    resizerMain.roundRect(0, 0, w, h, TIMELINE_TRAIN_RADIUS)
      .fill(this.active ? TIMELINE_WIDGET_ACTIVE_FILL : TIMELINE_WIDGET_HOVER_FILL)
    resizer.addChild(resizerMain)

    const handlerWidth = TIMELINE_RESIZE_HANDLER_WIDTH
    const handlerHeight = this._resizeHandlerHeight
    const handlerRadius = handlerWidth / 2

    const resizerHandler = new Graphics()
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
    mask.rect(maskX, 0, w / 2, h).fill('transparent')
    resizer.addChild(mask)
    resizerMain.setMask({ mask, inverse: true })

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
    const radius = TIMELINE_TRAIN_RADIUS

    if (!this._leftResizer) {
      [this._leftResizer, this._leftResizerMain] = this._drawResizerHelper(0, 0, triggerWidth, this.height)
      this._bindLeftResize(this._leftResizer)
    }
    else {
      this._leftResizerMain
        .clear()
        .roundRect(0, 0, triggerWidth, this.height, radius)
        .fill(fillStyle)
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
        .roundRect(0, 0, triggerWidth, this.height, radius)
        .fill(fillStyle)
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

    const update = (): void => {
      this._borderMain
        .roundRect(
          -TIMELINE_TRAIN_BORDER_SIZE,
          -TIMELINE_TRAIN_BORDER_SIZE,
          width + TIMELINE_TRAIN_BORDER_SIZE * 2,
          height + TIMELINE_TRAIN_BORDER_SIZE * 2,
          TIMELINE_TRAIN_RADIUS,
        )
        .fill(this.active ? TIMELINE_WIDGET_ACTIVE_FILL : TIMELINE_WIDGET_HOVER_FILL)

      this._borderMask
        .roundRect(
          0,
          0,
          width,
          height,
          TIMELINE_TRAIN_RADIUS,
        )
        .fill('transparent ')
    }

    if (this._borderContainer) {
      this._borderMain.clear()
      this._borderMask.clear()

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
          this.container.y = (RAIL_HEIGHT - this.height) / 2
        }

        this.x = site.xValue
        this.y = site.yValue

        this.emit('afterMove', this)
      },
      up: () => {
        this.state.setTrainDragging(false)
        this.state.setDraggingTrain(null)

        if (this.dragStatus === 'static') {
          this.updatePos(this.container.x, undefined, true)
        }
        else if (this.dragStatus === 'free') {
          // 如果是游离态, 恢复train为拖拽前的状态
          this._recordWhenDrag!.parent.insertTrain(this)
          this.updatePos(this._recordWhenDrag!.x, (RAIL_HEIGHT - this.height) / 2, true)
        }
        else {
          if (this.x !== this.container.x) {
            this.updatePos(this.container.x, undefined, true)
          }
          else {
            const newStart = getMsByPx(this.x, this.state.pxPerMs)
            if (newStart !== this.start) {
              this.updateStart(getMsByPx(this.x, this.state.pxPerMs))
            }
          }
        }

        // 拖拽结束后将y值还原
        this.y = (RAIL_HEIGHT - this.height) / 2
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

        this.width = site.wValue
        this.x = site.xValue

        if (!site.disdrawable) {
          this.container.x = this.x

          this.updateWidth(this.width)
        }

        this._drawBorder()
      },
      up: () => {
        this.width = this.container.width
        this.x = this.container.x

        // TODO
        /*
          这里调用函数会触发事件
          但是这里其实是一个组合事件, 而不是先修改了start, 又修改了duration
        */
        this.updateStart(getMsByPx(this.x, this.state.pxPerMs))
        this.updateDuration(getMsByPx(this.width, this.state.pxPerMs))
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
          traget.x = this.width - TIMELINE_RESIZE_TRIGGER_WIDTH
        }

        this._drawBorder()
      },

      up: () => {
        this.width = this.container.width
        this.updateDuration(getMsByPx(this.width, this.state.pxPerMs))

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
  updateWidth(width: number, withEffect?: boolean): void {
    if (width === this.container.width)
      return

    this.width = width

    if (withEffect) {
      this.updateDuration(getMsByPx(this.width, this.state.pxPerMs))
    }

    this._drawSlot()

    this._rightResizer.x = width - TIMELINE_RESIZE_TRIGGER_WIDTH
  }

  /**
   * Updates the position of train
   *
   * If `withEffect` is true, then the start time of the train will be updated accordingly
   */
  updatePos(x?: number, y?: number, withEffect?: boolean): void {
    if (typeof x === 'number') {
      this.x = this.container.x = x

      if (withEffect) {
        this.updateStart(getMsByPx(this.x, this.state.pxPerMs))
      }
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
  updateStart(start: number, withEffect?: boolean): void {
    this.start = start

    if (withEffect) {
      this.x = this.container.x = getPxByMs(start, this.state.pxPerMs)
    }

    this.emit('startChanged')
  }

  /**
   * Updates the duration of the train
   *
   * If `withEffect` is true, will call `updateWidth`
   */
  updateDuration(duration: number, withEffect?: boolean): void {
    this.duration = duration

    if (withEffect) {
      this.updateWidth(getPxByMs(duration, this.state.pxPerMs))
    }

    this.emit('durationChanged')
  }

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
