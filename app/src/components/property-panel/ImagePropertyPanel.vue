<script setup lang="ts">
import { Image } from '@clippa/performer'
import type { CanvasPerformer } from '@/store/usePerformerStore'

interface Props {
  performer: CanvasPerformer
}

const props = defineProps<Props>()

const imagePerformer = computed(() => {
  return props.performer instanceof Image ? props.performer : null
})

const sourceFileName = computed(() => {
  const p = imagePerformer.value
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
</script>

<template>
  <div space-y-3>
    <div text-xs uppercase tracking-widest text-foreground-subtle>
      Image
    </div>

    <div space-y-2>
      <div flex items-center justify-between gap-2>
        <span text-xs text-foreground-muted>Source</span>
        <span class="max-w-40 truncate text-xs text-foreground">{{ sourceFileName }}</span>
      </div>
    </div>
  </div>
</template>
