import { describe, expect, it } from 'vitest'
import { rotateCropDelta } from './cropGesture'

describe('rotateCropDelta', () => {
  it('returns the same delta when rotation is zero', () => {
    expect(rotateCropDelta(12, -4, 0)).toEqual({ x: 12, y: -4 })
  })

  it('converts world delta into local delta for 90 degree rotation', () => {
    const local = rotateCropDelta(10, 0, -90)
    const world = rotateCropDelta(10, 0, 90)

    expect(local.x).toBeCloseTo(0, 6)
    expect(local.y).toBeCloseTo(-10, 6)
    expect(world.x).toBeCloseTo(0, 6)
    expect(world.y).toBeCloseTo(10, 6)
  })

  it('keeps vector length under arbitrary rotation', () => {
    const rotated = rotateCropDelta(6, 8, 37)

    expect(Math.hypot(rotated.x, rotated.y)).toBeCloseTo(10, 6)
  })
})
