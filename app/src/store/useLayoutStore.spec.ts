import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import {
  SIDER_COLLAPSED_STORAGE_KEY,
  TIMELINE_HIDDEN_STORAGE_KEY,
  useLayoutStore,
} from './useLayoutStore'

interface MockStorage {
  getItem: (key: string) => string | null
  setItem: (key: string, value: string) => void
  removeItem: (key: string) => void
  clear: () => void
}

function createMockStorage(initial: Record<string, string> = {}): MockStorage {
  const data = new Map<string, string>(Object.entries(initial))
  return {
    getItem(key) {
      return data.get(key) ?? null
    },
    setItem(key, value) {
      data.set(key, value)
    },
    removeItem(key) {
      data.delete(key)
    },
    clear() {
      data.clear()
    },
  }
}

describe('useLayoutStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('uses expected defaults', () => {
    vi.stubGlobal('localStorage', createMockStorage())
    const store = useLayoutStore()

    expect(store.siderCollapsed).toBe(true)
    expect(store.timelineHidden).toBe(false)
  })

  it('toggles timeline hidden state', () => {
    vi.stubGlobal('localStorage', createMockStorage())
    const store = useLayoutStore()

    store.toggleTimelineHidden()
    expect(store.timelineHidden).toBe(true)

    store.toggleTimelineHidden()
    expect(store.timelineHidden).toBe(false)
  })

  it('restores persisted layout state', async () => {
    const persisted = createMockStorage()
    vi.stubGlobal('localStorage', persisted)

    setActivePinia(createPinia())
    const firstStore = useLayoutStore()
    firstStore.setSiderCollapsed(false)
    firstStore.setTimelineHidden(true)
    await nextTick()

    setActivePinia(createPinia())
    const secondStore = useLayoutStore()

    expect(secondStore.siderCollapsed).toBe(false)
    expect(secondStore.timelineHidden).toBe(true)
  })

  it('reads preloaded storage values', () => {
    vi.stubGlobal('localStorage', createMockStorage({
      [SIDER_COLLAPSED_STORAGE_KEY]: 'false',
      [TIMELINE_HIDDEN_STORAGE_KEY]: 'true',
    }))

    const store = useLayoutStore()
    expect(store.siderCollapsed).toBe(false)
    expect(store.timelineHidden).toBe(true)
  })
})
