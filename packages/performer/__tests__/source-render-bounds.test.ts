import { describe, expect, it } from 'vitest'
import { Image } from '../src/image'

type MockSprite = {
  x: number
  y: number
  width: number
  height: number
  angle: number
  alpha: number
  scale: {
    x: number
    y: number
  }
}

function createImageHarness(): Image {
  const performer = Object.create(Image.prototype) as Image
  const performerLike = performer as any
  performerLike._sprite = {
    x: 320,
    y: 180,
    width: 400,
    height: 200,
    angle: 30,
    alpha: 0.8,
    scale: {
      x: 2,
      y: 2,
    },
  } as MockSprite
  performerLike._naturalSize = { width: 200, height: 100 }
  performerLike._cropInsets = {
    left: 24,
    top: 12,
    right: 36,
    bottom: 18,
  }
  return performer
}

describe('source render bounds', () => {
  it('keeps source preview aligned with crop pivot under rotation', () => {
    const performer = createImageHarness()

    const bounds = performer.getSourceRenderBounds()

    expect(bounds).not.toBeNull()
    expect(bounds?.x).toBeCloseTo(320)
    expect(bounds?.y).toBeCloseTo(180)
    expect(bounds?.width).toBeCloseTo(400)
    expect(bounds?.height).toBeCloseTo(200)
    expect(bounds?.pivotX).toBeCloseTo(24)
    expect(bounds?.pivotY).toBeCloseTo(12)
    expect(bounds?.rotation).toBeCloseTo(30)
    expect(bounds?.alpha).toBeCloseTo(0.8)
  })
})
