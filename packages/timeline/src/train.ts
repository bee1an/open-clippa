import { drag, EventBus } from '@clippa/utils'
import { Container, Graphics, Text } from 'pixi.js'
import { State } from './state'

export const TRAIN_HEIGHT = 36

export const RESIZE_TRIGGER_WIDTH = 16

export interface TrainOption {
  x: number
  width: number
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
  beforeMove: [{ nextX: number }, target: Train]

  /**
   * 拖拽结束
   */
  moveEnd: [target: Train]
}

export type TrainState = 'normal' | 'static' | 'translucent'

let i = 0
export class Train extends EventBus<TrainEvents> {
  container: Container

  width: number

  x: number = Math.random() * 300

  status: TrainState = 'normal'

  state: State = State.getInstance()

  constructor(option: TrainOption) {
    i++
    super()
    this.x = option.x
    this.width = option.width

    this.container = new Container({ x: this.x, y: 2 })

    this._drawResizer()

    this._drawSlot()
  }

  private _drawResizerHelper(...rest: [x: number, y: number, w: number, h: number]): Graphics {
    const resizer = new Graphics()
    resizer.roundRect(...rest, 6)
    resizer.fill('#6e3a3aff')
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

    this._rightResizer = this._drawResizerHelper(this.width - RESIZE_TRIGGER_WIDTH, 0, RESIZE_TRIGGER_WIDTH, TRAIN_HEIGHT)
    this._bindRightResize(this._rightResizer)
  }

  private _slot!: Graphics
  private _drawSlot(): void {
    if (this._slot) {
      this._slot.removeFromParent()
    }

    this._slot = new Graphics()
    this._slot.rect(RESIZE_TRIGGER_WIDTH / 2, 0, this.width - RESIZE_TRIGGER_WIDTH, TRAIN_HEIGHT)
    this._slot.fill('#c98c8caa')
    this._slot.eventMode = 'static'
    this._slot.cursor = 'move'

    const text = new Text({
      text: i,
      x: 20,
      style: { fontSize: 14 },
    })

    this.container.addChild(this._slot)
    this.container.addChild(text)
    this._bindDrag(this._slot)
  }

  private _bindDrag(traget: Graphics): void {
    drag(traget, {
      down: () => {
        this.state.setTrainDragging(true)
        this.state.setDraggingTrain(this)
        this.emit('moveStart')
      },
      move: (_, { dx }) => {
        const site = { nextX: this.x + dx }
        this.emit('beforeMove', site, this)

        if (this.status !== 'static') {
          this.container.x = site.nextX
        }

        this.x = site.nextX
      },
      up: () => {
        this.state.setTrainDragging(false)
        this.state.setDraggingTrain(null)
        this.emit('moveEnd', this)
      },
    })
  }

  private _bindLeftResize(traget: Graphics): void {
    drag(traget, {
      move: (_, { dx }) => {
        this.container.x += dx
        this._rightResizer.x -= dx

        this.width -= dx
        this._drawSlot()
      },
    })
  }

  private _bindRightResize(traget: Graphics): void {
    drag(traget, {
      move: (_, { dx }) => {
        this.width += dx
        this._drawSlot()
        traget.x += dx
      },
    })
  }

  updateX(x: number): void {
    this.x = this.container.x = x
  }

  /**
   * 修改状态
   */
  updateState(state: TrainState): void {
    this.status = state

    if (state === 'translucent') {
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
      x: this.x,
      width: this.width,
    }
  }
}
