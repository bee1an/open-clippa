import type {
  FilterConfig,
  FilterLayer,
  FilterLayerCreateOptions,
  FilterManagerSnapshot,
} from '@clippa/filter'
import { cloneFilterConfig, DEFAULT_FILTER_CONFIG, FilterManager, isDefaultFilterConfig } from '@clippa/filter'
import { defineStore } from 'pinia'
import { computed, markRaw, shallowRef } from 'vue'

export type { FilterConfig, FilterLayer }
export { cloneFilterConfig, DEFAULT_FILTER_CONFIG, isDefaultFilterConfig }

export const useFilterStore = defineStore('filter', () => {
  const manager = markRaw(new FilterManager())
  const layers = shallowRef<FilterLayer[]>([])
  const activeLayerId = ref<string | null>(null)

  const layersSignature = computed(() => {
    return layers.value.map(layer => `${layer.id}:${layer.version}`).join('|')
  })

  const activeLayer = computed(() => {
    if (!activeLayerId.value)
      return null
    return layers.value.find(layer => layer.id === activeLayerId.value) ?? null
  })

  const syncSnapshot = (snapshot: FilterManagerSnapshot): void => {
    layers.value = snapshot.layers
    activeLayerId.value = snapshot.activeLayerId
  }

  manager.on('change', (snapshot) => {
    syncSnapshot(snapshot)
  })

  function bindTimeline(timeline: Parameters<FilterManager['bindTimeline']>[0]): void {
    manager.bindTimeline(timeline)
    syncSnapshot(manager.getSnapshot())
  }

  function createLayer(options?: FilterLayerCreateOptions): FilterLayer | null {
    return manager.createLayer(options)
  }

  function selectLayer(id: string | null): void {
    manager.selectLayer(id)
  }

  function updateLayerConfig(id: string, patch: Partial<FilterConfig>): void {
    manager.updateLayerConfig(id, patch)
  }

  function resetLayerConfig(id: string): void {
    manager.resetLayerConfig(id)
  }

  function updateLayerZIndex(id: string, zIndex: number): void {
    manager.updateLayerZIndex(id, zIndex)
  }

  function removeLayer(id: string): void {
    manager.removeLayer(id)
  }

  return {
    layers,
    activeLayerId,
    activeLayer,
    layersSignature,
    bindTimeline,
    createLayer,
    selectLayer,
    updateLayerConfig,
    resetLayerConfig,
    updateLayerZIndex,
    removeLayer,
  }
})
