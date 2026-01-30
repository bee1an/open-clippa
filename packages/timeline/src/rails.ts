import type { FederatedPointerEvent } from 'pixi.js'
import type { TrainOption } from './train'
import { TIMELINE_AUTO_PAGE_TURN_THRESHOLD, TIMELINE_RULER_HEIGHT } from '@clippa/constants'
import { EventBus, getPxByMs } from '@clippa/utils'
import { Container } from 'pixi.js'
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

  // 背景容器已移除，rails组件不应该负责背景渲染
  // private _backgroundContainer: Container = new Container({ label: 'background' })

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
    if (typeof option.maxZIndex === 'number') {
      this.maxZIndex = option.maxZIndex
    }
    this._processWidth()
    this.screenWidth = option.screenWidth
    this.screenHeight = option.screenHeight

    this.scrollBox = new ScrollBox({
      scrollbar: {
        hysteresisPx: 8, // 可配置更小的滞回阈值，响应更灵敏
      },
    })

    this.scrollBox.on('toggleXBarVisible', (visible) => {
      // 更新 scrollMore 但不触发重新渲染，避免循环
      this.scrollBox.scrollMore ??= {}
      this.scrollBox.scrollMore.y = visible ? this.scrollBox.barHeight : 0
      // 背景绘制已移除，只更新rails容器位置
      this._updateRailContainerY()
    })

    this.scrollBox.on('toggleYBarVisible', (visible) => {
      // 更新 scrollMore 但不触发重新渲染，避免循环
      this.scrollBox.scrollMore ??= {}
      this.scrollBox.scrollMore.x = visible ? this.scrollBox.barWidth : 0

      // 当 Y 滚动条消失时，重置 Y 方向的滚动偏移，确保内容能正确居中
      if (!visible && this.scrollBox.offsetY !== 0) {
        // 重置 wrapper 的 Y 位置
        // (this.scrollBox as any)._wrapper.y = 0
        // // 重置 Y 滚动条的位置（如果存在）
        // if ((this.scrollBox as any)._scrollbarYTrigger) {
        //   (this.scrollBox as any)._scrollbarYTrigger.y = 0
        // }
        this.scrollBox.scroll({ y: 0 })
      }

      // 背景绘制已移除，只更新rails容器位置
      this._updateRailContainerY()
    })

    this.railsContainer.eventMode = 'static'

    this.scrollBox.on('scroll', (event) => {
      this.emit('scroll', event)
    })

    this.container.y = TIMELINE_RULER_HEIGHT

    this.container.addChild(this.railsContainer)

    this._drawBody()

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
      // 无 Y 滚动条时纵向居中（考虑 X 滚动条高度占位）
      const effectiveViewportHeight = this.screenHeight - TIMELINE_RULER_HEIGHT - (this.scrollBox.isXBarVisible ? this.scrollBox.barHeight : 0)
      const contentHeight = this.railsContainer.height
      const centeredY = Math.max(0, (effectiveViewportHeight - contentHeight) / 2)
      this.railsContainer.y = centeredY
    }
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

    // 设置railsContainer的高度为rails总高度，确保ScrollBox能正确计算内容高度
    const railsTotalHeight = this.getRailsTotalHeight()
    this.railsContainer.height = railsTotalHeight
  }

  private _insertGapByZIndex(gap: RailGap, zIndex: number): void {
    this.railGaps.splice((this.maxZIndex - zIndex) + 1, 0, gap)
  }

  private _insertRailByZIndex(rail: Rail, zIndex: number): void {
    this.rails.splice(this.maxZIndex - zIndex, 0, rail)
  }

  private _tryAutoScrollWhenTrainDragging(): void {
    // 如果已经在滚动或没有train在拖拽，直接返回
    if (!this.state.trainDragging)
      return

    const scrollStep = (): void => {
      if (!this.state.trainDragging)
        return
      // 执行滚动并检查是否需要继续
      const shouldContinue = this._checkAndPerformScroll()

      if (shouldContinue) {
        // 继续滚动
        requestAnimationFrame(scrollStep)
      }
    }

    scrollStep()
  }

  /**
   * 当前的鼠标的x位置
   */
  private _currentX = 0

  /**
   * 执行滚动并检查是否需要继续
   */
  private _checkAndPerformScroll(): boolean {
    // 计算当前鼠标在视口中的位置
    const offsetX = -this.offsetX + this._currentX

    // 检查边界并执行滚动
    if (this.isWhetherNearLeftEdge(offsetX)) {
      this.scrollBox.scroll({ x: -0.2 })
      this.state.atDragTrain?.updatePos(this.state.atDragTrain.x - 0.2, undefined)
      return true // 继续滚动
    }
    else if (this.isWhetherNearRightEdge(offsetX)) {
      this.scrollBox.scroll({ x: 0.2 })
      this.state.atDragTrain?.updatePos(this.state.atDragTrain.x + 0.2, undefined)
      return true // 继续滚动
    }

    return false // 停止滚动
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

      // 拖拽到rail上
      const { x, y } = e.getLocalPosition(this.railsContainer)
      const rail = this.rails.find((rail) => {
        // Simple arithmetic check is O(1) and much faster than getLocalBounds
        return x >= 0 && x <= rail.width && y >= rail.y && y <= rail.y + RAIL_HEIGHT
      })

      const atTrain = this.state.atDragTrain!

      if (rail && !rail.trains.includes(atTrain)) {
        rail.insertTrain(atTrain)

        atTrain.updateState('normal')
        atTrain.updatePos(undefined, atTrain.y - (rail.y + this.railsContainer.y))

        this.railGaps.forEach(gap => gap.setActive(false))
      }

      this._currentX = e.getLocalPosition(this.container).x
      this._tryAutoScrollWhenTrainDragging()
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

    // 背景绘制已移除，rails组件不负责背景
    return rail
  }

  /**
   * 判断一个值是否接近右边界
   */
  isWhetherNearRightEdge(x: number): boolean {
    // 获取视口宽度
    const viewportWidth = this.screenWidth

    const cursorRelativePosition = x + this.offsetX

    const threshold = viewportWidth * TIMELINE_AUTO_PAGE_TURN_THRESHOLD
    const distanceToRight = viewportWidth - cursorRelativePosition

    const isNearRightEdge = distanceToRight < threshold

    return isNearRightEdge
  }

  /**
   * 判断一个值是否接近左边界
   */
  isWhetherNearLeftEdge(x: number): boolean {
    const cursorRelativePosition = x + this.offsetX

    const threshold = this.screenWidth * TIMELINE_AUTO_PAGE_TURN_THRESHOLD
    const distanceToLeft = cursorRelativePosition

    const isNearLeftEdge = distanceToLeft < threshold

    return isNearLeftEdge
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

    // 更新railsContainer高度
    const railsTotalHeight = this.getRailsTotalHeight()
    this.railsContainer.height = railsTotalHeight

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

    // 更新railsContainer高度
    const railsTotalHeight = this.getRailsTotalHeight()
    this.railsContainer.height = railsTotalHeight

    // 背景绘制已移除，rails组件不负责背景
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
   * 获取rails的总高度（用于滚动条判断）
   */
  getRailsTotalHeight(): number {
    return (this.maxZIndex + 1) * (RAIL_HEIGHT + GAP) + GAP
  }

  /**
   * 更新屏幕宽度
   */
  updateScreenWidth(screenWidth: number): void {
    this.screenWidth = screenWidth

    this.scrollBox.updateViewportSize(screenWidth)

    // 在resize场景中使用同步渲染避免竞态条件
    this.scrollBox.renderSync()

    this.update()
  }

  updateScreenHeight(screenHeight: number): void {
    this.screenHeight = screenHeight

    // 计算实际可用的视口高度（减去标尺高度）
    const availableHeight = screenHeight - TIMELINE_RULER_HEIGHT
    // 设置视口高度为实际可用高度，让ScrollBox根据内容高度决定是否显示滚动条
    this.scrollBox.updateViewportSize(undefined, availableHeight)

    // 在resize场景中使用同步渲染避免竞态条件
    this.scrollBox.renderSync()

    this.update()

    // 视口高度变化时重新计算垂直居中位置
    this._updateRailContainerY()
  }

  updateScreenSize(screenWidth?: number, screenHeight?: number): void {
    if (screenWidth) {
      this.screenWidth = screenWidth
    }

    if (screenHeight) {
      this.screenHeight = screenHeight
    }

    const availableHeight = this.screenHeight - TIMELINE_RULER_HEIGHT

    this.scrollBox.updateViewportSize(this.screenWidth, availableHeight)

    // 在resize场景中使用同步渲染避免竞态条件
    this.scrollBox.renderSync()

    this.update()

    // 视口尺寸变化时重新计算垂直居中位置
    if (screenHeight) {
      this._updateRailContainerY()
    }
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
    // 背景绘制已移除，rails组件不负责背景

    const helper = (instance: Rail | RailGap): void => {
      instance.updateWidth(Math.max(this.width, this.screenWidth - this.offsetX))
    }

    this.rails.forEach(helper)
    this.railGaps.forEach(helper)
  }
}
