import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fetchModels, useAiModelCatalogStore } from './useAiModelCatalogStore'

function toHeaders(requestInit: RequestInit | undefined): Headers {
  return new Headers(requestInit?.headers ?? {})
}

describe('useAiModelCatalogStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('fetches model list in byok mode with upstream headers', async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => {
      return new Response(JSON.stringify({
        data: [
          { id: 'gpt-4.1', name: 'GPT-4.1' },
          { model: 'gpt-4o-mini' },
        ],
      }), {
        status: 200,
        headers: {
          'content-type': 'application/json',
        },
      })
    })
    vi.stubGlobal('fetch', fetchMock)

    const result = await fetchModels({
      apiKeySource: 'byok',
      apiKey: 'test-key',
      baseUrl: 'https://api.openai.com/v1',
    })

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const requestUrl = fetchMock.mock.calls[0]?.[0]
    const requestInit = fetchMock.mock.calls[0]?.[1] as RequestInit | undefined
    expect(requestUrl).toBe('/api/kimi/models')

    const headers = toHeaders(requestInit)
    expect(headers.get('x-clippc-key-source')).toBe('byok')
    expect(headers.get('authorization')).toBe('Bearer test-key')
    expect(headers.get('x-clippc-upstream-base')).toBe('https://api.openai.com/v1')

    expect(result).toHaveLength(2)
    expect(result).toEqual(expect.arrayContaining([
      { id: 'gpt-4.1', label: 'GPT-4.1', raw: { id: 'gpt-4.1', name: 'GPT-4.1' } },
      { id: 'gpt-4o-mini', label: 'gpt-4o-mini', raw: { model: 'gpt-4o-mini' } },
    ]))
  })

  it('fetches model list in managed mode without browser authorization', async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => {
      return new Response(JSON.stringify({
        data: [{ id: 'managed-model' }],
      }), {
        status: 200,
        headers: {
          'content-type': 'application/json',
        },
      })
    })
    vi.stubGlobal('fetch', fetchMock)

    const result = await fetchModels({
      apiKeySource: 'managed',
      apiKey: '',
      baseUrl: '',
    })

    const requestInit = fetchMock.mock.calls[0]?.[1] as RequestInit | undefined
    const headers = toHeaders(requestInit)
    expect(headers.get('x-clippc-key-source')).toBe('managed')
    expect(headers.get('authorization')).toBeNull()
    expect(headers.get('x-clippc-upstream-base')).toBeNull()
    expect(result).toEqual([
      { id: 'managed-model', label: 'managed-model', raw: { id: 'managed-model' } },
    ])
  })

  it('returns chinese error and empty items when request fails', async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => {
      return new Response(JSON.stringify({
        error: 'upstream unavailable',
      }), {
        status: 502,
        headers: {
          'content-type': 'application/json',
        },
      })
    })
    vi.stubGlobal('fetch', fetchMock)

    const store = useAiModelCatalogStore()
    const result = await store.fetchModelCatalog({
      apiKeySource: 'managed',
      apiKey: '',
      baseUrl: '',
    })

    expect(result).toEqual([])
    expect(store.items).toEqual([])
    expect(store.loaded).toBe(false)
    expect(store.error).toBe('获取模型失败：upstream unavailable')
  })

  it('handles empty model list response', async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => {
      return new Response(JSON.stringify({
        data: [],
      }), {
        status: 200,
        headers: {
          'content-type': 'application/json',
        },
      })
    })
    vi.stubGlobal('fetch', fetchMock)

    const store = useAiModelCatalogStore()
    const result = await store.fetchModelCatalog({
      apiKeySource: 'managed',
      apiKey: '',
      baseUrl: '',
    })

    expect(result).toEqual([])
    expect(store.items).toEqual([])
    expect(store.loaded).toBe(true)
    expect(store.error).toBeNull()
    expect(store.lastLoadedAt).not.toBeNull()
  })

  it('validates byok settings before request', async () => {
    await expect(fetchModels({
      apiKeySource: 'byok',
      apiKey: '',
      baseUrl: '',
    })).rejects.toThrow('请先填写 API 密钥。')
  })
})
