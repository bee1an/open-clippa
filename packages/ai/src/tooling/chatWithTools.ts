import type {
  ChatAssistantToolCallMessage,
  ChatCompletionMessage,
  ChatCompletionToolDefinition,
  ChatContentPartImage,
  ChatToolCall,
} from '../types'
import type {
  AiToolCall,
  AiToolDefinition,
  AiToolResult,
  ChatWithToolsOptions,
} from './types'
import {
  createChatCompletion,
  streamChatCompletion,
} from '../providers/kimiClient'

const DEFAULT_MAX_TOOL_ROUNDS = 4
const MAX_IMAGE_INPUTS = 4
const MAX_TEXT_PAYLOAD_DEPTH = 8
const MAX_TEXT_PAYLOAD_ARRAY_ITEMS = 200
const MAX_TEXT_PAYLOAD_OBJECT_KEYS = 200
const MAX_TEXT_VALUE_LENGTH = 4000

function ensureNotAborted(signal?: AbortSignal): void {
  if (signal?.aborted)
    throw new DOMException('Aborted', 'AbortError')
}

function toProviderTools(tools: AiToolDefinition[]): ChatCompletionToolDefinition[] {
  return tools.map(tool => ({
    type: 'function',
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.jsonSchema,
    },
  }))
}

function parseToolArguments(raw: string): { ok: true, value: unknown } | { ok: false, error: string } {
  const normalized = raw.trim()
  if (!normalized)
    return { ok: true, value: {} }

  try {
    return {
      ok: true,
      value: JSON.parse(normalized) as unknown,
    }
  }
  catch {
    return {
      ok: false,
      error: `Invalid JSON arguments: ${normalized}`,
    }
  }
}

function stringifyPayload(payload: unknown): string {
  if (typeof payload === 'string')
    return payload

  try {
    return JSON.stringify(payload)
  }
  catch {
    return String(payload)
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isInlineImageDataUrl(value: string): boolean {
  return /^data:image\/[a-z0-9.+-]+;base64,/i.test(value.trim())
}

function sanitizePayloadForText(
  payload: unknown,
  depth = 0,
): unknown {
  if (depth >= MAX_TEXT_PAYLOAD_DEPTH)
    return '[truncated-depth]'

  if (typeof payload === 'string') {
    if (isInlineImageDataUrl(payload))
      return '[image-data-url]'

    if (payload.length > MAX_TEXT_VALUE_LENGTH)
      return `${payload.slice(0, MAX_TEXT_VALUE_LENGTH)}...`

    return payload
  }

  if (Array.isArray(payload)) {
    return payload
      .slice(0, MAX_TEXT_PAYLOAD_ARRAY_ITEMS)
      .map(item => sanitizePayloadForText(item, depth + 1))
  }

  if (!isRecord(payload))
    return payload

  const result: Record<string, unknown> = {}
  const entries = Object.entries(payload)
  const truncatedEntries = entries.slice(0, MAX_TEXT_PAYLOAD_OBJECT_KEYS)
  truncatedEntries.forEach(([key, value]) => {
    result[key] = sanitizePayloadForText(value, depth + 1)
  })

  if (entries.length > MAX_TEXT_PAYLOAD_OBJECT_KEYS) {
    result.__truncatedKeys = entries.length - MAX_TEXT_PAYLOAD_OBJECT_KEYS
  }

  return result
}

function collectInlineImageDataUrls(
  payload: unknown,
  result: string[],
  visited: WeakSet<object>,
): void {
  if (result.length >= MAX_IMAGE_INPUTS)
    return

  if (Array.isArray(payload)) {
    payload.forEach(item => collectInlineImageDataUrls(item, result, visited))
    return
  }

  if (!isRecord(payload))
    return

  if (visited.has(payload))
    return
  visited.add(payload)

  const dataUrl = payload.dataUrl
  if (typeof dataUrl === 'string' && isInlineImageDataUrl(dataUrl)) {
    result.push(dataUrl)
    if (result.length >= MAX_IMAGE_INPUTS)
      return
  }

  Object.values(payload).forEach((value) => {
    collectInlineImageDataUrls(value, result, visited)
  })
}

function buildVisionContextUserMessage(toolResults: AiToolResult[]): ChatCompletionMessage | null {
  const successfulResults = toolResults.filter(
    result => !result.isError && result.data !== undefined,
  )
  if (successfulResults.length === 0)
    return null

  const imageUrls: string[] = []
  const dedup = new Set<string>()
  successfulResults.forEach((result) => {
    const found: string[] = []
    collectInlineImageDataUrls(result.data, found, new WeakSet<object>())
    found.forEach((url) => {
      if (dedup.has(url) || imageUrls.length >= MAX_IMAGE_INPUTS)
        return
      dedup.add(url)
      imageUrls.push(url)
    })
  })

  if (imageUrls.length === 0)
    return null

  const summarizedToolResults = successfulResults.map(result => ({
    toolName: result.toolName,
    toolCallId: result.toolCallId,
    data: sanitizePayloadForText(result.data),
  }))

  const contextText = [
    'Use this tool context and attached images as factual grounding for your final answer.',
    stringifyPayload({ toolResults: summarizedToolResults }),
  ].join('\n')

  const imageParts: ChatContentPartImage[] = imageUrls.map(url => ({
    type: 'image_url',
    image_url: {
      url,
      detail: 'low',
    },
  }))

  return {
    role: 'user',
    content: [
      {
        type: 'text',
        text: contextText,
      },
      ...imageParts,
    ],
  }
}

function toAiToolCall(call: ChatToolCall): AiToolCall {
  return {
    id: call.id,
    name: call.function.name,
    arguments: call.function.arguments,
  }
}

function buildToolResultContent(result: unknown): string {
  return stringifyPayload({
    ok: true,
    data: sanitizePayloadForText(result),
  })
}

function buildToolErrorContent(message: string): string {
  return stringifyPayload({
    ok: false,
    error: message,
  })
}

function toAssistantToolCallMessage(
  content: string,
  toolCalls: ChatToolCall[],
): ChatAssistantToolCallMessage {
  return {
    role: 'assistant',
    content,
    tool_calls: toolCalls,
  }
}

function toToolMessage(result: AiToolResult): ChatCompletionMessage {
  return {
    role: 'tool',
    tool_call_id: result.toolCallId,
    content: result.content,
  }
}

async function executeToolCall(
  call: AiToolCall,
  toolsByName: Map<string, AiToolDefinition>,
  round: number,
  signal?: AbortSignal,
): Promise<AiToolResult> {
  const tool = toolsByName.get(call.name)
  if (!tool) {
    return {
      toolCallId: call.id,
      toolName: call.name,
      content: buildToolErrorContent(`Tool not found: ${call.name}`),
      isError: true,
    }
  }

  const parsed = parseToolArguments(call.arguments)
  if (!parsed.ok) {
    return {
      toolCallId: call.id,
      toolName: call.name,
      content: buildToolErrorContent(parsed.error),
      isError: true,
    }
  }

  try {
    ensureNotAborted(signal)
    const output = await tool.handler(parsed.value, {
      signal,
      round,
      toolCallId: call.id,
    })
    ensureNotAborted(signal)

    return {
      toolCallId: call.id,
      toolName: call.name,
      content: buildToolResultContent(output),
      data: output,
    }
  }
  catch (error) {
    const message = error instanceof Error && error.message.trim().length > 0
      ? error.message.trim()
      : 'Tool execution failed'

    return {
      toolCallId: call.id,
      toolName: call.name,
      content: buildToolErrorContent(message),
      isError: true,
    }
  }
}

export async function chatWithTools(options: ChatWithToolsOptions): Promise<void> {
  const maxToolRounds = Math.max(1, options.maxToolRounds ?? DEFAULT_MAX_TOOL_ROUNDS)
  const toolsByName = new Map(options.tools.map(tool => [tool.name, tool]))
  const providerTools = options.tools.length > 0
    ? toProviderTools(options.tools)
    : undefined
  const conversation: ChatCompletionMessage[] = [...options.messages]
  const toolResults: AiToolResult[] = []

  if (!providerTools) {
    ensureNotAborted(options.signal)
    await streamChatCompletion(options.settings, conversation, {
      signal: options.signal,
      onToken: options.onToken,
      onDone: options.onDone,
    })
    return
  }

  for (let round = 1; round <= maxToolRounds; round += 1) {
    ensureNotAborted(options.signal)

    const completion = await createChatCompletion(
      options.settings,
      conversation,
      {
        tools: providerTools,
        toolChoice: 'auto',
        signal: options.signal,
      },
    )

    if (completion.toolCalls.length === 0) {
      // If the model can answer directly without any tool call, avoid a second
      // request and forward this completion as the final response.
      if (toolResults.length === 0) {
        if (completion.content.length > 0)
          options.onToken(completion.content)
        options.onDone?.()
        return
      }

      break
    }

    conversation.push(toAssistantToolCallMessage(completion.content, completion.toolCalls))

    for (const toolCall of completion.toolCalls) {
      const result = await executeToolCall(
        toAiToolCall(toolCall),
        toolsByName,
        round,
        options.signal,
      )
      toolResults.push(result)
      conversation.push(toToolMessage(result))
    }
  }

  const visionContextMessage = buildVisionContextUserMessage(toolResults)
  if (visionContextMessage)
    conversation.push(visionContextMessage)

  ensureNotAborted(options.signal)
  await streamChatCompletion(options.settings, conversation, {
    signal: options.signal,
    onToken: options.onToken,
    onDone: options.onDone,
  })
}
