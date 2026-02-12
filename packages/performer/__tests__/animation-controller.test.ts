import type { AnimationLayout, PerformerAnimationSpec, TransformState } from '../src/animation'
import { describe, expect, it } from 'vitest'
import { AnimationController } from '../src/animation'

const TEST_LAYOUT: AnimationLayout = {
  localWidth: 200,
  localHeight: 100,
}

function createBaseTransform(): TransformState {
  return {
    x: 120,
    y: 80,
    scaleX: 1,
    scaleY: 1,
    rotation: 10,
    alpha: 1,
  }
}

function applyAt(
  controller: AnimationController,
  timeMs: number,
  durationMs: number,
  layout?: AnimationLayout,
): TransformState {
  let output = createBaseTransform()
  controller.apply(
    timeMs,
    durationMs,
    (transform) => {
      output = { ...transform }
    },
    layout,
  )
  return output
}

function rotateVector(x: number, y: number, rotation: number): { x: number, y: number } {
  if (!rotation)
    return { x, y }

  const rad = rotation * Math.PI / 180
  const cos = Math.cos(rad)
  const sin = Math.sin(rad)
  return {
    x: x * cos - y * sin,
    y: x * sin + y * cos,
  }
}

function resolveCenter(transform: TransformState, layout: AnimationLayout): { x: number, y: number } {
  const offset = rotateVector(
    layout.localWidth * transform.scaleX / 2,
    layout.localHeight * transform.scaleY / 2,
    transform.rotation,
  )
  return {
    x: transform.x + offset.x,
    y: transform.y + offset.y,
  }
}

describe('animation controller', () => {
  it('applies enter progression and returns to neutral at enter end', () => {
    const base = createBaseTransform()
    const spec: PerformerAnimationSpec = {
      enter: {
        preset: 'slide-up',
        durationMs: 400,
      },
    }
    const controller = new AnimationController(base, spec)

    const atMid = applyAt(controller, 200, 3000)
    expect(atMid.y).toBeGreaterThan(base.y)
    expect(atMid.y).toBeLessThan(base.y + 24)
    expect(atMid.alpha).toBeGreaterThan(0)
    expect(atMid.alpha).toBeLessThan(1)

    const atEnterEnd = applyAt(controller, 400, 3000)
    expect(atEnterEnd.y).toBeCloseTo(base.y)
    expect(atEnterEnd.alpha).toBeCloseTo(1)
  })

  it('applies exit segment at tail and reaches target values at clip end', () => {
    const base = createBaseTransform()
    const spec: PerformerAnimationSpec = {
      exit: {
        preset: 'fade',
        durationMs: 400,
      },
    }
    const controller = new AnimationController(base, spec)

    const beforeExit = applyAt(controller, 1500, 2000)
    expect(beforeExit.alpha).toBeCloseTo(1)

    const atClipEnd = applyAt(controller, 2000, 2000)
    expect(atClipEnd.alpha).toBeCloseTo(0)
  })

  it('loops with modulo time for spin preset', () => {
    const base = createBaseTransform()
    const spec: PerformerAnimationSpec = {
      loop: {
        preset: 'spin',
        durationMs: 2000,
      },
    }
    const controller = new AnimationController(base, spec)

    const at500 = applyAt(controller, 500, 8000)
    const at2500 = applyAt(controller, 2500, 8000)

    expect(at500.rotation).toBeCloseTo(base.rotation + 90)
    expect(at2500.rotation).toBeCloseTo(base.rotation + 90)
  })

  it('prioritizes exit when enter and exit overlap', () => {
    const base = createBaseTransform()
    const spec: PerformerAnimationSpec = {
      enter: {
        preset: 'slide-up',
        durationMs: 400,
      },
      exit: {
        preset: 'slide-down',
        durationMs: 400,
      },
    }
    const controller = new AnimationController(base, spec)

    const atStart = applyAt(controller, 0, 300)
    expect(atStart.y).toBeCloseTo(base.y)

    const atEnd = applyAt(controller, 300, 300)
    expect(atEnd.y).toBeCloseTo(base.y + 24)
    expect(atEnd.alpha).toBeCloseTo(0)
  })

  it('keeps visual center stable for rotation under center-pivot composition', () => {
    const base: TransformState = {
      x: 100,
      y: 80,
      scaleX: 1.2,
      scaleY: 0.9,
      rotation: 0,
      alpha: 1,
    }
    const spec: PerformerAnimationSpec = {
      loop: {
        preset: 'spin',
        durationMs: 2000,
      },
    }
    const controller = new AnimationController(base, spec)

    const transformed = applyAt(controller, 500, 8000, TEST_LAYOUT)
    const baseCenter = resolveCenter(base, TEST_LAYOUT)
    const nextCenter = resolveCenter(transformed, TEST_LAYOUT)

    expect(transformed.rotation).toBeCloseTo(90)
    expect(nextCenter.x).toBeCloseTo(baseCenter.x)
    expect(nextCenter.y).toBeCloseTo(baseCenter.y)
  })

  it('keeps visual center stable for scale under center-pivot composition', () => {
    const base: TransformState = {
      x: 140,
      y: 60,
      scaleX: 1,
      scaleY: 1,
      rotation: 25,
      alpha: 1,
    }
    const spec: PerformerAnimationSpec = {
      exit: {
        preset: 'zoom-out',
        durationMs: 400,
      },
    }
    const controller = new AnimationController(base, spec)

    const atStart = applyAt(controller, 3000, 3000, TEST_LAYOUT)
    const baseCenter = resolveCenter(base, TEST_LAYOUT)
    const nextCenter = resolveCenter(atStart, TEST_LAYOUT)

    expect(atStart.scaleX).toBeCloseTo(0.85)
    expect(atStart.scaleY).toBeCloseTo(0.85)
    expect(nextCenter.x).toBeCloseTo(baseCenter.x)
    expect(nextCenter.y).toBeCloseTo(baseCenter.y)
  })

  it('applies x/y translation in world coordinates with center-pivot composition', () => {
    const base: TransformState = {
      x: 80,
      y: 40,
      scaleX: 1.1,
      scaleY: 0.9,
      rotation: 35,
      alpha: 1,
    }
    const spec: PerformerAnimationSpec = {
      exit: {
        preset: 'slide-left',
        durationMs: 400,
      },
    }
    const controller = new AnimationController(base, spec)

    const atStart = applyAt(controller, 3000, 3000, TEST_LAYOUT)
    const baseCenter = resolveCenter(base, TEST_LAYOUT)
    const nextCenter = resolveCenter(atStart, TEST_LAYOUT)

    expect(nextCenter.x - baseCenter.x).toBeCloseTo(-24)
    expect(nextCenter.y - baseCenter.y).toBeCloseTo(0)
  })
})
