import type { Timeline, Train } from 'clippc'
import { describe, expect, it, vi } from 'vitest'
import { TransitionCandidateTracker } from '../index'

type EventMap = Record<string, ((...args: any[]) => void)[]>

class MockEmitter {
  private readonly listeners: EventMap = {}

  on(event: string, handler: (...args: any[]) => void): void {
    if (!this.listeners[event])
      this.listeners[event] = []

    this.listeners[event].push(handler)
  }

  off(event: string, handler: (...args: any[]) => void): void {
    if (!this.listeners[event])
      return

    this.listeners[event] = this.listeners[event].filter(item => item !== handler)
  }

  emit(event: string, ...args: any[]): void {
    this.listeners[event]?.forEach((handler) => {
      handler(...args)
    })
  }
}

class MockTrain extends MockEmitter {
  constructor(
    public id: string,
    public start: number,
    public duration: number,
  ) {
    super()
  }
}

class MockRail extends MockEmitter {
  trains: Train[] = []

  constructor(public zIndex: number) {
    super()
  }

  insertTrain(train: MockTrain): void {
    this.trains.push(train as unknown as Train)
    this.emit('insertTrain', train)
  }
}

class MockRails extends MockEmitter {
  constructor(public rails: MockRail[]) {
    super()
  }
}

class MockTimeline extends MockEmitter {
  rails: MockRails

  constructor(rails: MockRail[]) {
    super()
    this.rails = new MockRails(rails)
  }
}

describe('transitionCandidateTracker', () => {
  it('refreshes candidate list when train events change seam', () => {
    const first = new MockTrain('a', 0, 100)
    const second = new MockTrain('b', 100, 80)
    const rail = new MockRail(1)
    rail.trains = [first as unknown as Train, second as unknown as Train]
    const timeline = new MockTimeline([rail])

    const tracker = new TransitionCandidateTracker({
      timeline: timeline as unknown as Timeline,
      resolveClip: performerId => ({
        id: performerId,
        start: 0,
        duration: 100,
        type: 'image',
      }),
    })

    tracker.start()
    expect(tracker.getSnapshot().candidates).toHaveLength(1)

    second.start = 120
    second.emit('moveEnd')

    expect(tracker.getSnapshot().candidates).toHaveLength(0)
  })

  it('clears active selection when active pair disappears', () => {
    const first = new MockTrain('a', 0, 100)
    const second = new MockTrain('b', 100, 80)
    const rail = new MockRail(1)
    rail.trains = [first as unknown as Train, second as unknown as Train]
    const timeline = new MockTimeline([rail])

    const clearActiveSelection = vi.fn()
    const tracker = new TransitionCandidateTracker({
      timeline: timeline as unknown as Timeline,
      resolveClip: performerId => performerId === 'b'
        ? null
        : {
            id: performerId,
            start: 0,
            duration: 100,
            type: 'image',
          },
      getActivePairKey: () => 'a->b',
      clearActiveSelection,
    })

    tracker.start()

    expect(clearActiveSelection).toHaveBeenCalledTimes(1)
    expect(tracker.getSnapshot().candidates).toHaveLength(0)
  })

  it('stops reacting after stop()', () => {
    const first = new MockTrain('a', 0, 100)
    const second = new MockTrain('b', 100, 80)
    const rail = new MockRail(1)
    rail.trains = [first as unknown as Train, second as unknown as Train]
    const timeline = new MockTimeline([rail])

    const tracker = new TransitionCandidateTracker({
      timeline: timeline as unknown as Timeline,
      resolveClip: performerId => ({
        id: performerId,
        start: 0,
        duration: 100,
        type: 'image',
      }),
    })

    tracker.start()
    const startVersion = tracker.getSnapshot().version

    tracker.stop()
    second.start = 200
    second.emit('moveEnd')

    expect(tracker.getSnapshot().version).toBe(startVersion)
  })

  it('binds newly created rails after layoutChanged', () => {
    const first = new MockTrain('a', 0, 100)
    const initialRail = new MockRail(0)
    initialRail.trains = [first as unknown as Train]
    const timeline = new MockTimeline([initialRail])

    const tracker = new TransitionCandidateTracker({
      timeline: timeline as unknown as Timeline,
      resolveClip: performerId => ({
        id: performerId,
        start: 0,
        duration: 100,
        type: 'image',
      }),
    })

    tracker.start()
    expect(tracker.getSnapshot().candidates).toHaveLength(0)

    const from = new MockTrain('from', 0, 100)
    const to = new MockTrain('to', 100, 60)
    const newRail = new MockRail(1)
    newRail.trains = [from as unknown as Train, to as unknown as Train]
    timeline.rails.rails.push(newRail)
    timeline.rails.emit('layoutChanged')

    const next = tracker.getSnapshot()
    expect(next.candidates).toHaveLength(1)
    expect(next.candidates[0]?.pairKey).toBe('from->to')
  })
})
