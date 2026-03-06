import { describe, expect, it } from 'vitest'
import { applyCropHandleResize, applySideCropResize, panCropByWorldDelta } from '../src/mediaCrop'

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

  it('pans crop window without changing visible size', () => {
    const result = panCropByWorldDelta({
      localWidth: 100,
      localHeight: 60,
      scaleX: 2,
      scaleY: 2,
      crop: {
        left: 10,
        right: 20,
        top: 5,
        bottom: 5,
      },
      deltaCanvasX: 20,
      deltaCanvasY: 10,
    })

    expect(result.left).toBeCloseTo(0)
    expect(result.right).toBeCloseTo(30)
    expect(result.top).toBeCloseTo(0)
    expect(result.bottom).toBeCloseTo(10)
  })

  it('resizes crop from the left handle and reports origin shift', () => {
    const result = applyCropHandleResize({
      direction: 'left',
      localWidth: 100,
      localHeight: 60,
      scaleX: 2,
      scaleY: 2,
      crop: {
        left: 10,
        right: 10,
        top: 0,
        bottom: 0,
      },
      deltaLocalX: 20,
      deltaLocalY: 0,
    })

    expect(result.crop.left).toBeCloseTo(20)
    expect(result.crop.right).toBeCloseTo(10)
    expect(result.originShiftX).toBeCloseTo(20)
    expect(result.originShiftY).toBeCloseTo(0)
  })

  it('resizes crop from the right handle without moving origin', () => {
    const result = applyCropHandleResize({
      direction: 'right',
      localWidth: 100,
      localHeight: 60,
      scaleX: 2,
      scaleY: 2,
      crop: {
        left: 10,
        right: 10,
        top: 0,
        bottom: 0,
      },
      deltaLocalX: -20,
      deltaLocalY: 0,
    })

    expect(result.crop.left).toBeCloseTo(10)
    expect(result.crop.right).toBeCloseTo(20)
    expect(result.originShiftX).toBeCloseTo(0)
    expect(result.originShiftY).toBeCloseTo(0)
  })

  it('resizes crop from the top handle and reports vertical origin shift', () => {
    const result = applyCropHandleResize({
      direction: 'top',
      localWidth: 100,
      localHeight: 80,
      scaleX: 2,
      scaleY: 4,
      crop: {
        left: 0,
        right: 0,
        top: 8,
        bottom: 12,
      },
      deltaLocalX: 0,
      deltaLocalY: 8,
    })

    expect(result.crop.top).toBeCloseTo(10)
    expect(result.crop.bottom).toBeCloseTo(12)
    expect(result.originShiftX).toBeCloseTo(0)
    expect(result.originShiftY).toBeCloseTo(8)
  })

  it('resizes crop from the top-left corner on both axes', () => {
    const result = applyCropHandleResize({
      direction: 'top-left',
      localWidth: 120,
      localHeight: 80,
      scaleX: 2,
      scaleY: 4,
      crop: {
        left: 10,
        right: 20,
        top: 8,
        bottom: 12,
      },
      deltaLocalX: 10,
      deltaLocalY: 8,
      preserveAspectRatio: true,
    })

    expect(result.crop.left).toBeCloseTo(15)
    expect(result.crop.top).toBeCloseTo(11.333, 3)
    expect(result.originShiftX).toBeCloseTo(10)
    expect(result.originShiftY).toBeCloseTo(13.333, 3)

    const visibleWidth = 120 - result.crop.left - result.crop.right
    const visibleHeight = 80 - result.crop.top - result.crop.bottom
    expect((visibleWidth * 2) / (visibleHeight * 4)).toBeCloseTo(0.75)
  })
})
