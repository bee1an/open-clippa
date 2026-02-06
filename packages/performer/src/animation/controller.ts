import type { RelativeAnimationSegment } from './timeline'
import type {
  PerformerAnimationSpec,
  RelativeTransformState,
  TransformState,
} from './types'
import {
  createEnterTimeline,
  createExitTimeline,
  createLoopTimeline,
  killSegment,
  sampleSegment,
} from './timeline'
import {
  clampAlpha,
  cloneTransformState,
  DEFAULT_TRANSFORM_STATE,
  normalizeAnimationSpec,
} from './types'

function neutralRelativeState(): RelativeTransformState {
  return {
    x: 0,
    y: 0,
    scaleX: 1,
    scaleY: 1,
    rotation: 0,
    alpha: 1,
  }
}

function composeTransform(base: TransformState, relative: RelativeTransformState): TransformState {
  return {
    x: base.x + relative.x,
    y: base.y + relative.y,
    scaleX: base.scaleX * relative.scaleX,
    scaleY: base.scaleY * relative.scaleY,
    rotation: base.rotation + relative.rotation,
    alpha: clampAlpha(base.alpha * relative.alpha),
  }
}

function mapToSegmentTime(
  localTimeMs: number,
  effectiveDurationMs: number,
  sourceDurationMs: number,
): number {
  if (effectiveDurationMs <= 0 || sourceDurationMs <= 0)
    return 0

  const progress = Math.min(Math.max(localTimeMs / effectiveDurationMs, 0), 1)
  return sourceDurationMs * progress
}

export class AnimationController {
  private _baseTransform: TransformState = { ...DEFAULT_TRANSFORM_STATE }
  private _spec: PerformerAnimationSpec | null = null

  private _enterSegment: RelativeAnimationSegment | null = null
  private _exitSegment: RelativeAnimationSegment | null = null
  private _loopSegment: RelativeAnimationSegment | null = null

  isApplying = false

  constructor(baseTransform: TransformState, spec: PerformerAnimationSpec | null) {
    this._baseTransform = cloneTransformState(baseTransform)
    this.setSpec(spec)
  }

  get baseTransform(): TransformState {
    return cloneTransformState(this._baseTransform)
  }

  setBaseTransform(baseTransform: TransformState): void {
    this._baseTransform = cloneTransformState(baseTransform)
  }

  setSpec(spec: PerformerAnimationSpec | null): void {
    this._spec = normalizeAnimationSpec(spec)
    this._rebuildSegments()
  }

  apply(
    timeMs: number,
    durationMs: number,
    applyTransform: (transform: TransformState) => void,
  ): void {
    if (!this._spec || durationMs <= 0) {
      this._applyWithGuard(applyTransform, this._baseTransform)
      return
    }

    const safeDuration = Math.max(durationMs, 0)
    const safeTime = Math.min(Math.max(timeMs, 0), safeDuration)
    const enterDuration = this._enterSegment
      ? Math.min(this._enterSegment.durationMs, safeDuration)
      : 0
    const exitDuration = this._exitSegment
      ? Math.min(this._exitSegment.durationMs, safeDuration)
      : 0
    const exitStart = Math.max(0, safeDuration - exitDuration)

    let relative = neutralRelativeState()

    // Exit segment has higher priority when enter and exit overlap.
    if (this._exitSegment && safeTime >= exitStart) {
      const localTime = safeTime - exitStart
      const segmentTime = mapToSegmentTime(localTime, exitDuration, this._exitSegment.durationMs)
      relative = sampleSegment(this._exitSegment, segmentTime)
    }
    else if (this._enterSegment && safeTime <= enterDuration) {
      const segmentTime = mapToSegmentTime(safeTime, enterDuration, this._enterSegment.durationMs)
      relative = sampleSegment(this._enterSegment, segmentTime)
    }
    else if (this._loopSegment && this._loopSegment.durationMs > 0) {
      const loopTime = safeTime % this._loopSegment.durationMs
      relative = sampleSegment(this._loopSegment, loopTime)
    }

    const nextTransform = composeTransform(this._baseTransform, relative)
    this._applyWithGuard(applyTransform, nextTransform)
  }

  destroy(): void {
    killSegment(this._enterSegment)
    killSegment(this._exitSegment)
    killSegment(this._loopSegment)

    this._enterSegment = null
    this._exitSegment = null
    this._loopSegment = null
    this._spec = null
  }

  private _rebuildSegments(): void {
    killSegment(this._enterSegment)
    killSegment(this._exitSegment)
    killSegment(this._loopSegment)

    this._enterSegment = null
    this._exitSegment = null
    this._loopSegment = null

    if (!this._spec)
      return

    this._enterSegment = createEnterTimeline(this._spec.enter ?? null)
    this._exitSegment = createExitTimeline(this._spec.exit ?? null)
    this._loopSegment = createLoopTimeline(this._spec.loop ?? null)
  }

  private _applyWithGuard(
    applyTransform: (transform: TransformState) => void,
    transform: TransformState,
  ): void {
    this.isApplying = true

    try {
      applyTransform(transform)
    }
    finally {
      this.isApplying = false
    }
  }
}
