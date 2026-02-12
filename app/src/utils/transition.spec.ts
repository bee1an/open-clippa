import { describe, expect, it } from 'vitest'
import { buildTransitionCandidates, buildTransitionPairKey, computeTransitionMaxMs } from './transition'

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

describe('buildTransitionPairKey', () => {
  it('joins ids with stable separator', () => {
    expect(buildTransitionPairKey('from', 'to')).toBe('from->to')
  })
})

describe('buildTransitionCandidates', () => {
  it('collects adjacent joined clips from each rail', () => {
    const candidates = buildTransitionCandidates({
      rails: {
        rails: [
          {
            zIndex: 10,
            trains: [
              { id: 'b', start: 1000, duration: 500 },
              { id: 'a', start: 0, duration: 1000 },
              { id: 'c', start: 1500, duration: 700 },
            ],
          },
          {
            zIndex: 20,
            trains: [
              { id: 'x', start: 0, duration: 600 },
              { id: 'y', start: 602, duration: 300 },
            ],
          },
        ],
      },
    } as any)

    expect(candidates).toEqual([
      {
        id: '10:a->b',
        railZIndex: 10,
        fromId: 'a',
        toId: 'b',
        cutTime: 1000,
      },
      {
        id: '10:b->c',
        railZIndex: 10,
        fromId: 'b',
        toId: 'c',
        cutTime: 1500,
      },
    ])
  })

  it('keeps candidates when diff is within join tolerance', () => {
    const candidates = buildTransitionCandidates({
      rails: {
        rails: [
          {
            zIndex: 1,
            trains: [
              { id: 'left', start: 0, duration: 1000 },
              { id: 'right', start: 1000.8, duration: 500 },
            ],
          },
        ],
      },
    } as any)

    expect(candidates).toHaveLength(1)
    expect(candidates[0]?.id).toBe('1:left->right')
    expect(candidates[0]?.cutTime).toBe(1000)
  })

  it('returns empty list when timeline has no rails', () => {
    expect(buildTransitionCandidates({ rails: { rails: [] } } as any)).toEqual([])
    expect(buildTransitionCandidates({} as any)).toEqual([])
  })
})
