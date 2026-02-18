import { describe, expect, it } from 'vitest'
import { applySideCropResize } from '../src/mediaCrop'

describe('mediaCrop side resize', () => {
  it('applies inward right drag as pure crop without scale change', () => {
    const result = applySideCropResize({
      direction: 'right',
      localWidth: 100,
      localHeight: 60,
      scaleX: 1,
      scaleY: 1,
      crop: null,
      targetVisibleWidth: 80,
      targetVisibleHeight: 60,
    })

    expect(result.scaleX).toBe(1)
    expect(result.scaleY).toBe(1)
    expect(result.crop.right).toBeCloseTo(20)
    expect(result.crop.left).toBe(0)
  })

  it('releases existing right crop before scale up on outward drag', () => {
    const result = applySideCropResize({
      direction: 'right',
      localWidth: 100,
      localHeight: 60,
      scaleX: 1,
      scaleY: 1,
      crop: { right: 10 },
      targetVisibleWidth: 95,
      targetVisibleHeight: 60,
    })

    expect(result.scaleX).toBe(1)
    expect(result.scaleY).toBe(1)
    expect(result.crop.right).toBeCloseTo(5)
  })

  it('scales up and center-crops vertical axis on right outward drag', () => {
    const result = applySideCropResize({
      direction: 'right',
      localWidth: 100,
      localHeight: 100,
      scaleX: 1,
      scaleY: 1,
      crop: { right: 10 },
      targetVisibleWidth: 120,
      targetVisibleHeight: 100,
    })

    expect(result.scaleX).toBeCloseTo(1.2)
    expect(result.scaleY).toBeCloseTo(1.2)
    expect(result.crop.right).toBeCloseTo(0)
    expect(result.crop.top).toBeCloseTo(result.crop.bottom)
    expect(result.crop.top).toBeGreaterThan(0)
  })

  it('scales up and center-crops horizontal axis on bottom outward drag', () => {
    const result = applySideCropResize({
      direction: 'bottom',
      localWidth: 120,
      localHeight: 100,
      scaleX: 1,
      scaleY: 1,
      crop: { bottom: 12 },
      targetVisibleWidth: 120,
      targetVisibleHeight: 130,
    })

    expect(result.scaleX).toBeGreaterThan(1)
    expect(result.scaleY).toBeGreaterThan(1)
    expect(result.crop.bottom).toBeCloseTo(0)
    expect(result.crop.left).toBeCloseTo(result.crop.right)
    expect(result.crop.left).toBeGreaterThan(0)
  })
})
