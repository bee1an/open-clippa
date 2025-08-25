import type { Container, FederatedPointerEvent } from 'pixi.js'
import type { TrainOption } from './train'
import { EventBus, getPxByMs } from '@clippa/utils'
import { Graphics } from 'pixi.js'
import { Rail, RAIL_HEIGHT } from './rail'
import { GAP, RailGap } from './railGap'
import { RULER_HEIGHT } from './ruler'
import { ScrollBox } from './scrollBox'
import { State } from './state'

export interface RailsOption {
  screenWidth: number
  screenHeight: number
  duration: number
  maxZIndex: number
}

export type RailsEvents = {
  scroll: [{ x: number, y: number }]
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

  state: State

  width!: number
  screenWidth: number
  screenHeight: number

  duration: number

  maxZIndex: number

  get offsetX(): number {
    return this.scrollBox.offsetX
  }

  get offsetY(): number {
    return this.scrollBox.offsetY
  }

  constructor(option: RailsOption) {
    super()
    const processWidth = (): void => {
      this.width = getPxByMs(this.duration, this.state.pxPerMs)
    }

    this.state = State.getInstance()
    this.state.on('updatedPxPerMs', () => {
      processWidth()

      this.update()
    })

    this.duration = option.duration
    processWidth()
    this.screenWidth = option.screenWidth
    this.screenHeight = option.screenHeight
    this.maxZIndex = option.maxZIndex

    this.scrollBox = new ScrollBox()

    this.scrollBox.on('toggleXBarVisible', (visible) => {
      this.scrollBox.updateScrollMore({ y: visible ? this.scrollBox.barHeight : 0 })
    })

    this.scrollBox.on('toggleYBarVisible', (visible) => {
      this.scrollBox.updateScrollMore({ x: visible ? this.scrollBox.barWidth : 0 })
    })

    this.scrollBox.on('scroll', event => this.emit('scroll', event))

    this.container.y = RULER_HEIGHT

    this._drawBg()

    this._drawBody()

    this._bindEvents()
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
      train.updatePos(undefined, rail.y + train.y)
      train.updateState('free')

      this.container.addChild(train.container)
    })

    rail.on('trainsPosUpdated', () => {
      this.scrollBox.update()
    })

    this._insertRailByZIndex(rail, zIndex)

    this.container.addChild(rail.container)

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

    this.container.addChild(gap.container)

    return gap
  }

  private _drawBody(): void {
    this._createRailGap(this.maxZIndex + 1)

    for (let index = 0; index <= this.maxZIndex; index++) {
      const zIndex = this.maxZIndex - index

      this._createRail(this.maxZIndex - index, [
        // { start: 500, duration: 1000 },
        { start: 2000, duration: 1500 },
        // { start: 5000, duration: 2000 },
      ])

      this._createRailGap(zIndex)
    }
  }

  private _bg?: Graphics
  private _drawBg(): void {
    const bgColor = 'transparent'

    const w = Math.max(this.width, this.screenWidth - this.offsetX)
    const h = this.screenHeight - RULER_HEIGHT

    if (this._bg) {
      this._bg.clear().rect(0, 0, w, h).fill(bgColor)
      return
    }

    this._bg = new Graphics()
    this._bg.rect(0, 0, w, h).fill(bgColor)
    this.container.addChild(this._bg)
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
    this.container.on('pointermove', (e) => {
      if (!this.state.trainDragging)
        return

      clearTimeout(timeId)

      timeId = window.setTimeout(() => {
        this._stayWhenDragging(e)
      }, 500)

      const { x, y } = e.getLocalPosition(this.container)

      const rail = this.rails.find((rail) => {
        const bounds = rail.container.getLocalBounds()
        bounds.y = rail.y

        return rail.container.getLocalBounds().containsPoint(x, y - this.offsetY)
      })

      const atTrain = this.state.atDragTrain!

      if (rail && !rail.trains.includes(atTrain)) {
        rail.insertTrain(atTrain)

        atTrain.updateState('normal')
        atTrain.updatePos(undefined, atTrain.y - rail.y)

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

        this.maxZIndex = Math.max(this.rails[0].zIndex, zIndex)

        /* move train to new rail */
        const rail = this._createRail(zIndex)
        this._createRailGap(zIndex)

        rail.insertTrain(atTrain)

        atTrain.updateState('normal')
      }

      if (atTrain.dragStatus === 'free')
        return

      /* check rail whether need to remove */
      const emptyRail = this.rails.find(rail => rail.trains.length === 0)

      if (emptyRail)
        this.removeRail(emptyRail)

      // console.log('', this.rails.map(i => i.zIndex), this.railGaps.map(i => i.zIndex))
    })
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
        this.container.removeChild(item.container)

      return itemZIndex !== zIndex
    })

    this.container.removeChild(rail.container)

    this.scrollBox.update()
  }

  getRailByZIndex(zIndex: number): Rail {
    return this.rails[this.maxZIndex - zIndex]
  }

  private _stayWhenDragging(e: FederatedPointerEvent): void {
    const { x, y } = e.getLocalPosition(this.container)

    const gap = this.railGaps.find((gap) => {
      const bounds = gap.container.getLocalBounds()
      bounds.y = gap.y

      return gap.container.getLocalBounds().containsPoint(x, y - this.offsetY)
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

    this.scrollBox.updateViewportSize(undefined, screenHeight - RULER_HEIGHT)

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

    this.scrollBox.updateViewportSize(this.screenWidth, this.screenHeight - RULER_HEIGHT)

    this.scrollBox.update()

    this.update()
  }

  update(): void {
    this._drawBg()

    const helper = (instance: Rail | RailGap): void => {
      instance.updateWidth(Math.max(this.width, this.screenWidth - this.offsetX))
    }

    this.rails.forEach(helper)
    this.railGaps.forEach(helper)
  }
}
