<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { computed } from 'vue'
import { Button } from '@/components/ui/button'
import { useTransitionCandidates } from '@/composables/useTransitionCandidates'
import { useTransitionStore } from '@/store/useTransitionStore'
import {
  DEFAULT_GL_TRANSITION_TYPE,
  getGlTransitionDefaultParams,
  GL_TRANSITION_PRESETS,
} from '@/utils/glTransitions'
import {
  computeTransitionMaxMs,
  TRANSITION_FEATURE_AVAILABLE,
} from '@/utils/transition'

const transitionStore = useTransitionStore()
const transitionFeatureAvailable = TRANSITION_FEATURE_AVAILABLE
const { activeTransition } = storeToRefs(transitionStore)
const {
  candidates,
  activeCandidate,
  getTransitionClip,
  selectOrCreateTransition,
} = useTransitionCandidates()
const transitionTypeOptions = GL_TRANSITION_PRESETS.map(preset => ({
  value: preset.type,
  label: preset.name,
}))

const activeTransitionClipPair = computed(() => {
  if (!activeTransition.value)
    return null

  const from = getTransitionClip(activeTransition.value.fromId)
  const to = getTransitionClip(activeTransition.value.toId)
  if (!from || !to)
    return null

  return { from, to }
})

const activeLimit = computed(() => {
  if (!activeTransition.value || !activeTransitionClipPair.value)
    return null

  return computeTransitionMaxMs(
    activeTransitionClipPair.value.from,
    activeTransitionClipPair.value.to,
    activeTransition.value.durationMs,
  )
})

function formatCutTime(ms: number): string {
  return `${(ms / 1000).toFixed(2)}s`
}

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

function updateDuration(nextValue: number): void {
  if (!activeTransition.value)
    return

  const next = normalizeDuration(nextValue)
  if (next === activeTransition.value.durationMs)
    return

  transitionStore.updateTransition(activeTransition.value.id, {
    durationMs: next,
  })
}

function handleSliderInput(event: Event): void {
  const input = event.target as HTMLInputElement
  const value = Number.parseInt(input.value, 10)
  if (Number.isNaN(value))
    return

  updateDuration(value)
}

function handleSliderKeydown(event: KeyboardEvent): void {
  if (!activeTransition.value)
    return

  if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight')
    return

  event.preventDefault()

  const step = event.shiftKey ? 10 : 50
  const direction = event.key === 'ArrowRight' ? 1 : -1
  const next = activeTransition.value.durationMs + direction * step
  updateDuration(next)
}

function removeActiveTransition(): void {
  if (!activeTransition.value)
    return

  transitionStore.removeTransition(activeTransition.value.id)
}

function handleTypeChange(event: Event): void {
  if (!activeTransition.value)
    return

  const target = event.target as HTMLSelectElement
  const type = target.value || DEFAULT_GL_TRANSITION_TYPE

  transitionStore.updateTransition(activeTransition.value.id, {
    type,
    params: getGlTransitionDefaultParams(type),
  })
}
</script>

<template>
  <div h-full flex="~ col" overflow-hidden>
    <div p-4 border-b border-border>
      <div text-sm font-medium text-foreground>
        Transition
      </div>
      <div text-xs text-foreground-muted mt-1>
        {{ transitionFeatureAvailable ? 'Select a cut to create or edit a transition' : 'Transition is currently unavailable' }}
      </div>
    </div>

    <div
      v-if="!transitionFeatureAvailable"
      flex-1 min-h-0 p-4 flex items-center justify-center
    >
      <div class="text-xs text-foreground-muted border border-border/60 rounded-md px-3 py-2 bg-background">
        Transition feature is temporarily unavailable
      </div>
    </div>

    <div
      v-else
      flex-1 min-h-0 grid grid-cols-1 gap-0 overflow-hidden
    >
      <div p-4 border-b border-border overflow-y-auto max-h="[45%]">
        <div v-if="candidates.length === 0" text-xs text-foreground-muted>
          No adjacent video/image cuts found
        </div>

        <div v-else class="space-y-2">
          <button
            v-for="candidate in candidates"
            :key="candidate.id"
            class="w-full text-left border rounded-md px-3 py-2 transition-colors"
            :class="{
              'bg-secondary/50 border-primary/50': activeCandidate?.id === candidate.id,
              'bg-background border-border/60 hover:border-border': activeCandidate?.id !== candidate.id,
            }"
            @click="selectOrCreateTransition(candidate)"
          >
            <div class="text-xs text-foreground-muted">
              {{ formatCutTime(candidate.cutTime) }}
            </div>
            <div class="text-sm text-foreground truncate">
              {{ candidate.fromId }} → {{ candidate.toId }}
            </div>
            <div class="text-[11px] text-foreground-muted mt-1">
              {{ candidate.transitionId ? 'Transition ready' : 'Create transition' }}
            </div>
          </button>
        </div>
      </div>

      <div p-4 overflow-y-auto flex-1>
        <div v-if="!activeTransition || !activeLimit" text-xs text-foreground-muted>
          Select a transition candidate to edit duration
        </div>

        <div v-else class="space-y-4">
          <div class="text-sm text-foreground">
            {{ activeTransition.fromId }} → {{ activeTransition.toId }}
          </div>

          <div class="space-y-2">
            <div class="flex items-center justify-between text-xs text-foreground-muted">
              <span>Effect</span>
            </div>
            <select
              class="w-full text-xs bg-background border border-border/60 rounded px-2 py-2"
              :value="activeTransition.type"
              @change="handleTypeChange"
            >
              <option
                v-for="option in transitionTypeOptions"
                :key="option.value"
                :value="option.value"
              >
                {{ option.label }}
              </option>
            </select>
          </div>

          <div class="space-y-2">
            <div class="flex items-center justify-between text-xs text-foreground-muted">
              <span>Duration</span>
              <span>{{ activeTransition.durationMs }}ms</span>
            </div>

            <input
              type="range"
              min="0"
              step="50"
              :max="activeLimit.uiMax"
              :value="activeTransition.durationMs"
              class="w-full"
              @input="handleSliderInput"
              @keydown="handleSliderKeydown"
            >
          </div>

          <Button
            variant="outline"
            class="w-full justify-center"
            @click="removeActiveTransition"
          >
            Delete transition
          </Button>
        </div>
      </div>
    </div>
  </div>
</template>
