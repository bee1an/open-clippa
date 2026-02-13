import { describe, expect, it } from 'vitest'
import { buildTransitionPairKey, TransitionManager } from '../index'

describe('transitionManager', () => {
  it('creates transition and syncs active selection', () => {
    const manager = new TransitionManager()

    const created = manager.createTransition({
      fromId: 'from-a',
      toId: 'to-b',
    })

    const snapshot = manager.getSnapshot()
    expect(snapshot.transitions).toHaveLength(1)
    expect(snapshot.activeTransitionId).toBe(created.id)
    expect(snapshot.activePairKey).toBe(buildTransitionPairKey('from-a', 'to-b'))
  })

  it('updates transition and clamps duration to non-negative', () => {
    const manager = new TransitionManager()
    const created = manager.createTransition({
      fromId: 'from-a',
      toId: 'to-b',
      durationMs: 300,
    })

    manager.updateTransition(created.id, {
      durationMs: -10,
      fromId: 'from-c',
      toId: 'to-d',
    })

    const snapshot = manager.getSnapshot()
    expect(snapshot.transitions[0]?.durationMs).toBe(0)
    expect(snapshot.activePairKey).toBe(buildTransitionPairKey('from-c', 'to-d'))
  })

  it('removes transition and clears only activeTransitionId', () => {
    const manager = new TransitionManager()
    const created = manager.createTransition({
      fromId: 'from-a',
      toId: 'to-b',
    })

    manager.removeTransition(created.id)

    const snapshot = manager.getSnapshot()
    expect(snapshot.transitions).toHaveLength(0)
    expect(snapshot.activeTransitionId).toBeNull()
    expect(snapshot.activePairKey).toBe(buildTransitionPairKey('from-a', 'to-b'))
  })

  it('supports pair selection toggle and clear', () => {
    const manager = new TransitionManager()

    manager.selectPair('from-a', 'to-b')
    expect(manager.getSnapshot().activePairKey).toBe(buildTransitionPairKey('from-a', 'to-b'))

    manager.selectPair('from-a', 'to-b', true)
    const snapshot = manager.getSnapshot()
    expect(snapshot.activePairKey).toBeNull()
    expect(snapshot.activeTransitionId).toBeNull()
  })
})
