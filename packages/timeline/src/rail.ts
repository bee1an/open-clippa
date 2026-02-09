import type { FederatedPointerEvent } from 'pixi.js'
import type { TrainOption } from './train'
import {
  TIMELINE_RAIL_FILL,
  TIMELINE_TRAIN_BORDER_SIZE,
  TIMELINE_TRAIN_CONNECTION_TIME_PX,
  TIMELINE_TRAIN_SEAM_EPSILON,
  TIMELINE_TRAIN_SEAM_WIDTH,
} from '@clippa/constants'
import { EventBus, getMsByPx, getPxByMs, isIntersection } from '@clippa/utils'
import { Container, Graphics } from 'pixi.js'
import { State } from './state'
import { Train } from './train'
import { collectAdjacentBoundaries, collectTrainJoinStates } from './utils/seam'

/**
 * rail height
 */
export const RAIL_HEIGHT = 45
export interface RailOption {
  /**
   * 宽度
   *
   * 需要保留这个参数, 这个宽度不全部受时间影响
   */
  width: number
  y: number
  duration: number
  zIndex: number
  trainsOption: TrainOption[]
}

export type RailEvents = {
  trainLeave: [Train, FederatedPointerEvent]
  trainBeforeMoveEnd: [Train]

  trainsPosUpdated: []

  /**
   * just train right resize end trigger
   */
  trainRightResizeEnd: []

  /**
   * when train `moveEnd` event trigger
   */
  trainMoveEnd: []

  /**
   * insert train
   */
  insertTrain: [Train]
}

export class Rail extends EventBus<RailEvents> {
  container: Container
  width: number
  y: number

  /**
   * trains, is sorted
   */
  trains: Train[] = []
  duration: number
  zIndex: number
  state: State = State.getInstance()
  private _seamLayer: Graphics
  private _dragDockState = new Map<Train, { target: Train, side: 'left' | 'right', escapeDistance: number }>()
  private _handlePxPerMsUpdated = (): void => {
    this._refreshVisualLayoutAndAdjacentVisuals()
  }

  private _getConnectionGapPx(): number {
    return TIMELINE_TRAIN_CONNECTION_TIME_PX
  }

  private _getDockSnapEnterPx(): number {
    return Math.max(6, this._getConnectionGapPx() * 1.5)
  }

  private _getDockSnapExitPx(): number {
    return this._getDockSnapEnterPx() + 4
  }

  private _getDockX(train: Train, target: Train, side: 'left' | 'right'): number {
    const connectionGap = this._getConnectionGapPx()

    if (side === 'left')
      return Math.max(0, target.x - train.width - connectionGap)

    return target.x + target.width + connectionGap
  }

  private _getDockAwayStep(proposedX: number, dockX: number, side: 'left' | 'right'): number {
    if (side === 'left')
      return Math.max(0, dockX - proposedX)

    return Math.max(0, proposedX - dockX)
  }

  private _getDockTowardsStep(proposedX: number, dockX: number, side: 'left' | 'right'): number {
    if (side === 'left')
      return Math.max(0, proposedX - dockX)

    return Math.max(0, dockX - proposedX)
  }

  private _applyDock(
    train: Train,
    event: { xValue: number },
    target: Train,
    side: 'left' | 'right',
    options: { resetEscape?: boolean } = {},
  ): void {
    const dockX = this._getDockX(train, target, side)
    const currentDockState = this._dragDockState.get(train)
    const keepEscape = currentDockState
      && currentDockState.target === target
      && currentDockState.side === side
      && !options.resetEscape

    this._dragDockState.set(train, {
      target,
      side,
      escapeDistance: keepEscape ? currentDockState.escapeDistance : 0,
    })
    train.updateState('static')
    event.xValue = dockX

    if (train.container.x !== dockX)
      train.container.x = dockX
  }

  private _pickNearestDockCandidate(
    train: Train,
    proposedX: number,
    targets: readonly Train[],
  ): { target: Train, side: 'left' | 'right', dockX: number, distance: number } | null {
    let nearest: { target: Train, side: 'left' | 'right', dockX: number, distance: number } | null = null

    for (const target of targets) {
      if (target === train)
        continue

      const leftDockX = this._getDockX(train, target, 'left')
      const rightDockX = this._getDockX(train, target, 'right')
      const leftDistance = Math.abs(proposedX - leftDockX)
      const rightDistance = Math.abs(proposedX - rightDockX)
      const side: 'left' | 'right' = leftDistance <= rightDistance ? 'left' : 'right'
      const dockX = side === 'left' ? leftDockX : rightDockX
      const distance = Math.abs(proposedX - dockX)

      if (!nearest || distance < nearest.distance) {
        nearest = { target, side, dockX, distance }
      }
    }

    return nearest
  }

  getRawMsByVisualPx(_train: Train, visualPx: number): number {
    const dockState = this._dragDockState.get(_train)
    if (dockState) {
      if (dockState.side === 'left')
        return Math.max(0, dockState.target.start - _train.duration)

      return dockState.target.start + dockState.target.duration
    }

    const clampedVisualPx = Math.max(0, visualPx)
    const connectionGap = this._getConnectionGapPx()
    const seamTrains = this.trains
      .map(item => ({
        x: item.container.x,
        width: item.width,
      }))
      .sort((a, b) => a.x - b.x)

    const boundaries = collectAdjacentBoundaries(
      seamTrains,
      TIMELINE_TRAIN_SEAM_EPSILON,
      connectionGap,
    )
    const seamOffsetPx = boundaries.reduce((offset, boundary) => {
      if (clampedVisualPx + TIMELINE_TRAIN_SEAM_EPSILON < boundary)
        return offset

      return offset + connectionGap
    }, 0)

    return getMsByPx(
      Math.max(0, clampedVisualPx - seamOffsetPx),
      this.state.pxPerMs,
    )
  }

  private _syncVisualLayoutFromRawTimings(): void {
    if (this.trains.length === 0)
      return

    this.sortTrains()
    let seamOffsetPx = 0

    for (let i = 0; i < this.trains.length; i++) {
      const train = this.trains[i]
      const visualX = getPxByMs(train.start, this.state.pxPerMs) + seamOffsetPx
      const visualWidth = getPxByMs(train.duration, this.state.pxPerMs)

      train.updateWidth(visualWidth)
      train.updatePos(visualX, undefined)

      if (i === this.trains.length - 1)
        continue

      const nextTrain = this.trains[i + 1]
      const rawGapPx = getPxByMs(
        nextTrain.start - (train.start + train.duration),
        this.state.pxPerMs,
      )

      if (Math.abs(rawGapPx) <= TIMELINE_TRAIN_SEAM_EPSILON)
        seamOffsetPx += this._getConnectionGapPx()
    }
  }

  private _refreshVisualLayoutAndAdjacentVisuals(): void {
    this._syncVisualLayoutFromRawTimings()
    this._refreshAdjacentVisuals()
  }

  private _refreshAdjacentVisuals(): void {
    this._syncTrainJoinState()
    this._drawAdjacentSeams()
  }

  private _bindPxPerMsEvents(): void {
    this.state.off('updatedPxPerMs', this._handlePxPerMsUpdated)
    this.state.on('updatedPxPerMs', this._handlePxPerMsUpdated)
  }

  constructor(option: RailOption) {
    super()
    this.width = option.width
    this.y = option.y
    this.duration = option.duration
    this.zIndex = option.zIndex

    this.container = new Container({ y: this.y, label: 'rail' })

    this._drawBg()
    this._seamLayer = this._createSeamLayer()

    option.trainsOption.forEach(item => this.insertTrain(new Train(item)))

    this._bindEvents()
    this._bindPxPerMsEvents()
    this._refreshVisualLayoutAndAdjacentVisuals()
  }

  /**
   * 每一次拖拽前对事件进行拦截
   *
   * 拖拽吸附状态机:
   * 1. 硬碰撞: 不允许进入重叠区
   * 2. 吸附保持: 已吸附时在释放阈值内维持锁定, 防止抖动
   * 3. 吸附进入: 接近连接位时吸附
   */
  private _trainBeforeMoveHandle = (event: { xValue: number }, train: Train): void => {
    const connectionGap = this._getConnectionGapPx()
    const proposedX = Math.max(0, event.xValue)
    const movingRight = proposedX > train.x
    const movingLeft = proposedX < train.x
    const intersectTrains = this.trains.filter((item) => {
      if (item === train)
        return false

      return isIntersection([proposedX, proposedX + train.width + connectionGap], [item.x, item.x + item.width])
    })
    const cachedDock = this._dragDockState.get(train)

    if (intersectTrains.length > 0) {
      if (cachedDock && intersectTrains.includes(cachedDock.target)) {
        this._applyDock(train, event, cachedDock.target, cachedDock.side, { resetEscape: true })
        return
      }

      if (movingRight) {
        const target = intersectTrains.reduce((best, current) =>
          current.x < best.x ? current : best,
        )
        this._applyDock(train, event, target, 'left', { resetEscape: true })
        return
      }

      if (movingLeft) {
        const target = intersectTrains.reduce((best, current) =>
          current.x > best.x ? current : best,
        )
        this._applyDock(train, event, target, 'right', { resetEscape: true })
        return
      }

      const nearestCollisionDock = this._pickNearestDockCandidate(train, proposedX, intersectTrains)
      if (nearestCollisionDock) {
        this._applyDock(train, event, nearestCollisionDock.target, nearestCollisionDock.side, { resetEscape: true })
        return
      }
    }

    if (cachedDock) {
      const dockX = this._getDockX(train, cachedDock.target, cachedDock.side)
      const awayStep = this._getDockAwayStep(proposedX, dockX, cachedDock.side)
      const towardsStep = this._getDockTowardsStep(proposedX, dockX, cachedDock.side)
      if (awayStep > 0) {
        cachedDock.escapeDistance += awayStep
      }
      else if (towardsStep > 0) {
        cachedDock.escapeDistance = Math.max(0, cachedDock.escapeDistance - towardsStep)
      }

      if (cachedDock.escapeDistance < this._getDockSnapExitPx()) {
        this._applyDock(train, event, cachedDock.target, cachedDock.side)
        return
      }

      const releaseX = cachedDock.side === 'left'
        ? Math.max(0, dockX - cachedDock.escapeDistance)
        : dockX + cachedDock.escapeDistance

      this._dragDockState.delete(train)
      train.updateState('normal')
      event.xValue = releaseX
      return
    }

    const nearestDock = this._pickNearestDockCandidate(
      train,
      proposedX,
      this.trains,
    )
    if (nearestDock && nearestDock.distance <= this._getDockSnapEnterPx()) {
      this._applyDock(train, event, nearestDock.target, nearestDock.side)
      return
    }

    this._dragDockState.delete(train)
    train.updateState('normal')
    event.xValue = proposedX
  }

  private _trainMoveEndHandle = (train: Train): void => {
    this._dragDockState.delete(train)
    this.insertTrain(train)

    this.updateTrainsPos()

    this.emit('trainMoveEnd')
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
    const connectionGap = this._getConnectionGapPx()
    const [intersectTrain] = this.trains.filter((item) => {
      if (item.x >= train.container.x)
        return false

      return isIntersection([train.x - connectionGap, train.x + train.width], [item.x, item.x + item.width])
    })

    if (intersectTrain) {
      event.disdrawable = true

      const intersectRight = intersectTrain.x + intersectTrain.width
      const trainRight = train.x + train.width
      event.xValue = intersectRight + connectionGap
      event.wValue = trainRight - event.xValue

      train.updateWidth(
        event.wValue,
      )

      train.container.x = event.xValue
    }
  }

  private _rightTrains: Train[] | null = null
  /**
   * 收集当前resize的train右边的train集合
   */
  private _trainRightResizeStartHandle = (train: Train): void => {
    this._rightTrains = this.trains.filter(item => item.x >= train.container.x)
  }

  /**
   * 动态调整右边train的位置
   * 仅仅是位置, 并不会改变train的开始时间
   * 改变开始时间将在拖拽结束时进行
   */
  private _trainBeforeRightResizeHandle = (): void => {
    if (!this._rightTrains)
      return

    const connectionGap = this._getConnectionGapPx()
    let i = 0
    while (true) {
      if (i === this._rightTrains.length - 1)
        break

      const { container, width } = this._rightTrains[i]

      const rightX = container.x + width + connectionGap

      const { x } = this._rightTrains[i + 1]

      if (rightX < x) {
        break
      }
      else {
        this._rightTrains[i + 1].container.x = rightX
      }

      i++
    }
  }

  /**
   * 修改右边train的位置和开始时间
   * 发送 `trainRightResizeEnd` 事件, 父类将检测总时长是否需要更新
   */
  private _trainRightResizeEndHandle = (): void => {
    this._rightTrains?.forEach((item) => {
      item.x = item.container.x
      item.start = this.getRawMsByVisualPx(item, item.x)
    })

    this._rightTrains = null

    this._refreshVisualLayoutAndAdjacentVisuals()
    this.emit('trainRightResizeEnd')
  }

  private _trainLeftResizeEndHandle = (): void => {
    this._refreshVisualLayoutAndAdjacentVisuals()
  }

  private _bindResizeEvents(train: Train): void {
    train.on('beforeLeftResize', this._trainBeforeLeftResizeHandle)
    train.on('leftResizeEnd', this._trainLeftResizeEndHandle)
    train.on('rightResizeStart', this._trainRightResizeStartHandle)
    train.on('beforeRightResize', this._trainBeforeRightResizeHandle)
    train.on('rightResizeEnd', this._trainRightResizeEndHandle)
  }

  private _unbindResizeEvents(train: Train): void {
    train.off('beforeLeftResize', this._trainBeforeLeftResizeHandle)
    train.off('leftResizeEnd', this._trainLeftResizeEndHandle)
    train.off('rightResizeStart', this._trainRightResizeStartHandle)
    train.off('beforeRightResize', this._trainBeforeRightResizeHandle)
    train.off('rightResizeEnd', this._trainRightResizeEndHandle)
  }

  private _bg: Graphics | null = null
  private _createSeamLayer(): Graphics {
    const seamLayer = new Graphics({ label: 'rail-seam' })
    seamLayer.eventMode = 'none'
    seamLayer.visible = true
    this.container.addChild(seamLayer)
    return seamLayer
  }

  private _drawAdjacentSeams(): void {
    this._seamLayer.clear()

    const boundaries = collectAdjacentBoundaries(
      this.trains,
      TIMELINE_TRAIN_SEAM_EPSILON,
      this._getConnectionGapPx(),
    )
    if (boundaries.length === 0)
      return

    for (const boundary of boundaries) {
      this._seamLayer
        .rect(
          boundary - TIMELINE_TRAIN_SEAM_WIDTH / 2,
          -TIMELINE_TRAIN_BORDER_SIZE,
          TIMELINE_TRAIN_SEAM_WIDTH,
          RAIL_HEIGHT + TIMELINE_TRAIN_BORDER_SIZE * 2,
        )
        .fill(TIMELINE_RAIL_FILL)
    }
  }

  private _syncTrainJoinState(): void {
    const joinStates = collectTrainJoinStates(
      this.trains,
      TIMELINE_TRAIN_SEAM_EPSILON,
      this._getConnectionGapPx(),
    )

    for (let i = 0; i < this.trains.length; i++) {
      const train = this.trains[i]
      const joinState = joinStates[i]
      if (!joinState)
        continue

      train.updateJoinState(joinState.joinLeft, joinState.joinRight)
    }
  }

  private _moveSeamLayerToTop(): void {
    this.container.addChild(this._seamLayer)
  }

  private _drawBg(): void {
    const bg = new Graphics()

    bg.roundRect(0, 0, this.width, RAIL_HEIGHT, 8)
    bg.fill(TIMELINE_RAIL_FILL)

    if (this._bg) {
      this.container.replaceChild(this._bg, bg)
    }
    else {
      this.container.addChild(bg)
    }

    this._bg = bg
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
      item.start >= train.start, // 这里使用 >=, 是为了让插入的优先级更高
    )

    if (nextIndex !== -1)
      this.trains.splice(nextIndex, 0, train)
    else
      this.trains.push(train)

    this._bindPxPerMsEvents()
    this._moveSeamLayerToTop()
    if (this.state.trainDragging)
      this._refreshAdjacentVisuals()
    else
      this._refreshVisualLayoutAndAdjacentVisuals()
    this.emit('insertTrain', train)
  }

  /**
   * 移除train
   */
  removeTrain(train: Train): void {
    const index = this.trains.findIndex(item => item === train)
    this.trains.splice(index, 1)
    this.container.removeChild(train.container)
    train.parent = null
    this._dragDockState.delete(train)

    this._unbindTrainMoveEvents(train)
    this._unbindResizeEvents(train)
    if (this.state.trainDragging)
      this._refreshAdjacentVisuals()
    else
      this._refreshVisualLayoutAndAdjacentVisuals()
  }

  /**
   * 根据x的位置进行排序
   */
  sortTrains(): void {
    this.trains.sort((a, b) => a.start - b.start)
  }

  /**
   * 更新train的位置, 如果train相交, 则按照x的位置重新排序他, 然后重新更新位置
   */
  updateTrainsPos(): void {
    const connectionGap = this._getConnectionGapPx()
    this.trains
      .find((train) => {
        const intersectTrains = this.trains.filter((item) => {
          return isIntersection([train.x, train.x + train.width + connectionGap], [item.x, item.x + item.width])
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
            item.updatePos(
              item.x + (minialXTrain.x + minialXTrain.width + connectionGap - item.x),
              undefined,
            )
            item.start = this.getRawMsByVisualPx(item, item.x)
            this.insertTrain(item)
          })

        this.updateTrainsPos()
        return true
      },
      )

    this.emit('trainsPosUpdated')
    this._refreshVisualLayoutAndAdjacentVisuals()
  }

  /**
   * 更新rail的宽度
   */
  updateWidth(width: number): void {
    if (width === this.width)
      return

    this.width = width

    this._drawBg()
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

    // TODO
  }
}
