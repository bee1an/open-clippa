import { Container, Graphics } from 'pixi.js'

export interface CursorOption {
  duration: number
  height: number
}

export class Cursor {
  container: Container
  duration: number

  constructor(option: CursorOption) {
    this.duration = option.duration

    this.container = new Container()
    this.container.cursor = 'pointer'
    this.container.eventMode = 'static'

    this._bindDrag()

    this._draw()
    this._drawBody(option.height)
  }

  private _draw(): void {
    const graphics = new Graphics()
    graphics.roundRect(0, 0, 20, 20, 6)
    graphics.fill('#fff')

    graphics.poly([0, 17, 20, 17, 10, 26])
    graphics.fill('#fff')

    this.container.addChild(graphics)
  }

  private _body?: Graphics
  private _drawBody(height: number): void {
    height -= 2

    if (this._body) {
      this._body.height = height
      return
    }

    this._body = new Graphics()
    this._body.roundRect(8, 0, 4, height, 2)
    this._body.fill('#fff')

    this.container.addChild(this._body)
  }

  /**
   * 绑定拖拽事件
   */
  private _bindDrag(): void {
    let x
    const move = (e: PointerEvent): void => {
      const dx = e.x - x!

      const targetX = this.container.x + dx
      if (targetX >= 0) {
        // 坐边界判断
        this.container.x += dx
        x = e.x
      }
    }

    const up = (): void => {
      document.removeEventListener('pointermove', move)
      document.removeEventListener('pointerup', up)
    }

    this.container.on('pointerdown', (e) => {
      x = e.x
      document.addEventListener('pointermove', move)
      document.addEventListener('pointerup', up)
    })
  }

  updateHeight(height: number): void {
    this._drawBody(height)
  }
}
