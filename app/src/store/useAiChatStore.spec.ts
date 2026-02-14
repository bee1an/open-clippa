import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useAiSettingsStore } from './useAiSettingsStore'
import { useAiChatStore } from './useAiChatStore'

const { chatWithToolsMock, resolveAppAiToolsMock } = vi.hoisted(() => {
  return {
    chatWithToolsMock: vi.fn(),
    resolveAppAiToolsMock: vi.fn((): any[] => []),
  }
})

vi.mock('@clippc/ai', async () => {
  const actual = await vi.importActual<typeof import('@clippc/ai')>('@clippc/ai')
  return {
    ...actual,
    chatWithTools: chatWithToolsMock,
  }
})

vi.mock('@/ai/context/tools', () => {
  return {
    resolveAppAiTools: resolveAppAiToolsMock,
  }
})

describe('useAiChatStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    chatWithToolsMock.mockReset()
    resolveAppAiToolsMock.mockReset()
    resolveAppAiToolsMock.mockReturnValue([])

    let id = 0
    vi.stubGlobal('crypto', {
      randomUUID: vi.fn(() => `id-${id++}`),
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('streams assistant output and finalizes message', async () => {
    chatWithToolsMock.mockImplementation(async (options: any) => {
      options.onToken('hello')
      options.onToken(' world')
      options.onDone?.()
    })

    const settingsStore = useAiSettingsStore()
    settingsStore.updateSettings({
      apiKeySource: 'byok',
      apiKey: 'test-key',
      baseUrl: 'https://integrate.api.nvidia.com/v1',
      model: 'moonshotai/kimi-k2.5',
    })

    const store = useAiChatStore()
    store.draft = 'Say hello'

    await store.sendMessage()

    expect(store.messages).toHaveLength(2)
    expect(store.messages[0].role).toBe('user')
    expect(store.messages[0].content).toBe('Say hello')
    expect(store.messages[1].role).toBe('assistant')
    expect(store.messages[1].content).toBe('hello world')
    expect(store.messages[1].status).toBe('done')
    expect(store.isStreaming).toBe(false)
    expect(store.lastError).toBeNull()
    expect(chatWithToolsMock).toHaveBeenCalledTimes(1)

    const callOptions = chatWithToolsMock.mock.calls[0][0]
    expect(callOptions.settings).toEqual({
      apiKeySource: 'byok',
      apiKey: 'test-key',
      baseUrl: 'https://integrate.api.nvidia.com/v1',
      model: 'moonshotai/kimi-k2.5',
    })
    expect(callOptions.messages[0].role).toBe('system')
  })

  it('blocks send when byok api key is missing', async () => {
    const settingsStore = useAiSettingsStore()
    settingsStore.updateSettings({
      apiKeySource: 'byok',
      apiKey: '',
      baseUrl: 'https://api.openai.com/v1',
      model: 'gpt-4o-mini',
    })

    const store = useAiChatStore()
    store.draft = 'hello'

    await store.sendMessage()

    expect(store.messages).toHaveLength(0)
    expect(store.lastError).toBe('缺少必要配置：API 密钥')
    expect(chatWithToolsMock).not.toHaveBeenCalled()
  })

  it('allows managed mode without client api key', async () => {
    chatWithToolsMock.mockImplementation(async (options: any) => {
      options.onToken('managed')
      options.onDone?.()
    })

    const settingsStore = useAiSettingsStore()
    settingsStore.updateSettings({
      apiKeySource: 'managed',
      apiKey: '',
      baseUrl: '',
      model: 'moonshotai/kimi-k2.5',
    })

    const store = useAiChatStore()
    store.draft = 'hello'

    await store.sendMessage()

    expect(store.lastError).toBeNull()
    expect(chatWithToolsMock).toHaveBeenCalledTimes(1)
    const callOptions = chatWithToolsMock.mock.calls[0][0]
    expect(callOptions.settings).toEqual({
      apiKeySource: 'managed',
      apiKey: '',
      baseUrl: '',
      model: 'moonshotai/kimi-k2.5',
    })
  })

  it('marks assistant message as error when request fails', async () => {
    chatWithToolsMock.mockRejectedValue(new Error('bad request'))

    const settingsStore = useAiSettingsStore()
    settingsStore.updateSettings({
      apiKeySource: 'byok',
      apiKey: 'test-key',
      baseUrl: 'https://integrate.api.nvidia.com/v1',
      model: 'moonshotai/kimi-k2.5',
    })

    const store = useAiChatStore()
    store.draft = 'Say hello'

    await store.sendMessage()

    expect(store.messages).toHaveLength(2)
    const assistant = store.messages[1]
    expect(assistant.role).toBe('assistant')
    expect(assistant.status).toBe('error')
    expect(assistant.error).toBe('bad request')
    expect(store.lastError).toBe('bad request')
    expect(store.isStreaming).toBe(false)
  })

  it('stops streaming without marking error', async () => {
    chatWithToolsMock.mockImplementation(async (options: any) => {
      return await new Promise<void>((_resolve, reject) => {
        options.signal?.addEventListener('abort', () => {
          reject(new DOMException('Aborted', 'AbortError'))
        }, { once: true })
      })
    })

    const settingsStore = useAiSettingsStore()
    settingsStore.updateSettings({
      apiKeySource: 'byok',
      apiKey: 'test-key',
      baseUrl: 'https://integrate.api.nvidia.com/v1',
      model: 'moonshotai/kimi-k2.5',
    })

    const store = useAiChatStore()
    store.draft = 'Say hello'

    const sending = store.sendMessage()
    expect(store.isStreaming).toBe(true)

    store.stopStreaming()
    await sending

    expect(store.messages).toHaveLength(2)
    expect(store.messages[1].status).toBe('done')
    expect(store.messages[1].error).toBeUndefined()
    expect(store.isStreaming).toBe(false)
    expect(store.lastError).toBeNull()
  })

  it('clears messages and last error', async () => {
    chatWithToolsMock.mockImplementation(async (options: any) => {
      options.onToken('ok')
      options.onDone?.()
    })

    const settingsStore = useAiSettingsStore()
    settingsStore.updateSettings({
      apiKeySource: 'byok',
      apiKey: 'test-key',
      baseUrl: 'https://integrate.api.nvidia.com/v1',
      model: 'moonshotai/kimi-k2.5',
    })

    const store = useAiChatStore()
    store.draft = 'hello'
    await store.sendMessage()
    expect(store.messages.length).toBeGreaterThan(0)

    store.clearMessages()
    expect(store.messages).toHaveLength(0)
    expect(store.lastError).toBeNull()
  })

  it('passes context tools for context-aware prompts', async () => {
    resolveAppAiToolsMock.mockReturnValue([
      {
        name: 'get_current_scene',
        description: 'desc',
        jsonSchema: { type: 'object' },
        handler: vi.fn(),
      },
    ])
    chatWithToolsMock.mockImplementation(async (options: any) => {
      options.onToken('scene')
      options.onDone?.()
    })

    const settingsStore = useAiSettingsStore()
    settingsStore.updateSettings({
      apiKeySource: 'byok',
      apiKey: 'test-key',
      baseUrl: 'https://integrate.api.nvidia.com/v1',
      model: 'moonshotai/kimi-k2.5',
    })

    const store = useAiChatStore()
    store.draft = '当前画面内容是什么'

    await store.sendMessage()

    const callOptions = chatWithToolsMock.mock.calls[0][0]
    expect(callOptions.tools).toHaveLength(1)
    expect(callOptions.tools[0].name).toBe('get_current_scene')
  })
})
