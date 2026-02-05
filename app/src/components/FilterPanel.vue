<script setup lang="ts">
import type { FilterConfig } from '@/store/useFilterStore'
import { storeToRefs } from 'pinia'
import { computed, onMounted } from 'vue'
import { Button } from '@/components/ui/button'
import { useEditorStore } from '@/store'
import {
  cloneFilterConfig,
  DEFAULT_FILTER_CONFIG,
  isDefaultFilterConfig,
  useFilterStore,
} from '@/store/useFilterStore'

const editorStore = useEditorStore()
const filterStore = useFilterStore()
const { layers, activeLayerId, activeLayer } = storeToRefs(filterStore)
const { currentTime } = storeToRefs(editorStore)

const config = computed(() => activeLayer.value?.config ?? DEFAULT_FILTER_CONFIG)

onMounted(() => {
  filterStore.bindTimeline(editorStore.clippa.timeline)
})

async function handleCreateLayer() {
  await editorStore.clippa.ready

  const performers = editorStore.clippa.theater.performers
  const maxZIndex = performers.reduce((max, performer) => Math.max(max, performer.zIndex), 0)
  const start = currentTime.value

  filterStore.createLayer({
    start,
    zIndex: maxZIndex + 1,
  })
}

function handleSelectLayer(id: string) {
  filterStore.selectLayer(id)
}

function handleRemoveLayer(id: string) {
  filterStore.removeLayer(id)
}

function handleResetConfig() {
  if (!activeLayer.value)
    return
  filterStore.resetLayerConfig(activeLayer.value.id)
}

function handleUpdateConfig(key: keyof FilterConfig, value: number) {
  if (!activeLayer.value)
    return
  const patch = { [key]: value } as Partial<FilterConfig>
  filterStore.updateLayerConfig(activeLayer.value.id, patch)
}

function handleUpdateZIndex(event: Event) {
  if (!activeLayer.value)
    return
  const input = event.target as HTMLInputElement
  const value = Number.parseInt(input.value, 10)
  if (Number.isNaN(value))
    return
  filterStore.updateLayerZIndex(activeLayer.value.id, value)
}

function handleRangeInput(event: Event, key: keyof FilterConfig) {
  const input = event.target as HTMLInputElement
  const value = Number.parseFloat(input.value)
  if (Number.isNaN(value))
    return
  handleUpdateConfig(key, value)
}

function handleHueInput(event: Event) {
  handleRangeInput(event, 'hue')
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
  <div h-full flex="~ col" overflow-hidden>
    <div p-4 border-b border-border>
      <div text-sm font-medium text-foreground>
        滤镜层
      </div>
      <div text-xs text-foreground-muted mt-1>
        按 zIndex 叠加，影响低于该层的素材
      </div>
      <Button
        class="mt-3 w-full justify-center"
        variant="outline"
        @click="handleCreateLayer"
      >
        新增滤镜层
      </Button>
    </div>

    <div flex-1 overflow-y-auto p-4 space-y-4>
      <div v-if="layers.length === 0" text-sm text-foreground-muted text-center py-6>
        还没有滤镜层
      </div>

      <div v-else class="space-y-2">
        <div
          v-for="layer in layers"
          :key="layer.id"
          class="border border-border/60 rounded-md px-3 py-2 flex items-center justify-between"
          :class="layer.id === activeLayerId ? 'bg-secondary/40 border-primary/50' : 'bg-background'"
        >
          <button
            class="flex flex-col text-left flex-1"
            @click="handleSelectLayer(layer.id)"
          >
            <span class="text-sm text-foreground truncate">
              {{ layer.name }}
            </span>
            <span class="text-xs text-foreground-muted">
              zIndex {{ layer.zIndex }} · {{ Math.round(layer.duration / 100) / 10 }}s
            </span>
          </button>

          <button
            class="text-xs text-foreground-muted hover:text-destructive transition-colors"
            @click="handleRemoveLayer(layer.id)"
          >
            删除
          </button>
        </div>
      </div>

      <div v-if="activeLayer" class="space-y-4">
        <div class="border border-border/60 rounded-md px-3 py-2 space-y-3">
          <div class="flex items-center justify-between">
            <span class="text-xs text-foreground-muted">zIndex</span>
            <input
              type="number"
              class="w-20 text-xs bg-background border border-border/60 rounded px-2 py-1 text-right"
              :value="activeLayer.zIndex"
              min="0"
              step="1"
              @change="handleUpdateZIndex"
            >
          </div>

          <div class="flex items-center justify-between">
            <span class="text-xs text-foreground-muted">配置状态</span>
            <span
              class="text-xs"
              :class="isConfigDefault ? 'text-foreground-muted' : 'text-primary'"
            >
              {{ isConfigDefault ? '默认' : '已调整' }}
            </span>
          </div>

          <Button
            class="w-full justify-center"
            variant="outline"
            @click="handleResetConfig"
          >
            重置参数
          </Button>
        </div>

        <div class="space-y-3">
          <div class="space-y-1">
            <div class="flex items-center justify-between text-xs text-foreground-muted">
              <span>亮度</span>
              <span>{{ hintConfig.brightness.toFixed(2) }}</span>
            </div>
            <input
              type="range"
              min="0"
              max="2"
              step="0.01"
              :value="config.brightness"
              class="w-full"
              @input="handleRangeInput($event, 'brightness')"
            >
          </div>

          <div class="space-y-1">
            <div class="flex items-center justify-between text-xs text-foreground-muted">
              <span>对比度</span>
              <span>{{ hintConfig.contrast.toFixed(2) }}</span>
            </div>
            <input
              type="range"
              min="0"
              max="2"
              step="0.01"
              :value="config.contrast"
              class="w-full"
              @input="handleRangeInput($event, 'contrast')"
            >
          </div>

          <div class="space-y-1">
            <div class="flex items-center justify-between text-xs text-foreground-muted">
              <span>饱和度</span>
              <span>{{ hintConfig.saturation.toFixed(2) }}</span>
            </div>
            <input
              type="range"
              min="0"
              max="2"
              step="0.01"
              :value="config.saturation"
              class="w-full"
              @input="handleRangeInput($event, 'saturation')"
            >
          </div>

          <div class="space-y-1">
            <div class="flex items-center justify-between text-xs text-foreground-muted">
              <span>色相</span>
              <span>{{ hintConfig.hue.toFixed(0) }}</span>
            </div>
            <input
              type="range"
              min="-180"
              max="180"
              step="1"
              :value="config.hue"
              class="w-full"
              @input="handleHueInput"
            >
          </div>
        </div>
      </div>

      <div v-else class="text-sm text-foreground-muted text-center py-6">
        选择一个滤镜层以编辑参数
      </div>
    </div>
  </div>
</template>
