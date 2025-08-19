import type { FederatedPointerEvent } from 'pixi.js'
import type { TrainOption } from './train'
import { EventBus, isIntersection } from '@clippa/utils'
import { Container, Graphics } from 'pixi.js'
import { State } from './state'
import { Train } from './train'

export const RAIL_HEIGHT = 40

export const RAIL_COLOR = '#5f5f63ff'

export interface RailOption {
  width: number
  y: number
  trainsOption: TrainOption[]
}

export type RailEvents = {
  trainLeave: [Train, FederatedPointerEvent]
}

export class Rail extends EventBus<RailEvents> {
  container: Container
  width: number
  y: number
  /**
   * trains, is sorted
   */
  trains: Train[] = []

  state: State = State.getInstance()

  constructor(option: RailOption) {
    super()
    this.width = option.width
    this.y = option.y

    this.container = new Container({ y: this.y })

    this._drawBody()

    option.trainsOption.forEach(item => this.insertTrain(new Train(item)))

    this._bindEvents()
  }

  /**
   * 每一次拖拽前对事件进行拦截
   *
   * 判断是否在当前rail中是否有train与当前拖拽的train相交
   * 如果相交的状态当前train的x小于相交的train的x, 则将当前train设置为半透明态
   * 否则将当前train设置为静态态, 并且将当前train的x设置为相交的train的x + 相交的train的width
   */
  private _trainBeforeMoveHandle = (event: { xValue: number }, train: Train): void => {
    const intersectTrains = this.trains.filter((item) => {
      if (item === train)
        return false

      return isIntersection([event.xValue, event.xValue + train.width], [item.x, item.x + item.width])
    })

    if (intersectTrains.length === 0) {
      train.updateState('normal')
      return
    }

    const [minialXTrain] = intersectTrains.sort((a, b) => a.x - b.x)

    if (event.xValue <= minialXTrain.x) {
      train.updateState('translucent')
    }
    else {
      train.updateState('static')

      // 将拖拽的train的位置停靠在相交的train的后面
      if (train.container.x !== minialXTrain.x + minialXTrain.width)
        train.container.x = minialXTrain.x + minialXTrain.width
    }
  }

  private _trainMoveEndHandle = (train: Train): void => {
    this.insertTrain(train)

    this.updateTrainsPos()
  }

  private _bindTrainMoveEvents(train: Train): void {
    train.on('beforeMove', this._trainBeforeMoveHandle)
    train.on('moveEnd', this._trainMoveEndHandle)
  }

  private _unbindTrainMoveEvents(train: Train): void {
    train.off('beforeMove', this._trainBeforeMoveHandle)
    train.off('moveEnd', this._trainMoveEndHandle)
  }

  private _trainBeforeLeftResizeHandle = (event: {
    xValue: number
    wValue: number
    disdrawable: boolean
  }, train: Train): void => {
    const [intersectTrain] = this.trains.filter((item) => {
      if (item.x >= train.container.x)
        return false

      return isIntersection([train.x, train.x + train.width], [item.x, item.x + item.width])
    })

    if (intersectTrain) {
      event.disdrawable = true

      train.updateWidth(
        train.container.x + train.container.width - (intersectTrain.x + intersectTrain.width),
      )

      train.container.x = intersectTrain.x + intersectTrain.width
    }
  }

  private _rightTrains: Train[] | null = null
  private _trainRightResizeStartHandle = (train: Train): void => {
    this._rightTrains = this.trains.filter(item => item.x >= train.container.x)
  }

  private _trainBeforeRightResizeHandle = (): void => {
    if (!this._rightTrains)
      return

    let i = 0
    while (true) {
      if (i === this._rightTrains.length - 1)
        break

      const { container, width } = this._rightTrains[i]

      const rightX = container.x + width

      const { x } = this._rightTrains[i + 1]

      if (rightX < x) {
        break
      }
      else {
        this._rightTrains[i + 1].container.x = rightX
      }

      i++
    }

    // const [intersectTrain] = this.trains.filter((item) => {
    //   if (item.x <= train.container.x)
    //     return false

    //   return isIntersection([train.x, train.x + train.width], [item.x, item.x + item.width])
    // })

    // if (intersectTrain) {
    //   event.disdrawable = true

    //   train.updateSlotWidth(intersectTrain.x - train.x)
    // }
  }

  private _trainRightResizeEndHandle = (): void => {
    this._rightTrains?.forEach((item) => {
      item.x = item.container.x
    })

    this._rightTrains = null
  }

  private _bindResizeEvents(train: Train): void {
    train.on('beforeLeftResize', this._trainBeforeLeftResizeHandle)
    train.on('rightResizeStart', this._trainRightResizeStartHandle)
    train.on('beforeRightResize', this._trainBeforeRightResizeHandle)
    train.on('rightResizeEnd', this._trainRightResizeEndHandle)
  }

  private _unbindResizeEvents(train: Train): void {
    train.off('beforeLeftResize', this._trainBeforeLeftResizeHandle)
    train.off('rightResizeStart', this._trainRightResizeStartHandle)
    train.off('beforeRightResize', this._trainBeforeRightResizeHandle)
    train.off('rightResizeEnd', this._trainRightResizeEndHandle)
  }

  /**
   * 插入train到指定位置, 也可以排序已存在的train
   *
   * 如果这个train在列表中不存在, 那么会渲染这个train并且绑定事件
   */
  insertTrain(train: Train): void {
    const index = this.trains.findIndex(item => item === train)
    if (index !== -1) {
      // 从原位上抽离出来
      this.trains.splice(index, 1)
    }
    else {
      train.parent = this
      // 渲染并绑定事件
      this.container.addChild(train.container)
      this._bindTrainMoveEvents(train)
      this._bindResizeEvents(train)
    }

    // 寻找插入的位置
    const nextIndex = this.trains.findIndex(item =>
      item.x >= train.x, // 这里使用 >=, 是为了让插入的优先级更高
    )

    if (nextIndex !== -1)
      this.trains.splice(nextIndex, 0, train)
    else
      this.trains.push(train)
  }

  /**
   * 移除train
   */
  removeTrain(train: Train): void {
    const index = this.trains.findIndex(item => item === train)
    this.trains.splice(index, 1)
    this.container.removeChild(train.container)
    train.parent = null

    this._unbindTrainMoveEvents(train)
    this._unbindResizeEvents(train)
  }

  /**
   * 根据x的位置进行排序
   */
  sortTrains(): void {
    this.trains.sort((a, b) => a.x - b.x)
  }

  /**
   * 更新train的位置, 如果train相交, 则按照x的位置重新排序他, 然后重新更新位置
   */
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
            item.updatePos(item.x + (minialXTrain.x + minialXTrain.width - item.x))
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

  private _bindEvents(): void {
    this.container.eventMode = 'static'

    this.container.on('pointerleave', (e) => {
      // 如果是train正在拖拽状态, 那么需要将这个train从当前rail中移除
      if (!this.state.trainDragging)
        return

      const atTrain = this.state.atDragTrain!

      this.emit('trainLeave', atTrain, e)

      this.removeTrain(atTrain)
    })
  }
}
