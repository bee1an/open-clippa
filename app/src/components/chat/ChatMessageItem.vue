<script setup lang="ts">
import type { ChatMessage } from '@clippc/ai'
import DOMPurify from 'dompurify'
import MarkdownIt from 'markdown-it'

interface Props {
  message: ChatMessage
}

const props = defineProps<Props>()

const markdownRenderer = new MarkdownIt({
  html: false,
  linkify: true,
  breaks: true,
})

const contentText = computed(() => {
  return props.message.content || (props.message.status === 'streaming' ? '...' : '')
})

const shouldRenderMarkdown = computed(() => {
  return props.message.role === 'assistant' && Boolean(contentText.value)
})

const sanitizedMarkdownHtml = computed(() => {
  if (!shouldRenderMarkdown.value)
    return ''

  return DOMPurify.sanitize(markdownRenderer.render(contentText.value), {
    USE_PROFILES: { html: true },
  })
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
      <div class="chat-message-content break-words text-xs leading-relaxed">
        <div
          v-if="shouldRenderMarkdown"
          class="chat-markdown"
          v-html="sanitizedMarkdownHtml"
        />
        <div
          v-else
          class="whitespace-pre-wrap"
        >
          {{ contentText }}
        </div>
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

<style scoped>
.chat-message-content {
  --chat-selection-bg: rgb(186 230 253 / 78%);
  --chat-selection-text: rgb(15 23 42);
}

.chat-message-content::selection,
.chat-message-content :deep(*::selection) {
  background: var(--chat-selection-bg);
  color: var(--chat-selection-text);
}

.chat-message-content::-moz-selection,
.chat-message-content :deep(*::-moz-selection) {
  background: var(--chat-selection-bg);
  color: var(--chat-selection-text);
}

.chat-markdown {
  line-height: 1.55;
}

.chat-markdown :deep(p) {
  margin: 0;
}

.chat-markdown :deep(p + p) {
  margin-top: 0.5rem;
}

.chat-markdown :deep(ul),
.chat-markdown :deep(ol) {
  margin: 0.55rem 0 0;
  padding-left: 1.25rem;
}

.chat-markdown :deep(ul) {
  list-style: disc;
}

.chat-markdown :deep(ol) {
  list-style: decimal;
}

.chat-markdown :deep(ul ul) {
  list-style: circle;
}

.chat-markdown :deep(ol ol) {
  list-style: lower-alpha;
}

.chat-markdown :deep(li) {
  display: list-item;
}

.chat-markdown :deep(li + li) {
  margin-top: 0.25rem;
}

.chat-markdown :deep(li > p) {
  margin: 0;
}

.chat-markdown :deep(li > ul),
.chat-markdown :deep(li > ol) {
  margin-top: 0.25rem;
}

.chat-markdown :deep(pre) {
  margin: 0.5rem 0 0;
  overflow-x: auto;
  border-radius: 0.5rem;
  border: 1px solid rgb(148 163 184 / 35%);
  background: rgb(15 23 42 / 55%);
  padding: 0.5rem 0.625rem;
}

.chat-markdown :deep(code) {
  border-radius: 0.25rem;
  background: rgb(148 163 184 / 18%);
  padding: 0.125rem 0.25rem;
  font-size: 0.92em;
}

.chat-markdown :deep(pre code) {
  background: transparent;
  padding: 0;
}

.chat-markdown :deep(a) {
  color: rgb(125 211 252);
  text-decoration: underline;
  text-underline-offset: 2px;
}

.chat-markdown :deep(blockquote) {
  margin: 0.55rem 0 0;
  border-left: 2px solid rgb(148 163 184 / 45%);
  padding-left: 0.625rem;
  color: rgb(203 213 225 / 92%);
}

.chat-markdown :deep(hr) {
  margin: 0.55rem 0;
  border: 0;
  border-top: 1px solid rgb(148 163 184 / 35%);
}

.chat-markdown :deep(h1),
.chat-markdown :deep(h2),
.chat-markdown :deep(h3),
.chat-markdown :deep(h4) {
  margin: 0.6rem 0 0;
  font-weight: 600;
  line-height: 1.35;
}

.chat-markdown :deep(table) {
  margin-top: 0.55rem;
  width: 100%;
  border-collapse: collapse;
  font-size: 0.95em;
}

.chat-markdown :deep(th),
.chat-markdown :deep(td) {
  border: 1px solid rgb(148 163 184 / 35%);
  padding: 0.3rem 0.45rem;
}
</style>
