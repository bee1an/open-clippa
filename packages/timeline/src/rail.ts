import type { FederatedPointerEvent } from 'pixi.js'
import type { TrainOption } from './train'
import type { TrainRailStyle } from './train/types'
import {
  PRIMARYCOLOR,
  TIMELINE_FILTER_TRAIN_HEIGHT,
  TIMELINE_RAIL_FILL,
  TIMELINE_TEXT_TRAIN_HEIGHT,
  TIMELINE_TRAIN_BORDER_SIZE,
  TIMELINE_TRAIN_CONNECTION_TIME_PX,
  TIMELINE_TRAIN_HEIGHT,
  TIMELINE_TRAIN_SEAM_EPSILON,
  TIMELINE_TRAIN_SEAM_WIDTH,
} from '@clippc/constants'
import { EventBus, getMsByPx, getPxByMs, isIntersection } from '@clippc/utils'
import { Container, Graphics } from 'pixi.js'
import { State } from './state'
import { Train } from './train'
import { collectAdjacentBoundaries, collectTrainJoinStates } from './utils/seam'

/**
 * rail height
 */
export const RAIL_HEIGHT = TIMELINE_TRAIN_HEIGHT
const COMPACT_RAIL_PADDING = 4

export function getRailHeightByStyle(railStyle: TrainRailStyle): number {
  if (railStyle === 'text')
    return TIMELINE_TEXT_TRAIN_HEIGHT + COMPACT_RAIL_PADDING

  if (railStyle === 'filter')
    return TIMELINE_FILTER_TRAIN_HEIGHT + COMPACT_RAIL_PADDING

  return RAIL_HEIGHT
}

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
  railStyle?: TrainRailStyle
  trainsOption: TrainOption[]
}

export interface RailTransitionHandle {
  id: string
  pairKey: string
  fromId: string
  toId: string
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

  /**
   * selected gap changed
   */
  gapSelectionChanged: [ClosableGap | null]

  transitionHandleClick: [RailTransitionHandle]
}

type ClosableGap = {
  leftTrain: Train | null
  rightTrain: Train
  leftX: number
  rightX: number
  gapMs: number
}

const GAP_DELETE_ICON_SIZE = 16
const GAP_DELETE_ICON_RADIUS = 4
const GAP_DELETE_ICON_HIT_PADDING = 4
const GAP_DELETE_ICON_FILL = 0xF2F2F2
const GAP_DELETE_ICON_FOREGROUND = 0x171717
const GAP_GRID_COLOR = 0xFFFFFF
const GAP_GRID_SPACING = 9
const GAP_GRID_LINE_WIDTH = 1
const TRANSITION_HANDLE_HIT_RADIUS = 14
const TRANSITION_HANDLE_VISIBLE_RADIUS = 10
const TRANSITION_HANDLE_STROKE_WIDTH = 1.5
const RAIL_SEAM_LAYER_Z_INDEX = 20
const RAIL_GAP_LAYER_Z_INDEX = 30
const RAIL_TRANSITION_HANDLE_LAYER_Z_INDEX = 40
const TRANSITION_HANDLE_IDLE_FILL = '#16181f'
const TRANSITION_HANDLE_IDLE_STROKE = '#8d8f99'
const TRANSITION_HANDLE_IDLE_ICON = '#f2f2f2'
const TRANSITION_HANDLE_ACTIVE_FILL = PRIMARYCOLOR
const TRANSITION_HANDLE_ACTIVE_STROKE = PRIMARYCOLOR
const TRANSITION_HANDLE_ACTIVE_ICON = '#171717'
const TRANSITION_HANDLE_HOVER_RING = '#f2f2f2'

export class Rail extends EventBus<RailEvents> {
  container: Container
  width: number
  y: number
  height: number
  railStyle: TrainRailStyle

  /**
   * trains, is sorted
   */
  trains: Train[] = []
  duration: number
  zIndex: number
  state: State = State.getInstance()
  private _seamLayer: Graphics
  private _gapInteractionLayer: Graphics
  private _transitionHandleLayer: Graphics
  private _hoveredGap: ClosableGap | null = null
  private _selectedGap: ClosableGap | null = null
  private _transitionHandles: RailTransitionHandle[] = []
  private _hoveredTransitionPairKey: string | null = null
  private _activeTransitionPairKey: string | null = null
  private _dragDockState = new Map<Train, { target: Train, side: 'left' | 'right', escapeOffset: number }>()
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

  private _applyDock(
    train: Train,
    event: { xValue: number },
    target: Train,
    side: 'left' | 'right',
  ): void {
    const dockX = this._getDockX(train, target, side)
    const currentDockState = this._dragDockState.get(train)
    const keepEscapeOffset = currentDockState
      && currentDockState.target === target
      && currentDockState.side === side

    this._dragDockState.set(train, {
      target,
      side,
      escapeOffset: keepEscapeOffset ? currentDockState.escapeOffset : 0,
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

  private _getRailTrainStyle(): Train['railStyle'] | null {
    if (this.trains.length === 0)
      return this.railStyle

    return this.trains[0].railStyle
  }

  canAcceptTrain(train: Train): boolean {
    const currentStyle = this._getRailTrainStyle()
    if (!currentStyle)
      return true

    return currentStyle === train.railStyle
  }

  setRailStyle(railStyle: TrainRailStyle): boolean {
    if (this.railStyle === railStyle)
      return false

    if (this.trains.length > 0)
      return false

    this.railStyle = railStyle
    this.height = getRailHeightByStyle(railStyle)
    this._drawBg()
    this._drawAdjacentSeams()
    this._renderTransitionHandles()
    return true
  }

  private _refreshVisualLayoutAndAdjacentVisuals(): void {
    this._syncVisualLayoutFromRawTimings()
    this._refreshAdjacentVisuals()
  }

  private _refreshAdjacentVisuals(): void {
    this._syncTrainJoinState()
    this._drawAdjacentSeams()
    this._refreshGapInteractionAfterLayout()
    this._renderTransitionHandles()
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
    this.railStyle = option.railStyle ?? 'default'
    this.height = getRailHeightByStyle(this.railStyle)

    this.container = new Container({ y: this.y, label: 'rail', sortableChildren: true })

    this._drawBg()
    this._seamLayer = this._createSeamLayer()
    this._gapInteractionLayer = this._createGapInteractionLayer()
    this._transitionHandleLayer = this._createTransitionHandleLayer()

    option.trainsOption.forEach(item => this.insertTrain(new Train(item)))

    this._bindEvents()
    this._bindPxPerMsEvents()
    this._refreshVisualLayoutAndAdjacentVisuals()
  }

  /**
   * 每一次拖拽前对事件进行拦截
   *
   * 拖拽吸附状态机:
   * 1. 吸附保持: 已吸附时在释放阈值内维持锁定, 防止抖动
   * 2. 吸附进入: 接近连接位时吸附
   */
  private _trainBeforeMoveHandle = (event: { xValue: number }, train: Train): void => {
    const proposedX = Math.max(0, event.xValue)
    const cachedDock = this._dragDockState.get(train)

    if (cachedDock) {
      const dockX = this._getDockX(train, cachedDock.target, cachedDock.side)
      cachedDock.escapeOffset += proposedX - dockX
      const distance = Math.abs(cachedDock.escapeOffset)

      if (distance < this._getDockSnapExitPx()) {
        this._applyDock(train, event, cachedDock.target, cachedDock.side)
        return
      }

      this._dragDockState.delete(train)
      train.updateState('normal')
      event.xValue = Math.max(0, dockX + cachedDock.escapeOffset)
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
    seamLayer.zIndex = RAIL_SEAM_LAYER_Z_INDEX
    seamLayer.visible = true
    this.container.addChild(seamLayer)
    return seamLayer
  }

  private _createGapInteractionLayer(): Graphics {
    const gapInteractionLayer = new Graphics({ label: 'rail-gap-interaction' })
    gapInteractionLayer.eventMode = 'none'
    gapInteractionLayer.zIndex = RAIL_GAP_LAYER_Z_INDEX
    gapInteractionLayer.visible = true
    this.container.addChild(gapInteractionLayer)
    return gapInteractionLayer
  }

  private _createTransitionHandleLayer(): Graphics {
    const transitionHandleLayer = new Graphics({ label: 'rail-transition-handle' })
    transitionHandleLayer.eventMode = 'static'
    transitionHandleLayer.zIndex = RAIL_TRANSITION_HANDLE_LAYER_Z_INDEX
    transitionHandleLayer.visible = true
    this.container.addChild(transitionHandleLayer)
    return transitionHandleLayer
  }

  private _resolveTransitionHandleCenter(handle: RailTransitionHandle): { x: number, y: number } | null {
    const fromTrain = this.trains.find(train => train.id === handle.fromId)
    if (!fromTrain)
      return null

    return {
      x: fromTrain.container.x + fromTrain.width,
      y: fromTrain.container.y + fromTrain.height / 2,
    }
  }

  private _resolveTransitionHandleByPoint(x: number, y: number): RailTransitionHandle | null {
    for (const handle of this._transitionHandles) {
      const center = this._resolveTransitionHandleCenter(handle)
      if (!center)
        continue

      const dx = x - center.x
      const dy = y - center.y
      if (Math.sqrt(dx * dx + dy * dy) <= TRANSITION_HANDLE_HIT_RADIUS)
        return handle
    }

    return null
  }

  private _drawTransitionHandleGlyph(centerX: number, centerY: number, color: string): void {
    this._transitionHandleLayer
      .moveTo(centerX - 5, centerY - 3)
      .lineTo(centerX - 1, centerY)
      .lineTo(centerX - 5, centerY + 3)
      .stroke({ color, alpha: 0.98, width: 1.6, cap: 'round', join: 'round' })
      .moveTo(centerX + 1, centerY - 3)
      .lineTo(centerX + 5, centerY)
      .lineTo(centerX + 1, centerY + 3)
      .stroke({ color, alpha: 0.98, width: 1.6, cap: 'round', join: 'round' })
  }

  private _renderTransitionHandles(): void {
    this._transitionHandleLayer.clear()

    for (const handle of this._transitionHandles) {
      const center = this._resolveTransitionHandleCenter(handle)
      if (!center)
        continue

      const isHovered = this._hoveredTransitionPairKey === handle.pairKey
      const isActive = this._activeTransitionPairKey === handle.pairKey
      const isVisible = isHovered || isActive

      this._transitionHandleLayer
        .circle(center.x, center.y, TRANSITION_HANDLE_HIT_RADIUS)
        .fill({ color: '#000000', alpha: 0.001 })

      if (!isVisible)
        continue

      if (isHovered && !isActive) {
        this._transitionHandleLayer
          .circle(center.x, center.y, TRANSITION_HANDLE_VISIBLE_RADIUS + 2)
          .fill({ color: TRANSITION_HANDLE_HOVER_RING, alpha: 0.12 })
      }

      const fill = isActive ? TRANSITION_HANDLE_ACTIVE_FILL : TRANSITION_HANDLE_IDLE_FILL
      const stroke = isActive ? TRANSITION_HANDLE_ACTIVE_STROKE : TRANSITION_HANDLE_IDLE_STROKE
      const iconColor = isActive ? TRANSITION_HANDLE_ACTIVE_ICON : TRANSITION_HANDLE_IDLE_ICON

      this._transitionHandleLayer
        .circle(center.x, center.y, TRANSITION_HANDLE_VISIBLE_RADIUS)
        .fill({ color: fill, alpha: 0.96 })
        .circle(center.x, center.y, TRANSITION_HANDLE_VISIBLE_RADIUS)
        .stroke({ color: stroke, alpha: 0.98, width: TRANSITION_HANDLE_STROKE_WIDTH })

      this._drawTransitionHandleGlyph(center.x, center.y, iconColor)
    }
  }

  private _setHoveredTransitionPairKey(pairKey: string | null): void {
    if (this._hoveredTransitionPairKey === pairKey)
      return

    this._hoveredTransitionPairKey = pairKey
    this._renderTransitionHandles()
  }

  private _isSameGap(a: ClosableGap | null, b: ClosableGap | null): boolean {
    if (!a || !b)
      return a === b

    return a.leftTrain === b.leftTrain && a.rightTrain === b.rightTrain
  }

  private _collectClosableGaps(): ClosableGap[] {
    if (this.trains.length === 0)
      return []

    const sorted = [...this.trains].sort((a, b) => a.start - b.start)
    const result: ClosableGap[] = []
    const firstTrain = sorted[0]

    const leadingGapMs = firstTrain.start
    if (leadingGapMs > TIMELINE_TRAIN_SEAM_EPSILON) {
      const leftX = 0
      const rightX = firstTrain.container.x
      if (rightX - leftX > TIMELINE_TRAIN_SEAM_EPSILON) {
        result.push({
          leftTrain: null,
          rightTrain: firstTrain,
          leftX,
          rightX,
          gapMs: leadingGapMs,
        })
      }
    }

    if (sorted.length < 2)
      return result

    for (let i = 0; i < sorted.length - 1; i++) {
      const leftTrain = sorted[i]
      const rightTrain = sorted[i + 1]
      const gapMs = rightTrain.start - (leftTrain.start + leftTrain.duration)
      if (gapMs <= TIMELINE_TRAIN_SEAM_EPSILON)
        continue

      const leftX = leftTrain.container.x + leftTrain.width
      const rightX = rightTrain.container.x
      if (rightX - leftX <= TIMELINE_TRAIN_SEAM_EPSILON)
        continue

      result.push({
        leftTrain,
        rightTrain,
        leftX,
        rightX,
        gapMs,
      })
    }

    return result
  }

  private _findGapByTrains(leftTrain: Train | null, rightTrain: Train): ClosableGap | null {
    return this._collectClosableGaps().find(gap => gap.leftTrain === leftTrain && gap.rightTrain === rightTrain) ?? null
  }

  private _resolveGapByPoint(x: number, y: number): ClosableGap | null {
    if (y < 0 || y > this.height)
      return null

    const gaps = this._collectClosableGaps()
    for (const gap of gaps) {
      if (x >= gap.leftX && x <= gap.rightX)
        return gap
    }

    return null
  }

  private _resolveIconGap(): ClosableGap | null {
    return this._hoveredGap ?? this._selectedGap
  }

  private _getIconCenter(gap: ClosableGap): { x: number, y: number } {
    return {
      x: (gap.leftX + gap.rightX) / 2,
      y: this.height / 2,
    }
  }

  private _isPointInDeleteIcon(gap: ClosableGap, x: number, y: number): boolean {
    const center = this._getIconCenter(gap)
    const half = GAP_DELETE_ICON_SIZE / 2 + GAP_DELETE_ICON_HIT_PADDING

    return x >= center.x - half
      && x <= center.x + half
      && y >= center.y - half
      && y <= center.y + half
  }

  private _drawDeleteIcon(gap: ClosableGap): void {
    const center = this._getIconCenter(gap)
    const iconLeft = center.x - GAP_DELETE_ICON_SIZE / 2
    const iconTop = center.y - GAP_DELETE_ICON_SIZE / 2
    const binWidth = 8
    const binHeight = 7
    const binLeft = center.x - binWidth / 2
    const binTop = center.y - 1

    this._gapInteractionLayer
      .roundRect(iconLeft, iconTop, GAP_DELETE_ICON_SIZE, GAP_DELETE_ICON_SIZE, GAP_DELETE_ICON_RADIUS)
      .fill({ color: GAP_DELETE_ICON_FILL, alpha: 0.96 })
      .roundRect(binLeft, binTop, binWidth, binHeight, 1)
      .fill({ color: GAP_DELETE_ICON_FOREGROUND, alpha: 0.98 })
      .roundRect(center.x - 5, binTop - 2.5, 10, 2, 1)
      .fill({ color: GAP_DELETE_ICON_FOREGROUND, alpha: 0.98 })
      .roundRect(center.x - 1.5, binTop - 4, 3, 1.5, 0.75)
      .fill({ color: GAP_DELETE_ICON_FOREGROUND, alpha: 0.98 })
  }

  private _drawGapGrid(leftX: number, rightX: number, gridAlpha: number): void {
    const width = rightX - leftX
    if (width <= TIMELINE_TRAIN_SEAM_EPSILON)
      return

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
      if (topX >= leftX && topX <= rightX)
        pushPoint(topX, 0)

      const bottomX = c + this.height
      if (bottomX >= leftX && bottomX <= rightX)
        pushPoint(bottomX, this.height)

      const leftY = leftX - c
      if (leftY >= 0 && leftY <= this.height)
        pushPoint(leftX, leftY)

      const rightY = rightX - c
      if (rightY >= 0 && rightY <= this.height)
        pushPoint(rightX, rightY)

      if (points.length < 2)
        return null

      return [points[0].x, points[0].y, points[1].x, points[1].y]
    }

    for (let c = leftX - this.height; c <= rightX; c += GAP_GRID_SPACING) {
      const segment = resolveDiagonalSegment(c)
      if (!segment)
        continue

      const [x1, y1, x2, y2] = segment
      this._gapInteractionLayer
        .moveTo(x1, y1)
        .lineTo(x2, y2)
        .stroke({ color: GAP_GRID_COLOR, alpha: gridAlpha, width: GAP_GRID_LINE_WIDTH })
    }

    const topY = GAP_GRID_LINE_WIDTH / 2
    const bottomY = this.height - GAP_GRID_LINE_WIDTH / 2
    const leftBorderX = leftX + GAP_GRID_LINE_WIDTH / 2
    const rightBorderX = rightX - GAP_GRID_LINE_WIDTH / 2
    const borderAlpha = Math.min(1, gridAlpha + 0.12)
    this._gapInteractionLayer
      .moveTo(leftX, topY)
      .lineTo(rightX, topY)
      .stroke({ color: GAP_GRID_COLOR, alpha: borderAlpha, width: GAP_GRID_LINE_WIDTH })
      .moveTo(leftX, bottomY)
      .lineTo(rightX, bottomY)
      .stroke({ color: GAP_GRID_COLOR, alpha: borderAlpha, width: GAP_GRID_LINE_WIDTH })
      .moveTo(leftBorderX, 0)
      .lineTo(leftBorderX, this.height)
      .stroke({ color: GAP_GRID_COLOR, alpha: borderAlpha, width: GAP_GRID_LINE_WIDTH })
      .moveTo(rightBorderX, 0)
      .lineTo(rightBorderX, this.height)
      .stroke({ color: GAP_GRID_COLOR, alpha: borderAlpha, width: GAP_GRID_LINE_WIDTH })
  }

  private _renderGapInteraction(): void {
    this._gapInteractionLayer.clear()

    if (this._selectedGap) {
      this._drawGapGrid(this._selectedGap.leftX, this._selectedGap.rightX, 0.86)
    }

    if (this._hoveredGap && !this._isSameGap(this._hoveredGap, this._selectedGap)) {
      this._drawGapGrid(this._hoveredGap.leftX, this._hoveredGap.rightX, 0.62)
    }

    const iconGap = this._resolveIconGap()
    if (iconGap)
      this._drawDeleteIcon(iconGap)
  }

  private _setSelectedGap(gap: ClosableGap | null): void {
    if (this._isSameGap(this._selectedGap, gap))
      return

    this._selectedGap = gap
    this.emit('gapSelectionChanged', this._selectedGap)
  }

  private _refreshGapInteractionAfterLayout(): void {
    this._hoveredGap = null

    const normalizedSelected = this._selectedGap
      ? this._findGapByTrains(this._selectedGap.leftTrain, this._selectedGap.rightTrain)
      : null
    const selectedChanged = !this._isSameGap(this._selectedGap, normalizedSelected)
    this._selectedGap = normalizedSelected

    if (selectedChanged)
      this.emit('gapSelectionChanged', this._selectedGap)

    this._renderGapInteraction()
    this.container.cursor = this._resolveRailCursor()
  }

  private _resolveRailCursor(): string {
    if (this._hoveredTransitionPairKey)
      return 'pointer'

    if (this._hoveredGap)
      return 'pointer'

    return 'default'
  }

  private _updateHoveredGap(x: number, y: number): void {
    const nextGap = this._resolveGapByPoint(x, y)
    if (this._isSameGap(this._hoveredGap, nextGap))
      return

    this._hoveredGap = nextGap
    this._renderGapInteraction()
    this.container.cursor = this._resolveRailCursor()
  }

  private _closeGap(gap: ClosableGap): boolean {
    const targetGap = this._findGapByTrains(gap.leftTrain, gap.rightTrain)
    if (!targetGap || targetGap.gapMs <= TIMELINE_TRAIN_SEAM_EPSILON)
      return false

    const sorted = [...this.trains].sort((a, b) => a.start - b.start)
    const pivotIndex = sorted.findIndex(train => train === targetGap.rightTrain)
    if (pivotIndex === -1)
      return false

    for (let index = pivotIndex; index < sorted.length; index += 1) {
      const train = sorted[index]
      train.start = Math.max(0, train.start - targetGap.gapMs)
    }

    this.updateTrainsPos()
    return true
  }

  clearGapSelection(): void {
    this._setSelectedGap(null)
    this._renderGapInteraction()
  }

  deleteSelectedGap(): boolean {
    if (!this._selectedGap)
      return false

    const deleted = this._closeGap(this._selectedGap)
    if (!deleted)
      return false

    this._setSelectedGap(null)
    this._renderGapInteraction()
    return true
  }

  setTransitionHandles(handles: RailTransitionHandle[]): void {
    this._transitionHandles = handles.map(handle => ({ ...handle }))

    if (this._hoveredTransitionPairKey) {
      const hasHovered = this._transitionHandles.some(
        handle => handle.pairKey === this._hoveredTransitionPairKey,
      )
      if (!hasHovered)
        this._hoveredTransitionPairKey = null
    }

    this._renderTransitionHandles()
    this.container.cursor = this._resolveRailCursor()
  }

  setActiveTransitionPairKey(pairKey: string | null): void {
    if (this._activeTransitionPairKey === pairKey)
      return

    this._activeTransitionPairKey = pairKey
    this._renderTransitionHandles()
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
          this.height + TIMELINE_TRAIN_BORDER_SIZE * 2,
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

  private _moveVisualLayerToTop(): void {
    this.container.addChild(this._seamLayer)
    this.container.addChild(this._gapInteractionLayer)
    this.container.addChild(this._transitionHandleLayer)
  }

  private _drawBg(): void {
    const bg = new Graphics()

    bg.roundRect(0, 0, this.width, this.height, 8)
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

    this.container.on('pointermove', (e) => {
      if (this.state.trainDragging) {
        this._setHoveredTransitionPairKey(null)
        this._hoveredGap = null
        this._renderGapInteraction()
        this.container.cursor = this._resolveRailCursor()
        return
      }

      const point = e.getLocalPosition(this.container)
      const hoveredTransitionHandle = this._resolveTransitionHandleByPoint(point.x, point.y)
      this._setHoveredTransitionPairKey(hoveredTransitionHandle?.pairKey ?? null)

      if (hoveredTransitionHandle) {
        if (this._hoveredGap) {
          this._hoveredGap = null
          this._renderGapInteraction()
        }
        this.container.cursor = this._resolveRailCursor()
        return
      }

      this._updateHoveredGap(point.x, point.y)
    })

    this.container.on('pointerdown', (e) => {
      const point = e.getLocalPosition(this.container)
      const transitionHandle = this._resolveTransitionHandleByPoint(point.x, point.y)
      if (transitionHandle) {
        this._setHoveredTransitionPairKey(transitionHandle.pairKey)
        this.emit('transitionHandleClick', transitionHandle)
        e.stopPropagation()
        return
      }

      if (this.state.trainDragging)
        return

      this._updateHoveredGap(point.x, point.y)

      const iconGap = this._resolveIconGap()
      if (iconGap && this._isPointInDeleteIcon(iconGap, point.x, point.y)) {
        const deleted = this._closeGap(iconGap)
        if (deleted) {
          this._setSelectedGap(null)
          this._hoveredGap = null
          this._renderGapInteraction()
          this.container.cursor = this._resolveRailCursor()
        }
        e.stopPropagation()
        return
      }

      const gap = this._resolveGapByPoint(point.x, point.y)
      if (gap) {
        this._setSelectedGap(gap)
        this._hoveredGap = gap
        this._renderGapInteraction()
        this.container.cursor = this._resolveRailCursor()
        e.stopPropagation()
        return
      }

      if (this._selectedGap) {
        this._setSelectedGap(null)
        this._renderGapInteraction()
      }
    })

    this.container.on('pointerleave', (e) => {
      this._setHoveredTransitionPairKey(null)
      this._hoveredGap = null
      this._renderGapInteraction()
      this.container.cursor = this._resolveRailCursor()

      // 如果是train正在拖拽状态, 那么需要将这个train从当前rail中移除
      if (!this.state.trainDragging)
        return

      const atTrain = this.state.atDragTrain!
      if (atTrain.parent !== this || !this.trains.includes(atTrain))
        return

      atTrain.updateDragFallback(this, atTrain.container.x)

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
    if (!this.canAcceptTrain(train))
      return

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

    train.syncRailY()

    // 寻找插入的位置
    const nextIndex = this.trains.findIndex(item =>
      item.start >= train.start, // 这里使用 >=, 是为了让插入的优先级更高
    )

    if (nextIndex !== -1)
      this.trains.splice(nextIndex, 0, train)
    else
      this.trains.push(train)

    this._bindPxPerMsEvents()
    this._moveVisualLayerToTop()
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
    if (index === -1)
      return

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
   * 移除train并合拢后续train的时间间隙（ripple delete）
   */
  removeTrainAndCloseGap(train: Train): void {
    const index = this.trains.findIndex(item => item === train)
    if (index === -1)
      return

    const removedStart = train.start
    const removedDuration = train.duration

    this.removeTrain(train)

    // 将所有在被删除 train 之后的 train 前移，填充空隙
    for (const t of this.trains) {
      if (t.start > removedStart) {
        t.start = Math.max(0, t.start - removedDuration)
      }
    }

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
    this._renderTransitionHandles()
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
  }
}
