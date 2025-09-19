import type { FederatedPointerEvent } from 'pixi.js'
import type { TrainOption } from './train'
import { TIMELINE_RULER_HEIGHT } from '@clippa/constants'
import { EventBus, getPxByMs } from '@clippa/utils'
import { Container, Graphics } from 'pixi.js'
import { Rail, RAIL_HEIGHT } from './rail'
import { GAP, RailGap } from './railGap'
import { ScrollBox } from './scrollBox'
import { State } from './state'

export interface RailsOption {
  screenWidth: number
  screenHeight: number
  duration: number
  maxZIndex?: number
}

export type RailsEvents = {
  scroll: [{ x: number, y: number }]

  /**
   * duration over timeline limit
   *
   * it is before update `duration`
   */
  updateDuration: [number]
}

export class Rails extends EventBus<RailsEvents> {
  scrollBox: ScrollBox

  get container(): Container {
    return this.scrollBox.container
  }

  /**
   * sort by zIndex
   *
   * 由大到小
   */
  rails: Rail[] = []

  /**
   * sort by zIndex
   *
   * 由大到小
   */
  railGaps: RailGap[] = []

  /**
   * include rails and railGaps
   */
  railsContainer: Container = new Container({ label: 'rails' })

  state: State

  width!: number
  screenWidth: number
  screenHeight: number

  duration: number

  maxZIndex: number = -1

  get offsetX(): number {
    return this.scrollBox.offsetX
  }

  get offsetY(): number {
    return this.scrollBox.offsetY
  }

  constructor(option: RailsOption) {
    super()

    this.state = State.getInstance()
    this.state.on('updatedPxPerMs', () => {
      this._processWidth()

      this.update()
    })

    this.duration = option.duration
    this._processWidth()
    this.screenWidth = option.screenWidth
    this.screenHeight = option.screenHeight

    this.scrollBox = new ScrollBox()

    this.scrollBox.on('toggleXBarVisible', (visible) => {
      this._updateRailContainerY()

      this.scrollBox.updateScrollMore({ y: visible ? this.scrollBox.barHeight : 0 })
    })

    this.scrollBox.on('toggleYBarVisible', (visible) => {
      this._updateRailContainerY()

      this.scrollBox.updateScrollMore({ x: visible ? this.scrollBox.barWidth : 0 })
    })

    this.railsContainer.eventMode = 'static'

    this.scrollBox.on('scroll', event => this.emit('scroll', event))

    this.container.y = TIMELINE_RULER_HEIGHT

    // TODO: maybe bug add on this local
    // this.container.addChild(this.railsContainer)

    this._drawBody()

    this._drawFoundation()

    this.container.addChild(this.railsContainer)

    this._bindEvents()
  }

  private _processWidth(): void {
    this.width = getPxByMs(this.duration, this.state.pxPerMs)
  }

  private _updateRailContainerY(): void {
    if (this.scrollBox.isYBarVisible) {
      this.railsContainer.y = 0
    }
    else {
      // move to center y
      this.railsContainer.y = ((this.screenHeight - TIMELINE_RULER_HEIGHT - (this.scrollBox.isXBarVisible ? this.scrollBox.barHeight : 0)) / 2) - this.railsContainer.height / 2
    }

    this.scrollBox.update()
  }

  private _createRail(zIndex: number, trainsOptions: TrainOption[] = []): Rail {
    const y = (this.maxZIndex - zIndex) * (RAIL_HEIGHT + GAP) + GAP

    const rail = new Rail(
      {
        width: Math.max(this.width, this.screenWidth),
        y,
        duration: this.duration,
        zIndex,
        trainsOption: trainsOptions,
      },
    )

    rail.on('trainLeave', (train) => {
      train.updatePos(undefined, rail.y + this.railsContainer.y + train.y)
      train.updateState('free')

      this.container.addChild(train.container)
    })

    // 获取所有train中最大的duration
    const autoUpdateDuration = (): void => {
      const duration = Math.max(
        ...this.rails.map(
          (rail) => {
            return rail.trains.reduce(
              (acc, train) => Math.max(acc, train.start + train.duration),
              0,
            )
          },
        ),
      )

      if (duration !== this.duration) {
        this.emit('updateDuration', duration)
      }
    }

    rail.on('trainMoveEnd', () => {
      autoUpdateDuration()

      this.scrollBox.update()
    })

    rail.on('trainRightResizeEnd', () => {
      autoUpdateDuration()

      this.scrollBox.update()
    })

    rail.on('insertTrain', () => {
      if (this.state.trainDragging)
        return

      this.scrollBox.update()
    })

    this._insertRailByZIndex(rail, zIndex)

    this.railsContainer.addChild(rail.container)

    return rail
  }

  private _createRailGap(zIndex: number): RailGap {
    const y = (this.maxZIndex - (zIndex - 1)) * (RAIL_HEIGHT + GAP)

    const gap = new RailGap({
      y,
      width: Math.max(this.width, this.screenWidth),
      zIndex,
    })

    this._insertGapByZIndex(gap, zIndex)

    this.railsContainer.addChild(gap.container)

    return gap
  }

  private _drawBody(): void {
    this._createRailGap(this.maxZIndex + 1)

    for (let index = 0; index <= this.maxZIndex; index++) {
      const zIndex = this.maxZIndex - index

      this._createRail(zIndex)

      this._createRailGap(zIndex)
    }
  }

  private _foundation?: Graphics
  private _drawFoundation(): void {
    const bgColor = 'transparent'

    const w = Math.max(this.width, this.screenWidth - this.offsetX)
    const h = Math.max(
      this.railsContainer.height,
      this.screenHeight - TIMELINE_RULER_HEIGHT,
    )

    if (this._foundation) {
      this._foundation.clear().rect(0, 0, w, h).fill(bgColor)
      return
    }

    this._foundation = new Graphics({ label: 'foundation', eventMode: 'static' })

    this._foundation.rect(0, 0, w, h).fill(bgColor)
    this.container.addChild(this._foundation)
  }

  private _insertGapByZIndex(gap: RailGap, zIndex: number): void {
    this.railGaps.splice((this.maxZIndex - zIndex) + 1, 0, gap)
  }

  private _insertRailByZIndex(rail: Rail, zIndex: number): void {
    this.rails.splice(this.maxZIndex - zIndex, 0, rail)
  }

  private _bindEvents(): void {
    this.container.eventMode = 'static'
    let timeId: number
    this.container.on('pointerdown', (e) => {
      /* train 取消选中逻辑 */
      if (!this.state.activeTrain)
        return

      const { x, y } = e.global

      let clickedTrain: undefined | boolean
      for (const rail of this.rails) {
        clickedTrain = rail.trains.some((train) => {
          return train.container.getBounds().containsPoint(x, y)
        })
        if (clickedTrain)
          break
      }

      if (!clickedTrain)
        this.state.activeTrain.updateActive(false)
    })

    this.container.on('pointermove', (e) => {
      if (!this.state.trainDragging)
        return

      clearTimeout(timeId)

      timeId = window.setTimeout(() => {
        this._stayWhenDragging(e)
      }, 500)

      const { x, y } = e.getLocalPosition(this.railsContainer)

      const rail = this.rails.find((rail) => {
        const bounds = rail.container.getLocalBounds()
        bounds.y = rail.y

        return rail.container.getLocalBounds().containsPoint(x, y)
      })

      const atTrain = this.state.atDragTrain!

      if (rail && !rail.trains.includes(atTrain)) {
        rail.insertTrain(atTrain)

        atTrain.updateState('normal')
        atTrain.updatePos(undefined, atTrain.y - (rail.y + this.railsContainer.y))

        this.railGaps.forEach(gap => gap.setActive(false))
      }
    })

    this.container.on('pointerup', () => {
      if (!this.state.trainDragging)
        return

      clearTimeout(timeId)

      const gap = this.railGaps.find(gap => gap.active)

      const atTrain = this.state.atDragTrain!

      if (gap) {
        gap.setActive(false)

        const { zIndex } = gap

        const rail = this.createRailByZIndex(zIndex)

        rail.insertTrain(atTrain)

        atTrain.updateState('normal')
      }

      if (atTrain.dragStatus === 'free')
        return

      /* check rail whether need to remove */
      const emptyRail = this.rails.find(rail => rail.trains.length === 0)

      if (emptyRail)
        this.removeRail(emptyRail)

      this._updateRailContainerY()
    })
  }

  /**
   * 创建rail和railGap
   *
   *
   */
  private _createRailByZIndexRaw(zIndex: number): Rail {
    /* update other zIndex */
    this.rails.forEach((rail) => {
      if (rail.zIndex >= zIndex) {
        rail.updateZIndex(rail.zIndex + 1)
      }
      else {
        rail.updateY(rail.y + RAIL_HEIGHT + GAP)
      }
    })

    this.railGaps.forEach((railGap) => {
      if (railGap.zIndex >= zIndex) {
        railGap.updateZIndex(railGap.zIndex + 1)
      }
      else {
        railGap.updateY(railGap.y + RAIL_HEIGHT + GAP)
      }
    })

    this.maxZIndex = Math.max(this.rails[0]?.zIndex ?? 0, zIndex)

    const rail = this._createRail(zIndex)
    this._createRailGap(zIndex)

    this.scrollBox.update()

    this._drawFoundation()
    return rail
  }

  /**
   * create rail and rail gap by zIndex with update rail container
   */
  createRailByZIndex(zIndex: number): Rail {
    if (zIndex >= this.rails.length) {
      /**
       * Rails只能应对rails数组连续的情况
       * 这种情况属于越级创建, 例在zindex0未创建的情况下创建zindex1
       */
      for (let index = this.rails.length; index < zIndex; index++) {
        this._createRailByZIndexRaw(index)
      }
    }

    const rail = this._createRailByZIndexRaw(zIndex)

    this._updateRailContainerY()

    return rail
  }

  /**
   * 移除rail, 伴随移除gap的副作用
   */
  removeRail(rail: Rail): void {
    const { zIndex } = rail

    this.rails = this.rails.filter((curRail) => {
      if (curRail.zIndex > zIndex) {
        // filter with update
        curRail.updateZIndex(curRail.zIndex - 1)
      }
      else {
        curRail.updateY(curRail.y - RAIL_HEIGHT - GAP)
      }

      return curRail !== rail
    })

    this.maxZIndex = this.rails[0].zIndex

    this.railGaps = this.railGaps.filter((item) => {
      const itemZIndex = item.zIndex

      if (item.zIndex > zIndex) {
        // filter with update
        item.updateZIndex(item.zIndex - 1)
      }
      else {
        item.updateY(item.y - RAIL_HEIGHT - GAP)
      }

      // with remove
      if (itemZIndex === zIndex)
        this.railsContainer.removeChild(item.container)

      return itemZIndex !== zIndex
    })

    this.railsContainer.removeChild(rail.container)

    this.scrollBox.update()

    this._drawFoundation()
  }

  getRailByZIndex(zIndex: number): Rail | undefined {
    return this.rails[this.maxZIndex - zIndex]
  }

  private _stayWhenDragging(e: FederatedPointerEvent): void {
    const { x, y } = e.getLocalPosition(this.railsContainer)

    const gap = this.railGaps.find((gap) => {
      const bounds = gap.container.getLocalBounds()
      bounds.y = gap.y

      return gap.container.getLocalBounds().containsPoint(x, y)
    })

    gap?.setActive(true)
  }

  /**
   * 更新屏幕宽度
   */
  updateScreenWidth(screenWidth: number): void {
    this.screenWidth = screenWidth

    this.scrollBox.updateViewportSize(screenWidth)

    this.scrollBox.update()

    this.update()
  }

  updateScreenHeight(screenHeight: number): void {
    this.screenHeight = screenHeight

    this.scrollBox.updateViewportSize(undefined, screenHeight - TIMELINE_RULER_HEIGHT)

    this.scrollBox.update()

    this.update()
  }

  updateScreenSize(screenWidth?: number, screenHeight?: number): void {
    if (screenWidth) {
      this.screenWidth = screenWidth
    }

    if (screenHeight) {
      this.screenHeight = screenHeight
    }

    this.scrollBox.updateViewportSize(this.screenWidth, this.screenHeight - TIMELINE_RULER_HEIGHT)

    this.scrollBox.update()

    this.update()
  }

  /**
   * Update the duration of the rail
   */
  updateDuration(duration: number): void {
    this.duration = duration
    this._processWidth()

    this.update()
  }

  update(): void {
    this._drawFoundation()

    const helper = (instance: Rail | RailGap): void => {
      instance.updateWidth(Math.max(this.width, this.screenWidth - this.offsetX))
    }

    this.rails.forEach(helper)
    this.railGaps.forEach(helper)
  }
}
