<script setup lang="ts">
import type { ChatMessage } from '@clippc/ai'

interface Props {
  message: ChatMessage
}

const props = defineProps<Props>()

const roleLabel = computed(() => {
  if (props.message.role === 'user')
    return 'You'
  if (props.message.role === 'assistant')
    return 'Kimi'
  if (props.message.role === 'system')
    return 'System'
  return 'Error'
})

const rowClass = computed(() => {
  if (props.message.role === 'user')
    return 'justify-end'
  return 'justify-start'
})

const bubbleClass = computed(() => {
  if (props.message.role === 'user') {
    return 'bg-foreground text-background border-foreground/30'
  }

  if (props.message.role === 'error') {
    return 'bg-red-500/15 text-red-200 border-red-500/40'
  }

  if (props.message.status === 'error') {
    return 'bg-red-500/10 text-red-100 border-red-500/30'
  }

  return 'bg-secondary/50 text-foreground border-border/70'
})
</script>

<template>
  <div class="w-full flex" :class="rowClass">
    <div class="max-w-[85%] rounded-lg border px-3 py-2" :class="bubbleClass">
      <div class="mb-1 text-[10px] uppercase tracking-widest opacity-60">
        {{ roleLabel }}
      </div>

      <div class="whitespace-pre-wrap break-words text-xs leading-relaxed">
        {{ message.content || (message.status === 'streaming' ? '...' : '') }}
        <span
          v-if="message.role === 'assistant' && message.status === 'streaming'"
          class="ml-1 inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-current align-middle"
        />
      </div>

      <div
        v-if="message.error"
        class="mt-2 text-[11px] text-red-300"
      >
        {{ message.error }}
      </div>
    </div>
  </div>
</template>
