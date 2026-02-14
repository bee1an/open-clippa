import { buildTransitionPairKey } from '@clippc/transition'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'
import { useTransitionStore } from './useTransitionStore'

describe('useTransitionStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('supports selectPair and toggle clear', () => {
    const store = useTransitionStore()

    store.selectPair('from-a', 'to-b')
    expect(store.activePairKey).toBe(buildTransitionPairKey('from-a', 'to-b'))
    expect(store.activeTransitionId).toBeNull()

    store.selectPair('from-a', 'to-b', true)
    expect(store.activePairKey).toBeNull()
    expect(store.activeTransitionId).toBeNull()
  })

  it('syncs activePairKey and activeTransitionId after createTransition', () => {
    const store = useTransitionStore()

    const created = store.createTransition({
      fromId: 'from-a',
      toId: 'to-b',
    })

    expect(store.activeTransitionId).toBe(created.id)
    expect(store.activePairKey).toBe(buildTransitionPairKey('from-a', 'to-b'))
  })

  it('syncs pair key when selecting transition by id', () => {
    const store = useTransitionStore()

    const first = store.createTransition({
      fromId: 'from-a',
      toId: 'to-b',
    })
    const second = store.createTransition({
      fromId: 'from-c',
      toId: 'to-d',
    })

    expect(store.activeTransitionId).toBe(second.id)
    expect(store.activePairKey).toBe(buildTransitionPairKey('from-c', 'to-d'))

    store.selectTransition(first.id)
    expect(store.activeTransitionId).toBe(first.id)
    expect(store.activePairKey).toBe(buildTransitionPairKey('from-a', 'to-b'))
  })

  it('keeps activePairKey when selecting null transition id', () => {
    const store = useTransitionStore()

    const created = store.createTransition({
      fromId: 'from-a',
      toId: 'to-b',
    })
    expect(store.activeTransitionId).toBe(created.id)
    expect(store.activePairKey).toBe(buildTransitionPairKey('from-a', 'to-b'))

    store.selectTransition(null)

    expect(store.activeTransitionId).toBeNull()
    expect(store.activePairKey).toBe(buildTransitionPairKey('from-a', 'to-b'))
  })

  it('keeps activePairKey when active transition is removed', () => {
    const store = useTransitionStore()

    const created = store.createTransition({
      fromId: 'from-a',
      toId: 'to-b',
    })

    store.removeTransition(created.id)

    expect(store.activeTransitionId).toBeNull()
    expect(store.activePairKey).toBe(buildTransitionPairKey('from-a', 'to-b'))
  })

  it('clearActiveSelection clears both active states', () => {
    const store = useTransitionStore()

    store.createTransition({
      fromId: 'from-a',
      toId: 'to-b',
    })
    store.clearActiveSelection()

    expect(store.activeTransitionId).toBeNull()
    expect(store.activePairKey).toBeNull()
  })
})
