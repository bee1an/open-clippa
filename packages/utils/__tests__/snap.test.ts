import { describe, expect, it } from 'vitest'
import { clearSnapState, pickNearestCandidate, solveAxisSnap } from '../src/snap'

describe('snap utils', () => {
  it('finds nearest candidate', () => {
    const nearest = pickNearestCandidate(100, [
      { id: 'a', value: 120 },
      { id: 'b', value: 98 },
      { id: 'c', value: 105 },
    ])

    expect(nearest?.candidate.id).toBe('b')
    expect(nearest?.distance).toBe(2)
  })

  it('snaps when entering threshold', () => {
    const result = solveAxisSnap({
      nextValue: 101,
      candidates: [{ id: 'target', value: 100 }],
      state: null,
      enterThreshold: 6,
      exitThreshold: 10,
    })

    expect(result.snapped).toBe(true)
    expect(result.value).toBe(100)
    expect(result.state?.lockedCandidateId).toBe('target')
  })

  it('keeps lock before exit threshold and releases after threshold', () => {
    const first = solveAxisSnap({
      nextValue: 101,
      candidates: [{ id: 'target', value: 100 }],
      state: null,
      enterThreshold: 6,
      exitThreshold: 10,
      mode: 'incremental',
    })

    const keep = solveAxisSnap({
      nextValue: 108,
      candidates: [{ id: 'target', value: 100 }],
      state: first.state,
      enterThreshold: 6,
      exitThreshold: 10,
      mode: 'incremental',
    })
    expect(keep.snapped).toBe(true)
    expect(keep.value).toBe(100)

    const release = solveAxisSnap({
      nextValue: 112,
      candidates: [{ id: 'target', value: 100 }],
      state: keep.state,
      enterThreshold: 6,
      exitThreshold: 10,
      mode: 'incremental',
    })
    expect(release.snapped).toBe(false)
    expect(release.state).toBeNull()
    expect(release.value).toBe(120)
  })

  it('uses absolute mode to avoid release overshoot', () => {
    const first = solveAxisSnap({
      nextValue: 98,
      candidates: [{ id: 'target', value: 100 }],
      state: null,
      enterThreshold: 6,
      exitThreshold: 10,
    })
    expect(first.snapped).toBe(true)
    expect(first.value).toBe(100)

    const keep = solveAxisSnap({
      nextValue: 105,
      candidates: [{ id: 'target', value: 100 }],
      state: first.state,
      enterThreshold: 6,
      exitThreshold: 10,
    })
    expect(keep.snapped).toBe(true)
    expect(keep.value).toBe(100)

    const release = solveAxisSnap({
      nextValue: 111,
      candidates: [{ id: 'target', value: 100 }],
      state: keep.state,
      enterThreshold: 6,
      exitThreshold: 10,
    })
    expect(release.snapped).toBe(false)
    expect(release.state).toBeNull()
    expect(release.value).toBe(111)
  })

  it('bypasses snap and clears state', () => {
    const result = solveAxisSnap({
      nextValue: 50,
      candidates: [{ id: 'target', value: 40 }],
      state: { lockedCandidateId: 'target', escapeOffset: 0 },
      enterThreshold: 6,
      exitThreshold: 10,
      bypass: true,
    })

    expect(result.snapped).toBe(false)
    expect(result.value).toBe(50)
    expect(result.state).toEqual(clearSnapState())
  })
})
