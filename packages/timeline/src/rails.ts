import { Container } from 'pixi.js'
import { Rail, RAIL_HEIGHT } from './rail'
import { RULER_HEIGHT } from './ruler'
import { State } from './state'

export interface RailsOption {
  width: number
}

export class Rails {
  container: Container

  rails: Rail[] = []

  state: State = State.getInstance()

  width: number

  constructor(option: RailsOption) {
    this.width = option.width
    this.container = new Container({ y: RULER_HEIGHT })

    this._drawBody()

    this._bindEvents()
  }

  private _drawBody(): void {
    let y = 0
    for (let index = 0; index < 1; index++) {
      const rail = new Rail(
        {
          width: this.width,
          y,
          trainsOption: [
            { start: 100, duration: 1000 },
            { start: 2000, duration: 1500 },
            { start: 5000, duration: 2000 },
          ],
        },
      )

      this.rails.push(rail)

      this.container.addChild(rail.container)
      y += RAIL_HEIGHT + 10
    }
  }

  private _bindEvents(): void {
    this.rails.forEach((rail) => {
      // 如果有train离开, 则将这个train设置为游离状态
      rail.on('trainLeave', (train) => {
        train.updatePos(undefined, rail.y + train.y)
        train.updateState('free')

        this.container.addChild(train.container)
      })
    })

    this.container.eventMode = 'static'
    this.container.on('pointermove', (e) => {
      if (!this.state.trainDragging)
        return

      const { x, y } = e.getLocalPosition(this.container)

      const rail = this.rails.find((rail) => {
        const bounds = rail.container.getLocalBounds()
        bounds.y = rail.y

        return rail.container.getLocalBounds().containsPoint(x, y)
      })

      const atTrain = this.state.atDragTrain!

      if (rail && !rail.trains.includes(atTrain)) {
        rail.insertTrain(atTrain)

        atTrain.updateState('normal')
        atTrain.updatePos(undefined, atTrain.y - rail.y)
      }
    })
  }

  /**
   * 更新宽度
   */
  updateWidth(width: number): void {
    this.width = width

    this.rails.forEach(rail => rail.updateWidth(width))
  }
}
