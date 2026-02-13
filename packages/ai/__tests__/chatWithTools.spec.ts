import type { AiToolDefinition } from '../src/tooling/types'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { chatWithTools } from '../src/tooling/chatWithTools'

const { createChatCompletionMock, streamChatCompletionMock } = vi.hoisted(() => {
  return {
    createChatCompletionMock: vi.fn(),
    streamChatCompletionMock: vi.fn(),
  }
})

vi.mock('../src/providers/kimiClient', () => {
  return {
    createChatCompletion: createChatCompletionMock,
    streamChatCompletion: streamChatCompletionMock,
  }
})

const defaultSettings = {
  apiKeySource: 'byok' as const,
  apiKey: 'test-key',
  baseUrl: 'https://integrate.api.nvidia.com/v1',
  model: 'moonshotai/kimi-k2.5',
}

describe('chatWithTools', () => {
  beforeEach(() => {
    createChatCompletionMock.mockReset()
    streamChatCompletionMock.mockReset()
  })

  it('streams directly when no tools are provided', async () => {
    streamChatCompletionMock.mockImplementation(async (_settings: any, _messages: any, handlers: any) => {
      handlers.onToken('hello')
      handlers.onDone?.()
    })

    const onToken = vi.fn()
    const onDone = vi.fn()
    await chatWithTools({
      settings: defaultSettings,
      messages: [{ role: 'user', content: 'hello' }],
      tools: [],
      onToken,
      onDone,
    })

    expect(createChatCompletionMock).not.toHaveBeenCalled()
    expect(streamChatCompletionMock).toHaveBeenCalledTimes(1)
    expect(onToken).toHaveBeenCalledWith('hello')
    expect(onDone).toHaveBeenCalledTimes(1)
  })

  it('executes tool call and injects tool result before final stream', async () => {
    createChatCompletionMock
      .mockResolvedValueOnce({
        role: 'assistant',
        content: '',
        toolCalls: [
          {
            id: 'call-1',
            type: 'function',
            function: {
              name: 'get_current_scene',
              arguments: '{"detailLevel":"brief"}',
            },
          },
        ],
      })
      .mockResolvedValueOnce({
        role: 'assistant',
        content: '',
        toolCalls: [],
      })
    streamChatCompletionMock.mockResolvedValue(undefined)

    const toolHandler = vi.fn(async () => ({ currentTimeMs: 1000 }))
    const tools: AiToolDefinition[] = [
      {
        name: 'get_current_scene',
        description: 'Read current scene',
        jsonSchema: { type: 'object' },
        handler: toolHandler,
      },
    ]

    await chatWithTools({
      settings: defaultSettings,
      messages: [{ role: 'user', content: 'What is current scene?' }],
      tools,
      onToken: vi.fn(),
    })

    expect(toolHandler).toHaveBeenCalledWith(
      { detailLevel: 'brief' },
      expect.objectContaining({
        round: 1,
        toolCallId: 'call-1',
      }),
    )
    expect(createChatCompletionMock).toHaveBeenCalledTimes(2)

    const secondCallMessages = createChatCompletionMock.mock.calls[1][1]
    expect(secondCallMessages).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          role: 'assistant',
          tool_calls: expect.any(Array),
        }),
        expect.objectContaining({
          role: 'tool',
          tool_call_id: 'call-1',
        }),
      ]),
    )
    expect(streamChatCompletionMock).toHaveBeenCalledTimes(1)
  })

  it('returns direct completion when tools are available but no tool call is emitted', async () => {
    createChatCompletionMock.mockResolvedValue({
      role: 'assistant',
      content: 'direct answer',
      toolCalls: [],
    })
    streamChatCompletionMock.mockResolvedValue(undefined)

    const onToken = vi.fn()
    const onDone = vi.fn()

    await chatWithTools({
      settings: defaultSettings,
      messages: [{ role: 'user', content: 'hello' }],
      tools: [
        {
          name: 'get_current_scene',
          description: 'Read current scene',
          jsonSchema: { type: 'object' },
          handler: vi.fn(),
        },
      ],
      onToken,
      onDone,
    })

    expect(createChatCompletionMock).toHaveBeenCalledTimes(1)
    expect(streamChatCompletionMock).not.toHaveBeenCalled()
    expect(onToken).toHaveBeenCalledTimes(1)
    expect(onToken).toHaveBeenCalledWith('direct answer')
    expect(onDone).toHaveBeenCalledTimes(1)
  })

  it('handles invalid JSON arguments as tool error payload', async () => {
    createChatCompletionMock
      .mockResolvedValueOnce({
        role: 'assistant',
        content: '',
        toolCalls: [
          {
            id: 'call-2',
            type: 'function',
            function: {
              name: 'get_current_scene',
              arguments: '{"detailLevel":',
            },
          },
        ],
      })
      .mockResolvedValueOnce({
        role: 'assistant',
        content: '',
        toolCalls: [],
      })
    streamChatCompletionMock.mockResolvedValue(undefined)

    const toolHandler = vi.fn()
    await chatWithTools({
      settings: defaultSettings,
      messages: [{ role: 'user', content: 'scene?' }],
      tools: [
        {
          name: 'get_current_scene',
          description: 'Read current scene',
          jsonSchema: { type: 'object' },
          handler: toolHandler,
        },
      ],
      onToken: vi.fn(),
    })

    expect(toolHandler).not.toHaveBeenCalled()
    const secondCallMessages = createChatCompletionMock.mock.calls[1][1]
    const toolMessage = secondCallMessages.find((item: any) => item.role === 'tool')
    expect(toolMessage.content).toContain('"ok":false')
    expect(toolMessage.content).toContain('Invalid JSON arguments')
  })

  it('handles tool execution errors as tool error payload', async () => {
    createChatCompletionMock
      .mockResolvedValueOnce({
        role: 'assistant',
        content: '',
        toolCalls: [
          {
            id: 'call-3',
            type: 'function',
            function: {
              name: 'get_current_scene',
              arguments: '{}',
            },
          },
        ],
      })
      .mockResolvedValueOnce({
        role: 'assistant',
        content: '',
        toolCalls: [],
      })
    streamChatCompletionMock.mockResolvedValue(undefined)

    await chatWithTools({
      settings: defaultSettings,
      messages: [{ role: 'user', content: 'scene?' }],
      tools: [
        {
          name: 'get_current_scene',
          description: 'Read current scene',
          jsonSchema: { type: 'object' },
          handler: async () => {
            throw new Error('tool failed')
          },
        },
      ],
      onToken: vi.fn(),
    })

    const secondCallMessages = createChatCompletionMock.mock.calls[1][1]
    const toolMessage = secondCallMessages.find((item: any) => item.role === 'tool')
    expect(toolMessage.content).toContain('"ok":false')
    expect(toolMessage.content).toContain('tool failed')
  })

  it('propagates abort signal to final streaming stage', async () => {
    createChatCompletionMock.mockResolvedValue({
      role: 'assistant',
      content: '',
      toolCalls: [],
    })
    streamChatCompletionMock.mockImplementation(async (_settings: any, _messages: any, handlers: any) => {
      return await new Promise<void>((_resolve, reject) => {
        handlers.signal?.addEventListener('abort', () => {
          reject(new DOMException('Aborted', 'AbortError'))
        }, { once: true })
      })
    })

    const controller = new AbortController()
    const pending = chatWithTools({
      settings: defaultSettings,
      messages: [{ role: 'user', content: 'stop' }],
      tools: [],
      signal: controller.signal,
      onToken: vi.fn(),
    })
    controller.abort()

    await expect(pending).rejects.toThrow('Aborted')
  })

  it('limits tool rounds and still streams final response', async () => {
    createChatCompletionMock.mockResolvedValue({
      role: 'assistant',
      content: '',
      toolCalls: [
        {
          id: 'call-loop',
          type: 'function',
          function: {
            name: 'get_current_scene',
            arguments: '{}',
          },
        },
      ],
    })
    streamChatCompletionMock.mockResolvedValue(undefined)

    await chatWithTools({
      settings: defaultSettings,
      messages: [{ role: 'user', content: 'loop' }],
      tools: [
        {
          name: 'get_current_scene',
          description: 'Read current scene',
          jsonSchema: { type: 'object' },
          handler: async () => ({ ok: true }),
        },
      ],
      maxToolRounds: 2,
      onToken: vi.fn(),
    })

    expect(createChatCompletionMock).toHaveBeenCalledTimes(2)
    expect(streamChatCompletionMock).toHaveBeenCalledTimes(1)
  })

  it('injects image_url content parts before final stream when tool output contains screenshot', async () => {
    createChatCompletionMock
      .mockResolvedValueOnce({
        role: 'assistant',
        content: '',
        toolCalls: [
          {
            id: 'call-image',
            type: 'function',
            function: {
              name: 'get_current_scene',
              arguments: '{}',
            },
          },
        ],
      })
      .mockResolvedValueOnce({
        role: 'assistant',
        content: '',
        toolCalls: [],
      })
    streamChatCompletionMock.mockResolvedValue(undefined)

    await chatWithTools({
      settings: defaultSettings,
      messages: [{ role: 'user', content: 'What is on screen?' }],
      tools: [
        {
          name: 'get_current_scene',
          description: 'Read current scene',
          jsonSchema: { type: 'object' },
          handler: async () => ({
            currentTimeMs: 123,
            canvasScreenshot: {
              mimeType: 'image/jpeg',
              dataUrl: 'data:image/jpeg;base64,abc123',
              width: 320,
              height: 180,
            },
          }),
        },
      ],
      onToken: vi.fn(),
    })

    expect(streamChatCompletionMock).toHaveBeenCalledTimes(1)
    const finalMessages = streamChatCompletionMock.mock.calls[0][1]
    const toolMessage = finalMessages.find((item: any) => item.role === 'tool')
    expect(toolMessage.content).toContain('[image-data-url]')

    const injectedUserMessage = finalMessages.find((item: any) => {
      if (item.role !== 'user')
        return false
      if (!Array.isArray(item.content))
        return false
      return item.content.some((part: any) => part?.type === 'image_url')
    })
    expect(injectedUserMessage).toBeDefined()
    expect(injectedUserMessage.content).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'text',
        }),
        expect.objectContaining({
          type: 'image_url',
          image_url: expect.objectContaining({
            url: 'data:image/jpeg;base64,abc123',
          }),
        }),
      ]),
    )
  })
})
