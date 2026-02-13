import type { Timeline } from 'clippc'
import { describe, expect, it } from 'vitest'
import {
  clampVideoSourceTime,
  resolveActiveTransition,
  resolveTransitionVideoSourceTime,
} from '../index'

function createTimeline(): Timeline {
  return {
    rails: {
      rails: [
        {
          zIndex: 1,
          trains: [
            { id: 'from', start: 0, duration: 100 },
            { id: 'to', start: 100, duration: 100 },
          ],
        },
      ],
    },
  } as unknown as Timeline
}

describe('runtimeCore', () => {
  it('resolves active transition within duration window', () => {
    const timeline = createTimeline()
    const transitions = [
      {
        id: 't-1',
        fromId: 'from',
        toId: 'to',
        durationMs: 40,
        type: 'fade',
        params: {},
      },
    ]

    const performers = {
      from: { id: 'from', start: 0, duration: 100 },
      to: { id: 'to', start: 100, duration: 100 },
    }

    const context = resolveActiveTransition({
      time: 100,
      transitions,
      timeline,
      getPerformerById: performerId => (performers as Record<string, unknown>)[performerId],
    })

    expect(context).not.toBeNull()
    expect(context?.pairKey).toBe('from->to')
    expect(context?.progress).toBe(0.5)
  })

  it('treats zero duration transition as instant window', () => {
    const timeline = createTimeline()
    const transitions = [
      {
        id: 't-1',
        fromId: 'from',
        toId: 'to',
        durationMs: 0,
        type: 'fade',
        params: {},
      },
    ]

    const performers = {
      from: { id: 'from', start: 0, duration: 100 },
      to: { id: 'to', start: 100, duration: 100 },
    }

    const context = resolveActiveTransition({
      time: 100.3,
      transitions,
      timeline,
      getPerformerById: performerId => (performers as Record<string, unknown>)[performerId],
    })

    expect(context).not.toBeNull()
    expect(context?.progress).toBe(1)
  })

  it('clamps video source time', () => {
    const video = {
      id: 'video',
      start: 0,
      duration: 100,
      sourceStart: 20,
      sourceDuration: 120,
      renderFrameAtSourceTime: () => Promise.resolve(),
    }

    expect(clampVideoSourceTime(video, -10)).toBe(0)
    expect(clampVideoSourceTime(video, 999)).toBe(120)
    expect(clampVideoSourceTime(video, 80)).toBe(80)
  })

  it('resolves video source time with role bounds', () => {
    const context = {
      transition: {
        id: 't-1',
        fromId: 'from',
        toId: 'to',
        durationMs: 40,
        type: 'fade',
        params: {},
      },
      candidate: {
        id: 'c-1',
        railZIndex: 1,
        fromId: 'from',
        toId: 'to',
        cutTime: 100,
      },
      from: {
        id: 'from',
        start: 0,
        duration: 100,
      },
      to: {
        id: 'to',
        start: 100,
        duration: 100,
      },
      pairKey: 'from->to',
      progress: 0.75,
    }

    const fromVideo = {
      id: 'from',
      start: 0,
      duration: 100,
      sourceStart: 10,
      sourceDuration: 140,
      renderFrameAtSourceTime: () => Promise.resolve(),
    }

    const toVideo = {
      id: 'to',
      start: 100,
      duration: 100,
      sourceStart: 20,
      sourceDuration: 200,
      renderFrameAtSourceTime: () => Promise.resolve(),
    }

    const fromTime = resolveTransitionVideoSourceTime(context, fromVideo, 'from')
    const toTime = resolveTransitionVideoSourceTime(context, toVideo, 'to')

    expect(fromTime).toBeGreaterThanOrEqual(0)
    expect(fromTime).toBeLessThanOrEqual(fromVideo.sourceDuration)
    expect(toTime).toBeGreaterThanOrEqual(0)
    expect(toTime).toBeLessThanOrEqual(toVideo.sourceDuration)
  })
})
