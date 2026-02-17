<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { nextTick, onMounted, ref, watch } from 'vue'
import { AI_DISPLAY_NAME } from '@/ai/constants'
import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/select'
import { useAiChatStore } from '@/store/useAiChatStore'
import { useAiModelCatalogStore } from '@/store/useAiModelCatalogStore'
import { useAiSettingsStore } from '@/store/useAiSettingsStore'
import ChatMessageItem from './ChatMessageItem.vue'
import { buildMissingSettingsMessage, isNearBottom, shouldSubmitOnEnter } from './chatPanel.helpers'

const aiSettingsStore = useAiSettingsStore()
const aiChatStore = useAiChatStore()
const aiModelCatalogStore = useAiModelCatalogStore()

const { apiKeySource, apiKey, baseUrl, model } = storeToRefs(aiSettingsStore)
const { messages, isStreaming, lastError, draft } = storeToRefs(aiChatStore)
const {
  items: modelItems,
  loading: isModelLoading,
  loaded: isModelLoaded,
  error: modelError,
} = storeToRefs(aiModelCatalogStore)

const showSettings = ref(false)
const revealApiKey = ref(false)
const messageListRef = ref<HTMLElement | null>(null)
const shouldAutoScroll = ref(true)

const providerLabel = AI_DISPLAY_NAME
const isByokMode = computed(() => apiKeySource.value === 'byok')
const apiKeySourceOptions = [
  { value: 'managed', label: '托管密钥（服务端）' },
  { value: 'byok', label: '自有密钥（OpenAI 兼容）' },
]

const modelOptions = computed(() => {
  return modelItems.value.map(item => ({
    label: item.label,
    value: item.id,
  }))
})

const modelSelectOptions = computed(() => {
  const selectedModel = model.value.trim()
  if (!selectedModel)
    return modelOptions.value

  if (modelOptions.value.some(option => option.value === selectedModel))
    return modelOptions.value

  return [
    {
      label: `${selectedModel}（缓存）`,
      value: selectedModel,
    },
    ...modelOptions.value,
  ]
})

const hasSelectableModel = computed(() => {
  const selected = model.value.trim()
  if (!selected)
    return false
  return modelOptions.value.some(option => option.value === selected)
})

const canFetchModels = computed(() => {
  if (isModelLoading.value)
    return false

  if (isByokMode.value) {
    return apiKey.value.trim().length > 0
      && baseUrl.value.trim().length > 0
  }

  return true
})

const modelFetchButtonLabel = computed(() => {
  if (isModelLoading.value)
    return '获取中...'
  return isModelLoaded.value ? '刷新模型' : '获取模型'
})

const modelCatalogWarning = computed(() => {
  if (!isModelLoaded.value) {
    if (model.value.trim().length > 0)
      return null
    return '请先获取模型列表。'
  }
  if (modelOptions.value.length === 0)
    return '未获取到可用模型，请检查上游是否支持 /models 接口。'
  if (model.value.trim().length === 0)
    return '请选择模型。'
  if (!hasSelectableModel.value)
    return '当前模型不在可用列表，请重新选择。'
  return null
})

const modelCatalogHint = computed(() => {
  if (!isModelLoaded.value && model.value.trim().length > 0) {
    return '当前使用缓存模型，可直接发送；建议先刷新模型列表确认可用性。'
  }
  return null
})

const settingsWarning = computed(() => {
  const missingSettingsWarning = buildMissingSettingsMessage({
    apiKeySource: apiKeySource.value,
    apiKey: apiKey.value,
    baseUrl: baseUrl.value,
    model: model.value,
  })
  return missingSettingsWarning ?? modelCatalogWarning.value
})

const canSend = computed(() => {
  return !isStreaming.value
    && !settingsWarning.value
    && draft.value.trim().length > 0
})

async function scrollToBottom(force: boolean = false): Promise<void> {
  const element = messageListRef.value
  if (!element)
    return
  if (!force && !shouldAutoScroll.value)
    return

  await nextTick()
  element.scrollTop = element.scrollHeight
}

function handleScroll(): void {
  const element = messageListRef.value
  if (!element)
    return

  shouldAutoScroll.value = isNearBottom(
    element.scrollTop,
    element.clientHeight,
    element.scrollHeight,
  )
}

function handleSend(): void {
  if (!canSend.value)
    return
  void aiChatStore.sendMessage()
}

function handleStop(): void {
  aiChatStore.stopStreaming()
}

async function handleFetchModels(): Promise<void> {
  await aiModelCatalogStore.fetchModelCatalog({
    apiKeySource: apiKeySource.value,
    apiKey: apiKey.value,
    baseUrl: baseUrl.value,
  })
}

function handleComposerKeydown(event: KeyboardEvent): void {
  if (!shouldSubmitOnEnter({
    key: event.key,
    shiftKey: event.shiftKey,
    isComposing: event.isComposing,
  })) {
    return
  }

  event.preventDefault()
  handleSend()
}

watch(messages, () => {
  void scrollToBottom()
}, { deep: true })

watch(isStreaming, () => {
  void scrollToBottom(true)
})

watch([apiKeySource, baseUrl], ([nextKeySource, nextBaseUrl], [prevKeySource, prevBaseUrl]) => {
  if (
    nextKeySource !== prevKeySource
    || nextBaseUrl !== prevBaseUrl
  ) {
    aiModelCatalogStore.resetCatalog()
  }

  if (nextKeySource === 'managed')
    revealApiKey.value = false
})

onMounted(() => {
  void scrollToBottom(true)
})
</script>

<template>
  <section
    h-full flex="~ col"
    data-preserve-canvas-selection="true"
  >
    <header h-12 shrink-0 border-b border="border/50" px-3 flex items-center justify-between gap-2>
      <div class="text-xs font-semibold uppercase tracking-widest text-foreground-subtle">
        clippc 助手
      </div>

      <div class="flex items-center gap-1">
        <Button
          size="icon-xs"
          variant="ghost"
          title="清空消息"
          :disabled="messages.length === 0"
          @click="aiChatStore.clearMessages()"
        >
          <div class="i-ph-broom-bold text-sm" />
        </Button>

        <Button
          size="icon-xs"
          variant="ghost"
          title="配置"
          @click="showSettings = !showSettings"
        >
          <div class="i-ph-gear-six-bold text-sm" />
        </Button>
      </div>
    </header>

    <div
      v-if="showSettings"
      class="shrink-0 border-b p-3 space-y-2"
      border="border/50"
      data-preserve-canvas-selection="true"
    >
      <div class="grid gap-2">
        <label class="text-[11px] uppercase tracking-wider text-foreground-subtle">助手名称</label>
        <input
          class="h-8 rounded-md border border-border/70 bg-secondary/30 px-2 text-xs text-foreground-muted"
          :value="providerLabel"
          readonly
          disabled
        >
      </div>

      <div class="grid gap-2">
        <label class="text-[11px] uppercase tracking-wider text-foreground-subtle">密钥模式</label>
        <Select
          v-model="apiKeySource"
          :options="apiKeySourceOptions"
          size="xs"
        />
      </div>

      <div
        v-if="!isByokMode"
        class="rounded-md border border-border/60 bg-secondary/20 px-2 py-1.5 text-[11px] text-foreground-muted"
      >
        当前使用服务端托管密钥与上游地址，浏览器不会保存或展示密钥。
      </div>

      <div v-if="isByokMode" class="grid gap-2">
        <label class="text-[11px] uppercase tracking-wider text-foreground-subtle">API 密钥</label>
        <div class="flex items-center gap-2">
          <input
            v-model="apiKey"
            :type="revealApiKey ? 'text' : 'password'"
            class="h-8 flex-1 rounded-md border border-border/70 bg-secondary/30 px-2 text-xs text-foreground"
            placeholder="请输入 API 密钥"
            autocomplete="off"
          >
          <Button
            size="icon-xs"
            variant="outline"
            :title="revealApiKey ? '隐藏 API 密钥' : '显示 API 密钥'"
            @click="revealApiKey = !revealApiKey"
          >
            <div :class="revealApiKey ? 'i-ph-eye-slash-bold' : 'i-ph-eye-bold'" text-sm />
          </Button>
        </div>
      </div>

      <div v-if="isByokMode" class="grid gap-2">
        <label class="text-[11px] uppercase tracking-wider text-foreground-subtle">接口地址</label>
        <input
          v-model="baseUrl"
          class="h-8 rounded-md border border-border/70 bg-secondary/30 px-2 text-xs text-foreground"
          placeholder="https://api.openai.com/v1"
          autocomplete="off"
        >
      </div>

      <div
        v-else
        class="rounded-md border border-border/60 bg-secondary/20 px-2 py-1.5 text-[11px] text-foreground-muted"
      >
        托管模式下接口地址由服务端固定提供。
      </div>

      <div class="grid gap-2">
        <div class="flex items-center justify-between gap-2">
          <label class="text-[11px] uppercase tracking-wider text-foreground-subtle">模型</label>
          <Button
            size="xs"
            variant="outline"
            :disabled="!canFetchModels"
            @click="handleFetchModels"
          >
            {{ modelFetchButtonLabel }}
          </Button>
        </div>

        <Select
          v-model="model"
          :options="modelSelectOptions"
          size="xs"
          :disabled="isModelLoading || modelSelectOptions.length === 0"
          :placeholder="modelSelectOptions.length > 0 ? '请选择模型' : '请先获取模型列表'"
          content-class="max-h-36"
          viewport-class="max-h-34 overflow-y-auto"
          searchable
          search-placeholder="搜索模型（名称 / ID）"
          no-results-text="未找到匹配模型"
        />
      </div>

      <div
        v-if="modelError"
        class="rounded-md border border-red-500/30 bg-red-500/10 px-2 py-1.5 text-[11px] text-red-200"
      >
        {{ modelError }}
      </div>

      <div
        v-else-if="isModelLoaded && modelOptions.length === 0"
        class="rounded-md border border-border/60 bg-secondary/20 px-2 py-1.5 text-[11px] text-foreground-muted"
      >
        未获取到可用模型，请确认上游支持 `/models` 接口。
      </div>

      <div
        v-if="modelCatalogHint"
        class="rounded-md border border-border/60 bg-secondary/20 px-2 py-1.5 text-[11px] text-foreground-muted"
      >
        {{ modelCatalogHint }}
      </div>
    </div>

    <div
      ref="messageListRef"
      class="min-h-0 flex-1 overflow-y-auto px-3 py-3 space-y-2"
      @scroll="handleScroll"
    >
      <div
        v-if="messages.length === 0"
        class="h-full min-h-24 flex items-center justify-center text-center text-xs text-foreground-muted"
      >
        开始与 {{ AI_DISPLAY_NAME }} 对话。
      </div>

      <ChatMessageItem
        v-for="message in messages"
        :key="message.id"
        :message="message"
      />
    </div>

    <footer class="shrink-0 border-t p-3 space-y-2" border="border/50" data-preserve-canvas-selection="true">
      <div
        v-if="settingsWarning"
        class="rounded-md border border-yellow-500/30 bg-yellow-500/10 px-2 py-1.5 text-[11px] text-yellow-200"
      >
        {{ settingsWarning }}
      </div>

      <div
        v-if="lastError"
        class="rounded-md border border-red-500/30 bg-red-500/10 px-2 py-1.5 text-[11px] text-red-200"
      >
        {{ lastError }}
      </div>

      <textarea
        v-model="draft"
        rows="3"
        class="w-full resize-none rounded-md border border-border/70 bg-secondary/30 px-2 py-2 text-xs text-foreground outline-none focus:border-foreground/40"
        placeholder="输入你的问题..."
        @keydown="handleComposerKeydown"
      />

      <div class="flex items-center justify-end gap-2">
        <Button
          v-if="isStreaming"
          size="sm"
          variant="outline"
          @click="handleStop"
        >
          停止
        </Button>

        <Button
          v-else
          size="sm"
          :disabled="!canSend"
          @click="handleSend"
        >
          发送
        </Button>
      </div>
    </footer>
  </section>
</template>
