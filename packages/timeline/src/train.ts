import { drag } from '@clippa/utils'
import { Container, Graphics } from 'pixi.js'

export const TRAIN_HEIGHT = 36

export const RESIZE_TRIGGER_WIDTH = 16

export class Train {
  container: Container = new Container()

  width: number = 100

  constructor() {
    this._drawResizer()

    this._drawSlot()
    this.container.y = 2
    this.container.x = Math.random() * 300
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
    this._slot.fill('#c98c8cff')
    this._slot.eventMode = 'static'
    this._slot.cursor = 'move'

    this.container.addChild(this._slot)
    this._bindDrag(this._slot)
  }

  private _bindDrag(traget: Graphics): void {
    drag(traget, {
      move: (_, { dx }) => {
        this.container.x += dx
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
}
