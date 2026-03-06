<script setup lang="ts">
import type { CanvasPerformer } from '@/store/usePerformerStore'
import { Audio } from '@clippc/performer'
import { Slider } from '@/components/ui/slider'

interface Props {
  performer: CanvasPerformer
  volume: number
  muted: boolean
}

const props = defineProps<Props>()

const emit = defineEmits<{
  (event: 'update:volume', value: number): void
  (event: 'update:muted', value: boolean): void
}>()

const audioPerformer = computed(() => {
  return props.performer instanceof Audio ? props.performer : null
})

const sourceFileName = computed(() => {
  const p = audioPerformer.value
  if (!p)
    return '-'
  return p.src.split('/').pop() ?? p.src
})

const sourceDuration = computed(() => {
  const p = audioPerformer.value
  if (!p)
    return '-'
  return `${(p.sourceDuration / 1000).toFixed(1)}s`
})

const timelineDuration = computed(() => {
  const p = audioPerformer.value
  if (!p)
    return '-'
  return `${(p.duration / 1000).toFixed(1)}s`
})

const volumePercent = computed(() => Math.round(props.volume * 100))
</script>

<template>
  <div space-y-2>
    <div text="[10px]" uppercase tracking-wider text-foreground-subtle>
      音频
    </div>

    <div space-y-2>
      <div flex items-center justify-between gap-2>
        <span text="[10px]" text-foreground-muted>素材</span>
        <span class="max-w-40 truncate text-[10px] text-foreground">{{ sourceFileName }}</span>
      </div>

      <div flex items-center justify-between gap-2>
        <span text="[10px]" text-foreground-muted>素材时长</span>
        <span class="font-mono text-[10px] tabular-nums text-foreground">{{ sourceDuration }}</span>
      </div>

      <div flex items-center justify-between gap-2>
        <span text="[10px]" text-foreground-muted>片段时长</span>
        <span class="font-mono text-[10px] tabular-nums text-foreground">{{ timelineDuration }}</span>
      </div>

      <div flex items-center justify-between gap-2>
        <span text="[10px]" text-foreground-muted>静音</span>
        <button
          class="rounded-md border border-border/70 px-2 py-1 text-[10px] transition-colors"
          :class="muted ? 'bg-secondary text-foreground' : 'text-foreground-muted hover:text-foreground'"
          @click="emit('update:muted', !muted)"
        >
          {{ muted ? '已静音' : '已开启' }}
        </button>
      </div>

      <div space-y-1>
        <div flex items-center justify-between>
          <span text="[10px]" text-foreground-muted>音量</span>
          <span class="text-[10px] font-mono tabular-nums text-foreground-subtle">
            {{ volumePercent }}%
          </span>
        </div>
        <Slider
          :model-value="volumePercent"
          :min="0"
          :max="100"
          :step="1"
          size="sm"
          @update:model-value="emit('update:volume', $event / 100)"
        />
      </div>
    </div>
  </div>
</template>
