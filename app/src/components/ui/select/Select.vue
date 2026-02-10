<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import type { SelectTriggerVariants } from './select.un'
import {
  SelectContent,
  SelectIcon,
  SelectItem,
  SelectItemIndicator,
  SelectItemText,
  SelectPortal,
  SelectRoot,
  SelectTrigger,
  SelectValue,
  SelectViewport,
} from 'radix-vue'
import { cn } from '@/lib/utils'
import {
  selectContentVariants,
  selectItemVariants,
  selectTriggerVariants,
  selectViewportVariants,
} from './select.un'

type SelectSize = NonNullable<SelectTriggerVariants['size']>
type SelectTone = NonNullable<SelectTriggerVariants['tone']>

export interface SelectOption {
  label: string
  value: string
  disabled?: boolean
}

interface Props {
  modelValue?: string | null
  options: SelectOption[]
  placeholder?: string
  disabled?: boolean
  size?: SelectSize
  tone?: SelectTone
  preserveSelection?: boolean
  class?: HTMLAttributes['class']
  contentClass?: HTMLAttributes['class']
}

interface Emits {
  (event: 'update:modelValue', value: string): void
  (event: 'change', value: string): void
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: null,
  placeholder: 'Select an option',
  disabled: false,
  size: 'md',
  tone: 'default',
  preserveSelection: true,
})

const emit = defineEmits<Emits>()

function handleUpdateModelValue(value: unknown): void {
  if (typeof value !== 'string')
    return
  emit('update:modelValue', value)
  emit('change', value)
}
</script>

<template>
  <SelectRoot
    :model-value="modelValue ?? undefined"
    :disabled="disabled"
    @update:model-value="handleUpdateModelValue"
  >
    <SelectTrigger
      :class="cn(selectTriggerVariants({ size, tone }), props.class)"
      :data-preserve-canvas-selection="preserveSelection ? 'true' : undefined"
    >
      <SelectValue :placeholder="placeholder" />
      <SelectIcon as-child>
        <div class="i-ph-caret-down-bold text-xs opacity-70" />
      </SelectIcon>
    </SelectTrigger>

    <SelectPortal>
      <SelectContent
        position="popper"
        :side-offset="6"
        :class="cn(selectContentVariants({ tone }), props.contentClass)"
        :data-preserve-canvas-selection="preserveSelection ? 'true' : undefined"
      >
        <SelectViewport :class="selectViewportVariants({ size })">
          <SelectItem
            v-for="item in options"
            :key="item.value"
            :value="item.value"
            :disabled="item.disabled"
            :class="selectItemVariants({ size, tone })"
            :data-preserve-canvas-selection="preserveSelection ? 'true' : undefined"
          >
            <SelectItemText>
              {{ item.label }}
            </SelectItemText>

            <SelectItemIndicator class="absolute right-2 inline-flex items-center text-foreground-muted">
              <div class="i-ph-check-bold text-xs" />
            </SelectItemIndicator>
          </SelectItem>
        </SelectViewport>
      </SelectContent>
    </SelectPortal>
  </SelectRoot>
</template>
