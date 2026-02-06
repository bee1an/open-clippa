import type {
  EnterExitPresetType,
  LoopPresetType,
  RelativeTransformState,
} from './types'
import {
  createRelativeTransformState,
  NEUTRAL_RELATIVE_TRANSFORM_STATE,
} from './types'

const ENTER_FROM_PRESETS: Record<
  Exclude<EnterExitPresetType, 'none'>,
  Partial<RelativeTransformState>
> = {
  'fade': { alpha: 0 },
  'slide-up': { y: 24, alpha: 0 },
  'slide-down': { y: -24, alpha: 0 },
  'slide-left': { x: 24, alpha: 0 },
  'slide-right': { x: -24, alpha: 0 },
  'zoom-in': { scaleX: 0.85, scaleY: 0.85, alpha: 0 },
  'zoom-out': { scaleX: 1.15, scaleY: 1.15, alpha: 0 },
  'rotate-left': { rotation: -12, alpha: 0 },
  'rotate-right': { rotation: 12, alpha: 0 },
}

const EXIT_TO_PRESETS: Record<
  Exclude<EnterExitPresetType, 'none'>,
  Partial<RelativeTransformState>
> = {
  'fade': { alpha: 0 },
  'slide-up': { y: -24, alpha: 0 },
  'slide-down': { y: 24, alpha: 0 },
  'slide-left': { x: -24, alpha: 0 },
  'slide-right': { x: 24, alpha: 0 },
  'zoom-in': { scaleX: 1.15, scaleY: 1.15, alpha: 0 },
  'zoom-out': { scaleX: 0.85, scaleY: 0.85, alpha: 0 },
  'rotate-left': { rotation: -12, alpha: 0 },
  'rotate-right': { rotation: 12, alpha: 0 },
}

const LOOP_TO_PRESETS: Record<
  Exclude<LoopPresetType, 'none'>,
  Partial<RelativeTransformState>
> = {
  float: { y: -12 },
  pulse: { scaleX: 1.05, scaleY: 1.05 },
  spin: { rotation: 360 },
}

export function getEnterFromTransform(preset: EnterExitPresetType): RelativeTransformState {
  if (preset === 'none')
    return { ...NEUTRAL_RELATIVE_TRANSFORM_STATE }
  return createRelativeTransformState(ENTER_FROM_PRESETS[preset])
}

export function getExitToTransform(preset: EnterExitPresetType): RelativeTransformState {
  if (preset === 'none')
    return { ...NEUTRAL_RELATIVE_TRANSFORM_STATE }
  return createRelativeTransformState(EXIT_TO_PRESETS[preset])
}

export function getLoopToTransform(preset: LoopPresetType): RelativeTransformState {
  if (preset === 'none')
    return { ...NEUTRAL_RELATIVE_TRANSFORM_STATE }
  return createRelativeTransformState(LOOP_TO_PRESETS[preset])
}
