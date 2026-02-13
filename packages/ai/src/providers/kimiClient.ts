import type {
  ChatCompletionMessage,
  ChatCompletionResult,
  ChatCompletionToolDefinition,
  ChatProviderClient,
  CreateChatCompletionOptions,
  StreamChatHandlers,
} from '../types'
import OpenAI from 'openai'

const PROXY_KEY_SOURCE_HEADER = 'x-clippc-key-source'
const MANAGED_PLACEHOLDER_API_KEY = 'clippc-managed-placeholder'

type KimiClientSettings = {
  apiKeySource: 'managed' | 'byok'
  apiKey: string
  baseUrl: string
}

function trimTrailingSlash(input: string): string {
  return input.replace(/\/+$/g, '')
}

function isAbsoluteHttpUrl(input: string): boolean {
  return /^https?:\/\//i.test(input)
}

function resolveAbsoluteUrl(input: string): string {
  const normalized = input.trim()
  if (isAbsoluteHttpUrl(normalized))
    return normalized

  // Browser runtime: allow relative base URL like "/api/kimi".
  if (typeof window !== 'undefined' && window.location?.origin) {
    return new URL(normalized, window.location.origin).toString()
  }

  return normalized
}

export function resolveKimiBaseUrl(baseUrl: string): string {
  const normalizedBaseUrl = trimTrailingSlash(resolveAbsoluteUrl(baseUrl))
  const lowerCased = normalizedBaseUrl.toLowerCase()

  if (lowerCased.endsWith('/chat/completions'))
    return normalizedBaseUrl.slice(0, -'/chat/completions'.length)
  if (lowerCased.endsWith('/v1'))
    return normalizedBaseUrl
  return `${normalizedBaseUrl}/v1`
}

export function resolveKimiChatUrl(baseUrl: string): string {
  return `${resolveKimiBaseUrl(baseUrl)}/chat/completions`
}

function normalizeCompletionContent(content: unknown): string {
  if (typeof content === 'string')
    return content

  if (Array.isArray(content)) {
    const parts = content
      .map((part) => {
        if (!part || typeof part !== 'object')
          return ''

        if ('type' in part && (part as { type?: unknown }).type === 'text' && 'text' in part)
          return typeof (part as { text?: unknown }).text === 'string' ? (part as { text: string }).text : ''

        return ''
      })
      .filter(Boolean)

    return parts.join('')
  }

  return ''
}

function toProviderMessages(messages: ChatCompletionMessage[]): any[] {
  return messages.map((message) => {
    if (message.role === 'tool') {
      return {
        role: 'tool',
        content: message.content,
        tool_call_id: message.tool_call_id,
      }
    }

    if ('tool_calls' in message) {
      return {
        role: 'assistant',
        content: message.content,
        tool_calls: message.tool_calls.map(toolCall => ({
          id: toolCall.id,
          type: 'function',
          function: {
            name: toolCall.function.name,
            arguments: toolCall.function.arguments,
          },
        })),
      }
    }

    return {
      role: message.role,
      content: message.content,
    }
  })
}

function parseToolCalls(message: unknown): ChatCompletionResult['toolCalls'] {
  if (!message || typeof message !== 'object' || !('tool_calls' in message))
    return []

  const toolCalls = (message as { tool_calls?: unknown }).tool_calls
  if (!Array.isArray(toolCalls))
    return []

  return toolCalls
    .map((toolCall) => {
      if (!toolCall || typeof toolCall !== 'object')
        return null

      const id = 'id' in toolCall ? (toolCall as { id?: unknown }).id : undefined
      const type = 'type' in toolCall ? (toolCall as { type?: unknown }).type : undefined
      const fn = 'function' in toolCall ? (toolCall as { function?: unknown }).function : undefined
      const name = fn && typeof fn === 'object' && 'name' in fn
        ? (fn as { name?: unknown }).name
        : undefined
      const args = fn && typeof fn === 'object' && 'arguments' in fn
        ? (fn as { arguments?: unknown }).arguments
        : undefined

      if (typeof id !== 'string' || type !== 'function' || typeof name !== 'string')
        return null

      return {
        id,
        type: 'function' as const,
        function: {
          name,
          arguments: typeof args === 'string' ? args : '{}',
        },
      }
    })
    .filter((value): value is NonNullable<typeof value> => value !== null)
}

function shouldAttachProxyKeySourceHeader(baseUrl: string): boolean {
  const normalized = baseUrl.trim()
  if (normalized.startsWith('/'))
    return true

  if (typeof window === 'undefined' || !window.location?.origin)
    return false

  try {
    const url = new URL(normalized, window.location.origin)
    return url.origin === window.location.origin && url.pathname.startsWith('/api/')
  }
  catch {
    return false
  }
}

function resolveClientApiKey(settings: KimiClientSettings): string {
  if (settings.apiKeySource === 'byok')
    return settings.apiKey
  return MANAGED_PLACEHOLDER_API_KEY
}

function resolveClientHeaders(settings: KimiClientSettings): Record<string, string | null> | undefined {
  const headers: Record<string, string | null> = {}
  if (shouldAttachProxyKeySourceHeader(settings.baseUrl))
    headers[PROXY_KEY_SOURCE_HEADER] = settings.apiKeySource

  if (settings.apiKeySource === 'managed') {
    // Managed mode must never send browser Authorization headers.
    headers.authorization = null
  }

  if (Object.keys(headers).length === 0)
    return undefined

  return headers
}

function createOpenAiClient(settings: KimiClientSettings): OpenAI {
  const defaultHeaders = resolveClientHeaders(settings)
  return new OpenAI({
    apiKey: resolveClientApiKey(settings),
    baseURL: resolveKimiBaseUrl(settings.baseUrl),
    ...(defaultHeaders ? { defaultHeaders } : {}),
    // This project currently runs chat calls from browser runtime.
    dangerouslyAllowBrowser: true,
  })
}

export const kimiClient: ChatProviderClient = {
  async createChatCompletion(settings, messages, options): Promise<ChatCompletionResult> {
    const client = createOpenAiClient(settings)
    const completion = await client.chat.completions.create(
      {
        model: settings.model,
        messages: toProviderMessages(messages),
        stream: false,
        tools: options?.tools as ChatCompletionToolDefinition[] | undefined,
        tool_choice: options?.toolChoice as CreateChatCompletionOptions['toolChoice'],
      },
      {
        signal: options?.signal,
      },
    )

    const message = completion.choices[0]?.message
    return {
      role: 'assistant',
      content: normalizeCompletionContent(message?.content),
      toolCalls: parseToolCalls(message),
    }
  },
  async streamChatCompletion(settings, messages, handlers): Promise<void> {
    const client = createOpenAiClient(settings)

    const stream = await client.chat.completions.create(
      {
        model: settings.model,
        messages: toProviderMessages(messages),
        stream: true,
      },
      {
        signal: handlers.signal,
      },
    )

    for await (const chunk of stream) {
      const token = chunk.choices[0]?.delta?.content
      if (typeof token === 'string' && token.length > 0)
        handlers.onToken(token)
    }

    handlers.onDone?.()
  },
}

export async function streamChatCompletion(
  settings: { apiKeySource: 'managed' | 'byok', apiKey: string, baseUrl: string, model: string },
  messages: ChatCompletionMessage[],
  handlers: StreamChatHandlers,
): Promise<void> {
  await kimiClient.streamChatCompletion(settings, messages, handlers)
}

export async function createChatCompletion(
  settings: { apiKeySource: 'managed' | 'byok', apiKey: string, baseUrl: string, model: string },
  messages: ChatCompletionMessage[],
  options?: CreateChatCompletionOptions,
): Promise<ChatCompletionResult> {
  return kimiClient.createChatCompletion(settings, messages, options)
}
