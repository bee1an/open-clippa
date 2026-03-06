import { describe, expect, it } from 'vitest'
import { buildClipShapeSvgPath, CLIP_SHAPE_PRESETS, resolveClipShape } from '../index'

describe('clip shape presets', () => {
  it('resolves cloned clip shapes by preset id', () => {
    const shape = resolveClipShape('hexagon')

    expect(shape?.id).toBe('hexagon')
    expect(shape?.points).toHaveLength(6)

    shape?.points[0] && (shape.points[0].x = 123)
    const resolvedAgain = resolveClipShape('hexagon')
    expect(resolvedAgain?.points[0]?.x).not.toBe(123)
  })

  it('builds a closed svg path from preset points', () => {
    const path = buildClipShapeSvgPath(CLIP_SHAPE_PRESETS[0]?.shape ?? null)

    expect(path?.startsWith('M')).toBe(true)
    expect(path?.endsWith(' Z')).toBe(true)
  })

  it('normalizes preset points to remove extra padding', () => {
    const star = resolveClipShape('star')
    const xs = star?.points.map(point => point.x) ?? []
    const ys = star?.points.map(point => point.y) ?? []

    expect(Math.min(...xs)).toBeCloseTo(0)
    expect(Math.max(...xs)).toBeCloseTo(1)
    expect(Math.min(...ys)).toBeCloseTo(0)
    expect(Math.max(...ys)).toBeCloseTo(1)
  })
})
