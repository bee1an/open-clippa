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
import { computed, ref } from 'vue'
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
  searchable?: boolean
  searchPlaceholder?: string
  noResultsText?: string
  size?: SelectSize
  tone?: SelectTone
  preserveSelection?: boolean
  class?: HTMLAttributes['class']
  contentClass?: HTMLAttributes['class']
  viewportClass?: HTMLAttributes['class']
}

interface Emits {
  (event: 'update:modelValue', value: string): void
  (event: 'change', value: string): void
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: null,
  placeholder: '请选择',
  disabled: false,
  searchable: false,
  searchPlaceholder: '搜索选项',
  noResultsText: '无匹配项',
  size: 'md',
  tone: 'default',
  preserveSelection: true,
})

const emit = defineEmits<Emits>()
const searchKeyword = ref('')

const visibleOptions = computed(() => {
  if (!props.searchable)
    return props.options

  const keyword = searchKeyword.value.trim().toLowerCase()
  if (!keyword)
    return props.options

  return props.options.filter((option) => {
    return option.label.toLowerCase().includes(keyword)
      || option.value.toLowerCase().includes(keyword)
  })
})

function handleUpdateModelValue(value: unknown): void {
  if (typeof value !== 'string')
    return
  emit('update:modelValue', value)
  emit('change', value)
}

function handleOpenChange(open: boolean): void {
  if (!open)
    searchKeyword.value = ''
}
</script>

<template>
  <SelectRoot
    :model-value="modelValue ?? undefined"
    :disabled="disabled"
    @update:model-value="handleUpdateModelValue"
    @update:open="handleOpenChange"
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
        <div
          v-if="props.searchable"
          class="border-b border-border/60 p-1.5"
        >
          <input
            v-model="searchKeyword"
            type="text"
            class="h-7 w-full rounded-md border border-border/70 bg-background/70 px-2 text-xs text-foreground outline-none focus:border-foreground/40"
            :placeholder="props.searchPlaceholder"
            :data-preserve-canvas-selection="preserveSelection ? 'true' : undefined"
            @keydown.stop
          >
        </div>

        <SelectViewport :class="cn(selectViewportVariants({ size }), props.viewportClass)">
          <SelectItem
            v-for="item in visibleOptions"
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

          <div
            v-if="props.searchable && visibleOptions.length === 0"
            class="px-2 py-2 text-xs text-foreground-muted"
          >
            {{ props.noResultsText }}
          </div>
        </SelectViewport>
      </SelectContent>
    </SelectPortal>
  </SelectRoot>
</template>
