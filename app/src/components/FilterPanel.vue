<script setup lang="ts">
import type { AppFilterPresetOption } from '@/lib/filterPresets'
import type { FilterConfig } from '@/store/useFilterStore'
import { storeToRefs } from 'pinia'
import { computed, onMounted } from 'vue'
import { Button, Slider } from '@/components/ui'
import { useEditorCommandActions } from '@/composables/useEditorCommandActions'
import { APP_FILTER_PRESETS } from '@/lib/filterPresets'
import { useEditorStore } from '@/store'
import {
  cloneFilterConfig,
  DEFAULT_FILTER_CONFIG,
  isDefaultFilterConfig,
  useFilterStore,
} from '@/store/useFilterStore'

const FILTER_PRESETS = APP_FILTER_PRESETS

const editorStore = useEditorStore()
const filterStore = useFilterStore()
const editorCommandActions = useEditorCommandActions()
const { activeLayer } = storeToRefs(filterStore)
const { currentTime } = storeToRefs(editorStore)

const config = computed(() => activeLayer.value?.config ?? DEFAULT_FILTER_CONFIG)

onMounted(() => {
  filterStore.bindTimeline(editorStore.clippa.timeline)
})

async function handleCreateFromPreset(preset: AppFilterPresetOption) {
  await editorStore.clippa.ready

  const time = currentTime.value

  // check if there are filter layers covering the current cursor position
  const overlapping = filterStore.layers.filter(
    layer => layer.start <= time && time < layer.start + layer.duration,
  )

  let zIndex: number
  if (overlapping.length > 0) {
    // stack above the highest filter at this position
    zIndex = Math.max(...overlapping.map(l => l.zIndex)) + 1
  }
  else {
    // no filter at cursor — stack above all performers
    const performers = editorStore.clippa.theater.performers
    zIndex = performers.reduce((max, p) => Math.max(max, p.zIndex), 0) + 1
  }

  await editorCommandActions.filterCreateLayer({
    startMs: time,
    zIndex,
    name: preset.label,
    preset: preset.value,
  })
}

function handleResetConfig() {
  if (!activeLayer.value)
    return
  void editorCommandActions.filterResetConfig({ layerId: activeLayer.value.id })
}

function handleUpdateConfig(key: keyof FilterConfig, value: number) {
  if (!activeLayer.value)
    return
  const patch = { [key]: value } as Partial<FilterConfig>
  void editorCommandActions.filterUpdateConfig({
    layerId: activeLayer.value.id,
    patch,
  })
}

function handleBrightnessChange(value: number) {
  handleUpdateConfig('brightness', value)
}

function handleContrastChange(value: number) {
  handleUpdateConfig('contrast', value)
}

function handleSaturationChange(value: number) {
  handleUpdateConfig('saturation', value)
}

function handleHueChange(value: number) {
  handleUpdateConfig('hue', value)
}

const isConfigDefault = computed(() => {
  if (!activeLayer.value)
    return true
  return isDefaultFilterConfig(activeLayer.value.config)
})

const hintConfig = computed(() => {
  return cloneFilterConfig(config.value)
})
</script>

<template>
  <div h-full flex="~ col" overflow-hidden data-preserve-canvas-selection="true">
    <div class="p-3 border-b border-border/70">
      <div class="text-sm font-medium text-foreground">滤镜</div>
    </div>

    <div flex-1 overflow-y-auto p-3 space-y-3>
      <!-- Preset Grid -->
      <div class="grid grid-cols-3 gap-1.5">
        <Button
          v-for="preset in FILTER_PRESETS"
          :key="preset.value"
          variant="outline"
          size="xs"
          class="justify-start font-normal h-8 px-2 text-[10px]"
          @click="handleCreateFromPreset(preset)"
        >
          <div :class="preset.icon" class="mr-1.5 h-3.5 w-3.5 shrink-0 opacity-70" />
          {{ preset.label }}
        </Button>
      </div>

      <!-- Divider + Edit Area -->
      <template v-if="activeLayer">
        <div class="h-px bg-border/30" />

        <div class="space-y-3">
          <div class="flex items-center justify-between">
            <div class="flex flex-col">
              <span class="text-xs text-foreground font-medium">{{ activeLayer.name }}</span>
              <span class="text-[10px] text-foreground-muted tabular-nums">
                {{ Math.round(activeLayer.duration / 100) / 10 }}s
              </span>
            </div>
            <span
              class="text-[10px] bg-secondary/50 px-1.5 py-0.5 rounded"
              :class="isConfigDefault ? 'text-foreground-muted' : 'text-primary'"
            >
              {{ isConfigDefault ? '默认' : '已调整' }}
            </span>
          </div>

          <div class="space-y-3">
            <div class="space-y-1">
              <div class="flex items-center justify-between text-xs text-foreground-muted">
                <span>亮度</span>
                <span>{{ hintConfig.brightness.toFixed(2) }}</span>
              </div>
              <Slider
                :model-value="config.brightness"
                :min="0"
                :max="2"
                :step="0.01"
                class="w-full"
                @update:model-value="handleBrightnessChange"
              />
            </div>

            <div class="space-y-1">
              <div class="flex items-center justify-between text-xs text-foreground-muted">
                <span>对比度</span>
                <span>{{ hintConfig.contrast.toFixed(2) }}</span>
              </div>
              <Slider
                :model-value="config.contrast"
                :min="0"
                :max="2"
                :step="0.01"
                class="w-full"
                @update:model-value="handleContrastChange"
              />
            </div>

            <div class="space-y-1">
              <div class="flex items-center justify-between text-xs text-foreground-muted">
                <span>饱和度</span>
                <span>{{ hintConfig.saturation.toFixed(2) }}</span>
              </div>
              <Slider
                :model-value="config.saturation"
                :min="0"
                :max="2"
                :step="0.01"
                class="w-full"
                @update:model-value="handleSaturationChange"
              />
            </div>

            <div class="space-y-1">
              <div class="flex items-center justify-between text-xs text-foreground-muted">
                <span>色相</span>
                <span>{{ hintConfig.hue.toFixed(0) }}</span>
              </div>
              <Slider
                :model-value="config.hue"
                :min="-180"
                :max="180"
                :step="1"
                class="w-full"
                @update:model-value="handleHueChange"
              />
            </div>
          </div>

          <Button
            class="w-full justify-center"
            variant="outline"
            @click="handleResetConfig"
          >
            重置参数
          </Button>
        </div>
      </template>
    </div>
  </div>
</template>
