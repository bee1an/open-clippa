import { describe, expect, it } from 'vitest'
import { computeTransitionMaxMs } from './transition'

describe('computeTransitionMaxMs', () => {
  it('returns zero maxMs when both video clips have no crop margin', () => {
    const result = computeTransitionMaxMs(
      {
        id: 'from',
        start: 0,
        duration: 1000,
        type: 'video',
        sourceStart: 0,
        sourceDuration: 1000,
      },
      {
        id: 'to',
        start: 1000,
        duration: 1000,
        type: 'video',
        sourceStart: 0,
        sourceDuration: 1000,
      },
    )

    expect(result.maxMs).toBe(0)
    expect(result.fromTail).toBe(0)
    expect(result.toHead).toBe(0)
  })

  it('calculates maxMs with partial crop margins', () => {
    const result = computeTransitionMaxMs(
      {
        id: 'from',
        start: 0,
        duration: 1000,
        type: 'video',
        sourceStart: 500,
        sourceDuration: 2000,
      },
      {
        id: 'to',
        start: 1000,
        duration: 1000,
        type: 'video',
        sourceStart: 200,
        sourceDuration: 4000,
      },
    )

    expect(result.fromTail).toBe(500)
    expect(result.toHead).toBe(200)
    expect(result.maxMs).toBe(400)
  })

  it('uses full duration as crop margin for non-video clips', () => {
    const result = computeTransitionMaxMs(
      {
        id: 'from',
        start: 0,
        duration: 900,
        type: 'image',
      },
      {
        id: 'to',
        start: 900,
        duration: 300,
        type: 'image',
      },
    )

    expect(result.maxMs).toBe(600)
    expect(result.fromTail).toBe(900)
    expect(result.toHead).toBe(300)
  })

  it('keeps uiMax as max(maxMs, durationMs)', () => {
    const result = computeTransitionMaxMs(
      {
        id: 'from',
        start: 0,
        duration: 1000,
        type: 'video',
        sourceStart: 0,
        sourceDuration: 1500,
      },
      {
        id: 'to',
        start: 1000,
        duration: 1000,
        type: 'video',
        sourceStart: 0,
        sourceDuration: 3000,
      },
      500,
    )

    expect(result.maxMs).toBe(0)
    expect(result.uiMax).toBe(500)
  })
})
