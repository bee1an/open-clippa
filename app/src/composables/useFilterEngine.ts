import type { FilterLayer } from '@/store/useFilterStore'
import { storeToRefs } from 'pinia'
import { onMounted, onUnmounted, watch } from 'vue'
import { useEditorStore } from '@/store'
import { isDefaultFilterConfig, useFilterStore } from '@/store/useFilterStore'

export function useFilterEngine(): void {
  const editorStore = useEditorStore()
  const filterStore = useFilterStore()
  const { currentTime } = storeToRefs(editorStore)
  const { layersSignature, layers } = storeToRefs(filterStore)

  const appliedSignatures = new Map<string, string>()
  let ready = false

  function getActiveLayers(time: number): FilterLayer[] {
    return layers.value
      .filter((layer) => {
        if (isDefaultFilterConfig(layer.config))
          return false
        return time >= layer.start && time < layer.start + layer.duration
      })
      .sort((a, b) => {
        if (a.zIndex === b.zIndex)
          return a.createdAt - b.createdAt
        return a.zIndex - b.zIndex
      })
  }

  function buildSignature(targetLayers: FilterLayer[]): string {
    if (!targetLayers.length)
      return ''
    return targetLayers.map(layer => `${layer.id}:${layer.version}`).join('|')
  }

  function applyFilters(): void {
    if (!ready)
      return

    const time = currentTime.value
    const activeLayers = getActiveLayers(time)

    const performers = editorStore.clippa.theater.performers
    performers.forEach((performer) => {
      const applicableLayers = activeLayers.filter(layer => performer.zIndex < layer.zIndex)
      const signature = buildSignature(applicableLayers)

      if (appliedSignatures.get(performer.id) === signature)
        return

      const filters = applicableLayers.length ? applicableLayers.map(layer => layer.filter) : null
      performer.setFilters(filters)
      appliedSignatures.set(performer.id, signature)
    })
  }

  function handleHire(): void {
    applyFilters()
  }

  onMounted(async () => {
    await editorStore.clippa.ready
    ready = true
    filterStore.bindTimeline(editorStore.clippa.timeline)
    editorStore.clippa.theater.on('hire', handleHire)
    applyFilters()
  })

  onUnmounted(() => {
    if (!ready)
      return
    editorStore.clippa.theater.off('hire', handleHire)
  })

  watch(
    () => [currentTime.value, layersSignature.value],
    () => applyFilters(),
  )
}
