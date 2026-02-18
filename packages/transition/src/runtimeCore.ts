import type { Timeline } from 'clippc'
import type { Sprite } from 'pixi.js'
import type { TransitionCandidate, TransitionSpec } from './transition'
import { buildTransitionCandidates, buildTransitionPairKey } from './transition'

export interface TransitionMaskRect {
  x: number
  y: number
  width: number
  height: number
}

export interface TransitionRenderablePerformer {
  id: string
  start: number
  duration: number
  sprite?: Sprite
  getMaskRect?: () => TransitionMaskRect | null
}

export interface TransitionVideoPerformer extends TransitionRenderablePerformer {
  sourceStart: number
  sourceDuration: number
  renderFrameAtSourceTime: (timeMs: number) => Promise<void> | void
}

export interface ActiveTransitionContext<TPerformer extends TransitionRenderablePerformer = TransitionRenderablePerformer> {
  transition: TransitionSpec
  candidate: TransitionCandidate
  from: TPerformer
  to: TPerformer
  pairKey: string
  progress: number
}

export interface ResolveActiveTransitionInput<TPerformer extends TransitionRenderablePerformer = TransitionRenderablePerformer> {
  time: number
  transitions: TransitionSpec[]
  timeline: Timeline
  getPerformerById: (performerId: string) => unknown
  isRenderablePerformer?: (performer: unknown) => performer is TPerformer
}

function hasNumberField(value: unknown, field: string): boolean {
  return Number.isFinite((value as Record<string, unknown> | null | undefined)?.[field] as number)
}

export function isTransitionRenderablePerformer(performer: unknown): performer is TransitionRenderablePerformer {
  if (!performer || typeof performer !== 'object')
    return false

  const target = performer as Record<string, unknown>
  return typeof target.id === 'string'
    && hasNumberField(target, 'start')
    && hasNumberField(target, 'duration')
}

export function isTransitionVideoPerformer(performer: unknown): performer is TransitionVideoPerformer {
  if (!isTransitionRenderablePerformer(performer))
    return false

  const target = performer as unknown as { renderFrameAtSourceTime?: unknown }
  return hasNumberField(performer, 'sourceStart')
    && hasNumberField(performer, 'sourceDuration')
    && typeof target.renderFrameAtSourceTime === 'function'
}

export function resolveActiveTransition<TPerformer extends TransitionRenderablePerformer = TransitionRenderablePerformer>(
  input: ResolveActiveTransitionInput<TPerformer>,
): ActiveTransitionContext<TPerformer> | null {
  const { time, transitions, timeline, getPerformerById } = input
  const isRenderablePerformer = input.isRenderablePerformer ?? isTransitionRenderablePerformer as (performer: unknown) => performer is TPerformer

  if (!transitions.length)
    return null

  const candidates = buildTransitionCandidates(timeline)
  if (!candidates.length)
    return null

  const candidateMap = new Map<string, TransitionCandidate>()
  candidates.forEach((candidate) => {
    candidateMap.set(buildTransitionPairKey(candidate.fromId, candidate.toId), candidate)
  })

  const matched = transitions
    .map((transition) => {
      const pairKey = buildTransitionPairKey(transition.fromId, transition.toId)
      const candidate = candidateMap.get(pairKey)
      if (!candidate)
        return null

      const from = getPerformerById(transition.fromId)
      const to = getPerformerById(transition.toId)
      if (!isRenderablePerformer(from) || !isRenderablePerformer(to))
        return null

      const duration = Math.max(0, transition.durationMs)
      const half = duration / 2
      const windowStart = candidate.cutTime - half
      const windowEnd = candidate.cutTime + half
      const insideWindow = duration === 0
        ? Math.abs(time - candidate.cutTime) <= 0.5
        : time >= windowStart && time <= windowEnd

      if (!insideWindow)
        return null

      const progress = duration === 0
        ? 1
        : Math.max(0, Math.min(1, (time - windowStart) / duration))

      return {
        transition,
        candidate,
        from,
        to,
        pairKey,
        progress,
      }
    })
    .filter((item): item is ActiveTransitionContext<TPerformer> => Boolean(item))
    .sort((a, b) => a.candidate.cutTime - b.candidate.cutTime)

  return matched[0] ?? null
}

export function clampVideoSourceTime(video: TransitionVideoPerformer, sourceTime: number): number {
  const max = Math.max(0, video.sourceDuration)
  return Math.min(max, Math.max(0, sourceTime))
}

export function resolveTransitionVideoSourceTime(
  context: ActiveTransitionContext,
  video: TransitionVideoPerformer,
  role: 'from' | 'to',
): number {
  const duration = Math.max(0, context.transition.durationMs)
  const half = duration / 2
  if (half <= 0) {
    const cutBase = role === 'from'
      ? video.sourceStart + video.duration
      : video.sourceStart
    return clampVideoSourceTime(video, cutBase)
  }

  const progress = Math.max(0, Math.min(1, context.progress))
  let startOffset = -half
  let endOffset = half

  if (role === 'from') {
    const tail = Math.max(0, video.sourceDuration - (video.sourceStart + video.duration))
    endOffset = Math.min(half, tail)
  }
  else {
    const head = Math.max(0, video.sourceStart)
    startOffset = -Math.min(half, head)
  }

  const offset = startOffset + (endOffset - startOffset) * progress

  if (role === 'from')
    return clampVideoSourceTime(video, video.sourceStart + video.duration + offset)

  return clampVideoSourceTime(video, video.sourceStart + offset)
}
