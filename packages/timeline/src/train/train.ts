import type { Rail } from '../rail'
import type { TrainDragStatus, TrainEvents, TrainOption } from './types'
import { drag, EventBus, getMsByPx, getPxByMs } from '@clippa/utils'
import { Container, Graphics, Text } from 'pixi.js'
import { State } from '../state'

export const TRAIN_HEIGHT = 36

export const RESIZE_TRIGGER_WIDTH = 16

let i = 0
export class Train extends EventBus<TrainEvents> {
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
  x: number = Math.random() * 300
  /**
   * y position
   */
  y: number = 2
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

  constructor(option: TrainOption) {
    i++
    super()
    this.state = State.getInstance()
    this.state.on('updatedPxPerMs', (pxPerMs) => {
      this.updatePos(getPxByMs(option.start, pxPerMs))
      this.updateWidth(getPxByMs(option.duration, pxPerMs))
    })

    this.x = getPxByMs(option.start, this.state.pxPerMs)
    this.width = getPxByMs(option.duration, this.state.pxPerMs)
    this.start = option.start
    this.duration = option.duration

    this.container = new Container({ x: this.x, y: this.y })

    this._drawResizer()

    this._drawSlot()

    const text = new Text({
      text: i,
      x: 20,
      zIndex: 1,
      style: { fontSize: 14 },
    })
    this.container.addChild(text)
  }

  /**
   * draw a resizer helper
   */
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
  /**
   * include left resizer and right resizer
   */
  private _drawResizer(): void {
    this._leftResizer = this._drawResizerHelper(0, 0, RESIZE_TRIGGER_WIDTH, TRAIN_HEIGHT)
    this._bindLeftResize(this._leftResizer)

    this._rightResizer = this._drawResizerHelper(
      Math.max(this.width - RESIZE_TRIGGER_WIDTH, 0),
      0,
      RESIZE_TRIGGER_WIDTH,
      TRAIN_HEIGHT,
    )
    this._bindRightResize(this._rightResizer)
  }

  private _slot!: Graphics
  private _drawSlot(width = this.width): void {
    if (!width)
      return

    const x = RESIZE_TRIGGER_WIDTH / 2
    const y = 0
    const w = width - RESIZE_TRIGGER_WIDTH
    const h = TRAIN_HEIGHT
    const fill = '#c98c8c'

    if (this._slot) {
      this._slot
        .clear()
        .rect(x, y, w, h)
        .fill(fill)

      return
    }

    const slot = new Graphics()
    slot.rect(x, y, w, h)
      .fill(fill)
    slot.eventMode = 'static'
    slot.cursor = 'move'

    this.container.addChild(slot)

    this._slot = slot

    this._bindDrag(this._slot)
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
          this.container.x = Math.max(site.xValue, 0)
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
          this.updatePos(this._recordWhenDrag!.x, 2, true)
        }
        else {
          if (this.x !== this.container.x) {
            this.updatePos(this.container.x, undefined, true)
          }
          else {
            this.updateStart(getMsByPx(this.x, this.state.pxPerMs))
          }
        }

        // 拖拽结束后将y值还原
        this.y = 2
        this.updatePos(undefined, this.y)

        this.updateState('normal')
        this.emit('moveEnd', this)
      },
    })
  }

  /**
   * bind left risize handle
   */
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

        this.updateStart(getMsByPx(this.x, this.state.pxPerMs))
        this.updateDuration(getMsByPx(this.width, this.state.pxPerMs))
      },
    })
  }

  /**
   * bind right resize handle
   */
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
        this.updateDuration(getMsByPx(this.width, this.state.pxPerMs))

        this.emit('rightResizeEnd', this)
      },
    })
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

    this._rightResizer.x = width - RESIZE_TRIGGER_WIDTH
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
      start: this.start,
      duration: this.duration,
    }
  }
}
