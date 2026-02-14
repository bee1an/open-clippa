import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createChatCompletion,
  resolveKimiBaseUrl,
  resolveKimiChatUrl,
  resolveProxyUpstreamBase,
  streamChatCompletion,
} from '../src/providers/kimiClient'

const { chatCompletionCreateMock, openAICtorMock } = vi.hoisted(() => {
  const chatCompletionCreateMock = vi.fn()
  const openAICtorMock = vi.fn(() => {
    return {
      chat: {
        completions: {
          create: chatCompletionCreateMock,
        },
      },
    }
  })

  return {
    chatCompletionCreateMock,
    openAICtorMock,
  }
})

vi.mock('openai', () => {
  return {
    default: openAICtorMock,
  }
})

async function* createMockStream(tokens: string[]): AsyncGenerator<{
  choices: Array<{ delta: { content: string } }>
}> {
  for (const token of tokens) {
    yield {
      choices: [{ delta: { content: token } }],
    }
  }
}

describe('resolveKimiChatUrl', () => {
  it('keeps /v1 as base url', () => {
    expect(resolveKimiBaseUrl('https://host/v1')).toBe('https://host/v1')
  })

  it('strips /chat/completions suffix to base url', () => {
    expect(resolveKimiBaseUrl('https://host/v1/chat/completions')).toBe('https://host/v1')
  })

  it('keeps plain base url unchanged', () => {
    expect(resolveKimiBaseUrl('https://host/api')).toBe('https://host/api')
  })

  it('keeps /chat/completions unchanged', () => {
    expect(resolveKimiChatUrl('https://host/v1/chat/completions')).toBe('https://host/v1/chat/completions')
  })

  it('appends /chat/completions when base url ends with /v1', () => {
    expect(resolveKimiChatUrl('https://host/v1')).toBe('https://host/v1/chat/completions')
  })

  it('appends /chat/completions for plain base url', () => {
    expect(resolveKimiChatUrl('https://host/api')).toBe('https://host/api/chat/completions')
  })

  it('returns null upstream for legacy proxy path', () => {
    expect(resolveProxyUpstreamBase('/api/kimi')).toBeNull()
  })

  it('normalizes absolute upstream base for byok mode', () => {
    expect(resolveProxyUpstreamBase('https://api.openai.com/v1/chat/completions')).toBe('https://api.openai.com/v1')
  })
})

describe('streamChatCompletion', () => {
  beforeEach(() => {
    chatCompletionCreateMock.mockReset()
    openAICtorMock.mockClear()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('sends request and emits streaming tokens', async () => {
    chatCompletionCreateMock.mockResolvedValue(createMockStream(['hello', ' world']))

    const onToken = vi.fn()
    const onDone = vi.fn()

    await streamChatCompletion(
      {
        apiKeySource: 'byok',
        apiKey: 'test-key',
        baseUrl: 'https://integrate.api.nvidia.com/v1',
        model: 'moonshotai/kimi-k2.5',
      },
      [{ role: 'user', content: 'hello' }],
      { onToken, onDone },
    )

    expect(openAICtorMock).toHaveBeenCalledTimes(1)
    expect(openAICtorMock).toHaveBeenCalledWith({
      apiKey: 'test-key',
      baseURL: '/api/kimi',
      defaultHeaders: {
        'x-clippc-key-source': 'byok',
        'x-clippc-upstream-base': 'https://integrate.api.nvidia.com/v1',
      },
      dangerouslyAllowBrowser: true,
    })
    expect(chatCompletionCreateMock).toHaveBeenCalledTimes(1)
    expect(chatCompletionCreateMock).toHaveBeenCalledWith(
      {
        model: 'moonshotai/kimi-k2.5',
        messages: [{ role: 'user', content: 'hello' }],
        stream: true,
      },
      {
        signal: undefined,
      },
    )

    expect(onToken).toHaveBeenNthCalledWith(1, 'hello')
    expect(onToken).toHaveBeenNthCalledWith(2, ' world')
    expect(onDone).toHaveBeenCalledTimes(1)
  })

  it('throws sdk errors', async () => {
    chatCompletionCreateMock.mockRejectedValue(new Error('invalid key'))

    await expect(() => streamChatCompletion(
      {
        apiKeySource: 'byok',
        apiKey: 'bad-key',
        baseUrl: 'https://integrate.api.nvidia.com/v1',
        model: 'moonshotai/kimi-k2.5',
      },
      [{ role: 'user', content: 'hello' }],
      { onToken: vi.fn() },
    )).rejects.toThrow('invalid key')
  })

  it('passes abort signal through sdk', async () => {
    const controller = new AbortController()
    chatCompletionCreateMock.mockResolvedValue(createMockStream(['hello']))

    await streamChatCompletion(
      {
        apiKeySource: 'byok',
        apiKey: 'test-key',
        baseUrl: 'https://integrate.api.nvidia.com/v1',
        model: 'moonshotai/kimi-k2.5',
      },
      [{ role: 'user', content: 'hello' }],
      { onToken: vi.fn(), signal: controller.signal },
    )

    expect(chatCompletionCreateMock).toHaveBeenCalledWith(
      expect.any(Object),
      {
        signal: controller.signal,
      },
    )
  })

  it('does not send authorization in managed mode for proxy base url', async () => {
    chatCompletionCreateMock.mockResolvedValue(createMockStream(['ok']))

    await streamChatCompletion(
      {
        apiKeySource: 'managed',
        apiKey: 'should-not-leak',
        baseUrl: '/api/kimi',
        model: 'moonshotai/kimi-k2.5',
      },
      [{ role: 'user', content: 'hello' }],
      { onToken: vi.fn() },
    )

    expect(openAICtorMock).toHaveBeenCalledWith({
      apiKey: 'clippc-managed-placeholder',
      baseURL: '/api/kimi',
      defaultHeaders: {
        'x-clippc-key-source': 'managed',
        'authorization': null,
      },
      dangerouslyAllowBrowser: true,
    })
  })

  it('includes key source header in byok proxy mode', async () => {
    chatCompletionCreateMock.mockResolvedValue(createMockStream(['ok']))

    await streamChatCompletion(
      {
        apiKeySource: 'byok',
        apiKey: 'test-key',
        baseUrl: '/api/kimi',
        model: 'moonshotai/kimi-k2.5',
      },
      [{ role: 'user', content: 'hello' }],
      { onToken: vi.fn() },
    )

    expect(openAICtorMock).toHaveBeenCalledWith({
      apiKey: 'test-key',
      baseURL: '/api/kimi',
      defaultHeaders: {
        'x-clippc-key-source': 'byok',
      },
      dangerouslyAllowBrowser: true,
    })
  })

  it('keeps deep path base in byok upstream header', async () => {
    chatCompletionCreateMock.mockResolvedValue(createMockStream(['ok']))

    await streamChatCompletion(
      {
        apiKeySource: 'byok',
        apiKey: 'test-key',
        baseUrl: 'https://example.com/compatible-mode/v1/',
        model: 'moonshotai/kimi-k2.5',
      },
      [{ role: 'user', content: 'hello' }],
      { onToken: vi.fn() },
    )

    expect(openAICtorMock).toHaveBeenCalledWith({
      apiKey: 'test-key',
      baseURL: '/api/kimi',
      defaultHeaders: {
        'x-clippc-key-source': 'byok',
        'x-clippc-upstream-base': 'https://example.com/compatible-mode/v1',
      },
      dangerouslyAllowBrowser: true,
    })
  })
})

describe('createChatCompletion', () => {
  beforeEach(() => {
    chatCompletionCreateMock.mockReset()
    openAICtorMock.mockClear()
  })

  it('passes tools and returns parsed tool calls', async () => {
    chatCompletionCreateMock.mockResolvedValue({
      choices: [
        {
          message: {
            role: 'assistant',
            content: 'tool response',
            tool_calls: [
              {
                id: 'call-1',
                type: 'function',
                function: {
                  name: 'get_current_scene',
                  arguments: '{"detailLevel":"brief"}',
                },
              },
            ],
          },
        },
      ],
    })

    const result = await createChatCompletion(
      {
        apiKeySource: 'byok',
        apiKey: 'test-key',
        baseUrl: 'https://integrate.api.nvidia.com/v1',
        model: 'moonshotai/kimi-k2.5',
      },
      [{ role: 'user', content: 'what is current scene?' }],
      {
        tools: [
          {
            type: 'function',
            function: {
              name: 'get_current_scene',
              description: 'Read current scene.',
              parameters: {
                type: 'object',
                properties: {
                  detailLevel: { type: 'string' },
                },
              },
            },
          },
        ],
        toolChoice: 'auto',
      },
    )

    expect(chatCompletionCreateMock).toHaveBeenCalledWith(
      {
        model: 'moonshotai/kimi-k2.5',
        messages: [{ role: 'user', content: 'what is current scene?' }],
        stream: false,
        tools: [
          {
            type: 'function',
            function: {
              name: 'get_current_scene',
              description: 'Read current scene.',
              parameters: {
                type: 'object',
                properties: {
                  detailLevel: { type: 'string' },
                },
              },
            },
          },
        ],
        tool_choice: 'auto',
      },
      {
        signal: undefined,
      },
    )

    expect(result.content).toBe('tool response')
    expect(result.toolCalls).toEqual([
      {
        id: 'call-1',
        type: 'function',
        function: {
          name: 'get_current_scene',
          arguments: '{"detailLevel":"brief"}',
        },
      },
    ])
  })

  it('returns empty tool calls when none exist', async () => {
    chatCompletionCreateMock.mockResolvedValue({
      choices: [
        {
          message: {
            role: 'assistant',
            content: 'plain answer',
          },
        },
      ],
    })

    const result = await createChatCompletion(
      {
        apiKeySource: 'byok',
        apiKey: 'test-key',
        baseUrl: 'https://integrate.api.nvidia.com/v1',
        model: 'moonshotai/kimi-k2.5',
      },
      [{ role: 'user', content: 'hello' }],
    )

    expect(result.content).toBe('plain answer')
    expect(result.toolCalls).toEqual([])
  })

  it('supports multimodal user content parts', async () => {
    chatCompletionCreateMock.mockResolvedValue({
      choices: [
        {
          message: {
            role: 'assistant',
            content: 'image received',
          },
        },
      ],
    })

    await createChatCompletion(
      {
        apiKeySource: 'byok',
        apiKey: 'test-key',
        baseUrl: 'https://integrate.api.nvidia.com/v1',
        model: 'moonshotai/kimi-k2.5',
      },
      [
        {
          role: 'user',
          content: [
            { type: 'text', text: 'Describe this screenshot' },
            {
              type: 'image_url',
              image_url: {
                url: 'data:image/jpeg;base64,abc',
                detail: 'low',
              },
            },
          ],
        },
      ],
    )

    expect(chatCompletionCreateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: 'Describe this screenshot' },
              {
                type: 'image_url',
                image_url: {
                  url: 'data:image/jpeg;base64,abc',
                  detail: 'low',
                },
              },
            ],
          },
        ],
      }),
      expect.any(Object),
    )
  })
})
