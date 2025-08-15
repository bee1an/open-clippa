import { isIntersection } from '@clippa/utils'
import { Container, Graphics } from 'pixi.js'
import { Train } from './train'

export const RAIL_HEIGHT = 40

export const RAIL_COLOR = '#5f5f63ff'

export interface RailOption {
  width: number
  y: number
}

export class Rail {
  container: Container = new Container()
  width: number
  y: number

  /**
   * trains, is sorted
   */
  trains: Train[] = []

  constructor(option: RailOption) {
    this.width = option.width
    this.y = option.y

    this.container.y = this.y

    this._drawBody()

    this.trains.push(this._createTrain(100), this._createTrain(220, 200), this._createTrain(450, 250))

    this._renderTrains()
  }

  private _createTrain(x: number, w: number = 100): Train {
    const train = new Train({ x, width: w })

    train.on('beforeMove', (event) => {
      const intersectTrains = this.trains.filter((item) => {
        if (item === train)
          return false

        return isIntersection([event.nextX, event.nextX + train.width], [item.x, item.x + item.width])
      })

      if (intersectTrains.length === 0) {
        train.updateState('normal')
        return
      }

      const [minialXTrain] = intersectTrains.sort((a, b) => a.x - b.x)

      if (event.nextX <= minialXTrain.x) {
        train.updateState('translucent')
      }
      else {
        train.updateState('static')

        if (train.container.x !== minialXTrain.x + minialXTrain.width)
          train.container.x = minialXTrain.x + minialXTrain.width
      }
    })

    train.on('moveDown', () => {
      // 拖拽结束后
      // static 状态, 更新x的值为 container 的x
      if (train.state === 'static')
        train.updateX(train.container.x)

      this.insertTrain(train)

      this.updateTrainsPos()
      train.updateState('normal')
    })

    return train
  }

  /**
   * 插入train到指定位置, 也可以排序已存在的train
   */
  insertTrain(train: Train): void {
    const index = this.trains.findIndex(item => item === train)
    this.trains.splice(index, 1)
    const nextIndex = this.trains.findIndex(item =>
      item.x >= train.x, // 这里使用 >=, 是为了让插入的优先级更高
    )

    if (nextIndex !== -1)
      this.trains.splice(nextIndex, 0, train)
    else
      this.trains.push(train)
  }

  sortTrains(): void {
    this.trains.sort((a, b) => a.x - b.x)
  }

  updateTrainsPos(): void {
    this.trains
      .find((train) => {
        const intersectTrains = this.trains.filter((item) => {
          return isIntersection([train.x, train.x + train.width], [item.x, item.x + item.width])
        })

        // 排除当前循环的train
        if (intersectTrains.length <= 1)
          return false

        /*
          这个元素就是train

          minialXTrain === train ==> true
        */
        const minialXTrain = intersectTrains.shift()!

        intersectTrains
          .reverse() // 这里反转一下是为了让与当前元素相交的元素保持原有的顺序
          .forEach((item) => {
            item.updateX(item.x + (minialXTrain.x + minialXTrain.width - item.x))
            this.insertTrain(item)
          })

        this.updateTrainsPos()
        return true
      },
      )
  }

  private _drawBody(): void {
    const body = new Graphics()

    body.rect(0, 0, this.width, RAIL_HEIGHT)
    body.fill(RAIL_COLOR)

    this.container.addChild(body)
  }

  private _renderTrains(): void {
    this.trains.forEach((train) => {
      this.container.addChild(train.container)
    })
  }
}
