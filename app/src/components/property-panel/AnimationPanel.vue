<script setup lang="ts">
import type { EnterExitPresetType, LoopPresetType } from '@clippc/performer'
import {
  DEFAULT_ENTER_EXIT_DURATION_MS,
  DEFAULT_LOOP_DURATION_MS,
  mergeAnimationSpec,
} from '@clippc/performer'
import { storeToRefs } from 'pinia'
import { TabsContent, TabsList, TabsRoot, TabsTrigger } from 'radix-vue'
import { computed } from 'vue'
import { Slider } from '@/components/ui/slider'
import { useEditorCommandActions } from '@/composables/useEditorCommandActions'
import { usePerformerStore } from '@/store/usePerformerStore'

const emit = defineEmits<{
  back: []
}>()

const performerStore = usePerformerStore()
const editorCommandActions = useEditorCommandActions()
const { selectedPerformers } = storeToRefs(performerStore)

interface PresetOption {
  label: string
  value: string
  icon: string
}

const enterExitPresets: PresetOption[] = [
  { label: '淡入淡出', value: 'fade', icon: 'i-ph-drop-half-bottom-bold' },
  { label: '上滑', value: 'slide-up', icon: 'i-ph-arrow-up-bold' },
  { label: '下滑', value: 'slide-down', icon: 'i-ph-arrow-down-bold' },
  { label: '左滑', value: 'slide-left', icon: 'i-ph-arrow-left-bold' },
  { label: '右滑', value: 'slide-right', icon: 'i-ph-arrow-right-bold' },
  { label: '放大', value: 'zoom-in', icon: 'i-ph-magnifying-glass-plus-bold' },
  { label: '缩小', value: 'zoom-out', icon: 'i-ph-magnifying-glass-minus-bold' },
  { label: '左旋', value: 'rotate-left', icon: 'i-ph-arrow-counter-clockwise-bold' },
  { label: '右旋', value: 'rotate-right', icon: 'i-ph-arrow-clockwise-bold' },
]

const loopPresets: PresetOption[] = [
  { label: '漂浮', value: 'float', icon: 'i-ph-cloud-bold' },
  { label: '脉冲', value: 'pulse', icon: 'i-ph-heartbeat-bold' },
  { label: '旋转', value: 'spin', icon: 'i-ph-spinner-bold' },
]

type AnimationChannel = 'enter' | 'exit' | 'loop'

interface ChannelConfig {
  key: AnimationChannel
  label: string
  presets: PresetOption[]
  defaultDuration: number
}

const channels: ChannelConfig[] = [
  { key: 'enter', label: '入场', presets: enterExitPresets, defaultDuration: DEFAULT_ENTER_EXIT_DURATION_MS },
  { key: 'exit', label: '出场', presets: enterExitPresets, defaultDuration: DEFAULT_ENTER_EXIT_DURATION_MS },
  { key: 'loop', label: '循环', presets: loopPresets, defaultDuration: DEFAULT_LOOP_DURATION_MS },
]

const selectedPerformerId = computed(() => selectedPerformers.value[0]?.id ?? null)

const animationSpec = computed(() => {
  if (!selectedPerformerId.value)
    return null
  return performerStore.getAnimation(selectedPerformerId.value)
})

function getPreset(channel: AnimationChannel): string {
  return animationSpec.value?.[channel]?.preset ?? 'none'
}

function getDuration(channel: AnimationChannel, fallback: number): number {
  return animationSpec.value?.[channel]?.durationMs ?? fallback
}

function clampDuration(value: number, fallback: number): number {
  if (!Number.isFinite(value))
    return fallback
  return Math.max(50, Math.round(value))
}

function togglePreset(channel: AnimationChannel, value: string, fallbackDuration: number): void {
  const id = selectedPerformerId.value
  if (!id)
    return

  const currentSpec = animationSpec.value

  // re-clicking the active preset deselects it
  if (getPreset(channel) === value) {
    const nextSpec = mergeAnimationSpec(currentSpec, { [channel]: null })
    if (nextSpec)
      void editorCommandActions.performerSetAnimation({ performerId: id, animation: nextSpec as Record<string, unknown> })
    else
      void editorCommandActions.performerClearAnimation({ performerId: id })
    return
  }

  const nextSpec = mergeAnimationSpec(currentSpec, {
    [channel]: {
      preset: value as EnterExitPresetType | LoopPresetType,
      durationMs: getDuration(channel, fallbackDuration),
    },
  })

  if (!nextSpec)
    return

  void editorCommandActions.performerSetAnimation({
    performerId: id,
    animation: nextSpec as Record<string, unknown>,
  })
}

function handleDurationChange(channel: AnimationChannel, value: number, fallbackDuration: number): void {
  const id = selectedPerformerId.value
  if (!id || getPreset(channel) === 'none')
    return

  const nextSpec = mergeAnimationSpec(animationSpec.value, {
    [channel]: {
      durationMs: clampDuration(value, fallbackDuration),
    },
  })

  if (!nextSpec)
    return

  void editorCommandActions.performerSetAnimation({
    performerId: id,
    animation: nextSpec as Record<string, unknown>,
  })
}
</script>

<template>
  <div h-full flex="~ col" overflow-hidden data-preserve-canvas-selection="true">
    <div shrink-0 border-b border="border/30" p-2 px-3 flex items-center gap-2>
      <button
        class="flex items-center justify-center rounded-md p-1 text-foreground-muted transition-colors hover:bg-secondary/50 hover:text-foreground"
        @click="emit('back')"
      >
        <div class="i-ph-caret-left-bold" text-sm />
      </button>
      <span text-xs font-medium text-foreground>动画设置</span>
    </div>

    <div flex-1 overflow-y-auto p-3 space-y-2>
      <TabsRoot default-value="enter">
        <TabsList class="flex w-full rounded-md bg-secondary/30 p-0.5">
          <TabsTrigger
            v-for="ch in channels"
            :key="ch.key"
            :value="ch.key"
            class="flex-1 rounded-[4px] py-1 text-[11px] font-medium text-foreground-muted transition-all data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm"
          >
            {{ ch.label }}
          </TabsTrigger>
        </TabsList>

        <TabsContent
          v-for="ch in channels"
          :key="ch.key"
          :value="ch.key"
          class="mt-2 space-y-2 focus:outline-none"
        >
          <!-- Preset Grid -->
          <div class="grid grid-cols-3 gap-1">
            <button
              v-for="preset in ch.presets"
              :key="preset.value"
              class="flex flex-col items-center justify-center gap-1 rounded-md border text-[10px] transition-all aspect-square"
              :class="getPreset(ch.key) === preset.value
                ? 'border-primary/40 bg-primary/5 text-primary font-medium'
                : 'border-transparent bg-secondary/30 text-foreground-muted hover:bg-secondary/50 hover:text-foreground'"
              @click="togglePreset(ch.key, preset.value, ch.defaultDuration)"
            >
              <div :class="preset.icon" text-base shrink-0 opacity-80 />
              <span>{{ preset.label }}</span>
            </button>
          </div>

          <!-- Duration Slider -->
          <div v-if="getPreset(ch.key) !== 'none'" class="rounded-md border border-border/30 bg-secondary/10 p-2 space-y-1.5 mt-2">
            <div flex items-center justify-between>
              <span text-[10px] uppercase tracking-wider text-foreground-subtle>持续时长</span>
              <span text="[10px]" font-mono tabular-nums text-foreground-subtle>
                {{ getDuration(ch.key, ch.defaultDuration) }}<span text="[9px]" ml-0.5 opacity-60>ms</span>
              </span>
            </div>
            <Slider
              :model-value="getDuration(ch.key, ch.defaultDuration)"
              :min="50"
              :max="3000"
              :step="50"
              size="sm"
              @update:model-value="(v: number) => handleDurationChange(ch.key, v, ch.defaultDuration)"
            />
          </div>
        </TabsContent>
      </TabsRoot>
    </div>
  </div>
</template>
