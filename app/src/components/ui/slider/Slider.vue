<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import type { SliderVariants } from './slider.un'
import { cn } from '@/lib/utils'
import { sliderVariants } from './slider.un'

interface Props {
  modelValue: number
  min?: number
  max?: number
  step?: number
  disabled?: boolean
  size?: SliderVariants['size']
  tone?: SliderVariants['tone']
  preserveSelection?: boolean
  class?: HTMLAttributes['class']
}

interface Emits {
  (event: 'update:modelValue', value: number): void
  (event: 'change', value: number): void
  (event: 'input', value: number): void
}

const props = withDefaults(defineProps<Props>(), {
  min: 0,
  max: 100,
  step: 1,
  disabled: false,
  size: 'md',
  tone: 'default',
  preserveSelection: true,
})

const emit = defineEmits<Emits>()

function getValueFromEvent(event: Event): number | null {
  const input = event.target as HTMLInputElement | null
  if (!input)
    return null
  const value = Number.parseFloat(input.value)
  return Number.isFinite(value) ? value : null
}

function handleInput(event: Event): void {
  const value = getValueFromEvent(event)
  if (value == null)
    return
  emit('update:modelValue', value)
  emit('input', value)
}

function handleChange(event: Event): void {
  const value = getValueFromEvent(event)
  if (value == null)
    return
  emit('update:modelValue', value)
  emit('change', value)
}
</script>

<template>
  <input
    type="range"
    :value="modelValue"
    :min="min"
    :max="max"
    :step="step"
    :disabled="disabled"
    :data-tone="tone"
    :data-preserve-canvas-selection="preserveSelection ? 'true' : undefined"
    :class="cn(sliderVariants({ size, tone }), props.class)"
    @input="handleInput"
    @change="handleChange"
  >
</template>

<style scoped>
input[type='range'] {
  --slider-track-color: hsl(var(--border));
  --slider-thumb-color: hsl(var(--foreground));
  --slider-thumb-ring: hsl(var(--background));
}

input[type='range'][data-tone='subtle'] {
  --slider-track-color: hsl(var(--border-subtle));
  --slider-thumb-color: hsl(var(--foreground-muted));
}

input[type='range']::-webkit-slider-runnable-track {
  height: 4px;
  border-radius: 999px;
  background: var(--slider-track-color);
}

input[type='range']::-webkit-slider-thumb {
  margin-top: -4px;
  width: 12px;
  height: 12px;
  border: 2px solid var(--slider-thumb-ring);
  border-radius: 50%;
  background: var(--slider-thumb-color);
  -webkit-appearance: none;
  appearance: none;
}

input[type='range']:disabled::-webkit-slider-thumb {
  opacity: 0.7;
}

input[type='range']::-moz-range-track {
  height: 4px;
  border: none;
  border-radius: 999px;
  background: var(--slider-track-color);
}

input[type='range']::-moz-range-thumb {
  width: 12px;
  height: 12px;
  border: 2px solid var(--slider-thumb-ring);
  border-radius: 50%;
  background: var(--slider-thumb-color);
}
</style>
