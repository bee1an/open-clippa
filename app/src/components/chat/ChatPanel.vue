<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { nextTick, onMounted, ref, watch } from 'vue'
import { Button } from '@/components/ui/button'
import { useAiChatStore } from '@/store/useAiChatStore'
import { useAiSettingsStore } from '@/store/useAiSettingsStore'
import ChatMessageItem from './ChatMessageItem.vue'
import { buildMissingSettingsMessage, isNearBottom, shouldSubmitOnEnter } from './chatPanel.helpers'

const aiSettingsStore = useAiSettingsStore()
const aiChatStore = useAiChatStore()

const { provider, apiKeySource, apiKey, baseUrl, model } = storeToRefs(aiSettingsStore)
const { messages, isStreaming, lastError, draft } = storeToRefs(aiChatStore)

const showSettings = ref(false)
const revealApiKey = ref(false)
const messageListRef = ref<HTMLElement | null>(null)
const shouldAutoScroll = ref(true)

const providerLabel = computed(() => {
  if (provider.value === 'kimi')
    return 'Kimi'
  return provider.value
})

const isByokMode = computed(() => apiKeySource.value === 'byok')

const settingsWarning = computed(() => {
  return buildMissingSettingsMessage({
    apiKeySource: apiKeySource.value,
    apiKey: apiKey.value,
    baseUrl: baseUrl.value,
    model: model.value,
  })
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

watch(apiKeySource, (source) => {
  if (source === 'managed')
    revealApiKey.value = false
})

onMounted(() => {
  void scrollToBottom(true)
})
</script>

<template>
  <section
    h-full flex="~ col"
    border-r border="border/50" bg-background-elevated
    data-preserve-canvas-selection="true"
  >
    <header h-12 shrink-0 border-b border="border/50" px-3 flex items-center justify-between gap-2>
      <div class="text-xs font-semibold uppercase tracking-widest text-foreground-subtle">
        AI Chat
      </div>

      <div class="flex items-center gap-1">
        <Button
          size="icon-xs"
          variant="ghost"
          title="Clear messages"
          :disabled="messages.length === 0"
          @click="aiChatStore.clearMessages()"
        >
          <div class="i-ph-broom-bold text-sm" />
        </Button>

        <Button
          size="icon-xs"
          variant="ghost"
          title="Settings"
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
        <label class="text-[11px] uppercase tracking-wider text-foreground-subtle">Provider</label>
        <input
          class="h-8 rounded-md border border-border/70 bg-secondary/30 px-2 text-xs text-foreground-muted"
          :value="providerLabel"
          readonly
          disabled
        >
      </div>

      <div class="grid gap-2">
        <label class="text-[11px] uppercase tracking-wider text-foreground-subtle">Key Mode</label>
        <select
          v-model="apiKeySource"
          class="h-8 rounded-md border border-border/70 bg-secondary/30 px-2 text-xs text-foreground"
        >
          <option value="byok">
            Bring your key (OpenAI-compatible)
          </option>
          <option value="managed">
            Managed key (server-side default)
          </option>
        </select>
      </div>

      <div
        v-if="!isByokMode"
        class="rounded-md border border-border/60 bg-secondary/20 px-2 py-1.5 text-[11px] text-foreground-muted"
      >
        Using managed server-side API key. No key is shown or stored in browser.
      </div>

      <div v-if="isByokMode" class="grid gap-2">
        <label class="text-[11px] uppercase tracking-wider text-foreground-subtle">API Key</label>
        <div class="flex items-center gap-2">
          <input
            v-model="apiKey"
            :type="revealApiKey ? 'text' : 'password'"
            class="h-8 flex-1 rounded-md border border-border/70 bg-secondary/30 px-2 text-xs text-foreground"
            placeholder="Enter your API key"
            autocomplete="off"
          >
          <Button
            size="icon-xs"
            variant="outline"
            :title="revealApiKey ? 'Hide API key' : 'Show API key'"
            @click="revealApiKey = !revealApiKey"
          >
            <div :class="revealApiKey ? 'i-ph-eye-slash-bold' : 'i-ph-eye-bold'" text-sm />
          </Button>
        </div>
      </div>

      <div class="grid gap-2">
        <label class="text-[11px] uppercase tracking-wider text-foreground-subtle">Base URL</label>
        <input
          v-model="baseUrl"
          class="h-8 rounded-md border border-border/70 bg-secondary/30 px-2 text-xs text-foreground"
          placeholder="/api/kimi"
          autocomplete="off"
        >
      </div>

      <div class="grid gap-2">
        <label class="text-[11px] uppercase tracking-wider text-foreground-subtle">Model</label>
        <input
          v-model="model"
          class="h-8 rounded-md border border-border/70 bg-secondary/30 px-2 text-xs text-foreground"
          placeholder="moonshotai/kimi-k2.5"
          autocomplete="off"
        >
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
        Start a conversation with Kimi.
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
        placeholder="Ask something..."
        @keydown="handleComposerKeydown"
      />

      <div class="flex items-center justify-end gap-2">
        <Button
          v-if="isStreaming"
          size="sm"
          variant="outline"
          @click="handleStop"
        >
          Stop
        </Button>

        <Button
          v-else
          size="sm"
          :disabled="!canSend"
          @click="handleSend"
        >
          Send
        </Button>
      </div>
    </footer>
  </section>
</template>
