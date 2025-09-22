import { EventBus, getMsByPx, getPxByMs } from '@clippa/utils'
import { Container, Graphics } from 'pixi.js'
import { State } from './state'

export interface CursorOption {
  duration: number
  height: number
  screenWidth: number
}

export type CursorEvents = {
  seek: [number]
}

export class Cursor extends EventBus<CursorEvents> {
  container: Container
  currentTime: number = 0
  duration: number

  width!: number
  screenWidth: number

  state: State

  isDragging: boolean = false

  get pxPerMs(): number {
    return this.state.pxPerMs
  }

  constructor(option: CursorOption) {
    super()
    this.state = State.getInstance()

    this.state.on('updatedPxPerMs', () => this._processWidth())

    this.duration = option.duration
    this._processWidth()

    this.screenWidth = option.screenWidth

    this.container = new Container()
    this.container.cursor = 'pointer'
    this.container.eventMode = 'static'

    this._bindDrag()

    this._draw()
    this._drawBody(option.height)
  }

  private _processWidth(): void {
    this.width = getPxByMs(this.duration, this.state.pxPerMs)
  }

  private _draw(): void {
    const graphics = new Graphics()
    // 将图形向左移动10px，使中心对齐
    graphics.roundRect(-10, 0, 20, 20, 6)
    graphics.fill('#fff')

    graphics.poly([-10, 17, 10, 17, 0, 26])
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
    // 将竖条向左移动10px，使中心对齐
    this._body.roundRect(-2, 0, 4, height, 2)
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

      x = e.x

      this.container.x += dx

      // 左边界判断 (考虑光标宽度的一半)
      if (this.container.x < 0) {
        this.container.x = 0
      }

      // 右边界判断 (考虑光标宽度的一半)
      if (this.container.x > this.width) {
        this.container.x = this.width
      }

      this.currentTime = getMsByPx(this.container.x, this.pxPerMs)

      this.emit('seek', this.currentTime)
    }

    const up = (): void => {
      this.isDragging = false
      document.removeEventListener('pointermove', move)
      document.removeEventListener('pointerup', up)
    }

    this.container.on('pointerdown', (e) => {
      this.isDragging = true
      x = e.x
      document.addEventListener('pointermove', move)
      document.addEventListener('pointerup', up)
    })
  }

  updateWidth(width: number): void {
    this.width = width
  }

  updateScreenWidth(width: number): void {
    this.screenWidth = width
  }

  updateScreenHeight(height: number): void {
    this._drawBody(height)
  }

  updateScreenSize(screenWidth?: number, screenHeight?: number): void {
    if (screenWidth) {
      this.screenWidth = screenWidth
    }

    if (screenHeight) {
      this._drawBody(screenHeight)
    }
  }

  /**
   * Update the duration of the timeline
   */
  updateDuration(duration: number): void {
    this.duration = duration
    this._processWidth()
  }

  /**
   * 更新光标位置但不触发事件
   */
  updatePosition(time: number): void {
    // 边界判断
    if (time < 0) {
      time = 0
    }
    else if (time > this.duration) {
      time = this.duration
    }

    this.currentTime = time

    // 计算光标中心位置
    this.container.x = ((this.currentTime / this.duration) * this.width)
  }

  seek(time: number): void {
    this.updatePosition(time)
    this.emit('seek', this.currentTime)
  }
}
