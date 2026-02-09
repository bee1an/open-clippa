import type {
  EnterExitAnimationConfig,
  LoopAnimationConfig,
  RelativeTransformState,
} from './types'
import { gsap } from 'gsap'
import {
  getEnterFromTransform,
  getExitToTransform,
  getLoopToTransform,
} from './presets'
import {
  cloneRelativeTransformState,
  createRelativeTransformState,
  NEUTRAL_RELATIVE_TRANSFORM_STATE,
} from './types'

type AnimationTimeline = gsap.core.Timeline

export interface RelativeAnimationSegment {
  state: RelativeTransformState
  timeline: AnimationTimeline
  durationMs: number
}

function createTimelineState(): RelativeTransformState {
  return createRelativeTransformState({})
}

function createBaseTimeline(): AnimationTimeline {
  return gsap.timeline({ paused: true })
}

export function createEnterTimeline(config: EnterExitAnimationConfig | null): RelativeAnimationSegment | null {
  if (!config)
    return null

  const durationMs = config.durationMs ?? 0
  const state = createTimelineState()
  const timeline = createBaseTimeline()

  timeline.set(state, getEnterFromTransform(config.preset))
  timeline.to(state, {
    ...NEUTRAL_RELATIVE_TRANSFORM_STATE,
    duration: durationMs / 1000,
    ease: 'power2.out',
  })

  return {
    state,
    timeline,
    durationMs,
  }
}

export function createExitTimeline(config: EnterExitAnimationConfig | null): RelativeAnimationSegment | null {
  if (!config)
    return null

  const durationMs = config.durationMs ?? 0
  const state = createTimelineState()
  const timeline = createBaseTimeline()

  timeline.set(state, NEUTRAL_RELATIVE_TRANSFORM_STATE)
  timeline.to(state, {
    ...getExitToTransform(config.preset),
    duration: durationMs / 1000,
    ease: 'power2.in',
  })

  return {
    state,
    timeline,
    durationMs,
  }
}

export function createLoopTimeline(config: LoopAnimationConfig | null): RelativeAnimationSegment | null {
  if (!config)
    return null

  const durationMs = config.durationMs ?? 0
  const state = createTimelineState()
  const timeline = createBaseTimeline()
  const target = getLoopToTransform(config.preset)
  const totalDuration = durationMs / 1000

  timeline.set(state, NEUTRAL_RELATIVE_TRANSFORM_STATE)

  if (config.preset === 'spin') {
    timeline.to(state, {
      rotation: target.rotation,
      duration: totalDuration,
      ease: 'none',
    })
  }
  else {
    const halfDuration = totalDuration / 2
    timeline.to(state, {
      ...target,
      duration: halfDuration,
      ease: 'sine.inOut',
    })
    timeline.to(state, {
      ...NEUTRAL_RELATIVE_TRANSFORM_STATE,
      duration: halfDuration,
      ease: 'sine.inOut',
    })
  }

  return {
    state,
    timeline,
    durationMs,
  }
}

export function sampleSegment(segment: RelativeAnimationSegment, timeMs: number): RelativeTransformState {
  const clampedTime = Math.min(Math.max(timeMs, 0), segment.durationMs)
  segment.timeline.time(clampedTime / 1000, false)
  return cloneRelativeTransformState(segment.state)
}

export function killSegment(segment: RelativeAnimationSegment | null): void {
  if (!segment)
    return
  segment.timeline.kill()
}
