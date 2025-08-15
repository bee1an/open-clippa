import { Container, Graphics } from 'pixi.js'
import { Train } from './train'

export const RAIL_HEIGHT = 40

export interface RailOption {
  width: number
  y: number
}

export class Rail {
  container: Container = new Container()
  width: number
  y: number
  trains: Train[] = []

  constructor(option: RailOption) {
    this.width = option.width
    this.y = option.y

    this.container.y = this.y

    this._drawBody()

    this.trains.push(new Train())
    this._renderTrains()
  }

  private _drawBody(): void {
    const body = new Graphics()

    body.rect(0, 0, this.width, RAIL_HEIGHT)
    body.fill('#9898d7ff')

    this.container.addChild(body)
  }

  private _renderTrains(): void {
    this.trains.forEach((train) => {
      this.container.addChild(train.container)
    })
  }
}
