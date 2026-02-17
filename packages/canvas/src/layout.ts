import type { Performer } from '@clippc/performer'

export interface CanvasSize {
  width: number
  height: number
}

export interface CanvasPreset {
  id: string
  label: string
  size: CanvasSize
}

export interface CanvasBounds {
  x: number
  y: number
  width: number
  height: number
}

export const CANVAS_PRESETS: CanvasPreset[] = [
  { id: '16:9', label: '16:9 (Landscape)', size: { width: 960, height: 540 } },
  { id: '9:16', label: '9:16 (Portrait)', size: { width: 540, height: 960 } },
  { id: '1:1', label: '1:1 (Square)', size: { width: 720, height: 720 } },
  { id: '4:3', label: '4:3 (Classic)', size: { width: 960, height: 720 } },
  { id: '3:4', label: '3:4 (Portrait)', size: { width: 720, height: 960 } },
  { id: '21:9', label: '21:9 (Cinematic)', size: { width: 1260, height: 540 } },
]

export const DEFAULT_CANVAS_PRESET_ID = '16:9'

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

export function normalizeCanvasSize(size: CanvasSize): CanvasSize {
  const width = Number.isFinite(size.width) ? Math.max(1, Math.round(size.width)) : 1
  const height = Number.isFinite(size.height) ? Math.max(1, Math.round(size.height)) : 1
  return { width, height }
}

export function isValidCanvasSize(size: CanvasSize): boolean {
  return Number.isFinite(size.width)
    && Number.isFinite(size.height)
    && size.width > 0
    && size.height > 0
}

export function getCanvasPresetById(id: string): CanvasPreset | null {
  return CANVAS_PRESETS.find(preset => preset.id === id) ?? null
}

export function resolveCanvasSizeByPresetId(id: string): CanvasSize {
  const preset = getCanvasPresetById(id) ?? getCanvasPresetById(DEFAULT_CANVAS_PRESET_ID)
  if (!preset)
    return { width: 960, height: 540 }
  return { ...preset.size }
}

export function remapBoundsForCanvasResize(
  bounds: CanvasBounds,
  previousSize: CanvasSize,
  nextSize: CanvasSize,
): CanvasBounds | null {
  if (!isValidCanvasSize(previousSize) || !isValidCanvasSize(nextSize))
    return null

  const boundedWidth = Math.max(1, bounds.width)
  const boundedHeight = Math.max(1, bounds.height)

  const widthRatio = nextSize.width / previousSize.width
  const heightRatio = nextSize.height / previousSize.height
  const uniformScale = Math.min(widthRatio, heightRatio)

  const nextWidth = Math.max(1, boundedWidth * uniformScale)
  const nextHeight = Math.max(1, boundedHeight * uniformScale)

  const centerRatioX = (bounds.x + boundedWidth / 2) / previousSize.width
  const centerRatioY = (bounds.y + boundedHeight / 2) / previousSize.height

  const centerX = centerRatioX * nextSize.width
  const centerY = centerRatioY * nextSize.height

  const maxX = Math.max(0, nextSize.width - nextWidth)
  const maxY = Math.max(0, nextSize.height - nextHeight)

  return {
    x: clamp(centerX - nextWidth / 2, 0, maxX),
    y: clamp(centerY - nextHeight / 2, 0, maxY),
    width: nextWidth,
    height: nextHeight,
  }
}

/**
 * Project bounds defined in current canvas space back into the base canvas space.
 * Useful to keep a stable layout baseline when users edit elements after resizing.
 */
export function projectBoundsToCanvasBase(
  bounds: CanvasBounds,
  currentSize: CanvasSize,
  baseSize: CanvasSize,
): CanvasBounds | null {
  if (!isValidCanvasSize(currentSize) || !isValidCanvasSize(baseSize))
    return null

  const boundedWidth = Math.max(1, bounds.width)
  const boundedHeight = Math.max(1, bounds.height)
  const currentScale = Math.min(currentSize.width / baseSize.width, currentSize.height / baseSize.height)
  if (!(currentScale > 0))
    return null

  const baseWidth = Math.max(1, boundedWidth / currentScale)
  const baseHeight = Math.max(1, boundedHeight / currentScale)

  const centerRatioX = (bounds.x + boundedWidth / 2) / currentSize.width
  const centerRatioY = (bounds.y + boundedHeight / 2) / currentSize.height

  const centerX = centerRatioX * baseSize.width
  const centerY = centerRatioY * baseSize.height

  const maxX = Math.max(0, baseSize.width - baseWidth)
  const maxY = Math.max(0, baseSize.height - baseHeight)

  return {
    x: clamp(centerX - baseWidth / 2, 0, maxX),
    y: clamp(centerY - baseHeight / 2, 0, maxY),
    width: baseWidth,
    height: baseHeight,
  }
}

export function adaptPerformersForCanvasResize(
  performers: Iterable<Performer>,
  previousSize: CanvasSize,
  nextSize: CanvasSize,
): void {
  if (!isValidCanvasSize(previousSize) || !isValidCanvasSize(nextSize))
    return

  if (previousSize.width === nextSize.width && previousSize.height === nextSize.height)
    return

  for (const performer of performers) {
    const bounds = performer.getBaseBounds()
    if (!bounds.width || !bounds.height)
      continue

    const nextBounds = remapBoundsForCanvasResize(bounds, previousSize, nextSize)
    if (!nextBounds)
      continue

    const currentScaleX = performer.sprite?.scale.x ?? 1
    const currentScaleY = performer.sprite?.scale.y ?? 1
    const widthRatio = bounds.width ? nextBounds.width / bounds.width : 1
    const heightRatio = bounds.height ? nextBounds.height / bounds.height : 1

    if (Math.abs(widthRatio - 1) > 1e-6 || Math.abs(heightRatio - 1) > 1e-6) {
      performer.setScale(currentScaleX * widthRatio, currentScaleY * heightRatio)
    }

    if (Math.abs(nextBounds.x - bounds.x) > 1e-6 || Math.abs(nextBounds.y - bounds.y) > 1e-6) {
      performer.setPosition(nextBounds.x, nextBounds.y)
    }
  }
}
