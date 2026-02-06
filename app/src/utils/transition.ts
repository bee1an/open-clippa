import type { Timeline } from 'open-clippa'

export const DEFAULT_TRANSITION_DURATION = 500
export const TRANSITION_JOIN_TOLERANCE_MS = 1
export const TRANSITION_FEATURE_AVAILABLE = false

export interface TransitionSpec {
  id: string
  fromId: string
  toId: string
  durationMs: number
  type: string
  params: Record<string, unknown>
}

export interface TransitionCandidate {
  id: string
  railZIndex: number
  fromId: string
  toId: string
  cutTime: number
}

export interface TransitionClip {
  id: string
  start: number
  duration: number
  type: 'video' | 'image' | 'other'
  sourceStart?: number
  sourceDuration?: number
}

export interface TransitionLimitResult {
  maxMs: number
  uiMax: number
  fromTail: number
  toHead: number
}

export function buildTransitionPairKey(fromId: string, toId: string): string {
  return `${fromId}->${toId}`
}

export function buildTransitionCandidates(timeline: Timeline): TransitionCandidate[] {
  const rails = timeline.rails?.rails ?? []
  const candidates: TransitionCandidate[] = []

  rails.forEach((rail) => {
    const trains = [...rail.trains].sort((a, b) => a.start - b.start)
    for (let index = 0; index < trains.length - 1; index += 1) {
      const from = trains[index]
      const to = trains[index + 1]
      const cutTime = from.start + from.duration

      if (Math.abs(to.start - cutTime) > TRANSITION_JOIN_TOLERANCE_MS)
        continue

      candidates.push({
        id: `${rail.zIndex}:${buildTransitionPairKey(from.id, to.id)}`,
        railZIndex: rail.zIndex,
        fromId: from.id,
        toId: to.id,
        cutTime,
      })
    }
  })

  return candidates
}

function resolveFromTail(clip: TransitionClip): number {
  if (clip.type !== 'video')
    return Math.max(0, clip.duration)

  const sourceDuration = clip.sourceDuration ?? clip.duration
  const sourceStart = clip.sourceStart ?? 0
  return Math.max(0, sourceDuration - (sourceStart + clip.duration))
}

function resolveToHead(clip: TransitionClip): number {
  if (clip.type !== 'video')
    return Math.max(0, clip.duration)

  return Math.max(0, clip.sourceStart ?? 0)
}

export function computeTransitionMaxMs(
  from: TransitionClip,
  to: TransitionClip,
  durationMs: number = 0,
): TransitionLimitResult {
  const fromTail = resolveFromTail(from)
  const toHead = resolveToHead(to)
  const maxMs = Math.max(0, 2 * Math.min(fromTail, toHead))
  const uiMax = Math.max(maxMs, Math.max(0, durationMs))

  return {
    maxMs,
    uiMax,
    fromTail,
    toHead,
  }
}
