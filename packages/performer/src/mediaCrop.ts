import type { CropHandleDirection, CropHandleResizeResult, CropInsets, SideCropDirection, SideCropResizeResult } from './performer'

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

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

export function panCropByWorldDelta(input: {
  localWidth: number
  localHeight: number
  scaleX: number
  scaleY: number
  crop: Partial<CropInsets> | null | undefined
  deltaCanvasX: number
  deltaCanvasY: number
}): CropInsets {
  const localWidth = Math.max(LOCAL_MIN_VISIBLE, input.localWidth)
  const localHeight = Math.max(LOCAL_MIN_VISIBLE, input.localHeight)
  const crop = normalizeCropInsets(input.crop, localWidth, localHeight)
  const visible = resolveVisibleLocalSize(localWidth, localHeight, crop)
  const maxLeft = Math.max(0, localWidth - visible.width)
  const maxTop = Math.max(0, localHeight - visible.height)
  const absScaleX = Math.max(WORLD_EPSILON, Math.abs(input.scaleX))
  const absScaleY = Math.max(WORLD_EPSILON, Math.abs(input.scaleY))
  const deltaLocalX = input.deltaCanvasX / absScaleX
  const deltaLocalY = input.deltaCanvasY / absScaleY
  const nextLeft = clamp(crop.left - deltaLocalX, 0, maxLeft)
  const nextTop = clamp(crop.top - deltaLocalY, 0, maxTop)

  return {
    left: nextLeft,
    top: nextTop,
    right: Math.max(0, maxLeft - nextLeft),
    bottom: Math.max(0, maxTop - nextTop),
  }
}

export function applyCropHandleResize(input: {
  direction: CropHandleDirection
  localWidth: number
  localHeight: number
  scaleX: number
  scaleY: number
  crop: Partial<CropInsets> | null | undefined
  deltaLocalX: number
  deltaLocalY: number
  preserveAspectRatio?: boolean
}): CropHandleResizeResult {
  const localWidth = Math.max(LOCAL_MIN_VISIBLE, input.localWidth)
  const localHeight = Math.max(LOCAL_MIN_VISIBLE, input.localHeight)
  const currentCrop = normalizeCropInsets(input.crop, localWidth, localHeight)
  const absScaleX = Math.max(WORLD_EPSILON, Math.abs(input.scaleX))
  const absScaleY = Math.max(WORLD_EPSILON, Math.abs(input.scaleY))
  const currentVisible = resolveVisibleLocalSize(localWidth, localHeight, currentCrop)
  const resizeLeft = input.direction === 'left' || input.direction === 'top-left' || input.direction === 'bottom-left'
  const resizeRight = input.direction === 'right' || input.direction === 'top-right' || input.direction === 'bottom-right'
  const resizeTop = input.direction === 'top' || input.direction === 'top-left' || input.direction === 'top-right'
  const resizeBottom = input.direction === 'bottom' || input.direction === 'bottom-left' || input.direction === 'bottom-right'
  const keepAspectRatio = input.preserveAspectRatio === true

  let nextLeft = currentCrop.left
  let nextRight = currentCrop.right
  let nextTop = currentCrop.top
  let nextBottom = currentCrop.bottom

  if (keepAspectRatio) {
    const widthDeltaLocal = resizeLeft
      ? -(input.deltaLocalX / absScaleX)
      : resizeRight
        ? (input.deltaLocalX / absScaleX)
        : 0
    const heightDeltaLocal = resizeTop
      ? -(input.deltaLocalY / absScaleY)
      : resizeBottom
        ? (input.deltaLocalY / absScaleY)
        : 0
    const widthScale = currentVisible.width > WORLD_EPSILON
      ? (currentVisible.width + widthDeltaLocal) / currentVisible.width
      : 1
    const heightScale = currentVisible.height > WORLD_EPSILON
      ? (currentVisible.height + heightDeltaLocal) / currentVisible.height
      : 1

    let requestedScale = 1
    if (resizeLeft || resizeRight) {
      requestedScale = widthScale
    }
    if (resizeTop || resizeBottom) {
      if (!(resizeLeft || resizeRight)) {
        requestedScale = heightScale
      }
      else {
        requestedScale = Math.abs(widthScale - 1) >= Math.abs(heightScale - 1)
          ? widthScale
          : heightScale
      }
    }

    const maxVisibleWidth = resizeLeft
      ? (localWidth - currentCrop.right)
      : resizeRight
        ? (localWidth - currentCrop.left)
        : localWidth
    const maxVisibleHeight = resizeTop
      ? (localHeight - currentCrop.bottom)
      : resizeBottom
        ? (localHeight - currentCrop.top)
        : localHeight
    const minScale = Math.max(
      LOCAL_MIN_VISIBLE / currentVisible.width,
      LOCAL_MIN_VISIBLE / currentVisible.height,
    )
    const maxScale = Math.min(
      maxVisibleWidth / currentVisible.width,
      maxVisibleHeight / currentVisible.height,
    )
    const clampedScale = clamp(requestedScale, minScale, maxScale)
    const targetVisibleLocalWidth = currentVisible.width * clampedScale
    const targetVisibleLocalHeight = currentVisible.height * clampedScale
    const deltaVisibleHeight = targetVisibleLocalHeight - currentVisible.height
    const deltaVisibleWidth = targetVisibleLocalWidth - currentVisible.width

    if (resizeLeft)
      nextLeft = localWidth - currentCrop.right - targetVisibleLocalWidth
    if (resizeRight)
      nextRight = localWidth - currentCrop.left - targetVisibleLocalWidth
    if (!resizeLeft && !resizeRight) {
      nextLeft = currentCrop.left - deltaVisibleWidth / 2
      nextRight = currentCrop.right - deltaVisibleWidth / 2
    }

    if (resizeTop)
      nextTop = localHeight - currentCrop.bottom - targetVisibleLocalHeight
    if (resizeBottom)
      nextBottom = localHeight - currentCrop.top - targetVisibleLocalHeight
    if (!resizeTop && !resizeBottom) {
      nextTop = currentCrop.top - deltaVisibleHeight / 2
      nextBottom = currentCrop.bottom - deltaVisibleHeight / 2
    }
  }
  else {
    if (resizeLeft)
      nextLeft = clamp(currentCrop.left + (input.deltaLocalX / absScaleX), 0, localWidth - LOCAL_MIN_VISIBLE - currentCrop.right)
    if (resizeRight)
      nextRight = clamp(currentCrop.right - (input.deltaLocalX / absScaleX), 0, localWidth - LOCAL_MIN_VISIBLE - nextLeft)
    if (resizeTop)
      nextTop = clamp(currentCrop.top + (input.deltaLocalY / absScaleY), 0, localHeight - LOCAL_MIN_VISIBLE - currentCrop.bottom)
    if (resizeBottom)
      nextBottom = clamp(currentCrop.bottom - (input.deltaLocalY / absScaleY), 0, localHeight - LOCAL_MIN_VISIBLE - nextTop)
  }

  const nextCrop = normalizeCropInsets({
    left: nextLeft,
    right: nextRight,
    top: nextTop,
    bottom: nextBottom,
  }, localWidth, localHeight)

  return {
    crop: nextCrop,
    originShiftX: resizeLeft ? (nextCrop.left - currentCrop.left) * absScaleX : 0,
    originShiftY: resizeTop ? (nextCrop.top - currentCrop.top) * absScaleY : 0,
  }
}
