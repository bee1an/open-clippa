export const DEFAULT_ENTER_EXIT_DURATION_MS = 400
export const DEFAULT_LOOP_DURATION_MS = 2000
export const MIN_ANIMATION_DURATION_MS = 50

export type EnterExitPresetType
  = | 'none'
    | 'fade'
    | 'slide-up'
    | 'slide-down'
    | 'slide-left'
    | 'slide-right'
    | 'zoom-in'
    | 'zoom-out'
    | 'rotate-left'
    | 'rotate-right'

export type LoopPresetType
  = | 'none'
    | 'float'
    | 'pulse'
    | 'spin'

export interface TransformState {
  x: number
  y: number
  scaleX: number
  scaleY: number
  rotation: number
  alpha: number
}

export interface RelativeTransformState {
  x: number
  y: number
  scaleX: number
  scaleY: number
  rotation: number
  alpha: number
}

export interface EnterExitAnimationConfig {
  preset: EnterExitPresetType
  durationMs?: number
}

export interface LoopAnimationConfig {
  preset: LoopPresetType
  durationMs?: number
}

export interface PerformerAnimationSpec {
  enter?: EnterExitAnimationConfig | null
  exit?: EnterExitAnimationConfig | null
  loop?: LoopAnimationConfig | null
}

export const DEFAULT_TRANSFORM_STATE: TransformState = {
  x: 0,
  y: 0,
  scaleX: 1,
  scaleY: 1,
  rotation: 0,
  alpha: 1,
}

export const NEUTRAL_RELATIVE_TRANSFORM_STATE: RelativeTransformState = {
  x: 0,
  y: 0,
  scaleX: 1,
  scaleY: 1,
  rotation: 0,
  alpha: 1,
}

export function cloneTransformState(state: TransformState): TransformState {
  return {
    x: state.x,
    y: state.y,
    scaleX: state.scaleX,
    scaleY: state.scaleY,
    rotation: state.rotation,
    alpha: state.alpha,
  }
}

export function cloneRelativeTransformState(state: RelativeTransformState): RelativeTransformState {
  return {
    x: state.x,
    y: state.y,
    scaleX: state.scaleX,
    scaleY: state.scaleY,
    rotation: state.rotation,
    alpha: state.alpha,
  }
}

export function createRelativeTransformState(overrides: Partial<RelativeTransformState>): RelativeTransformState {
  return {
    ...NEUTRAL_RELATIVE_TRANSFORM_STATE,
    ...overrides,
  }
}

export function clampDuration(durationMs: number | undefined, fallbackMs: number): number {
  const safeValue = durationMs ?? fallbackMs
  if (!Number.isFinite(safeValue))
    return fallbackMs
  return Math.max(MIN_ANIMATION_DURATION_MS, Math.round(safeValue))
}

export function clampAlpha(alpha: number): number {
  return Math.min(1, Math.max(0, alpha))
}

export function normalizeEnterExitConfig(
  config: EnterExitAnimationConfig | null | undefined,
): EnterExitAnimationConfig | null {
  if (!config || config.preset === 'none')
    return null

  return {
    preset: config.preset,
    durationMs: clampDuration(config.durationMs, DEFAULT_ENTER_EXIT_DURATION_MS),
  }
}

export function normalizeLoopConfig(
  config: LoopAnimationConfig | null | undefined,
): LoopAnimationConfig | null {
  if (!config || config.preset === 'none')
    return null

  return {
    preset: config.preset,
    durationMs: clampDuration(config.durationMs, DEFAULT_LOOP_DURATION_MS),
  }
}

export function normalizeAnimationSpec(
  spec: PerformerAnimationSpec | null | undefined,
): PerformerAnimationSpec | null {
  if (!spec)
    return null

  const enter = normalizeEnterExitConfig(spec.enter)
  const exit = normalizeEnterExitConfig(spec.exit)
  const loop = normalizeLoopConfig(spec.loop)

  if (!enter && !exit && !loop)
    return null

  return {
    enter,
    exit,
    loop,
  }
}

export type PerformerAnimationPatch = {
  enter?: Partial<EnterExitAnimationConfig> | null
  exit?: Partial<EnterExitAnimationConfig> | null
  loop?: Partial<LoopAnimationConfig> | null
}

function mergeEnterExitConfig(
  current: EnterExitAnimationConfig | null | undefined,
  patch: Partial<EnterExitAnimationConfig> | null | undefined,
): EnterExitAnimationConfig | null | undefined {
  if (patch === undefined)
    return current
  if (patch === null)
    return null

  return {
    ...(current ?? { preset: 'none' as EnterExitPresetType }),
    ...patch,
  }
}

function mergeLoopConfig(
  current: LoopAnimationConfig | null | undefined,
  patch: Partial<LoopAnimationConfig> | null | undefined,
): LoopAnimationConfig | null | undefined {
  if (patch === undefined)
    return current
  if (patch === null)
    return null

  return {
    ...(current ?? { preset: 'none' as LoopPresetType }),
    ...patch,
  }
}

export function mergeAnimationSpec(
  current: PerformerAnimationSpec | null | undefined,
  patch: PerformerAnimationPatch,
): PerformerAnimationSpec | null {
  const merged: PerformerAnimationSpec = {
    enter: mergeEnterExitConfig(current?.enter, patch.enter),
    exit: mergeEnterExitConfig(current?.exit, patch.exit),
    loop: mergeLoopConfig(current?.loop, patch.loop),
  }

  return normalizeAnimationSpec(merged)
}
