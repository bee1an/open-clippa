import { Container, Graphics } from 'pixi.js'

export const RAIL_HEIGHT = 40

export interface RailOption {
  width: number
  y: number
}

export class Rail {
  container: Container = new Container()

  width: number
  y: number

  constructor(option: RailOption) {
    this.width = option.width
    this.y = option.y

    this._drawBody()
  }

  private _drawBody(): void {
    const body = new Graphics()

    body.rect(0, this.y, this.width, RAIL_HEIGHT)
    body.fill('#9898d7ff')

    this.container.addChild(body)
  }
}
