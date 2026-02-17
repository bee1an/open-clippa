<script setup lang="ts">
import type { PerformerBounds } from '@clippc/performer'
import { Slider } from '@/components/ui/slider'

interface Props {
  bounds: PerformerBounds | null
  visualPosition: { x: number, y: number } | null
  alpha: number
}

interface Emits {
  (event: 'update:position', x: number, y: number): void
  (event: 'update:rotation', angle: number): void
  (event: 'update:alpha', alpha: number): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

// position uses center-rotation visual coordinates
const posX = computed(() => Math.round(props.visualPosition?.x ?? 0))
const posY = computed(() => Math.round(props.visualPosition?.y ?? 0))
const width = computed(() => Math.round(props.bounds?.width ?? 0))
const height = computed(() => Math.round(props.bounds?.height ?? 0))
const rotation = computed(() => Math.round(props.bounds?.rotation ?? 0))

// alpha: performer uses 0~1, UI shows 0~100
const alphaPercent = computed(() => Math.round((props.alpha ?? 1) * 100))

function handlePositionChange(axis: 'x' | 'y', raw: string) {
  const value = Number.parseInt(raw, 10)
  if (!Number.isFinite(value))
    return
  const x = axis === 'x' ? value : posX.value
  const y = axis === 'y' ? value : posY.value
  emit('update:position', x, y)
}

function handleRotationChange(value: number) {
  emit('update:rotation', value)
}

function handleAlphaChange(value: number) {
  emit('update:alpha', value / 100)
}
</script>

<template>
  <div space-y-2>
    <div text="[10px]" uppercase tracking-wider text-foreground-subtle>
      变换
    </div>

    <!-- Position -->
    <div class="grid grid-cols-2 gap-1.5">
      <label class="space-y-1">
        <span text="[10px]" text-foreground-muted>X</span>
        <input
          type="number"
          :value="posX"
          data-preserve-canvas-selection="true"
          class="w-full rounded-md border border-border/70 bg-secondary/40 px-2 py-1 text-[10px] tabular-nums text-foreground outline-none focus:border-foreground/40"
          @change="(e: Event) => handlePositionChange('x', (e.target as HTMLInputElement).value)"
        >
      </label>
      <label class="space-y-1">
        <span text="[10px]" text-foreground-muted>Y</span>
        <input
          type="number"
          :value="posY"
          data-preserve-canvas-selection="true"
          class="w-full rounded-md border border-border/70 bg-secondary/40 px-2 py-1 text-[10px] tabular-nums text-foreground outline-none focus:border-foreground/40"
          @change="(e: Event) => handlePositionChange('y', (e.target as HTMLInputElement).value)"
        >
      </label>
    </div>

    <!-- Size (read-only) -->
    <div class="grid grid-cols-2 gap-1.5">
      <label class="space-y-1">
        <span text="[10px]" text-foreground-muted>W</span>
        <div class="rounded-md border border-border/40 bg-secondary/20 px-2 py-1 text-[10px] tabular-nums text-foreground-subtle">
          {{ width }}
        </div>
      </label>
      <label class="space-y-1">
        <span text="[10px]" text-foreground-muted>H</span>
        <div class="rounded-md border border-border/40 bg-secondary/20 px-2 py-1 text-[10px] tabular-nums text-foreground-subtle">
          {{ height }}
        </div>
      </label>
    </div>

    <!-- Rotation -->
    <div space-y-1>
      <div flex items-center justify-between>
        <span text="[10px]" text-foreground-muted>旋转</span>
        <span class="text-[10px] font-mono tabular-nums text-foreground-subtle">
          {{ rotation }}<span class="ml-0.5 text-[9px] opacity-60">°</span>
        </span>
      </div>
      <Slider
        :model-value="rotation"
        :min="-180"
        :max="180"
        :step="1"
        size="sm"
        @update:model-value="handleRotationChange"
      />
    </div>

    <!-- Opacity -->
    <div space-y-1>
      <div flex items-center justify-between>
        <span text="[10px]" text-foreground-muted>透明度</span>
        <span class="text-[10px] font-mono tabular-nums text-foreground-subtle">
          {{ alphaPercent }}<span class="ml-0.5 text-[9px] opacity-60">%</span>
        </span>
      </div>
      <Slider
        :model-value="alphaPercent"
        :min="0"
        :max="100"
        :step="1"
        size="sm"
        @update:model-value="handleAlphaChange"
      />
    </div>
  </div>
</template>
