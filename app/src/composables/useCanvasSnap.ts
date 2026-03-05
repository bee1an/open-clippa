import type { ResizeDirection, SelectionItem } from '@clippc/selection'
import type { AxisSnapCandidate, AxisSnapState } from '@clippc/utils'
import { solveAxisSnap } from '@clippc/utils'

export interface CanvasSnapBox {
  id: string
  left: number
  centerX: number
  right: number
  top: number
  centerY: number
  bottom: number
}

export interface CanvasSnapContext {
  canvasWidth: number
  canvasHeight: number
  peers: CanvasSnapBox[]
}

export interface CanvasSnapGuide {
  axis: 'x' | 'y'
  value: number
}

type SnapMode = 'idle' | 'drag' | 'resize'

interface SnapSession {
  mode: SnapMode
  direction: ResizeDirection | null
  stateX: AxisSnapState | null
  stateY: AxisSnapState | null
}

const SNAP_ENTER_PX = 8
const SNAP_EXIT_PX = 12
const ROTATION_EPSILON = 0.001
const MIN_SIZE = 1

type AxisLine = {
  id: string
  value: number
}

type AxisMeta = {
  guide: number
}

function rotatePoint(x: number, y: number, rotation: number): { x: number, y: number } {
  if (!rotation)
    return { x, y }

  const rad = rotation * Math.PI / 180
  const cos = Math.cos(rad)
  const sin = Math.sin(rad)
  return {
    x: x * cos - y * sin,
    y: x * sin + y * cos,
  }
}

function toAabb(item: SelectionItem): CanvasSnapBox {
  const rotation = item.rotation ?? 0
  if (Math.abs(rotation) <= ROTATION_EPSILON) {
    return {
      id: item.id,
      left: item.x,
      centerX: item.x + item.width / 2,
      right: item.x + item.width,
      top: item.y,
      centerY: item.y + item.height / 2,
      bottom: item.y + item.height,
    }
  }

  const cx = item.x + item.width / 2
  const cy = item.y + item.height / 2
  const halfW = item.width / 2
  const halfH = item.height / 2
  const corners = [
    rotatePoint(-halfW, -halfH, rotation),
    rotatePoint(halfW, -halfH, rotation),
    rotatePoint(halfW, halfH, rotation),
    rotatePoint(-halfW, halfH, rotation),
  ].map(point => ({
    x: cx + point.x,
    y: cy + point.y,
  }))

  const xs = corners.map(point => point.x)
  const ys = corners.map(point => point.y)
  const left = Math.min(...xs)
  const right = Math.max(...xs)
  const top = Math.min(...ys)
  const bottom = Math.max(...ys)

  return {
    id: item.id,
    left,
    centerX: (left + right) / 2,
    right,
    top,
    centerY: (top + bottom) / 2,
    bottom,
  }
}

function buildXLines(context: CanvasSnapContext): AxisLine[] {
  const lines: AxisLine[] = [
    { id: 'canvas:left', value: 0 },
    { id: 'canvas:center', value: context.canvasWidth / 2 },
    { id: 'canvas:right', value: context.canvasWidth },
  ]

  context.peers.forEach((peer) => {
    lines.push(
      { id: `peer:${peer.id}:left`, value: peer.left },
      { id: `peer:${peer.id}:center`, value: peer.centerX },
      { id: `peer:${peer.id}:right`, value: peer.right },
    )
  })

  return lines
}

function buildYLines(context: CanvasSnapContext): AxisLine[] {
  const lines: AxisLine[] = [
    { id: 'canvas:top', value: 0 },
    { id: 'canvas:center', value: context.canvasHeight / 2 },
    { id: 'canvas:bottom', value: context.canvasHeight },
  ]

  context.peers.forEach((peer) => {
    lines.push(
      { id: `peer:${peer.id}:top`, value: peer.top },
      { id: `peer:${peer.id}:center`, value: peer.centerY },
      { id: `peer:${peer.id}:bottom`, value: peer.bottom },
    )
  })

  return lines
}

function buildDragAxisCandidates(
  axis: 'x' | 'y',
  item: SelectionItem,
  lines: AxisLine[],
): Array<AxisSnapCandidate<AxisMeta>> {
  const box = toAabb(item)
  if (axis === 'x') {
    const sources = [
      { id: 'left', value: box.left },
      { id: 'center', value: box.centerX },
      { id: 'right', value: box.right },
    ]
    return sources.flatMap((source) => {
      return lines.map((line) => {
        const delta = line.value - source.value
        return {
          id: `drag:x:${source.id}->${line.id}`,
          value: item.x + delta,
          meta: { guide: line.value },
        }
      })
    })
  }

  const sources = [
    { id: 'top', value: box.top },
    { id: 'center', value: box.centerY },
    { id: 'bottom', value: box.bottom },
  ]
  return sources.flatMap((source) => {
    return lines.map((line) => {
      const delta = line.value - source.value
      return {
        id: `drag:y:${source.id}->${line.id}`,
        value: item.y + delta,
        meta: { guide: line.value },
      }
    })
  })
}

function isCornerDirection(direction: ResizeDirection): boolean {
  return direction.includes('-')
}

function isHorizontalDirection(direction: ResizeDirection): direction is 'left' | 'right' {
  return direction === 'left' || direction === 'right'
}

function isVerticalDirection(direction: ResizeDirection): direction is 'top' | 'bottom' {
  return direction === 'top' || direction === 'bottom'
}

function resolveHorizontalActive(direction: ResizeDirection): 'left' | 'right' {
  return direction.includes('left') ? 'left' : 'right'
}

function resolveVerticalActive(direction: ResizeDirection): 'top' | 'bottom' {
  return direction.includes('top') ? 'top' : 'bottom'
}

function applyHorizontalSnap(item: SelectionItem, direction: 'left' | 'right', edgeValue: number): SelectionItem | null {
  if (direction === 'left') {
    const delta = edgeValue - item.x
    const width = item.width - delta
    if (width < MIN_SIZE)
      return null

    return {
      ...item,
      x: edgeValue,
      width,
    }
  }

  const width = edgeValue - item.x
  if (width < MIN_SIZE)
    return null

  return {
    ...item,
    width,
  }
}

function applyVerticalSnap(item: SelectionItem, direction: 'top' | 'bottom', edgeValue: number): SelectionItem | null {
  if (direction === 'top') {
    const delta = edgeValue - item.y
    const height = item.height - delta
    if (height < MIN_SIZE)
      return null

    return {
      ...item,
      y: edgeValue,
      height,
    }
  }

  const height = edgeValue - item.y
  if (height < MIN_SIZE)
    return null

  return {
    ...item,
    height,
  }
}

function applyCornerByHorizontal(item: SelectionItem, direction: ResizeDirection, activeEdgeX: number): SelectionItem | null {
  const ratio = item.width / item.height
  if (!Number.isFinite(ratio) || ratio <= 0)
    return null

  const left = item.x
  const right = item.x + item.width
  const top = item.y
  const bottom = item.y + item.height
  const horizontalActive = resolveHorizontalActive(direction)
  const verticalActive = resolveVerticalActive(direction)

  const width = horizontalActive === 'left'
    ? right - activeEdgeX
    : activeEdgeX - left
  if (width < MIN_SIZE)
    return null

  const height = width / ratio
  if (height < MIN_SIZE)
    return null

  const x = horizontalActive === 'left' ? right - width : left
  const y = verticalActive === 'top' ? bottom - height : top

  return {
    ...item,
    x,
    y,
    width,
    height,
  }
}

function applyCornerByVertical(item: SelectionItem, direction: ResizeDirection, activeEdgeY: number): SelectionItem | null {
  const ratio = item.width / item.height
  if (!Number.isFinite(ratio) || ratio <= 0)
    return null

  const left = item.x
  const right = item.x + item.width
  const top = item.y
  const bottom = item.y + item.height
  const horizontalActive = resolveHorizontalActive(direction)
  const verticalActive = resolveVerticalActive(direction)

  const height = verticalActive === 'top'
    ? bottom - activeEdgeY
    : activeEdgeY - top
  if (height < MIN_SIZE)
    return null

  const width = height * ratio
  if (width < MIN_SIZE)
    return null

  const x = horizontalActive === 'left' ? right - width : left
  const y = verticalActive === 'top' ? bottom - height : top

  return {
    ...item,
    x,
    y,
    width,
    height,
  }
}

export function buildSnapBoxFromSelectionItem(item: SelectionItem): CanvasSnapBox {
  return toAabb(item)
}

export function useCanvasSnap() {
  const session: SnapSession = {
    mode: 'idle',
    direction: null,
    stateX: null,
    stateY: null,
  }

  function stop() {
    session.mode = 'idle'
    session.direction = null
    session.stateX = null
    session.stateY = null
  }

  function startDrag() {
    session.mode = 'drag'
    session.direction = null
    session.stateX = null
    session.stateY = null
  }

  function startResize(direction: ResizeDirection) {
    session.mode = 'resize'
    session.direction = direction
    session.stateX = null
    session.stateY = null
  }

  function apply(input: {
    item: SelectionItem
    context: CanvasSnapContext
    bypass: boolean
  }): { item: SelectionItem, guides: CanvasSnapGuide[] } {
    if (session.mode === 'idle')
      return { item: input.item, guides: [] }

    const xLines = buildXLines(input.context)
    const yLines = buildYLines(input.context)

    if (session.mode === 'drag') {
      const snapX = solveAxisSnap<AxisMeta>({
        nextValue: input.item.x,
        candidates: buildDragAxisCandidates('x', input.item, xLines),
        state: session.stateX,
        enterThreshold: SNAP_ENTER_PX,
        exitThreshold: SNAP_EXIT_PX,
        bypass: input.bypass,
      })
      const snapY = solveAxisSnap<AxisMeta>({
        nextValue: input.item.y,
        candidates: buildDragAxisCandidates('y', input.item, yLines),
        state: session.stateY,
        enterThreshold: SNAP_ENTER_PX,
        exitThreshold: SNAP_EXIT_PX,
        bypass: input.bypass,
      })
      session.stateX = snapX.state
      session.stateY = snapY.state

      const guides: CanvasSnapGuide[] = []
      if (snapX.snapped && snapX.candidate) {
        guides.push({
          axis: 'x',
          value: snapX.candidate.meta?.guide ?? snapX.value,
        })
      }
      if (snapY.snapped && snapY.candidate) {
        guides.push({
          axis: 'y',
          value: snapY.candidate.meta?.guide ?? snapY.value,
        })
      }

      return {
        item: {
          ...input.item,
          x: snapX.value,
          y: snapY.value,
        },
        guides,
      }
    }

    const direction = session.direction
    if (!direction)
      return { item: input.item, guides: [] }

    if (Math.abs(input.item.rotation ?? 0) > ROTATION_EPSILON) {
      session.stateX = null
      session.stateY = null
      return { item: input.item, guides: [] }
    }

    if (isHorizontalDirection(direction)) {
      const edge = direction === 'left' ? input.item.x : input.item.x + input.item.width
      const snap = solveAxisSnap<AxisMeta>({
        nextValue: edge,
        candidates: xLines.map((line) => {
          return {
            id: `resize:x:${direction}:${line.id}`,
            value: line.value,
            meta: { guide: line.value },
          }
        }),
        state: session.stateX,
        enterThreshold: SNAP_ENTER_PX,
        exitThreshold: SNAP_EXIT_PX,
        bypass: input.bypass,
      })
      session.stateX = snap.state
      session.stateY = null
      const nextItem = applyHorizontalSnap(input.item, direction, snap.value) ?? input.item
      const guides = snap.snapped && snap.candidate
        ? [{ axis: 'x' as const, value: snap.candidate.meta?.guide ?? snap.value }]
        : []
      return { item: nextItem, guides }
    }

    if (isVerticalDirection(direction)) {
      const edge = direction === 'top' ? input.item.y : input.item.y + input.item.height
      const snap = solveAxisSnap<AxisMeta>({
        nextValue: edge,
        candidates: yLines.map((line) => {
          return {
            id: `resize:y:${direction}:${line.id}`,
            value: line.value,
            meta: { guide: line.value },
          }
        }),
        state: session.stateY,
        enterThreshold: SNAP_ENTER_PX,
        exitThreshold: SNAP_EXIT_PX,
        bypass: input.bypass,
      })
      session.stateY = snap.state
      session.stateX = null
      const nextItem = applyVerticalSnap(input.item, direction, snap.value) ?? input.item
      const guides = snap.snapped && snap.candidate
        ? [{ axis: 'y' as const, value: snap.candidate.meta?.guide ?? snap.value }]
        : []
      return { item: nextItem, guides }
    }

    if (!isCornerDirection(direction)) {
      session.stateX = null
      session.stateY = null
      return { item: input.item, guides: [] }
    }

    const activeX = resolveHorizontalActive(direction) === 'left'
      ? input.item.x
      : input.item.x + input.item.width
    const activeY = resolveVerticalActive(direction) === 'top'
      ? input.item.y
      : input.item.y + input.item.height
    const snapX = solveAxisSnap<AxisMeta>({
      nextValue: activeX,
      candidates: xLines.map((line) => {
        return {
          id: `resize:corner:x:${direction}:${line.id}`,
          value: line.value,
          meta: { guide: line.value },
        }
      }),
      state: session.stateX,
      enterThreshold: SNAP_ENTER_PX,
      exitThreshold: SNAP_EXIT_PX,
      bypass: input.bypass,
    })
    const snapY = solveAxisSnap<AxisMeta>({
      nextValue: activeY,
      candidates: yLines.map((line) => {
        return {
          id: `resize:corner:y:${direction}:${line.id}`,
          value: line.value,
          meta: { guide: line.value },
        }
      }),
      state: session.stateY,
      enterThreshold: SNAP_ENTER_PX,
      exitThreshold: SNAP_EXIT_PX,
      bypass: input.bypass,
    })

    if (!snapX.snapped && !snapY.snapped) {
      session.stateX = snapX.state
      session.stateY = snapY.state
      return { item: input.item, guides: [] }
    }

    const distanceX = snapX.distance ?? Number.POSITIVE_INFINITY
    const distanceY = snapY.distance ?? Number.POSITIVE_INFINITY
    const pickHorizontal = snapX.snapped && (!snapY.snapped || distanceX <= distanceY)

    if (pickHorizontal) {
      session.stateX = snapX.state
      session.stateY = null
      const nextItem = applyCornerByHorizontal(input.item, direction, snapX.value) ?? input.item
      const guides = snapX.snapped && snapX.candidate
        ? [{ axis: 'x' as const, value: snapX.candidate.meta?.guide ?? snapX.value }]
        : []
      return { item: nextItem, guides }
    }

    session.stateX = null
    session.stateY = snapY.state
    const nextItem = applyCornerByVertical(input.item, direction, snapY.value) ?? input.item
    const guides = snapY.snapped && snapY.candidate
      ? [{ axis: 'y' as const, value: snapY.candidate.meta?.guide ?? snapY.value }]
      : []
    return { item: nextItem, guides }
  }

  return {
    startDrag,
    startResize,
    stop,
    apply,
  }
}
