import type { Train } from './train'
import {
  TIMELINE_DOT_FILL,
  TIMELINE_DOT_NUM,
  TIMELINE_DOT_RADIUS,
  TIMELINE_RULER_ACTIVE_RANGE_FILL,
  TIMELINE_RULER_FILL,
  TIMELINE_RULER_HEIGHT,
  TIMELINE_TICK_COLOR,
  TIMELINE_TICK_FONT_SIZE,
} from '@clippc/constants'
import { drag, EventBus, getMsByPx, getPxByMs, ms2TimeStr } from '@clippc/utils'
import { Container, Graphics, Text } from 'pixi.js'
import { State } from './state'

export interface RulerOption {
  screenWidth: number
  duration: number
  listGlobalGaps?: () => Array<{ start: number, end: number, duration: number }>
  resolveGlobalGapAt?: (time: number) => { start: number, end: number, duration: number } | null
  deleteGlobalGapAt?: (time: number) => boolean
}

export type RulerEvents = {
  seek: [number]
  updateCurrentTime: [number]

  render: []
}

/**
 * 基准刻度
 */
const basicTicks = [1000, 2000, 5000]

const ticks: number [] = []

for (let index = 0; index < 3; index++) {
  basicTicks.forEach((tick) => {
    ticks.push(tick * 10 ** index)
  })
}

type GlobalGapRange = { start: number, end: number, duration: number }

const RULER_GAP_DELETE_ICON_SIZE = 14
const RULER_GAP_DELETE_ICON_RADIUS = 4
const RULER_GAP_DELETE_ICON_HIT_PADDING = 4
const RULER_GAP_DELETE_ICON_FILL = 0xF2F2F2
const RULER_GAP_DELETE_ICON_FOREGROUND = 0x171717
const RULER_GAP_GRID_COLOR = 0xFFFFFF
const RULER_GAP_GRID_SPACING = 9
const RULER_GAP_GRID_LINE_WIDTH = 1

export class Ruler extends EventBus<RulerEvents> {
  container: Container
  duration: number

  width!: number
  screenWidth: number

  state: State

  offsetX: number = 0
  private _listGlobalGaps?: () => Array<{ start: number, end: number, duration: number }>
  private _resolveGlobalGapAt?: (time: number) => { start: number, end: number, duration: number } | null
  private _deleteGlobalGapAt?: (time: number) => boolean
  private _activeTrain: Train | null = null
  private _hoveredGlobalGap: GlobalGapRange | null = null
  private _renderFrame: number | null = null
  private _scheduleRender = (): void => {
    if (this._renderFrame !== null)
      return

    this._renderFrame = requestAnimationFrame(() => {
      this._renderFrame = null
      this.render()
    })
  }

  private _activeTrainVisualHandler = (): void => {
    this._scheduleRender()
  }

  constructor(option: RulerOption) {
    super()

    this.state = State.getInstance()
    this.state.on('updatedPxPerMs', () => {
      this._processWidth()

      this.render()
    })

    this.duration = option.duration
    this._processWidth()
    this.screenWidth = option.screenWidth
    this._listGlobalGaps = option.listGlobalGaps
    this._resolveGlobalGapAt = option.resolveGlobalGapAt
    this._deleteGlobalGapAt = option.deleteGlobalGapAt

    const container = new Container({ label: 'ruler' })
    this.container = container
    container.cursor = 'pointer'
    container.eventMode = 'static'

    this.state.on('activeTrainChanged', (train) => {
      this._bindActiveTrain(train)
      this.render()
    })
    this._bindActiveTrain(this.state.activeTrain)

    this.render()

    this._bindEvents()
  }

  private _processWidth(): void {
    this.width = getPxByMs(this.duration, this.state.pxPerMs)
  }

  private _bg?: Graphics
  private _drawBg(): void {
    if (this._bg) {
      this._bg.clear()
    }
    else {
      this._bg = new Graphics({ label: 'bg' })
      this.container.addChild(this._bg)
    }

    this._bg.rect(0, 0, Math.max(this.width, this.screenWidth - this.offsetX), TIMELINE_RULER_HEIGHT)
    this._bg.fill(TIMELINE_RULER_FILL)
  }

  private _resolveTimeByX(x: number): number {
    return Math.max(0, Math.min(this.duration, getMsByPx(x, this.state.pxPerMs)))
  }

  private _isSameGlobalGap(a: GlobalGapRange | null, b: GlobalGapRange | null): boolean {
    if (!a || !b)
      return a === b

    return a.start === b.start && a.end === b.end
  }

  private _getGlobalGaps(): GlobalGapRange[] {
    if (!this._listGlobalGaps)
      return []

    return this._listGlobalGaps()
      .filter(gap => Number.isFinite(gap.start) && Number.isFinite(gap.end) && Number.isFinite(gap.duration))
      .map(gap => ({
        start: Math.max(0, gap.start),
        end: Math.max(0, gap.end),
        duration: Math.max(0, gap.duration),
      }))
      .filter(gap => gap.duration > 0 && gap.end > gap.start)
  }

  private _resolveGlobalGapByTime(time: number): GlobalGapRange | null {
    if (this._resolveGlobalGapAt)
      return this._resolveGlobalGapAt(time)

    return this._getGlobalGaps().find(gap => time >= gap.start && time < gap.end) ?? null
  }

  private _resolveGlobalGapByX(x: number): GlobalGapRange | null {
    return this._resolveGlobalGapByTime(this._resolveTimeByX(x))
  }

  private _getGlobalGapIconCenter(gap: GlobalGapRange): { x: number, y: number } {
    return {
      x: getPxByMs(gap.start + gap.duration / 2, this.state.pxPerMs),
      y: TIMELINE_RULER_HEIGHT / 2,
    }
  }

  private _isPointInGlobalGapDeleteIcon(gap: GlobalGapRange, x: number, y: number): boolean {
    const center = this._getGlobalGapIconCenter(gap)
    const half = RULER_GAP_DELETE_ICON_SIZE / 2 + RULER_GAP_DELETE_ICON_HIT_PADDING

    return x >= center.x - half
      && x <= center.x + half
      && y >= center.y - half
      && y <= center.y + half
  }

  private _normalizeHoveredGlobalGap(): void {
    if (!this._hoveredGlobalGap)
      return

    const centerTime = this._hoveredGlobalGap.start + this._hoveredGlobalGap.duration / 2
    this._hoveredGlobalGap = this._resolveGlobalGapByTime(centerTime)
  }

  private _globalGapLayer?: Graphics
  private _drawGlobalGapRect(
    layer: Graphics,
    gap: GlobalGapRange,
    gridAlpha: number,
  ): void {
    const rightLimitX = Math.max(this.screenWidth - this.offsetX, this.width)
    const startX = getPxByMs(gap.start, this.state.pxPerMs)
    const width = getPxByMs(gap.duration, this.state.pxPerMs)
    if (width <= 0)
      return

    const clampedStartX = Math.max(0, Math.min(startX, rightLimitX))
    const clampedEndX = Math.max(clampedStartX, Math.min(startX + width, rightLimitX))
    const clampedWidth = clampedEndX - clampedStartX
    if (clampedWidth <= 0)
      return

    const clampedRight = clampedStartX + clampedWidth
    const resolveDiagonalSegment = (c: number): [number, number, number, number] | null => {
      const points: Array<{ x: number, y: number }> = []
      const pushPoint = (x: number, y: number): void => {
        const exists = points.some(point =>
          Math.abs(point.x - x) <= 0.001 && Math.abs(point.y - y) <= 0.001,
        )
        if (!exists)
          points.push({ x, y })
      }

      const topX = c
      if (topX >= clampedStartX && topX <= clampedRight)
        pushPoint(topX, 0)

      const bottomX = c + TIMELINE_RULER_HEIGHT
      if (bottomX >= clampedStartX && bottomX <= clampedRight)
        pushPoint(bottomX, TIMELINE_RULER_HEIGHT)

      const leftY = clampedStartX - c
      if (leftY >= 0 && leftY <= TIMELINE_RULER_HEIGHT)
        pushPoint(clampedStartX, leftY)

      const rightY = clampedRight - c
      if (rightY >= 0 && rightY <= TIMELINE_RULER_HEIGHT)
        pushPoint(clampedRight, rightY)

      if (points.length < 2)
        return null

      return [points[0].x, points[0].y, points[1].x, points[1].y]
    }

    for (let c = clampedStartX - TIMELINE_RULER_HEIGHT; c <= clampedRight; c += RULER_GAP_GRID_SPACING) {
      const segment = resolveDiagonalSegment(c)
      if (!segment)
        continue

      const [x1, y1, x2, y2] = segment
      layer
        .moveTo(x1, y1)
        .lineTo(x2, y2)
        .stroke({ color: RULER_GAP_GRID_COLOR, alpha: gridAlpha, width: RULER_GAP_GRID_LINE_WIDTH })
    }

    const topY = RULER_GAP_GRID_LINE_WIDTH / 2
    const bottomY = TIMELINE_RULER_HEIGHT - RULER_GAP_GRID_LINE_WIDTH / 2
    const leftBorderX = clampedStartX + RULER_GAP_GRID_LINE_WIDTH / 2
    const rightBorderX = clampedRight - RULER_GAP_GRID_LINE_WIDTH / 2
    const borderAlpha = Math.min(1, gridAlpha + 0.1)
    layer
      .moveTo(clampedStartX, topY)
      .lineTo(clampedRight, topY)
      .stroke({ color: RULER_GAP_GRID_COLOR, alpha: borderAlpha, width: RULER_GAP_GRID_LINE_WIDTH })
      .moveTo(clampedStartX, bottomY)
      .lineTo(clampedRight, bottomY)
      .stroke({ color: RULER_GAP_GRID_COLOR, alpha: borderAlpha, width: RULER_GAP_GRID_LINE_WIDTH })
      .moveTo(leftBorderX, 0)
      .lineTo(leftBorderX, TIMELINE_RULER_HEIGHT)
      .stroke({ color: RULER_GAP_GRID_COLOR, alpha: borderAlpha, width: RULER_GAP_GRID_LINE_WIDTH })
      .moveTo(rightBorderX, 0)
      .lineTo(rightBorderX, TIMELINE_RULER_HEIGHT)
      .stroke({ color: RULER_GAP_GRID_COLOR, alpha: borderAlpha, width: RULER_GAP_GRID_LINE_WIDTH })
  }

  private _drawGlobalGaps(): void {
    if (this._globalGapLayer) {
      this._globalGapLayer.clear()
    }
    else {
      this._globalGapLayer = new Graphics({ label: 'global-gap-range' })
      this.container.addChild(this._globalGapLayer)
    }

    const globalGaps = this._getGlobalGaps()
    for (const gap of globalGaps) {
      this._drawGlobalGapRect(this._globalGapLayer, gap, 0.72)
    }

    if (this._hoveredGlobalGap)
      this._drawGlobalGapRect(this._globalGapLayer, this._hoveredGlobalGap, 0.92)

    // keep global gap layer above ruler ticks
    this.container.addChild(this._globalGapLayer)
  }

  private _globalGapDeleteIconLayer?: Graphics
  private _drawGlobalGapDeleteIcon(gap: GlobalGapRange): void {
    if (!this._globalGapDeleteIconLayer)
      return

    const center = this._getGlobalGapIconCenter(gap)
    const iconLeft = center.x - RULER_GAP_DELETE_ICON_SIZE / 2
    const iconTop = center.y - RULER_GAP_DELETE_ICON_SIZE / 2
    const binWidth = 8
    const binHeight = 7
    const binLeft = center.x - binWidth / 2
    const binTop = center.y - 1

    this._globalGapDeleteIconLayer
      .roundRect(iconLeft, iconTop, RULER_GAP_DELETE_ICON_SIZE, RULER_GAP_DELETE_ICON_SIZE, RULER_GAP_DELETE_ICON_RADIUS)
      .fill({ color: RULER_GAP_DELETE_ICON_FILL, alpha: 0.96 })
      .roundRect(binLeft, binTop, binWidth, binHeight, 1)
      .fill({ color: RULER_GAP_DELETE_ICON_FOREGROUND, alpha: 0.98 })
      .roundRect(center.x - 5, binTop - 2.5, 10, 2, 1)
      .fill({ color: RULER_GAP_DELETE_ICON_FOREGROUND, alpha: 0.98 })
      .roundRect(center.x - 1.5, binTop - 4, 3, 1.5, 0.75)
      .fill({ color: RULER_GAP_DELETE_ICON_FOREGROUND, alpha: 0.98 })
  }

  private _drawHoveredGlobalGapDeleteIcon(): void {
    if (this._globalGapDeleteIconLayer) {
      this._globalGapDeleteIconLayer.clear()
    }
    else {
      this._globalGapDeleteIconLayer = new Graphics({ label: 'global-gap-delete-icon' })
      this.container.addChild(this._globalGapDeleteIconLayer)
    }

    if (this._hoveredGlobalGap)
      this._drawGlobalGapDeleteIcon(this._hoveredGlobalGap)

    this.container.addChild(this._globalGapDeleteIconLayer)
  }

  private _activeTrainRange?: Graphics
  private _resolveActiveTrainRangeMs(): { start: number, duration: number } | null {
    if (!this._activeTrain)
      return null

    if (this._activeTrain.dragStatus === 'free')
      return null

    if (!this._activeTrain.parent) {
      return {
        start: Math.max(0, this._activeTrain.start),
        duration: Math.max(0, this._activeTrain.duration),
      }
    }

    const startPx = this._activeTrain.container.x
    const endPx = startPx + Math.max(0, this._activeTrain.width)
    const startMs = this._activeTrain.parent.getRawMsByVisualPx(this._activeTrain, startPx)
    const endMs = this._activeTrain.parent.getRawMsByVisualPx(this._activeTrain, endPx)
    const durationMs = Math.max(0, endMs - startMs)

    if (!Number.isFinite(startMs) || !Number.isFinite(durationMs)) {
      return {
        start: Math.max(0, this._activeTrain.start),
        duration: Math.max(0, this._activeTrain.duration),
      }
    }

    return {
      start: Math.max(0, startMs),
      duration: durationMs,
    }
  }

  private _drawActiveTrainRange(): void {
    if (this._activeTrainRange) {
      this._activeTrainRange.clear()
    }
    else {
      this._activeTrainRange = new Graphics({ label: 'active-train-range' })
      this.container.addChild(this._activeTrainRange)
    }

    const activeRange = this._resolveActiveTrainRangeMs()
    if (!activeRange)
      return

    const rangeX = getPxByMs(activeRange.start, this.state.pxPerMs)
    const rangeWidth = getPxByMs(activeRange.duration, this.state.pxPerMs)
    if (rangeWidth <= 0)
      return

    const rightLimitX = Math.max(this.screenWidth - this.offsetX, this.width)
    const clampedStartX = Math.max(0, Math.min(rangeX, rightLimitX))
    const clampedEndX = Math.max(clampedStartX, Math.min(rangeX + rangeWidth, rightLimitX))
    const clampedWidth = clampedEndX - clampedStartX
    if (clampedWidth <= 0)
      return

    this._activeTrainRange.rect(clampedStartX, 0, clampedWidth, TIMELINE_RULER_HEIGHT)
    this._activeTrainRange.fill(TIMELINE_RULER_ACTIVE_RANGE_FILL)
    // keep active range above ruler ticks
    this.container.addChild(this._activeTrainRange)
  }

  private _bindActiveTrain(train: Train | null): void {
    if (this._activeTrain === train)
      return

    if (this._activeTrain) {
      this._activeTrain.off('afterMove', this._activeTrainVisualHandler)
      this._activeTrain.off('beforeLeftResize', this._activeTrainVisualHandler)
      this._activeTrain.off('beforeRightResize', this._activeTrainVisualHandler)
      this._activeTrain.off('moveEnd', this._activeTrainVisualHandler)
      this._activeTrain.off('leftResizeEnd', this._activeTrainVisualHandler)
      this._activeTrain.off('rightResizeEnd', this._activeTrainVisualHandler)
    }

    this._activeTrain = train

    if (!this._activeTrain)
      return

    this._activeTrain.on('afterMove', this._activeTrainVisualHandler)
    this._activeTrain.on('beforeLeftResize', this._activeTrainVisualHandler)
    this._activeTrain.on('beforeRightResize', this._activeTrainVisualHandler)
    this._activeTrain.on('moveEnd', this._activeTrainVisualHandler)
    this._activeTrain.on('leftResizeEnd', this._activeTrainVisualHandler)
    this._activeTrain.on('rightResizeEnd', this._activeTrainVisualHandler)
  }

  private _textPool: Text[] = []

  private _drawTextTime(x: number, content: string): Text {
    let text: Text
    if (this._textPool.length > 0) {
      text = this._textPool.pop()!
      text.text = content
      text.x = x
      text.y = TIMELINE_RULER_HEIGHT / 2
      text.visible = true
    }
    else {
      text = new Text({
        style: {
          fontSize: TIMELINE_TICK_FONT_SIZE,
          fill: TIMELINE_TICK_COLOR,
        },
        x,
        y: TIMELINE_RULER_HEIGHT / 2,
        text: content,
      })
      text.anchor.set(0.5)
    }

    return text
  }

  private _minTickSpacingPx = 120
  private get _tick(): number {
    const tick = ticks.find((tick) => {
      return getPxByMs(tick, this.state.pxPerMs) >= this._minTickSpacingPx
    }) || ticks[ticks.length - 1]

    return tick
  }

  private _ticksWrapper?: Container
  private _drawTick(): void {
    const ticksWrapper = new Container()

    // Batching: One Graphics for all dots
    const dotsGraphics = new Graphics()
    ticksWrapper.addChild(dotsGraphics)

    const tick = this._tick
    const gap = getPxByMs(tick, this.state.pxPerMs)
    const dotGap = gap / (TIMELINE_DOT_NUM + 1)

    // Calculate visible range with buffer
    const buffer = 200 // 200px buffer to prevent pop-in
    const startX = -this.offsetX - buffer
    const endX = -this.offsetX + this.screenWidth + buffer

    // Calculate start index to skip invisible ticks
    const startIndex = Math.max(0, Math.floor(startX / gap))

    const rightLimitX = Math.max(this.screenWidth - this.offsetX, this.width)
    const effectiveEndX = Math.min(endX, rightLimitX)

    const drawDotGroup = (baseX: number): void => {
      for (let index = 0; index < TIMELINE_DOT_NUM; index++) {
        const dotX = baseX + dotGap * (index + 1)
        if (dotX >= startX && dotX <= effectiveEndX) {
          // Batching: Draw directly to shared graphics
          dotsGraphics.circle(dotX, TIMELINE_RULER_HEIGHT / 2, TIMELINE_DOT_RADIUS)
        }
      }
    }

    // Draw 0 tick if visible
    if (startX <= 0 && effectiveEndX >= 0) {
      const zeroText = this._drawTextTime(0, '0')
      ticksWrapper.addChild(zeroText)
    }

    // Loop through ticks, starting from visible range
    for (let i = startIndex; ; i++) {
      const currentTickX = i * gap
      if (currentTickX > effectiveEndX)
        break

      // Draw dots after this tick
      drawDotGroup(currentTickX)

      // Draw next tick text
      const nextTickX = (i + 1) * gap

      // Stop if we go beyond visible range or physical limit
      if (nextTickX > effectiveEndX) {
        break
      }

      const text = this._drawTextTime(nextTickX, ms2TimeStr((i + 1) * tick))
      ticksWrapper.addChild(text)
    }

    // Batching: Fill all dots at once
    dotsGraphics.fill(TIMELINE_DOT_FILL)

    if (this._ticksWrapper) {
      // Recycle Text objects and destroy others
      const children = this._ticksWrapper.removeChildren()
      for (const child of children) {
        if (child instanceof Text) {
          child.visible = false
          this._textPool.push(child)
        }
        else {
          child.destroy()
        }
      }

      if (!this._ticksWrapper.destroyed) {
        this._ticksWrapper.destroy()
      }
      this.container.removeChild(this._ticksWrapper)
    }

    this.container.addChild(ticksWrapper)
    this._ticksWrapper = ticksWrapper
  }

  private _bindEvents(): void {
    let x: number
    let skipSeekUntilPointerUp = false

    const updateHoveredGlobalGap = (localX: number, localY: number): void => {
      const nextGap = localY >= 0 && localY <= TIMELINE_RULER_HEIGHT
        ? this._resolveGlobalGapByX(localX)
        : null
      if (this._isSameGlobalGap(this._hoveredGlobalGap, nextGap))
        return

      this._hoveredGlobalGap = nextGap
      this.render()
    }

    const seek = (): void => {
      const seekTime = this._resolveTimeByX(x)
      this.emit('updateCurrentTime', seekTime)
    }

    this.container.on('pointermove', (e) => {
      const point = e.getLocalPosition(this.container)
      updateHoveredGlobalGap(point.x, point.y)
    })

    this.container.on('pointerleave', () => {
      if (!this._hoveredGlobalGap)
        return

      this._hoveredGlobalGap = null
      this.render()
    })

    drag(this.container, {
      down: (e) => {
        const point = e.getLocalPosition(this.container)
        x = point.x
        updateHoveredGlobalGap(point.x, point.y)

        const targetGap = this._resolveGlobalGapByX(point.x)
        if (targetGap && this._isPointInGlobalGapDeleteIcon(targetGap, point.x, point.y)) {
          const deleted = this._deleteGlobalGapAt?.(this._resolveTimeByX(point.x)) ?? false
          if (deleted) {
            this._hoveredGlobalGap = this._resolveGlobalGapByX(point.x)
            this.render()
          }

          skipSeekUntilPointerUp = true
          return
        }

        skipSeekUntilPointerUp = false
        seek()
      },
      move: (_, { dx }) => {
        if (skipSeekUntilPointerUp)
          return

        x += dx
        seek()
      },
      up: () => {
        skipSeekUntilPointerUp = false
      },
    })
  }

  updateScreenWidth(screenWidth: number): void {
    this.screenWidth = screenWidth
    this.render()
  }

  updateOffsetX(offsetX: number): void {
    this.offsetX = offsetX
    this.render()
  }

  updateDuration(duration: number): void {
    this.duration = duration
    this._processWidth()

    this.render()
  }

  /**
   * Renders the ruler component.
   *
   * This method removes all the children of the container and then re-renders the
   * background and tick elements.
   */
  render(): void {
    if (this.width === 0)
      return

    this._normalizeHoveredGlobalGap()
    this._drawBg()
    this._drawTick()
    this._drawGlobalGaps()
    this._drawActiveTrainRange()
    this._drawHoveredGlobalGapDeleteIcon()

    this.emit('render')
  }
}
