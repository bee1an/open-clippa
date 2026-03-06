import type { PerformerClipShape } from './performer'

export interface ClipShapePreset {
  id: string
  shape: PerformerClipShape
}

function buildEllipsePoints(count: number): Array<{ x: number, y: number }> {
  return Array.from({ length: count }, (_, index) => {
    const angle = (Math.PI * 2 * index) / count
    return {
      x: 0.5 + Math.cos(angle) * 0.5,
      y: 0.5 + Math.sin(angle) * 0.5,
    }
  })
}

function normalizePoints(points: Array<{ x: number, y: number }>): Array<{ x: number, y: number }> {
  if (points.length === 0)
    return []

  const xs = points.map(point => point.x)
  const ys = points.map(point => point.y)
  const minX = Math.min(...xs)
  const maxX = Math.max(...xs)
  const minY = Math.min(...ys)
  const maxY = Math.max(...ys)
  const width = Math.max(1e-6, maxX - minX)
  const height = Math.max(1e-6, maxY - minY)

  return points.map(point => ({
    x: (point.x - minX) / width,
    y: (point.y - minY) / height,
  }))
}

function cloneShape(shape: PerformerClipShape): PerformerClipShape {
  return {
    id: shape.id,
    points: normalizePoints(shape.points).map(point => ({
      x: point.x,
      y: point.y,
    })),
  }
}

export const CLIP_SHAPE_PRESETS: ClipShapePreset[] = [
  {
    id: 'circle',
    shape: {
      id: 'circle',
      points: buildEllipsePoints(32),
    },
  },
  {
    id: 'diamond',
    shape: {
      id: 'diamond',
      points: [
        { x: 0.5, y: 0 },
        { x: 1, y: 0.5 },
        { x: 0.5, y: 1 },
        { x: 0, y: 0.5 },
      ],
    },
  },
  {
    id: 'hexagon',
    shape: {
      id: 'hexagon',
      points: [
        { x: 0.25, y: 0.08 },
        { x: 0.75, y: 0.08 },
        { x: 1, y: 0.5 },
        { x: 0.75, y: 0.92 },
        { x: 0.25, y: 0.92 },
        { x: 0, y: 0.5 },
      ],
    },
  },
  {
    id: 'star',
    shape: {
      id: 'star',
      points: [
        { x: 0.5, y: 0.04 },
        { x: 0.61, y: 0.35 },
        { x: 0.95, y: 0.35 },
        { x: 0.68, y: 0.56 },
        { x: 0.78, y: 0.92 },
        { x: 0.5, y: 0.7 },
        { x: 0.22, y: 0.92 },
        { x: 0.32, y: 0.56 },
        { x: 0.05, y: 0.35 },
        { x: 0.39, y: 0.35 },
      ],
    },
  },
]

const CLIP_SHAPE_PRESET_MAP = new Map(CLIP_SHAPE_PRESETS.map(preset => [preset.id, preset]))

export function resolveClipShapePreset(shapeId: string | null | undefined): ClipShapePreset | null {
  if (!shapeId)
    return null

  return CLIP_SHAPE_PRESET_MAP.get(shapeId) ?? null
}

export function resolveClipShape(shapeId: string | null | undefined): PerformerClipShape | null {
  const preset = resolveClipShapePreset(shapeId)
  return preset ? cloneShape(preset.shape) : null
}

export function buildClipShapeSvgPath(shape: PerformerClipShape | null | undefined): string | null {
  if (!shape || shape.points.length < 3)
    return null

  return `${shape.points.map((point, index) => {
    const x = (point.x * 100).toFixed(3)
    const y = (point.y * 100).toFixed(3)
    return `${index === 0 ? 'M' : 'L'}${x} ${y}`
  }).join(' ')} Z`
}
