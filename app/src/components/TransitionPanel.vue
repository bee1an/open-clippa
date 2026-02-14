<script setup lang="ts">
import { computed } from 'vue'
import { Slider } from '@/components/ui/slider'
import { useTransitionCandidates } from '@/composables/useTransitionCandidates'
import { useTransitionStore } from '@/store/useTransitionStore'
import { GL_TRANSITION_PRESETS } from '@clippc/transition'
import {
  computeTransitionMaxMs,
  DEFAULT_TRANSITION_DURATION,
  TRANSITION_FEATURE_AVAILABLE,
} from '@clippc/transition'

const transitionStore = useTransitionStore()
const transitionFeatureAvailable = TRANSITION_FEATURE_AVAILABLE
const {
  activeCandidate,
  getTransitionClip,
  applyTransitionType,
} = useTransitionCandidates()

const TRANSITION_TYPE_LABELS: Record<string, string> = {
  fade: '淡入淡出',
  crosswarp: '交叉扭曲',
  directionalwipe: '方向擦除',
  directionalwrap: '方向包裹',
}

const transitionTypeOptions = GL_TRANSITION_PRESETS.map(preset => ({
  value: preset.type,
  label: TRANSITION_TYPE_LABELS[preset.type] ?? preset.name,
}))

const activeTransition = computed(() => {
  if (!activeCandidate.value)
    return null

  return transitionStore.getTransitionByPair(activeCandidate.value.fromId, activeCandidate.value.toId)
})

const activeTransitionClipPair = computed(() => {
  if (!activeCandidate.value)
    return null

  const from = getTransitionClip(activeCandidate.value.fromId)
  const to = getTransitionClip(activeCandidate.value.toId)
  if (!from || !to)
    return null

  return { from, to }
})

const activeLimit = computed(() => {
  if (!activeTransitionClipPair.value)
    return null

  return computeTransitionMaxMs(
    activeTransitionClipPair.value.from,
    activeTransitionClipPair.value.to,
    activeTransition.value?.durationMs ?? DEFAULT_TRANSITION_DURATION,
  )
})

const activeTransitionType = computed(() => activeTransition.value?.type ?? null)

const displayDuration = computed(() => {
  if (activeTransition.value)
    return activeTransition.value.durationMs

  if (!activeLimit.value)
    return DEFAULT_TRANSITION_DURATION

  return Math.min(DEFAULT_TRANSITION_DURATION, activeLimit.value.uiMax)
})

function normalizeDuration(nextValue: number): number {
  if (!activeTransition.value || !activeLimit.value)
    return 0

  const current = activeTransition.value.durationMs
  const { maxMs, uiMax } = activeLimit.value

  let next = Math.max(0, Math.min(uiMax, nextValue))
  if (current > maxMs) {
    if (next > current)
      next = current
  }
  else if (next > maxMs) {
    next = maxMs
  }

  return Math.round(next)
}

function handleEffectClick(type: string): void {
  if (!activeCandidate.value)
    return

  applyTransitionType(activeCandidate.value, type)
}

function handleDurationChange(value: number): void {
  if (!activeTransition.value)
    return

  const next = normalizeDuration(value)
  if (next === activeTransition.value.durationMs)
    return

  transitionStore.updateTransition(activeTransition.value.id, {
    durationMs: next,
  })
}

function removeActiveTransition(): void {
  if (!activeTransition.value)
    return

  transitionStore.removeTransition(activeTransition.value.id)
}

function clearActiveSelection(): void {
  transitionStore.clearActiveSelection()
}
</script>

<template>
  <div h-full flex="~ col" overflow-hidden data-preserve-canvas-selection="true">
    <div p-4 border-b border-border>
      <div text-sm font-medium text-foreground>
        转场
      </div>
      <div text-xs text-foreground-muted mt-1>
        {{ transitionFeatureAvailable ? '编辑转场效果与时长' : '当前不可使用转场功能' }}
      </div>
    </div>

    <div
      v-if="!transitionFeatureAvailable"
      flex-1 min-h-0 p-4 flex items-center justify-center
      data-preserve-canvas-selection="true"
    >
      <div class="text-xs text-foreground-muted border border-border/60 rounded-md px-3 py-2 bg-background">
        转场功能暂不可用
      </div>
    </div>

    <div
      v-else
      flex-1 min-h-0 overflow-y-auto p-4 space-y-4
      data-preserve-canvas-selection="true"
    >
      <div
        v-if="!activeCandidate"
        class="text-xs text-foreground-muted border border-border/60 rounded-md px-3 py-2 bg-background"
      >
        点击时间轴上的转场图标开始编辑
      </div>

      <div
        v-else
        class="space-y-3"
      >
        <div class="space-y-2">
          <div class="text-xs text-foreground-muted">
            先选择一个效果类型，首次选择会自动创建转场。
          </div>
          <div class="grid grid-cols-2 gap-1.5">
            <button
              v-for="option in transitionTypeOptions"
              :key="option.value"
              type="button"
              class="rounded-md border px-2.5 py-2 text-xs text-left transition-colors"
              :class="activeTransitionType === option.value
                ? 'border-foreground/50 bg-foreground/8 text-foreground font-medium'
                : 'border-border/70 bg-background text-foreground-muted hover:bg-secondary/40 hover:text-foreground'"
              data-preserve-canvas-selection="true"
              @click="handleEffectClick(option.value)"
            >
              {{ option.label }}
            </button>
          </div>
        </div>

        <div class="h-px bg-border/50" />

        <div class="space-y-3">
          <div v-if="!activeTransition || !activeLimit" class="text-xs text-foreground-muted border border-border/60 rounded-md px-3 py-2 bg-background">
            请先选择效果，再调整时长
          </div>
          <template v-else>
            <div class="flex items-center justify-between text-xs text-foreground-muted">
              <span>时长</span>
              <span>{{ displayDuration }}ms</span>
            </div>
            <Slider
              :model-value="displayDuration"
              :min="0"
              :max="activeLimit.uiMax"
              :step="50"
              size="sm"
              @update:model-value="(value: number) => handleDurationChange(value)"
            />
            <div class="text-[11px] text-foreground-muted">
              受素材裁剪限制的最大时长：{{ activeLimit.maxMs }}ms
            </div>
          </template>
        </div>

        <div class="h-px bg-border/50" />

        <div class="space-y-2">
          <button
            type="button"
            class="w-full rounded-md border border-border/70 px-3 py-2 text-xs text-left transition-colors hover:bg-secondary/40 hover:text-foreground"
            data-preserve-canvas-selection="true"
            @click="clearActiveSelection"
          >
            清除当前转场选择
          </button>
          <button
            type="button"
            class="w-full rounded-md border border-destructive/40 px-3 py-2 text-xs text-left transition-colors hover:bg-destructive/10 disabled:opacity-50 disabled:cursor-not-allowed"
            data-preserve-canvas-selection="true"
            :disabled="!activeTransition"
            @click="removeActiveTransition"
          >
            删除转场
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
