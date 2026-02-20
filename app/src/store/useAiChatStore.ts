import type { AiApiKeySource, ChatMessage, ChatRequestMessage } from '@clippc/ai'
import { chatWithTools } from '@clippc/ai'
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { getEditorCommandBus } from '@/command/commandBus'
import { resolveAppAiTools } from '@/ai/context/tools'
import { useAiSettingsStore } from './useAiSettingsStore'

const CONTEXT_AWARE_SYSTEM_PROMPT = [
  'You are an assistant inside a video editor.',
  'For executable editing requests, prefer calling available tools to execute actions directly instead of only describing steps.',
  'If the user asks about current canvas, timeline, selected elements, active transition, filters, media assets, or export status, call the relevant tools before answering.',
  'If the user asks to create or add text on canvas or timeline, call create_text_element first.',
  'If the user asks to import a video from URL, call media_import_video_from_url before subsequent editing steps.',
  'If the user asks to import a random image, call media_import_random_image before follow-up editing steps.',
  'If the user asks to import a random video, call media_import_random_video before follow-up editing steps.',
  'If the user asks to randomly choose from media library, call media_pick_random_asset first.',
  'If media should be placed on timeline, chain media_add_asset_to_timeline after import or random pick.',
  'If the user asks to crop image/video, use performer_update_transform with crop or clearCrop and target performerId.',
  'If user asks to undo, redo, rollback, or recover previous state, call history_get_status first and then use history_undo or history_redo.',
  'Only use tool data as factual context. If a tool fails, explain the failure briefly and ask for a retry.',
].join(' ')

const ENABLE_AI_TOOL_DEBUG = import.meta.env.DEV
type AssistantActivityPhase = 'idle' | 'thinking' | 'calling_tool' | 'responding'

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
  const commandBus = getEditorCommandBus()

  const messages = ref<ChatMessage[]>([])
  const draft = ref('')
  const isStreaming = ref(false)
  const activeRequestId = ref<string | null>(null)
  const lastError = ref<string | null>(null)
  const assistantActivityPhase = ref<AssistantActivityPhase>('idle')
  const activeToolName = ref<string | null>(null)

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

  function appendAssistantMessage(content: string, status: ChatMessage['status'], error?: string): ChatMessage {
    const message: ChatMessage = {
      id: generateMessageId('assistant'),
      role: 'assistant',
      content,
      createdAt: Date.now(),
      status,
    }
    if (error)
      message.error = error
    messages.value.push(message)
    return message
  }

  function appendAssistantDelta(messageId: string, delta: string): void {
    if (delta.length === 0)
      return

    const message = messages.value.find(item => item.id === messageId)
    if (!message || message.role !== 'assistant')
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

  function markAssistantThinking(): void {
    assistantActivityPhase.value = 'thinking'
    activeToolName.value = null
  }

  function markAssistantCallingTool(toolName: string): void {
    assistantActivityPhase.value = 'calling_tool'
    activeToolName.value = toolName
  }

  function markAssistantResponding(): void {
    assistantActivityPhase.value = 'responding'
    activeToolName.value = null
  }

  function resetAssistantActivity(): void {
    assistantActivityPhase.value = 'idle'
    activeToolName.value = null
  }

  function isRequestStillActive(requestId: string): boolean {
    return activeRequestId.value === requestId
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
    const requestId = generateMessageId('request')
    let assistantMessageId: string | null = null
    const historyTransaction = commandBus.beginTransaction({
      source: 'ai',
      label: 'AI Reply Commands',
      mergeKey: requestId,
    })
    const historyTransactionId = historyTransaction.ok
      ? historyTransaction.data.transactionId
      : null

    isStreaming.value = true
    activeRequestId.value = requestId
    resetAssistantActivity()
    markAssistantThinking()
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
        maxToolRounds: 12,
        signal: activeController.signal,
        onToolStart: (toolCall) => {
          if (!isRequestStillActive(requestId))
            return
          markAssistantCallingTool(toolCall.name)
          if (!ENABLE_AI_TOOL_DEBUG)
            return
          console.warn('[ai-tool:start]', toolCall)
        },
        onToolResult: (result) => {
          if (!isRequestStillActive(requestId))
            return
          markAssistantThinking()
          if (!ENABLE_AI_TOOL_DEBUG)
            return
          console.warn('[ai-tool:result]', result)
        },
        onToken: (delta) => {
          if (!isRequestStillActive(requestId))
            return
          if (delta.length === 0)
            return
          if (!assistantMessageId) {
            const assistantMessage = appendAssistantMessage('', 'streaming')
            assistantMessageId = assistantMessage.id
          }
          appendAssistantDelta(assistantMessageId, delta)
          markAssistantResponding()
        },
      })
      if (isRequestStillActive(requestId) && assistantMessageId)
        finalizeAssistantMessage(assistantMessageId)
    }
    catch (error) {
      if (!isRequestStillActive(requestId))
        return

      if (isAbortError(error)) {
        if (assistantMessageId)
          finalizeAssistantMessage(assistantMessageId)
      }
      else {
        const errorMessage = resolveErrorMessage(error)
        lastError.value = errorMessage
        if (assistantMessageId) {
          const message = messages.value.find(item => item.id === assistantMessageId)
          if (message && message.role === 'assistant') {
            message.status = 'error'
            message.error = errorMessage
          }
        }
        else {
          appendAssistantMessage('', 'error', errorMessage)
        }
      }
    }
    finally {
      if (historyTransactionId)
        commandBus.endTransaction(historyTransactionId)

      if (!isRequestStillActive(requestId))
        return

      activeController = null
      isStreaming.value = false
      activeRequestId.value = null
      resetAssistantActivity()
    }
  }

  function stopStreaming(): void {
    activeController?.abort()
  }

  function clearMessages(): void {
    if (isStreaming.value)
      stopStreaming()

    activeController = null
    isStreaming.value = false
    activeRequestId.value = null
    messages.value = []
    lastError.value = null
    resetAssistantActivity()
  }

  const hasAssistantActivity = computed(() => {
    return assistantActivityPhase.value === 'thinking'
      || assistantActivityPhase.value === 'calling_tool'
  })

  const assistantActivityText = computed(() => {
    if (assistantActivityPhase.value === 'thinking')
      return 'reasoning'

    if (assistantActivityPhase.value === 'calling_tool') {
      if (activeToolName.value)
        return `tools:${activeToolName.value}`
      return 'tools'
    }

    return ''
  })

  return {
    messages,
    draft,
    isStreaming,
    activeRequestId,
    lastError,
    assistantActivityPhase,
    hasAssistantActivity,
    assistantActivityText,
    sendMessage,
    stopStreaming,
    clearMessages,
    appendUserMessage,
  }
})
