import type { CanvasPerformer } from '@/store/usePerformerStore'
import { MediaCropPreviewController } from 'clippc'
import { Image, Video } from '@clippc/performer'
import { storeToRefs } from 'pinia'
import { useEditorStore } from '@/store'
import { useMediaCropStore } from '@/store/useMediaCropStore'
import { usePerformerStore } from '@/store/usePerformerStore'

function isMediaPerformer(value: CanvasPerformer | null | undefined): value is Image | Video {
  return value instanceof Image || value instanceof Video
}

export function useMediaCropPreviewController() {
  const editorStore = useEditorStore()
  const performerStore = usePerformerStore()
  const mediaCropStore = useMediaCropStore()
  const { currentTime } = storeToRefs(editorStore)
  const revision = ref(0)
  const controller = markRaw(new MediaCropPreviewController(editorStore.clippa.stage))

  const activePerformer = computed<Image | Video | null>(() => {
    const performerId = mediaCropStore.activePerformerId
    if (!performerId)
      return null

    const performer = performerStore.getPerformerById(performerId) ?? null
    if (!isMediaPerformer(performer))
      return null

    return performer as Image | Video
  })

  function clearPreview(): void {
    controller.clear()
  }

  function syncPreview(): void {
    controller.setActivePerformer(activePerformer.value)
  }

  watch(activePerformer, (next, _previous, onCleanup) => {
    revision.value += 1
    if (!next) {
      clearPreview()
      return
    }

    const handler = () => {
      revision.value += 1
    }

    next.on?.('positionUpdate', handler)
    onCleanup(() => {
      next.off?.('positionUpdate', handler)
    })
  }, { immediate: true })

  watch([activePerformer, currentTime, revision], () => {
    syncPreview()
  }, { immediate: true })

  onUnmounted(() => {
    controller.destroy()
  })

  return {
    activePerformer,
    revision,
    syncPreview,
    clearPreview,
  }
}
