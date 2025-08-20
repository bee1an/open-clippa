import { getPxByMs } from '@clippa/utils'
import { Container } from 'pixi.js'
import { Rail, RAIL_HEIGHT } from './rail'
import { RULER_HEIGHT } from './ruler'
import { State } from './state'

export interface RailsOption {
  screenWidth: number
  duration: number
}

export class Rails {
  container: Container

  rails: Rail[] = []

  state: State

  width!: number
  screenWidth: number

  duration: number

  constructor(option: RailsOption) {
    const processWidth = (): void => {
      this.width = getPxByMs(this.duration, this.state.pxPerMs)
    }

    this.state = State.getInstance()
    this.state.on('updatedPxPerMs', () => {
      processWidth()

      this.queueUpdate()
    })

    this.duration = option.duration
    processWidth()
    this.screenWidth = option.screenWidth
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
          duration: this.duration,
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
  updateScreenWidth(screenWidth: number): void {
    this.screenWidth = screenWidth

    this.queueUpdate()
  }

  private _requestAnimationFrameId: number | null = null
  queueUpdate(): void {
    this._requestAnimationFrameId && cancelAnimationFrame(this._requestAnimationFrameId)

    this._requestAnimationFrameId = requestAnimationFrame(() => {
      this.update()
    })
  }

  update(): void {
    this.rails.forEach((rail) => {
      rail.updateWidth(Math.max(this.width, this.screenWidth))
    })
  }
}
