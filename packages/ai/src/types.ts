export type AiProviderId = 'kimi'
export type AiApiKeySource = 'managed' | 'byok'

export interface AiSettings {
  provider: AiProviderId
  apiKeySource: AiApiKeySource
  apiKey: string
  baseUrl: string
  model: string
  panelOpen: boolean
}

export type ChatMessageRole = 'system' | 'user' | 'assistant' | 'error'
export type ChatMessageStatus = 'streaming' | 'done' | 'error'

export interface ChatMessage {
  id: string
  role: ChatMessageRole
  content: string
  createdAt: number
  status: ChatMessageStatus
  error?: string
}

export interface ChatTextRequestMessage {
  role: 'system' | 'assistant'
  content: string
}

export interface ChatContentPartText {
  type: 'text'
  text: string
}

export interface ChatContentPartImage {
  type: 'image_url'
  image_url: {
    url: string
    detail?: 'auto' | 'low' | 'high'
  }
}

export type ChatUserContentPart = ChatContentPartText | ChatContentPartImage

export interface ChatUserRequestMessage {
  role: 'user'
  content: string | ChatUserContentPart[]
}

export type ChatRequestMessage = ChatTextRequestMessage | ChatUserRequestMessage

export interface ChatToolCall {
  id: string
  type: 'function'
  function: {
    name: string
    arguments: string
  }
}

export interface ChatToolMessage {
  role: 'tool'
  content: string
  tool_call_id: string
}

export interface ChatAssistantToolCallMessage {
  role: 'assistant'
  content: string
  tool_calls: ChatToolCall[]
}

export type ChatCompletionMessage = ChatRequestMessage | ChatToolMessage | ChatAssistantToolCallMessage

export interface ChatRequestPayload {
  model: string
  messages: ChatRequestMessage[]
  stream: true
}

export interface ChatStreamDelta {
  content: string
}

export interface StreamChatHandlers {
  onToken: (token: string) => void
  onDone?: () => void
  signal?: AbortSignal
}

export interface ChatCompletionToolDefinition {
  type: 'function'
  function: {
    name: string
    description?: string
    parameters?: Record<string, unknown>
  }
}

export type ChatCompletionToolChoice
  = 'none'
    | 'auto'
    | {
      type: 'function'
      function: {
        name: string
      }
    }

export interface CreateChatCompletionOptions {
  tools?: ChatCompletionToolDefinition[]
  toolChoice?: ChatCompletionToolChoice
  signal?: AbortSignal
}

export interface ChatCompletionResult {
  role: 'assistant'
  content: string
  toolCalls: ChatToolCall[]
}

export interface ChatProviderClient {
  createChatCompletion: (
    settings: Pick<AiSettings, 'apiKeySource' | 'apiKey' | 'baseUrl' | 'model'>,
    messages: ChatCompletionMessage[],
    options?: CreateChatCompletionOptions,
  ) => Promise<ChatCompletionResult>
  streamChatCompletion: (
    settings: Pick<AiSettings, 'apiKeySource' | 'apiKey' | 'baseUrl' | 'model'>,
    messages: ChatCompletionMessage[],
    handlers: StreamChatHandlers,
  ) => Promise<void>
}
