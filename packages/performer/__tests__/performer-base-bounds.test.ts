import type { PerformerAnimationSpec, TransformState } from '../src/animation'
import { describe, expect, it } from 'vitest'
import { AnimationController } from '../src/animation'
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

function createHarness(base?: Partial<TransformState>): Image {
  const performer = Object.create(Image.prototype) as Image
  const performerLike = performer as any
  performerLike.currentTime = 0
  performerLike.duration = 1000
  performerLike._sprite = {
    x: base?.x ?? 100,
    y: base?.y ?? 80,
    width: 200,
    height: 100,
    angle: base?.rotation ?? 0,
    alpha: base?.alpha ?? 1,
    scale: {
      x: base?.scaleX ?? 1,
      y: base?.scaleY ?? 1,
    },
  } as MockSprite
  performerLike._naturalSize = { width: 200, height: 100 }
  performerLike.notifyPositionUpdate = () => {}
  return performer
}

function rotateVector(x: number, y: number, rotation: number): { x: number, y: number } {
  if (!rotation)
    return { x, y }

  const radians = rotation * Math.PI / 180
  const cos = Math.cos(radians)
  const sin = Math.sin(radians)
  return {
    x: x * cos - y * sin,
    y: x * sin + y * cos,
  }
}

function resolveVisualCenter(bounds: { x: number, y: number, width: number, height: number, rotation?: number }): { x: number, y: number } {
  const rotation = bounds.rotation ?? 0
  const offset = rotateVector(bounds.width / 2, bounds.height / 2, rotation)
  return {
    x: bounds.x + offset.x,
    y: bounds.y + offset.y,
  }
}

describe('performer base bounds', () => {
  it('keeps base bounds stable while render bounds still include animation offsets', () => {
    const performer = createHarness({
      x: 100,
      y: 80,
      scaleX: 1,
      scaleY: 1,
      rotation: 0,
      alpha: 1,
    })
    const spec: PerformerAnimationSpec = {
      exit: {
        preset: 'slide-left',
        durationMs: 400,
      },
    }

    performer.setAnimation(spec)
    performer.update(1000)

    const initialBaseBounds = performer.getBaseBounds()
    const initialRenderBounds = performer.getBounds()
    expect(initialBaseBounds.x).toBeCloseTo(100)
    expect(initialRenderBounds.x).toBeCloseTo(76)

    performer.setPosition(300, 160)

    const nextBaseBounds = performer.getBaseBounds()
    const nextRenderBounds = performer.getBounds()
    expect(nextBaseBounds.x).toBeCloseTo(300)
    expect(nextBaseBounds.y).toBeCloseTo(160)
    expect(nextRenderBounds.x).toBeCloseTo(276)
    expect(nextRenderBounds.y).toBeCloseTo(160)
  })

  it('does not drift base bounds when switching animation spec', () => {
    const performer = createHarness({
      x: 140,
      y: 90,
      scaleX: 1,
      scaleY: 1,
      rotation: 0,
      alpha: 1,
    })

    performer.setAnimation({
      enter: {
        preset: 'slide-left',
        durationMs: 400,
      },
    })
    performer.setPosition(260, 180)

    const before = performer.getBaseBounds()

    performer.setAnimation({
      loop: {
        preset: 'pulse',
        durationMs: 1200,
      },
    })

    const after = performer.getBaseBounds()
    expect(after.x).toBeCloseTo(before.x)
    expect(after.y).toBeCloseTo(before.y)
    expect(after.width).toBeCloseTo(before.width)
    expect(after.height).toBeCloseTo(before.height)
    expect(after.rotation).toBeCloseTo(before.rotation)
  })

  it('handles near-zero render scale without NaN in base bounds', () => {
    const performer = createHarness({
      x: 40,
      y: 50,
      scaleX: 0,
      scaleY: 0,
      rotation: 0,
      alpha: 1,
    })

    const performerLike = performer as any
    performerLike._sprite.width = 0
    performerLike._sprite.height = 0
    performerLike._animationController = new AnimationController({
      x: 40,
      y: 50,
      scaleX: 2,
      scaleY: 3,
      rotation: 0,
      alpha: 1,
    }, null)

    const bounds = performer.getBaseBounds()
    expect(Number.isFinite(bounds.width)).toBe(true)
    expect(Number.isFinite(bounds.height)).toBe(true)
    expect(bounds.width).toBeGreaterThanOrEqual(0)
    expect(bounds.height).toBeGreaterThanOrEqual(0)
  })

  it('keeps render center aligned with base center for rotate preset', () => {
    const performer = createHarness({
      x: 120,
      y: 80,
      scaleX: 1,
      scaleY: 1,
      rotation: 0,
      alpha: 1,
    })

    performer.setAnimation({
      exit: {
        preset: 'rotate-right',
        durationMs: 400,
      },
    })
    performer.update(1000)

    const baseBounds = performer.getBaseBounds()
    const renderBounds = performer.getBounds()
    const baseCenter = resolveVisualCenter(baseBounds)
    const renderCenter = resolveVisualCenter(renderBounds)

    expect(renderBounds.rotation).toBeCloseTo(12)
    expect(renderCenter.x).toBeCloseTo(baseCenter.x)
    expect(renderCenter.y).toBeCloseTo(baseCenter.y)
  })
})
