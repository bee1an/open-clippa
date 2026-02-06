<script setup lang="ts">
import type { EnterExitPresetType, LoopPresetType } from '@clippa/performer'
import {
  DEFAULT_ENTER_EXIT_DURATION_MS,
  DEFAULT_LOOP_DURATION_MS,
} from '@clippa/performer'
import { storeToRefs } from 'pinia'
import { computed } from 'vue'
import { usePerformerStore } from '@/store/usePerformerStore'

const performerStore = usePerformerStore()
const { selectedPerformers } = storeToRefs(performerStore)

const enterExitOptions: Array<{ label: string, value: EnterExitPresetType }> = [
  { label: 'None', value: 'none' },
  { label: 'Fade', value: 'fade' },
  { label: 'Slide Up', value: 'slide-up' },
  { label: 'Slide Down', value: 'slide-down' },
  { label: 'Slide Left', value: 'slide-left' },
  { label: 'Slide Right', value: 'slide-right' },
  { label: 'Zoom In', value: 'zoom-in' },
  { label: 'Zoom Out', value: 'zoom-out' },
  { label: 'Rotate Left', value: 'rotate-left' },
  { label: 'Rotate Right', value: 'rotate-right' },
]

const loopOptions: Array<{ label: string, value: LoopPresetType }> = [
  { label: 'None', value: 'none' },
  { label: 'Float', value: 'float' },
  { label: 'Pulse', value: 'pulse' },
  { label: 'Spin', value: 'spin' },
]

const selectedPerformerId = computed(() => selectedPerformers.value[0]?.id ?? null)

const animationSpec = computed(() => {
  if (!selectedPerformerId.value)
    return null
  return performerStore.getAnimation(selectedPerformerId.value)
})

const enterPreset = computed<EnterExitPresetType>(() => animationSpec.value?.enter?.preset ?? 'none')
const exitPreset = computed<EnterExitPresetType>(() => animationSpec.value?.exit?.preset ?? 'none')
const loopPreset = computed<LoopPresetType>(() => animationSpec.value?.loop?.preset ?? 'none')

const enterDuration = computed(() => animationSpec.value?.enter?.durationMs ?? DEFAULT_ENTER_EXIT_DURATION_MS)
const exitDuration = computed(() => animationSpec.value?.exit?.durationMs ?? DEFAULT_ENTER_EXIT_DURATION_MS)
const loopDuration = computed(() => animationSpec.value?.loop?.durationMs ?? DEFAULT_LOOP_DURATION_MS)

function clampDuration(value: number, fallback: number): number {
  if (!Number.isFinite(value))
    return fallback
  return Math.max(50, Math.round(value))
}

function getSelectedId(): string | null {
  return selectedPerformerId.value
}

function handleEnterPresetChange(event: Event): void {
  const selectedId = getSelectedId()
  if (!selectedId)
    return

  const nextPreset = (event.target as HTMLSelectElement).value as EnterExitPresetType
  if (nextPreset === 'none') {
    performerStore.updateAnimation(selectedId, { enter: null })
    return
  }

  performerStore.updateAnimation(selectedId, {
    enter: {
      preset: nextPreset,
      durationMs: enterDuration.value,
    },
  })
}

function handleExitPresetChange(event: Event): void {
  const selectedId = getSelectedId()
  if (!selectedId)
    return

  const nextPreset = (event.target as HTMLSelectElement).value as EnterExitPresetType
  if (nextPreset === 'none') {
    performerStore.updateAnimation(selectedId, { exit: null })
    return
  }

  performerStore.updateAnimation(selectedId, {
    exit: {
      preset: nextPreset,
      durationMs: exitDuration.value,
    },
  })
}

function handleLoopPresetChange(event: Event): void {
  const selectedId = getSelectedId()
  if (!selectedId)
    return

  const nextPreset = (event.target as HTMLSelectElement).value as LoopPresetType
  if (nextPreset === 'none') {
    performerStore.updateAnimation(selectedId, { loop: null })
    return
  }

  performerStore.updateAnimation(selectedId, {
    loop: {
      preset: nextPreset,
      durationMs: loopDuration.value,
    },
  })
}

function handleEnterDurationChange(event: Event): void {
  const selectedId = getSelectedId()
  if (!selectedId || enterPreset.value === 'none')
    return

  const inputValue = Number.parseInt((event.target as HTMLInputElement).value, 10)
  performerStore.updateAnimation(selectedId, {
    enter: {
      durationMs: clampDuration(inputValue, DEFAULT_ENTER_EXIT_DURATION_MS),
    },
  })
}

function handleExitDurationChange(event: Event): void {
  const selectedId = getSelectedId()
  if (!selectedId || exitPreset.value === 'none')
    return

  const inputValue = Number.parseInt((event.target as HTMLInputElement).value, 10)
  performerStore.updateAnimation(selectedId, {
    exit: {
      durationMs: clampDuration(inputValue, DEFAULT_ENTER_EXIT_DURATION_MS),
    },
  })
}

function handleLoopDurationChange(event: Event): void {
  const selectedId = getSelectedId()
  if (!selectedId || loopPreset.value === 'none')
    return

  const inputValue = Number.parseInt((event.target as HTMLInputElement).value, 10)
  performerStore.updateAnimation(selectedId, {
    loop: {
      durationMs: clampDuration(inputValue, DEFAULT_LOOP_DURATION_MS),
    },
  })
}
</script>

<template>
  <div h-full flex="~ col" overflow-hidden data-preserve-canvas-selection="true">
    <div class="panel m-4 flex-1 overflow-hidden flex flex-col">
      <div class="panel-header">
        Animation
      </div>

      <div class="flex-1 overflow-y-auto p-4">
        <div
          v-if="!selectedPerformerId"
          class="h-full flex items-center justify-center text-sm text-foreground-muted"
        >
          Select one performer to configure animation
        </div>

        <div v-else class="space-y-4">
          <div class="text-xs text-foreground-muted">
            Target: {{ selectedPerformerId }}
          </div>

          <section class="border border-border/60 rounded-md p-3 space-y-3">
            <div class="text-xs font-medium text-foreground-muted">
              Enter
            </div>

            <select
              class="w-full bg-background border border-border/60 rounded px-2 py-1.5 text-sm"
              :value="enterPreset"
              @change="handleEnterPresetChange"
            >
              <option
                v-for="item in enterExitOptions"
                :key="`enter-${item.value}`"
                :value="item.value"
              >
                {{ item.label }}
              </option>
            </select>

            <input
              type="number"
              min="50"
              step="50"
              class="w-full bg-background border border-border/60 rounded px-2 py-1.5 text-sm"
              :value="enterDuration"
              :disabled="enterPreset === 'none'"
              @change="handleEnterDurationChange"
            >
          </section>

          <section class="border border-border/60 rounded-md p-3 space-y-3">
            <div class="text-xs font-medium text-foreground-muted">
              Exit
            </div>

            <select
              class="w-full bg-background border border-border/60 rounded px-2 py-1.5 text-sm"
              :value="exitPreset"
              @change="handleExitPresetChange"
            >
              <option
                v-for="item in enterExitOptions"
                :key="`exit-${item.value}`"
                :value="item.value"
              >
                {{ item.label }}
              </option>
            </select>

            <input
              type="number"
              min="50"
              step="50"
              class="w-full bg-background border border-border/60 rounded px-2 py-1.5 text-sm"
              :value="exitDuration"
              :disabled="exitPreset === 'none'"
              @change="handleExitDurationChange"
            >
          </section>

          <section class="border border-border/60 rounded-md p-3 space-y-3">
            <div class="text-xs font-medium text-foreground-muted">
              Loop
            </div>

            <select
              class="w-full bg-background border border-border/60 rounded px-2 py-1.5 text-sm"
              :value="loopPreset"
              @change="handleLoopPresetChange"
            >
              <option
                v-for="item in loopOptions"
                :key="`loop-${item.value}`"
                :value="item.value"
              >
                {{ item.label }}
              </option>
            </select>

            <input
              type="number"
              min="50"
              step="50"
              class="w-full bg-background border border-border/60 rounded px-2 py-1.5 text-sm"
              :value="loopDuration"
              :disabled="loopPreset === 'none'"
              @change="handleLoopDurationChange"
            >
          </section>
        </div>
      </div>
    </div>
  </div>
</template>
