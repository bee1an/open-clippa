import type { Performer } from '@clippc/performer'
import { describe, expect, it } from 'vitest'
import {
  adaptPerformersForCanvasResize,
  getCanvasPresetById,
  projectBoundsToCanvasBase,
  remapBoundsForCanvasResize,
  resolveCanvasSizeByPresetId,
} from '../src/layout'

function createMockPerformer(initialBounds: { x: number, y: number, width: number, height: number }) {
  const bounds = { ...initialBounds }
  const scaleCalls: Array<{ x: number, y: number }> = []
  const positionCalls: Array<{ x: number, y: number }> = []

  const sprite = {
    scale: {
      x: 1,
      y: 1,
    },
  }

  const performer = {
    sprite,
    getBaseBounds: () => ({ ...bounds, rotation: 0 }),
    setScale: (nextScaleX: number, nextScaleY: number) => {
      const ratioX = sprite.scale.x ? nextScaleX / sprite.scale.x : 1
      const ratioY = sprite.scale.y ? nextScaleY / sprite.scale.y : 1
      sprite.scale.x = nextScaleX
      sprite.scale.y = nextScaleY
      bounds.width *= ratioX
      bounds.height *= ratioY
      scaleCalls.push({ x: nextScaleX, y: nextScaleY })
    },
    setPosition: (x: number, y: number) => {
      bounds.x = x
      bounds.y = y
      positionCalls.push({ x, y })
    },
  } as unknown as Performer

  return {
    performer,
    getBounds: () => ({ ...bounds }),
    scaleCalls,
    positionCalls,
  }
}

describe('canvas layout', () => {
  it('resolves presets by id and fallback id', () => {
    expect(getCanvasPresetById('16:9')?.size).toEqual({ width: 960, height: 540 })
    expect(resolveCanvasSizeByPresetId('missing')).toEqual({ width: 960, height: 540 })
  })

  it('remaps bounds with identical aspect ratio scaling', () => {
    const mapped = remapBoundsForCanvasResize(
      { x: 96, y: 54, width: 192, height: 108 },
      { width: 960, height: 540 },
      { width: 1920, height: 1080 },
    )

    expect(mapped).not.toBeNull()
    expect(mapped?.x).toBeCloseTo(192)
    expect(mapped?.y).toBeCloseTo(108)
    expect(mapped?.width).toBeCloseTo(384)
    expect(mapped?.height).toBeCloseTo(216)
  })

  it('clamps remapped bounds inside the new canvas', () => {
    const mapped = remapBoundsForCanvasResize(
      { x: 900, y: 500, width: 200, height: 100 },
      { width: 960, height: 540 },
      { width: 540, height: 960 },
    )

    expect(mapped).not.toBeNull()
    expect(mapped?.x).toBeCloseTo(427.5)
    expect(mapped?.y).toBeCloseTo(903.75)
  })

  it('adapts performer position and size when canvas changes', () => {
    const mock = createMockPerformer({ x: 100, y: 100, width: 200, height: 100 })
    adaptPerformersForCanvasResize(
      [mock.performer],
      { width: 960, height: 540 },
      { width: 540, height: 960 },
    )

    const bounds = mock.getBounds()
    expect(bounds.width).toBeCloseTo(112.5)
    expect(bounds.height).toBeCloseTo(56.25)
    expect(bounds.x).toBeCloseTo(56.25)
    expect(bounds.y).toBeCloseTo(238.5416666667)
    expect(mock.scaleCalls.length).toBe(1)
    expect(mock.positionCalls.length).toBe(1)
  })

  it('keeps layout stable across multi-step ratio switching with a base projection', () => {
    const baseSize = { width: 960, height: 540 }
    const bounds = { x: 120, y: 90, width: 260, height: 140 }

    const asPortrait = remapBoundsForCanvasResize(bounds, baseSize, { width: 540, height: 960 })
    expect(asPortrait).not.toBeNull()

    const projectedBaseFromPortrait = projectBoundsToCanvasBase(asPortrait!, { width: 540, height: 960 }, baseSize)
    expect(projectedBaseFromPortrait).not.toBeNull()

    expect(projectedBaseFromPortrait?.x).toBeCloseTo(bounds.x)
    expect(projectedBaseFromPortrait?.y).toBeCloseTo(bounds.y)
    expect(projectedBaseFromPortrait?.width).toBeCloseTo(bounds.width)
    expect(projectedBaseFromPortrait?.height).toBeCloseTo(bounds.height)

    const asSquare = remapBoundsForCanvasResize(bounds, baseSize, { width: 720, height: 720 })
    expect(asSquare).not.toBeNull()

    const backToLandscape = remapBoundsForCanvasResize(bounds, baseSize, { width: 960, height: 540 })
    expect(backToLandscape).not.toBeNull()
    expect(backToLandscape?.x).toBeCloseTo(bounds.x)
    expect(backToLandscape?.y).toBeCloseTo(bounds.y)
    expect(backToLandscape?.width).toBeCloseTo(bounds.width)
    expect(backToLandscape?.height).toBeCloseTo(bounds.height)
  })
})
