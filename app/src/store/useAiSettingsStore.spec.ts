import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import {
  AI_SETTINGS_STORAGE_KEY,
  useAiSettingsStore,
} from './useAiSettingsStore'

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

describe('useAiSettingsStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('uses managed mode and empty base url by default', () => {
    vi.stubGlobal('localStorage', createMockStorage())
    const store = useAiSettingsStore()

    expect(store.apiKeySource).toBe('managed')
    expect(store.baseUrl).toBe('')
  })

  it('migrates legacy /api/kimi base url to empty string', () => {
    const persisted = JSON.stringify({
      apiKeySource: 'byok',
      baseUrl: '/api/kimi',
      model: 'moonshotai/kimi-k2.5',
    })
    vi.stubGlobal('localStorage', createMockStorage({
      [AI_SETTINGS_STORAGE_KEY]: persisted,
    }))

    const store = useAiSettingsStore()

    expect(store.baseUrl).toBe('')
    expect(store.model).toBe('moonshotai/kimi-k2.5')
  })

  it('migrates legacy nvidia direct base url to empty string', () => {
    const persisted = JSON.stringify({
      apiKeySource: 'byok',
      baseUrl: 'https://integrate.api.nvidia.com/v1',
    })
    vi.stubGlobal('localStorage', createMockStorage({
      [AI_SETTINGS_STORAGE_KEY]: persisted,
    }))

    const store = useAiSettingsStore()
    expect(store.baseUrl).toBe('')
  })

  it('persists selected model across store recreation', async () => {
    const mockStorage = createMockStorage()
    vi.stubGlobal('localStorage', mockStorage)

    setActivePinia(createPinia())
    const firstStore = useAiSettingsStore()
    firstStore.updateSettings({
      model: 'gpt-4.1',
    })
    await nextTick()

    setActivePinia(createPinia())
    const secondStore = useAiSettingsStore()
    expect(secondStore.model).toBe('gpt-4.1')
  })
})
