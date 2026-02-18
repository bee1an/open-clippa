import type { CropInsets, SideCropDirection, SideCropResizeResult } from './performer'

const LOCAL_MIN_VISIBLE = 0.5
const WORLD_EPSILON = 1e-6

export const EMPTY_CROP: CropInsets = {
  left: 0,
  top: 0,
  right: 0,
  bottom: 0,
}

function toSafeNumber(value: number | undefined): number {
  if (typeof value !== 'number' || !Number.isFinite(value))
    return 0

  return Math.max(0, value)
}

export function cloneCrop(crop?: Partial<CropInsets> | null): CropInsets {
  if (!crop)
    return { ...EMPTY_CROP }

  return {
    left: toSafeNumber(crop.left),
    top: toSafeNumber(crop.top),
    right: toSafeNumber(crop.right),
    bottom: toSafeNumber(crop.bottom),
  }
}

export function normalizeCropInsets(
  crop: Partial<CropInsets> | null | undefined,
  localWidth: number,
  localHeight: number,
  minVisibleLocal: number = LOCAL_MIN_VISIBLE,
): CropInsets {
  const normalized = cloneCrop(crop)
  const safeLocalWidth = Math.max(0, localWidth)
  const safeLocalHeight = Math.max(0, localHeight)
  const safeVisible = Math.max(0, minVisibleLocal)

  const maxCropWidth = Math.max(0, safeLocalWidth - safeVisible)
  const maxCropHeight = Math.max(0, safeLocalHeight - safeVisible)

  const horizontalSum = normalized.left + normalized.right
  if (horizontalSum > maxCropWidth && horizontalSum > WORLD_EPSILON) {
    const ratio = maxCropWidth / horizontalSum
    normalized.left *= ratio
    normalized.right *= ratio
  }

  const verticalSum = normalized.top + normalized.bottom
  if (verticalSum > maxCropHeight && verticalSum > WORLD_EPSILON) {
    const ratio = maxCropHeight / verticalSum
    normalized.top *= ratio
    normalized.bottom *= ratio
  }

  return normalized
}

export function resolveVisibleLocalSize(
  localWidth: number,
  localHeight: number,
  crop: Partial<CropInsets> | null | undefined,
): { width: number, height: number } {
  const normalized = normalizeCropInsets(crop, localWidth, localHeight)
  return {
    width: Math.max(LOCAL_MIN_VISIBLE, localWidth - normalized.left - normalized.right),
    height: Math.max(LOCAL_MIN_VISIBLE, localHeight - normalized.top - normalized.bottom),
  }
}

function applyHorizontalOutward(
  direction: 'left' | 'right',
  crop: CropInsets,
  localWidth: number,
  localHeight: number,
  scaleX: number,
  scaleY: number,
  targetVisibleWidth: number,
  targetVisibleHeight: number,
): SideCropResizeResult {
  const absScaleX = Math.max(WORLD_EPSILON, Math.abs(scaleX))
  const absScaleY = Math.max(WORLD_EPSILON, Math.abs(scaleY))
  const visibleLocal = resolveVisibleLocalSize(localWidth, localHeight, crop)
  let visibleWidth = visibleLocal.width * absScaleX
  const visibleHeight = visibleLocal.height * absScaleY

  let growWidth = Math.max(0, targetVisibleWidth - visibleWidth)
  const releaseKey = direction === 'right' ? 'right' : 'left'
  const releasableLocal = crop[releaseKey]
  const releaseLocal = Math.min(releasableLocal, growWidth / absScaleX)
  if (releaseLocal > WORLD_EPSILON) {
    crop[releaseKey] = Math.max(0, crop[releaseKey] - releaseLocal)
    visibleWidth += releaseLocal * absScaleX
    growWidth = Math.max(0, targetVisibleWidth - visibleWidth)
  }

  if (growWidth <= WORLD_EPSILON) {
    return {
      scaleX,
      scaleY,
      crop: normalizeCropInsets(crop, localWidth, localHeight),
    }
  }

  const nextRatio = targetVisibleWidth / Math.max(WORLD_EPSILON, visibleWidth)
  const nextScaleX = scaleX * nextRatio
  const nextScaleY = scaleY * nextRatio
  const scaledVisibleHeight = visibleHeight * nextRatio

  if (scaledVisibleHeight > targetVisibleHeight + WORLD_EPSILON) {
    const extraLocal = (scaledVisibleHeight - targetVisibleHeight) / Math.max(WORLD_EPSILON, Math.abs(nextScaleY))
    crop.top += extraLocal / 2
    crop.bottom += extraLocal / 2
  }

  return {
    scaleX: nextScaleX,
    scaleY: nextScaleY,
    crop: normalizeCropInsets(crop, localWidth, localHeight),
  }
}

function applyVerticalOutward(
  direction: 'top' | 'bottom',
  crop: CropInsets,
  localWidth: number,
  localHeight: number,
  scaleX: number,
  scaleY: number,
  targetVisibleWidth: number,
  targetVisibleHeight: number,
): SideCropResizeResult {
  const absScaleX = Math.max(WORLD_EPSILON, Math.abs(scaleX))
  const absScaleY = Math.max(WORLD_EPSILON, Math.abs(scaleY))
  const visibleLocal = resolveVisibleLocalSize(localWidth, localHeight, crop)
  const visibleWidth = visibleLocal.width * absScaleX
  let visibleHeight = visibleLocal.height * absScaleY

  let growHeight = Math.max(0, targetVisibleHeight - visibleHeight)
  const releaseKey = direction === 'bottom' ? 'bottom' : 'top'
  const releasableLocal = crop[releaseKey]
  const releaseLocal = Math.min(releasableLocal, growHeight / absScaleY)
  if (releaseLocal > WORLD_EPSILON) {
    crop[releaseKey] = Math.max(0, crop[releaseKey] - releaseLocal)
    visibleHeight += releaseLocal * absScaleY
    growHeight = Math.max(0, targetVisibleHeight - visibleHeight)
  }

  if (growHeight <= WORLD_EPSILON) {
    return {
      scaleX,
      scaleY,
      crop: normalizeCropInsets(crop, localWidth, localHeight),
    }
  }

  const nextRatio = targetVisibleHeight / Math.max(WORLD_EPSILON, visibleHeight)
  const nextScaleX = scaleX * nextRatio
  const nextScaleY = scaleY * nextRatio
  const scaledVisibleWidth = visibleWidth * nextRatio

  if (scaledVisibleWidth > targetVisibleWidth + WORLD_EPSILON) {
    const extraLocal = (scaledVisibleWidth - targetVisibleWidth) / Math.max(WORLD_EPSILON, Math.abs(nextScaleX))
    crop.left += extraLocal / 2
    crop.right += extraLocal / 2
  }

  return {
    scaleX: nextScaleX,
    scaleY: nextScaleY,
    crop: normalizeCropInsets(crop, localWidth, localHeight),
  }
}

export function applySideCropResize(input: {
  direction: SideCropDirection
  localWidth: number
  localHeight: number
  scaleX: number
  scaleY: number
  crop: Partial<CropInsets> | null | undefined
  targetVisibleWidth: number
  targetVisibleHeight: number
}): SideCropResizeResult {
  const localWidth = Math.max(LOCAL_MIN_VISIBLE, input.localWidth)
  const localHeight = Math.max(LOCAL_MIN_VISIBLE, input.localHeight)
  const targetVisibleWidth = Math.max(WORLD_EPSILON, input.targetVisibleWidth)
  const targetVisibleHeight = Math.max(WORLD_EPSILON, input.targetVisibleHeight)
  const crop = normalizeCropInsets(input.crop, localWidth, localHeight)
  const absScaleX = Math.max(WORLD_EPSILON, Math.abs(input.scaleX))
  const absScaleY = Math.max(WORLD_EPSILON, Math.abs(input.scaleY))
  const visibleLocal = resolveVisibleLocalSize(localWidth, localHeight, crop)
  const visibleWidth = visibleLocal.width * absScaleX
  const visibleHeight = visibleLocal.height * absScaleY

  if (input.direction === 'left' || input.direction === 'right') {
    if (targetVisibleWidth <= visibleWidth + WORLD_EPSILON) {
      const deltaLocal = (visibleWidth - targetVisibleWidth) / absScaleX
      if (input.direction === 'right')
        crop.right += deltaLocal
      else
        crop.left += deltaLocal

      return {
        scaleX: input.scaleX,
        scaleY: input.scaleY,
        crop: normalizeCropInsets(crop, localWidth, localHeight),
      }
    }

    return applyHorizontalOutward(
      input.direction,
      crop,
      localWidth,
      localHeight,
      input.scaleX,
      input.scaleY,
      targetVisibleWidth,
      targetVisibleHeight,
    )
  }

  if (targetVisibleHeight <= visibleHeight + WORLD_EPSILON) {
    const deltaLocal = (visibleHeight - targetVisibleHeight) / absScaleY
    if (input.direction === 'bottom')
      crop.bottom += deltaLocal
    else
      crop.top += deltaLocal

    return {
      scaleX: input.scaleX,
      scaleY: input.scaleY,
      crop: normalizeCropInsets(crop, localWidth, localHeight),
    }
  }

  return applyVerticalOutward(
    input.direction,
    crop,
    localWidth,
    localHeight,
    input.scaleX,
    input.scaleY,
    targetVisibleWidth,
    targetVisibleHeight,
  )
}
