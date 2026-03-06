import {
  buildClipShapeSvgPath,
  CLIP_SHAPE_PRESETS,
  resolveClipShape,
  resolveClipShapePreset,
} from '@clippc/performer'

export interface MediaClipShapePreset {
  id: string
  label: string
  svg: string
}

function buildSvg(path: string): string {
  return `<svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="${path}" fill="currentColor"/></svg>`
}

const MEDIA_CLIP_SHAPE_LABELS: Record<string, string> = {
  circle: 'Circle',
  diamond: 'Diamond',
  hexagon: 'Hexagon',
  star: 'Star',
}

export const MEDIA_CLIP_SHAPE_PRESETS: MediaClipShapePreset[] = CLIP_SHAPE_PRESETS.map((preset) => {
  const path = buildClipShapeSvgPath(preset.shape)
  if (!path)
    throw new Error(`Invalid clip shape preset: ${preset.id}`)

  return {
    id: preset.id,
    label: MEDIA_CLIP_SHAPE_LABELS[preset.id] ?? preset.id,
    svg: buildSvg(path),
  }
})

const MEDIA_CLIP_SHAPE_MAP = new Map(MEDIA_CLIP_SHAPE_PRESETS.map(preset => [preset.id, preset]))

export function resolveMediaClipShapePreset(shapeId: string | null | undefined): MediaClipShapePreset | null {
  if (!shapeId)
    return null

  const appPreset = MEDIA_CLIP_SHAPE_MAP.get(shapeId)
  if (!appPreset)
    return null

  return {
    ...appPreset,
  }
}

export { buildClipShapeSvgPath as buildMediaClipShapeSvgPath, resolveClipShape as resolveMediaClipShape, resolveClipShapePreset }
