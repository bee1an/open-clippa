<script setup lang="ts">
import { Video } from '@clippc/performer'
import type { CanvasPerformer } from '@/store/usePerformerStore'

interface Props {
  performer: CanvasPerformer
}

const props = defineProps<Props>()

const videoPerformer = computed(() => {
  return props.performer instanceof Video ? props.performer : null
})

const sourceFileName = computed(() => {
  const p = videoPerformer.value
  if (!p) return '-'
  const src = (p as any).src
  if (typeof src === 'string') {
    return src.split('/').pop() ?? src
  }
  if (src instanceof File) {
    return src.name
  }
  return 'Blob'
})

const sourceDuration = computed(() => {
  const p = videoPerformer.value
  if (!p) return '-'
  const dur = (p as any).sourceDuration
  if (typeof dur !== 'number' || !Number.isFinite(dur)) return '-'
  return `${(dur / 1000).toFixed(1)}s`
})

const timelineDuration = computed(() => {
  const p = videoPerformer.value
  if (!p) return '-'
  return `${(p.duration / 1000).toFixed(1)}s`
})
</script>

<template>
  <div space-y-3>
    <div text-xs uppercase tracking-widest text-foreground-subtle>
      Video
    </div>

    <div space-y-2>
      <div flex items-center justify-between gap-2>
        <span text-xs text-foreground-muted>Source</span>
        <span class="max-w-40 truncate text-xs text-foreground">{{ sourceFileName }}</span>
      </div>

      <div flex items-center justify-between gap-2>
        <span text-xs text-foreground-muted>Source Duration</span>
        <span class="font-mono text-xs tabular-nums text-foreground">{{ sourceDuration }}</span>
      </div>

      <div flex items-center justify-between gap-2>
        <span text-xs text-foreground-muted>Clip Duration</span>
        <span class="font-mono text-xs tabular-nums text-foreground">{{ timelineDuration }}</span>
      </div>
    </div>
  </div>
</template>
