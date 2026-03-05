import { describe, expect, it } from 'vitest'
import { buildTimelineEdgeSnapCandidates, buildTimelineLeftSnapCandidates } from '../src/utils/snap'

describe('timeline snap candidates', () => {
  it('builds move candidates from train boundaries and playhead', () => {
    const candidates = buildTimelineLeftSnapCandidates({
      trainId: 'current',
      width: 100,
      duration: 1000,
      connectionGapPx: 4,
      playhead: { x: 360, time: 5000 },
      targets: [
        {
          id: 'target-1',
          railZIndex: 3,
          x: 200,
          width: 120,
          start: 2000,
          duration: 1000,
        },
      ],
    })

    expect(candidates.map(item => item.id)).toEqual([
      'target:3:target-1:before',
      'target:3:target-1:after',
      'playhead:left',
      'playhead:right',
    ])
    expect(candidates[0]?.value).toBe(96)
    expect(candidates[0]?.meta?.rawStartMs).toBe(1000)
    expect(candidates[1]?.value).toBe(324)
    expect(candidates[1]?.meta?.rawStartMs).toBe(3000)
    expect(candidates[3]?.value).toBe(260)
    expect(candidates[3]?.meta?.rawStartMs).toBe(4000)
  })

  it('builds right-edge candidates from stable anchors', () => {
    const candidates = buildTimelineEdgeSnapCandidates({
      trainId: 'current',
      width: 80,
      duration: 1000,
      connectionGapPx: 4,
      playhead: { x: 200, time: 3000 },
      edge: 'right',
      targets: [
        {
          id: 'target-1',
          railZIndex: 2,
          x: 100,
          width: 60,
          start: 1000,
          duration: 1000,
        },
      ],
    })

    expect(candidates.map(item => item.id)).toEqual([
      'right:target:2:target-1:left',
      'right:target:2:target-1:right',
      'right:target:2:target-1:before-gap',
      'right:playhead',
    ])
    expect(candidates[0]?.value).toBe(100)
    expect(candidates[1]?.value).toBe(160)
    expect(candidates[2]?.value).toBe(96)
    expect(candidates[2]?.meta?.guideX).toBe(100)
    expect(candidates[3]?.id).toBe('right:playhead')
    expect(candidates[3]?.value).toBe(200)
  })

  it('keeps edge candidates stable when width changes', () => {
    const narrow = buildTimelineEdgeSnapCandidates({
      trainId: 'current',
      width: 80,
      duration: 1000,
      connectionGapPx: 4,
      playhead: { x: 200, time: 3000 },
      edge: 'left',
      targets: [
        {
          id: 'target-1',
          railZIndex: 1,
          x: 100,
          width: 60,
          start: 1000,
          duration: 1000,
        },
      ],
    })
    const wide = buildTimelineEdgeSnapCandidates({
      trainId: 'current',
      width: 220,
      duration: 3000,
      connectionGapPx: 4,
      playhead: { x: 200, time: 3000 },
      edge: 'left',
      targets: [
        {
          id: 'target-1',
          railZIndex: 1,
          x: 100,
          width: 60,
          start: 1000,
          duration: 1000,
        },
      ],
    })

    expect(narrow.map(item => item.value)).toEqual(wide.map(item => item.value))
  })

  it('omits raw start meta for visual-anchor targets', () => {
    const candidates = buildTimelineLeftSnapCandidates({
      trainId: 'current',
      width: 100,
      duration: 1000,
      connectionGapPx: 4,
      playhead: null,
      targets: [
        {
          id: 'same-rail',
          railZIndex: 1,
          x: 120,
          width: 60,
          start: 1000,
          duration: 500,
          anchorMode: 'time',
        },
        {
          id: 'other-rail',
          railZIndex: 0,
          x: 240,
          width: 80,
          start: 2000,
          duration: 500,
          anchorMode: 'visual',
        },
      ],
    })

    const sameRailBefore = candidates.find(item => item.id === 'target:1:same-rail:before')
    const crossRailBefore = candidates.find(item => item.id === 'target:0:other-rail:before')
    expect(sameRailBefore?.meta?.rawStartMs).toBe(0)
    expect(crossRailBefore?.meta?.rawStartMs).toBeUndefined()
  })
})
