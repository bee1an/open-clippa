import type { AiApiKeySource, ChatMessage, ChatRequestMessage } from '@clippc/ai'
import { chatWithTools } from '@clippc/ai'
import { defineStore } from 'pinia'
import { ref } from 'vue'
import { resolveAppAiTools } from '@/ai/context/tools'
import { useAiSettingsStore } from './useAiSettingsStore'

const CONTEXT_AWARE_SYSTEM_PROMPT = [
  'You are an assistant inside a video editor.',
  'If the user asks about current canvas, timeline, selected elements, or active transition, call the available tools before answering.',
  'Only use tool data as factual context. If a tool fails, explain the failure briefly and ask for a retry.',
].join(' ')

function generateMessageId(prefix: string): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function')
    return `${prefix}-${crypto.randomUUID()}`
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

function isAbortError(error: unknown): boolean {
  if (error instanceof DOMException)
    return error.name === 'AbortError'

  if (error && typeof error === 'object' && 'name' in error) {
    const name = (error as { name?: string }).name
    if (name === 'AbortError' || name === 'APIUserAbortError')
      return true
  }

  if (error instanceof Error && /abort/i.test(error.message))
    return true

  return false
}

function isRequestRole(role: ChatMessage['role']): role is ChatRequestMessage['role'] {
  return role === 'system' || role === 'user' || role === 'assistant'
}

function toRequestMessages(messages: ChatMessage[]): ChatRequestMessage[] {
  const requestMessages: ChatRequestMessage[] = []
  messages.forEach((message) => {
    if (!isRequestRole(message.role))
      return
    if (message.content.trim().length === 0)
      return

    requestMessages.push({
      role: message.role,
      content: message.content,
    })
  })
  return requestMessages
}

function buildRequestMessages(messages: ChatMessage[]): ChatRequestMessage[] {
  return [
    {
      role: 'system',
      content: CONTEXT_AWARE_SYSTEM_PROMPT,
    },
    ...toRequestMessages(messages),
  ]
}

function resolveErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim().length > 0)
    return error.message.trim()
  return '聊天请求失败'
}

function buildMissingSettingsError(settings: {
  apiKeySource: AiApiKeySource
  apiKey: string
  baseUrl: string
  model: string
}): string | null {
  const missing: string[] = []
  if (settings.apiKeySource === 'byok' && settings.apiKey.trim().length === 0)
    missing.push('API 密钥')
  if (settings.apiKeySource === 'byok' && settings.baseUrl.trim().length === 0)
    missing.push('接口地址')
  if (settings.model.trim().length === 0)
    missing.push('模型')

  if (missing.length === 0)
    return null

  return `缺少必要配置：${missing.join('、')}`
}

export const useAiChatStore = defineStore('ai-chat', () => {
  const aiSettingsStore = useAiSettingsStore()

  const messages = ref<ChatMessage[]>([])
  const draft = ref('')
  const isStreaming = ref(false)
  const activeRequestId = ref<string | null>(null)
  const lastError = ref<string | null>(null)

  let activeController: AbortController | null = null

  function appendUserMessage(content: string): ChatMessage {
    const message: ChatMessage = {
      id: generateMessageId('user'),
      role: 'user',
      content,
      createdAt: Date.now(),
      status: 'done',
    }
    messages.value.push(message)
    return message
  }

  function appendAssistantPlaceholder(): ChatMessage {
    const message: ChatMessage = {
      id: generateMessageId('assistant'),
      role: 'assistant',
      content: '',
      createdAt: Date.now(),
      status: 'streaming',
    }
    messages.value.push(message)
    return message
  }

  function appendAssistantDelta(messageId: string, delta: string): void {
    if (delta.length === 0)
      return

    const message = messages.value.find(item => item.id === messageId)
    if (!message)
      return

    message.content += delta
  }

  function finalizeAssistantMessage(messageId: string): void {
    const message = messages.value.find(item => item.id === messageId)
    if (!message || message.role !== 'assistant')
      return

    if (message.status !== 'error')
      message.status = 'done'
  }

  function markAssistantError(messageId: string, errorMessage: string): void {
    const message = messages.value.find(item => item.id === messageId)
    if (!message || message.role !== 'assistant')
      return

    message.status = 'error'
    message.error = errorMessage
  }

  async function sendMessage(input?: string): Promise<void> {
    if (isStreaming.value)
      return

    const content = (input ?? draft.value).trim()
    if (content.length === 0)
      return

    const apiKey = aiSettingsStore.apiKey.trim()
    const apiKeySource = aiSettingsStore.apiKeySource
    const baseUrl = aiSettingsStore.baseUrl.trim()
    const model = aiSettingsStore.model.trim()
    const missingSettingsError = buildMissingSettingsError({
      apiKeySource,
      apiKey,
      baseUrl,
      model,
    })
    if (missingSettingsError) {
      lastError.value = missingSettingsError
      return
    }

    lastError.value = null
    appendUserMessage(content)
    draft.value = ''

    const requestMessages = buildRequestMessages(messages.value)
    const assistantMessage = appendAssistantPlaceholder()

    isStreaming.value = true
    activeRequestId.value = assistantMessage.id
    activeController = new AbortController()

    try {
      await chatWithTools({
        settings: {
          apiKeySource,
          apiKey,
          baseUrl,
          model,
        },
        messages: requestMessages,
        tools: resolveAppAiTools(),
        maxToolRounds: 4,
        signal: activeController.signal,
        onToken: delta => appendAssistantDelta(assistantMessage.id, delta),
        onDone: () => finalizeAssistantMessage(assistantMessage.id),
      })
    }
    catch (error) {
      if (isAbortError(error)) {
        finalizeAssistantMessage(assistantMessage.id)
      }
      else {
        const errorMessage = resolveErrorMessage(error)
        lastError.value = errorMessage
        markAssistantError(assistantMessage.id, errorMessage)
      }
    }
    finally {
      activeController = null
      isStreaming.value = false
      activeRequestId.value = null
    }
  }

  function stopStreaming(): void {
    activeController?.abort()
  }

  function clearMessages(): void {
    if (isStreaming.value)
      stopStreaming()

    messages.value = []
    lastError.value = null
  }

  return {
    messages,
    draft,
    isStreaming,
    activeRequestId,
    lastError,
    sendMessage,
    stopStreaming,
    clearMessages,
    appendUserMessage,
    appendAssistantDelta,
    finalizeAssistantMessage,
    markAssistantError,
  }
})
