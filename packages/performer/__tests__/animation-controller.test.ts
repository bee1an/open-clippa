import type { PerformerAnimationSpec, TransformState } from '../src/animation'
import { describe, expect, it } from 'vitest'
import { AnimationController } from '../src/animation'

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
): TransformState {
  let output = createBaseTransform()
  controller.apply(timeMs, durationMs, (transform) => {
    output = { ...transform }
  })
  return output
}

describe('animation controller', () => {
  it('applies enter from state at t=0 and returns to neutral at enter end', () => {
    const base = createBaseTransform()
    const spec: PerformerAnimationSpec = {
      enter: {
        preset: 'slide-up',
        durationMs: 400,
      },
    }
    const controller = new AnimationController(base, spec)

    const atStart = applyAt(controller, 0, 3000)
    expect(atStart.y).toBeCloseTo(base.y + 24)
    expect(atStart.alpha).toBeCloseTo(0)

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
})
