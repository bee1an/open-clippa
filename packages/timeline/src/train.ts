import type { Rail } from './rail'
import { drag, EventBus, getPxByMs } from '@clippa/utils'
import { Container, Graphics, Text } from 'pixi.js'
import { State } from './state'

export const TRAIN_HEIGHT = 36

export const RESIZE_TRIGGER_WIDTH = 16

export interface TrainOption {
  start: number
  duration: number
}

export type TrainEvents = {
  /**
   * 拖拽开始
   */
  moveStart: []

  /**
   * 每一次移动前
   *
   * 这里使用对象的形式是为了让触发事件的时候可以修改这个参数
   */
  beforeMove: [{ xValue: number }, target: Train]

  /**
   * 拖拽结束
   */
  moveEnd: [target: Train]

  /**
   * 左侧调整器的值变化前
   */
  beforeLeftResize: [{ xValue: number, wValue: number, disdrawable: boolean }, target: Train]

  /**
   * 右侧调整器pointerdown
   */
  rightResizeStart: [target: Train]

  /**
   * 右侧调整器的值变化前
   */
  beforeRightResize: [{ wValue: number, disdrawable: boolean }, target: Train ]

  /**
   * 右侧调整器pointerup
   */
  rightResizeEnd: [target: Train]
}

export type TrainDragStatus
  = | 'normal' // 常规态
    | 'static' // 静态
    | 'translucent' // 半透明
    | 'free' // 游离

let i = 0
export class Train extends EventBus<TrainEvents> {
  container: Container

  width: number

  x: number = Math.random() * 300

  y: number = 2

  dragStatus: TrainDragStatus = 'normal'

  state: State

  parent: Rail | null = null

  start: number

  duration: number

  private _pxPerMs: number

  constructor(option: TrainOption) {
    i++
    super()
    this.state = State.getInstance()
    this.state.on('updatedPxPerMs', (pxPerMs) => {
      this._pxPerMs = pxPerMs

      this.updatePos(getPxByMs(option.start, pxPerMs))
      this.updateWidth(getPxByMs(option.duration, pxPerMs))
    })

    this._pxPerMs = this.state.pxPerMs

    this.x = getPxByMs(option.start, this._pxPerMs)
    this.width = getPxByMs(option.duration, this._pxPerMs)
    this.start = option.start
    this.duration = option.duration

    this.container = new Container({ x: this.x, y: this.y })

    this._drawResizer()

    this._drawSlot()

    const text = new Text({
      text: i,
      x: 20,
      style: { fontSize: 14 },
    })
    this.container.addChild(text)
  }

  private _drawResizerHelper(...[x, _, w, h]: [x: number, y: number, w: number, h: number]): Graphics {
    const resizer = new Graphics()
    resizer.roundRect(0, 0, w, h, 6)
    resizer.x = x
    resizer.fill('#6e3a3a')
    resizer.eventMode = 'static'
    resizer.cursor = 'ew-resize'
    this.container.addChild(resizer)
    return resizer
  }

  private _leftResizer!: Graphics
  private _rightResizer!: Graphics
  private _drawResizer(): void {
    this._leftResizer = this._drawResizerHelper(0, 0, RESIZE_TRIGGER_WIDTH, TRAIN_HEIGHT)
    this._bindLeftResize(this._leftResizer)

    this._rightResizer = this._drawResizerHelper(
      this.width - RESIZE_TRIGGER_WIDTH,
      0,
      RESIZE_TRIGGER_WIDTH,
      TRAIN_HEIGHT,
    )
    this._bindRightResize(this._rightResizer)
  }

  private _slot!: Graphics
  private _drawSlot(width = this.width): void {
    const slot = new Graphics()
    slot.rect(RESIZE_TRIGGER_WIDTH / 2, 0, width - RESIZE_TRIGGER_WIDTH, TRAIN_HEIGHT)
    slot.fill('#c98c8c')
    slot.eventMode = 'static'
    slot.cursor = 'move'

    if (this._slot) {
      this.container.replaceChild(this._slot, slot)
    }
    else {
      this.container.addChild(slot)
    }

    this._slot = slot

    this._bindDrag(this._slot)
  }

  updateWidth(width: number): void {
    if (width === this.container.width)
      return

    this.width = width

    this._drawSlot()

    this._rightResizer.x = width - RESIZE_TRIGGER_WIDTH
  }

  /**
   * 记录拖拽前的状态
   *
   * 如果拖转结束后train的状态是游离态, 那么会将train恢复为这个状态
   * 这里不要y的原因是, y在常态下固定为2
   */
  private _recordWhenDrag: { x: number, parent: Rail } | null = null
  private _bindDrag(traget: Graphics): void {
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
          this.container.x = site.xValue
        }

        if (this.dragStatus === 'free') {
          // 游离态时将设置y的值
          this.container.y = site.yValue
        }
        else {
          // 否则y为固定值
          this.container.y = 2
        }

        this.x = site.xValue
        this.y = site.yValue
      },
      up: () => {
        this.state.setTrainDragging(false)
        this.state.setDraggingTrain(null)

        if (this.dragStatus === 'static') {
          this.updatePos(this.container.x)
        }
        else if (this.dragStatus === 'free') {
          // 如果是游离态, 恢复train为拖拽前的状态
          this._recordWhenDrag!.parent.insertTrain(this)
          this.updatePos(this._recordWhenDrag!.x, 2)
        }

        // 拖拽结束后将y值还原
        this.y = 2

        this.updateState('normal')
        this.emit('moveEnd', this)
      },
    })
  }

  private _bindLeftResize(traget: Graphics): void {
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
      },
      up: () => {
        this.width = this.container.width
        this.x = this.container.x
      },
    })
  }

  private _bindRightResize(traget: Graphics): void {
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
          traget.x = this.width - RESIZE_TRIGGER_WIDTH
        }
      },

      up: () => {
        this.width = this.container.width
        this.emit('rightResizeEnd', this)
      },
    })
  }

  updatePos(x?: number, y?: number): void {
    if (typeof x === 'number') {
      this.x = this.container.x = x
    }

    if (typeof y === 'number') {
      this.y = this.container.y = y
    }
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
      start: this.start,
      duration: this.duration,
    }
  }
}
