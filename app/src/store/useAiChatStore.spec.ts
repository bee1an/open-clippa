import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getEditorCommandBus, resetEditorCommandBusForTesting } from '@/command/commandBus'
import { useAiChatStore } from './useAiChatStore'
import { useAiSettingsStore } from './useAiSettingsStore'

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
    resetEditorCommandBusForTesting()
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
    expect(store.assistantActivityPhase).toBe('idle')
    expect(store.hasAssistantActivity).toBe(false)
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
    expect(callOptions.messages[0].content).toContain('create_text_element')
    expect(callOptions.messages[0].content).toContain('media_import_random_image')
    expect(callOptions.messages[0].content).toContain('media_import_random_video')
    expect(callOptions.messages[0].content).toContain('media_pick_random_asset')
    expect(callOptions.messages[0].content).toContain('history_undo')
    expect(callOptions.messages[0].content).toContain('history_redo')
    expect(callOptions.maxToolRounds).toBe(12)
    expect(typeof callOptions.onToolStart).toBe('function')
    expect(typeof callOptions.onToolResult).toBe('function')
  })

  it('shows assistant activity before assistant bubble is appended', async () => {
    let releaseResponse!: () => void
    chatWithToolsMock.mockImplementation(async (options: any) => {
      options.onToolStart({
        id: 'tool-1',
        name: 'get_current_scene',
        arguments: '{}',
      })

      await new Promise<void>((resolve) => {
        releaseResponse = () => {
          options.onToolResult({
            toolCallId: 'tool-1',
            toolName: 'get_current_scene',
            content: '{"scene":"ok"}',
          })
          options.onToken('final reply')
          resolve()
        }
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
    store.draft = '当前画面内容是什么'

    const sending = store.sendMessage()
    expect(store.messages).toHaveLength(1)
    expect(store.messages[0].role).toBe('user')
    expect(store.assistantActivityPhase).toBe('calling_tool')
    expect(store.hasAssistantActivity).toBe(true)
    expect(store.assistantActivityText).toBe('tools:get_current_scene')

    releaseResponse()
    await sending

    expect(store.messages).toHaveLength(2)
    expect(store.messages[1].role).toBe('assistant')
    expect(store.messages[1].content).toBe('final reply')
    expect(store.assistantActivityPhase).toBe('idle')
    expect(store.hasAssistantActivity).toBe(false)
    expect(store.assistantActivityText).toBe('')
  })

  it('hides assistant activity while assistant bubble is streaming', async () => {
    let finishStreaming!: () => void
    chatWithToolsMock.mockImplementation(async (options: any) => {
      options.onToken('partial')
      await new Promise<void>((resolve) => {
        finishStreaming = () => {
          options.onDone?.()
          resolve()
        }
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
    store.draft = 'stream please'

    const sending = store.sendMessage()
    expect(store.messages).toHaveLength(2)
    expect(store.messages[1].role).toBe('assistant')
    expect(store.messages[1].status).toBe('streaming')
    expect(store.messages[1].content).toBe('partial')
    expect(store.assistantActivityPhase).toBe('responding')
    expect(store.hasAssistantActivity).toBe(false)
    expect(store.assistantActivityText).toBe('')

    finishStreaming()
    await sending

    expect(store.messages[1].status).toBe('done')
    expect(store.assistantActivityPhase).toBe('idle')
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

    expect(store.messages).toHaveLength(1)
    expect(store.messages[0].role).toBe('user')
    expect(store.isStreaming).toBe(false)
    expect(store.assistantActivityPhase).toBe('idle')
    expect(store.hasAssistantActivity).toBe(false)
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
    expect(store.assistantActivityPhase).toBe('idle')
    expect(store.hasAssistantActivity).toBe(false)
    expect(store.lastError).toBeNull()
  })

  it('passes full tool set for executable requests', async () => {
    resolveAppAiToolsMock.mockReturnValue([
      {
        name: 'get_current_scene',
        description: 'desc',
        jsonSchema: { type: 'object' },
        handler: vi.fn(),
      },
      {
        name: 'media_add_asset_to_timeline',
        description: 'desc',
        jsonSchema: { type: 'object' },
        handler: vi.fn(),
      },
      {
        name: 'export_start',
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
    expect(callOptions.tools).toHaveLength(3)
    expect(callOptions.tools.map((item: { name: string }) => item.name)).toEqual(expect.arrayContaining([
      'get_current_scene',
      'media_add_asset_to_timeline',
      'export_start',
    ]))
  })

  it('wraps single ai request in one history transaction', async () => {
    chatWithToolsMock.mockImplementation(async (options: any) => {
      options.onToolStart({
        id: 'tool-1',
        name: 'query_project_state',
        arguments: '{}',
      })
      options.onToolResult({
        toolCallId: 'tool-1',
        toolName: 'query_project_state',
        content: '{}',
      })
      options.onToken('ok')
      options.onDone?.()
    })

    const bus = getEditorCommandBus()
    const beginSpy = vi.spyOn(bus, 'beginTransaction')
    const endSpy = vi.spyOn(bus, 'endTransaction')

    const settingsStore = useAiSettingsStore()
    settingsStore.updateSettings({
      apiKeySource: 'byok',
      apiKey: 'test-key',
      baseUrl: 'https://integrate.api.nvidia.com/v1',
      model: 'moonshotai/kimi-k2.5',
    })

    const store = useAiChatStore()
    store.draft = 'do something'

    await store.sendMessage()

    expect(beginSpy).toHaveBeenCalledTimes(1)
    expect(endSpy).toHaveBeenCalledTimes(1)
  })
})
