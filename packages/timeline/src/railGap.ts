import { TIMELINE_GAP_ACTIVE_FILL } from '@clippa/constants'
import { Container, Graphics } from 'pixi.js'

export const GAP = 4

export interface RailGapOption {
  y: number
  width: number
  zIndex: number
}

export class RailGap {
  container: Container
  y: number
  width: number

  active: boolean = false

  zIndex: number

  constructor(option: RailGapOption) {
    this.y = option.y
    this.width = option.width
    this.zIndex = option.zIndex

    this.container = new Container({ y: option.y, label: 'label-gap' })

    this._drawBody()
  }

  private _bg?: Graphics
  private _drawBody(): void {
    if (this._bg) {
      this._bg
        .clear()
        .rect(0, 0, this.width, GAP)
        .fill(this.active ? TIMELINE_GAP_ACTIVE_FILL : 'transparent')
      return
    }

    const bg = new Graphics()
    bg.rect(0, 0, this.width, GAP)
      .fill('transparent')

    this.container.addChild(bg)
    this._bg = bg
  }

  render(): void {
    this._drawBody()
  }

  setActive(active: boolean): void {
    if (active === this.active)
      return

    this.active = active
    this._drawBody()
  }

  updateWidth(width: number): void {
    this.width = width

    this.render()
  }

  updateY(y: number): void {
    if (y === this.y)
      return

    this.y = y

    this.container.y = y
  }

  updateZIndex(zIndex: number): void {
    if (zIndex === this.zIndex)
      return

    this.zIndex = zIndex
  }
}
