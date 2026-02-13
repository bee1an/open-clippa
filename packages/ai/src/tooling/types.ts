import type {
  AiSettings,
  ChatCompletionMessage,
  ChatRequestMessage,
} from '../types'

export interface ToolExecutionContext {
  signal?: AbortSignal
  round: number
  toolCallId: string
}

export interface AiToolDefinition<TArgs = unknown, TResult = unknown> {
  name: string
  description: string
  jsonSchema: Record<string, unknown>
  handler: (args: TArgs, context: ToolExecutionContext) => Promise<TResult> | TResult
}

export interface AiToolCall {
  id: string
  name: string
  arguments: string
}

export interface AiToolResult {
  toolCallId: string
  toolName: string
  content: string
  data?: unknown
  isError?: boolean
}

export interface ChatWithToolsOptions {
  settings: Pick<AiSettings, 'apiKey' | 'baseUrl' | 'model'>
  messages: ChatRequestMessage[] | ChatCompletionMessage[]
  tools: AiToolDefinition[]
  signal?: AbortSignal
  maxToolRounds?: number
  onToken: (token: string) => void
  onDone?: () => void
}
