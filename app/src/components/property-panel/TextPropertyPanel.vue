<script setup lang="ts">
import type { TextStyleOption } from '@clippc/performer'
import { Select } from '@/components/ui/select'
import { Slider } from '@/components/ui/slider'

interface Props {
  textContent: string
  textStyle: TextStyleOption
}

interface Emits {
  (event: 'update:content', content: string): void
  (event: 'update:style', style: TextStyleOption): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const fontFamilyOptions = [
  { label: 'Arial', value: 'Arial' },
  { label: 'Helvetica', value: 'Helvetica' },
  { label: 'Georgia', value: 'Georgia' },
  { label: 'Times New Roman', value: 'Times New Roman' },
  { label: 'Courier New', value: 'Courier New' },
  { label: 'Verdana', value: 'Verdana' },
  { label: 'Impact', value: 'Impact' },
]

const fontWeightOptions = [
  { label: '常规', value: 'normal' },
  { label: '加粗', value: 'bold' },
]

const currentFontFamily = computed(() => {
  const ff = props.textStyle.fontFamily
  if (Array.isArray(ff))
    return ff[0] ?? 'Arial'
  return ff ?? 'Arial'
})

const currentFontSize = computed(() => props.textStyle.fontSize ?? 32)
const currentFontWeight = computed(() => String(props.textStyle.fontWeight ?? 'normal'))
const currentFill = computed(() => {
  const fill = props.textStyle.fill
  if (typeof fill === 'number')
    return `#${fill.toString(16).padStart(6, '0')}`
  return (fill as string) ?? '#ffffff'
})
const currentAlign = computed(() => props.textStyle.align ?? 'left')
const currentLetterSpacing = computed(() => props.textStyle.letterSpacing ?? 0)

function handleContentChange(e: Event) {
  const value = (e.target as HTMLTextAreaElement).value
  emit('update:content', value)
}

function updateStyle(patch: TextStyleOption) {
  emit('update:style', patch)
}

function handleFontSizeChange(e: Event) {
  const value = Number.parseInt((e.target as HTMLInputElement).value, 10)
  if (Number.isFinite(value) && value > 0) {
    updateStyle({ fontSize: value })
  }
}

function handleFillChange(e: Event) {
  const value = (e.target as HTMLInputElement).value
  updateStyle({ fill: value })
}
</script>

<template>
  <div space-y-3>
    <div text-xs uppercase tracking-widest text-foreground-subtle>
      文本
    </div>

    <!-- Content -->
    <div space-y-1>
      <span text-xs text-foreground-muted>内容</span>
      <textarea
        :value="textContent"
        rows="3"
        data-preserve-canvas-selection="true"
        class="w-full resize-none rounded-md border border-border/70 bg-secondary/40 px-2 py-1.5 text-xs text-foreground outline-none focus:border-foreground/40"
        @change="handleContentChange"
      />
    </div>

    <!-- Font Family -->
    <div space-y-1>
      <span text-xs text-foreground-muted>字体</span>
      <Select
        :model-value="currentFontFamily"
        :options="fontFamilyOptions"
        size="sm"
        @update:model-value="(v: string) => updateStyle({ fontFamily: v })"
      />
    </div>

    <!-- Font Size -->
    <div space-y-1>
      <span text-xs text-foreground-muted>字号</span>
      <input
        type="number"
        :value="currentFontSize"
        :min="1"
        :max="999"
        data-preserve-canvas-selection="true"
        class="w-full rounded-md border border-border/70 bg-secondary/40 px-2 py-1 text-xs tabular-nums text-foreground outline-none focus:border-foreground/40"
        @change="handleFontSizeChange"
      >
    </div>

    <!-- Font Weight -->
    <div space-y-1>
      <span text-xs text-foreground-muted>字重</span>
      <Select
        :model-value="currentFontWeight"
        :options="fontWeightOptions"
        size="sm"
        @update:model-value="(v: string) => updateStyle({ fontWeight: v as 'normal' | 'bold' })"
      />
    </div>

    <!-- Fill Color -->
    <div space-y-1>
      <div flex items-center justify-between>
        <span text-xs text-foreground-muted>填充颜色</span>
        <span class="text-[11px] font-mono text-foreground-subtle">{{ currentFill }}</span>
      </div>
      <input
        type="color"
        :value="currentFill"
        data-preserve-canvas-selection="true"
        class="h-7 w-full cursor-pointer rounded-md border border-border/70 bg-secondary/40 px-0.5"
        @input="handleFillChange"
      >
    </div>

    <!-- Text Align -->
    <div space-y-1>
      <span text-xs text-foreground-muted>对齐方式</span>
      <div class="flex gap-1">
        <button
          v-for="align in (['left', 'center', 'right'] as const)"
          :key="align"
          data-preserve-canvas-selection="true"
          class="flex-1 rounded-md border px-2 py-1.5 text-xs transition-colors"
          :class="currentAlign === align
            ? 'border-foreground/50 bg-foreground/8 text-foreground font-medium'
            : 'border-border/70 bg-background text-foreground-muted hover:bg-secondary/40 hover:text-foreground'"
          @click="updateStyle({ align })"
        >
          <div
            class="mx-auto"
            :class="{
              'i-ph-text-align-left-bold': align === 'left',
              'i-ph-text-align-center-bold': align === 'center',
              'i-ph-text-align-right-bold': align === 'right',
            }"
          />
        </button>
      </div>
    </div>

    <!-- Letter Spacing -->
    <div space-y-1>
      <div flex items-center justify-between>
        <span text-xs text-foreground-muted>字间距</span>
        <span class="text-[11px] font-mono tabular-nums text-foreground-subtle">
          {{ currentLetterSpacing }}<span class="ml-0.5 text-[9px] opacity-60">px</span>
        </span>
      </div>
      <Slider
        :model-value="currentLetterSpacing"
        :min="0"
        :max="20"
        :step="0.5"
        size="sm"
        @update:model-value="(v: number) => updateStyle({ letterSpacing: v })"
      />
    </div>
  </div>
</template>
