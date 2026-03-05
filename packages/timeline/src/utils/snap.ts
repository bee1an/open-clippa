import type { AxisSnapCandidate } from '@clippc/utils'

export interface TimelineSnapPlayhead {
  x: number
  time: number
}

export interface TimelineSnapTarget {
  id: string
  railZIndex: number
  x: number
  width: number
  start: number
  duration: number
  anchorMode?: 'time' | 'visual'
}

export interface TimelineMoveSnapMeta {
  guideX: number
  rawStartMs?: number
}

export function buildTimelineLeftSnapCandidates(input: {
  trainId: string
  width: number
  duration: number
  targets: TimelineSnapTarget[]
  connectionGapPx: number
  playhead: TimelineSnapPlayhead | null
}): Array<AxisSnapCandidate<TimelineMoveSnapMeta>> {
  const { trainId, width, duration, targets, connectionGapPx, playhead } = input
  const result: Array<AxisSnapCandidate<TimelineMoveSnapMeta>> = []

  for (const target of targets) {
    if (target.id === trainId)
      continue

    const useVisualAnchor = target.anchorMode === 'visual'

    const beforeX = Math.max(0, target.x - width - connectionGapPx)
    result.push({
      id: `target:${target.railZIndex}:${target.id}:before`,
      value: beforeX,
      meta: {
        guideX: target.x,
        rawStartMs: useVisualAnchor ? undefined : Math.max(0, target.start - duration),
      },
    })

    const afterX = target.x + target.width + connectionGapPx
    result.push({
      id: `target:${target.railZIndex}:${target.id}:after`,
      value: afterX,
      meta: {
        guideX: target.x + target.width,
        rawStartMs: useVisualAnchor ? undefined : target.start + target.duration,
      },
    })
  }

  if (playhead && Number.isFinite(playhead.x) && Number.isFinite(playhead.time)) {
    result.push({
      id: 'playhead:left',
      value: Math.max(0, playhead.x),
      meta: {
        guideX: playhead.x,
        rawStartMs: Math.max(0, playhead.time),
      },
    })
    result.push({
      id: 'playhead:right',
      value: Math.max(0, playhead.x - width),
      meta: {
        guideX: playhead.x,
        rawStartMs: Math.max(0, playhead.time - duration),
      },
    })
  }

  return result
}

export interface TimelineEdgeSnapMeta {
  guideX: number
}

export function buildTimelineEdgeSnapCandidates(input: {
  trainId: string
  width: number
  duration: number
  targets: TimelineSnapTarget[]
  connectionGapPx: number
  playhead: TimelineSnapPlayhead | null
  edge: 'left' | 'right'
}): Array<AxisSnapCandidate<TimelineEdgeSnapMeta>> {
  const result: Array<AxisSnapCandidate<TimelineEdgeSnapMeta>> = []
  const prefix = input.edge

  for (const target of input.targets) {
    if (target.id === input.trainId)
      continue

    const targetLeft = target.x
    const targetRight = target.x + target.width

    result.push(
      {
        id: `${prefix}:target:${target.railZIndex}:${target.id}:left`,
        value: targetLeft,
        meta: { guideX: targetLeft },
      },
      {
        id: `${prefix}:target:${target.railZIndex}:${target.id}:right`,
        value: targetRight,
        meta: { guideX: targetRight },
      },
    )

    if (input.edge === 'left') {
      result.push({
        id: `${prefix}:target:${target.railZIndex}:${target.id}:after-gap`,
        value: targetRight + input.connectionGapPx,
        meta: { guideX: targetRight },
      })
      continue
    }

    result.push({
      id: `${prefix}:target:${target.railZIndex}:${target.id}:before-gap`,
      value: Math.max(0, targetLeft - input.connectionGapPx),
      meta: { guideX: targetLeft },
    })
  }

  if (input.playhead && Number.isFinite(input.playhead.x)) {
    result.push({
      id: `${prefix}:playhead`,
      value: Math.max(0, input.playhead.x),
      meta: { guideX: input.playhead.x },
    })
  }

  return result
}
