<script setup lang="ts">
import type { CanvasSize, Train } from 'clippc'
import type { ResizeDirection } from '@clippc/selection'
import { Image, Video } from '@clippc/performer'
import { storeToRefs } from 'pinia'
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { Select } from '@/components/ui/select'
import MediaCropBoxOverlay from '@/components/MediaCropBoxOverlay.vue'
import { rotateCropDelta } from '@/components/cropGesture'
import { resolveCropOverlayState } from '@/components/cropOverlayState'
import { useEditorCommandActions } from '@/composables/useEditorCommandActions'
import { useMediaCropPreviewController } from '@/composables/useMediaCropPreviewController'
import { useMediaCropSession } from '@/composables/useMediaCropSession'
import { useEditorStore } from '@/store'
import { useMediaCropStore } from '@/store/useMediaCropStore'
import { usePerformerStore } from '@/store/usePerformerStore'
import SelectionGroup from './SelectionGroup.vue'

const MAX_TIMELINE_SYNC_RETRIES = 24

const editorStore = useEditorStore()
const performerStore = usePerformerStore()
const editorCommandActions = useEditorCommandActions()
const mediaCropStore = useMediaCropStore()
const { enterCropMode, exitCropMode } = useMediaCropSession()
const {
  activePerformer: activeCropPerformer,
  revision: cropPreviewRevision,
  clearPreview: clearCropPreview,
} = useMediaCropPreviewController()
const { currentTime, duration, canvasPresetId, canvasSize } = storeToRefs(editorStore)
const { selectedPerformers, selectionRevision } = storeToRefs(performerStore)
const { activePerformerId: activeMediaCropPerformerId } = storeToRefs(mediaCropStore)
const { clippa } = editorStore
clippa.stage.init({ width: canvasSize.value.width, height: canvasSize.value.height, antialias: true })
const canvasPresetOptions = computed(() => {
  return editorStore.canvasPresets.map(item => ({
    label: item.id,
    value: item.id,
  }))
})

const sliderValue = ref(0)
const isSyncingFromTimeline = ref(false)
const isSyncingFromSelection = ref(false)
const canvasPointerTarget = ref<HTMLCanvasElement | null>(null)
const canvasContainerRef = ref<HTMLElement | null>(null)
const canvasWrapperRef = ref<HTMLElement | null>(null)
let stopSelectionWatch: (() => void) | null = null
let isTimelineListenerActive = false
let canvasContainerResizeObserver: ResizeObserver | null = null
const PRESERVE_SELECTION_ATTR = 'data-preserve-canvas-selection'
const cropDragPointerId = ref<number | null>(null)
const cropDragLastCanvasPoint = ref<{ x: number, y: number } | null>(null)
const cropResizeDirection = ref<ResizeDirection | null>(null)

// Canvas 缩放率
const canvasScaleRatio = ref(1)
const canvasDisplaySize = ref({ width: canvasSize.value.width, height: canvasSize.value.height })
const CANVAS_MAX_WIDTH_FACTOR = 0.95
const CANVAS_MAX_HEIGHT_FACTOR = 0.9
const CANVAS_CONTROLS_RESERVED_HEIGHT = 38
const canvasWrapperStyle = computed(() => ({
  width: `${canvasDisplaySize.value.width}px`,
  height: `${canvasDisplaySize.value.height}px`,
}))
const isCropModeActive = computed(() => Boolean(activeMediaCropPerformerId.value))
const cropOverlayState = computed(() => {
  return resolveCropOverlayState({
    isCropModeActive: isCropModeActive.value,
    performer: activeCropPerformer.value,
    revision: cropPreviewRevision.value,
  })
})
const shouldShowRectCropHandles = computed(() => cropOverlayState.value.showOverlay)
const shouldShowCropSideHandles = computed(() => cropOverlayState.value.showSideHandles)
const shouldShowCropFrame = computed(() => cropOverlayState.value.showFrame)

function calculateCanvasDisplaySize() {
  const containerElement = canvasContainerRef.value
  if (!containerElement)
    return

  const availableWidth = containerElement.clientWidth * CANVAS_MAX_WIDTH_FACTOR
  const availableHeight = containerElement.clientHeight * CANVAS_MAX_HEIGHT_FACTOR - CANVAS_CONTROLS_RESERVED_HEIGHT
  if (availableWidth <= 0 || availableHeight <= 0)
    return

  const ratio = canvasSize.value.width / canvasSize.value.height
  let width = availableWidth
  let height = width / ratio

  if (height > availableHeight) {
    height = availableHeight
    width = height * ratio
  }

  canvasDisplaySize.value = {
    width: Math.max(1, Math.floor(width)),
    height: Math.max(1, Math.floor(height)),
  }

  nextTick(() => {
    calculateCanvasScaleRatio()
  })
}

// 获取 Canvas 元素并计算缩放率
function calculateCanvasScaleRatio() {
  const app = clippa.stage.app
  if (!app)
    return

  // Canvas 内在尺寸
  const internalWidth = app.renderer.width

  // Canvas 实际显示尺寸 (CSS尺寸)
  const canvasElement = app.canvas as HTMLCanvasElement
  const displayWidth = canvasElement.clientWidth

  // 计算缩放率 (由于宽高比固定，只需计算一个值)
  const ratio = displayWidth / internalWidth
  canvasScaleRatio.value = ratio
}

function resolveCanvasPoint(event: MouseEvent | PointerEvent): { x: number, y: number } | null {
  const app = clippa.stage.app
  if (!app)
    return null

  const canvasElement = app.canvas as HTMLCanvasElement
  const rect = canvasElement.getBoundingClientRect()
  const clientX = event.clientX
  const clientY = event.clientY

  if (clientX < rect.left || clientX > rect.right || clientY < rect.top || clientY > rect.bottom)
    return null

  const ratio = canvasScaleRatio.value || 1
  return {
    x: (clientX - rect.left) / ratio,
    y: (clientY - rect.top) / ratio,
  }
}

function resolveTopmostHitPerformer(event: PointerEvent) {
  const canvasPoint = resolveCanvasPoint(event)
  if (!canvasPoint)
    return null

  const { x: canvasX, y: canvasY } = canvasPoint

  const hitPerformers = Array.from(clippa.stage.performers)
    .filter(performer => performer.containsPoint(canvasX, canvasY))

  if (hitPerformers.length === 0)
    return null

  return hitPerformers.sort((a, b) => (b.zIndex ?? 0) - (a.zIndex ?? 0))[0] ?? null
}

async function handleCanvasPointerDown(event: PointerEvent) {
  if (mediaCropStore.activePerformerId) {
    const target = resolveTopmostHitPerformer(event)
    if (target && activeCropPerformer.value && target.id === activeCropPerformer.value.id) {
      const canvasPoint = resolveCanvasPoint(event)
      if (!canvasPoint)
        return

      cropDragPointerId.value = event.pointerId
      cropDragLastCanvasPoint.value = canvasPoint
      performerStore.clearPendingSelectionDrag()
      return
    }

    performerStore.clearPendingSelectionDrag()
    await exitCropMode()

    if (!target) {
      void editorCommandActions.performerClearSelection()
      syncSelectionToTimeline(null)
      return
    }

    void editorCommandActions.performerSelect({ performerId: target.id })
    syncSelectionToTimeline(target.id)
    return
  }

  const target = resolveTopmostHitPerformer(event)
  if (!target) {
    void editorCommandActions.performerClearSelection()
    performerStore.clearPendingSelectionDrag()
    syncSelectionToTimeline(null)
    return
  }

  const isAlreadySelected = selectedPerformers.value[0]?.id === target.id
  void editorCommandActions.performerSelect({ performerId: target.id })
  syncSelectionToTimeline(target.id)
  if (!isAlreadySelected || event.detail > 1) {
    performerStore.clearPendingSelectionDrag()
    return
  }

  performerStore.requestSelectionDrag({
    id: target.id,
    clientX: event.clientX,
    clientY: event.clientY,
    timestamp: Date.now(),
  })
}

function handleCanvasPointerCapture(event: PointerEvent) {
  event.stopPropagation()
  void handleCanvasPointerDown(event)
}

async function handleCanvasDoubleClick(event: MouseEvent): Promise<void> {
  const target = resolveTopmostHitPerformer(event as PointerEvent)
  if (!(target instanceof Image || target instanceof Video))
    return

  performerStore.clearPendingSelectionDrag()
  void editorCommandActions.performerSelect({ performerId: target.id })
  syncSelectionToTimeline(target.id)
  await enterCropMode(target)
}

function handleCropPointerMove(event: PointerEvent): void {
  if (cropDragPointerId.value !== event.pointerId || !cropDragLastCanvasPoint.value || !activeCropPerformer.value)
    return

  const nextPoint = resolveCanvasPoint(event)
  if (!nextPoint)
    return

  const deltaX = nextPoint.x - cropDragLastCanvasPoint.value.x
  const deltaY = nextPoint.y - cropDragLastCanvasPoint.value.y
  cropDragLastCanvasPoint.value = nextPoint

  const beforeBounds = activeCropPerformer.value.getBounds()
  const rotation = beforeBounds.rotation ?? 0
  const localDelta = rotateCropDelta(deltaX, deltaY, -rotation)

  if (cropResizeDirection.value) {
    const preserveAspectRatio
      = cropResizeDirection.value.includes('-')
        || Boolean(activeCropPerformer.value.getClipShape?.())
    const result = activeCropPerformer.value.applyCropHandleResize?.(
      cropResizeDirection.value,
      localDelta.x,
      localDelta.y,
      preserveAspectRatio,
    )

    if (result) {
      const originShift = rotateCropDelta(result.originShiftX, result.originShiftY, rotation)
      activeCropPerformer.value.setPosition(
        beforeBounds.x + originShift.x,
        beforeBounds.y + originShift.y,
      )
    }
    return
  }

  if (activeCropPerformer.value instanceof Image || activeCropPerformer.value instanceof Video)
    activeCropPerformer.value.panCropByLocalDelta?.(localDelta.x, localDelta.y)
}

function endCropDrag(pointerId?: number): void {
  if (pointerId !== undefined && cropDragPointerId.value !== pointerId)
    return

  cropDragPointerId.value = null
  cropDragLastCanvasPoint.value = null
  cropResizeDirection.value = null
}

function handleCropResizeStart(direction: ResizeDirection, event: PointerEvent): void {
  const canvasPoint = resolveCanvasPoint(event)
  if (!canvasPoint)
    return

  cropDragPointerId.value = event.pointerId
  cropDragLastCanvasPoint.value = canvasPoint
  cropResizeDirection.value = direction
}

function handleCropPointerUp(event: PointerEvent): void {
  endCropDrag(event.pointerId)
}

function handleCropPointerCancel(event: PointerEvent): void {
  endCropDrag(event.pointerId)
}

function shouldKeepSelection(event: PointerEvent): boolean {
  const hasPreserveFlag = (element: Element | null): boolean => {
    return element instanceof HTMLElement && element.getAttribute(PRESERVE_SELECTION_ATTR) === 'true'
  }

  const target = event.target as Element | null
  if (target instanceof HTMLElement && target.closest(`[${PRESERVE_SELECTION_ATTR}="true"]`)) {
    return true
  }

  return event.composedPath().some((node) => {
    return node instanceof Element && hasPreserveFlag(node)
  })
}

function handleDocumentPointerDown(event: PointerEvent) {
  // Native select popups can produce pointer events without a stable composedPath.
  // Keep selection when current focus is already inside a preserve-selection area.
  const activeElement = document.activeElement as Element | null
  const keepByActiveElement = activeElement instanceof HTMLElement
    && activeElement.closest(`[${PRESERVE_SELECTION_ATTR}="true"]`)

  if (shouldKeepSelection(event) || keepByActiveElement)
    return

  const wrapper = canvasWrapperRef.value
  const target = event.target as Node | null
  if (!wrapper || !target)
    return

  if (wrapper.contains(target))
    return

  const timelineElement = document.getElementById('timeline')
  if (timelineElement && timelineElement.contains(target))
    return

  if (mediaCropStore.activePerformerId)
    void exitCropMode()

  void editorCommandActions.performerClearSelection()
  performerStore.clearPendingSelectionDrag()
  syncSelectionToTimeline(null)
}

watch(currentTime, () => {
  sliderValue.value = currentTime.value / duration.value
})

function isSameCanvasSize(left: CanvasSize, right: CanvasSize): boolean {
  return left.width === right.width && left.height === right.height
}

async function handleCanvasSizeChange(nextSize: CanvasSize, previousSize: CanvasSize): Promise<void> {
  if (isSameCanvasSize(nextSize, previousSize))
    return

  await clippa.ready
  clippa.resizeCanvas(nextSize, true)
  calculateCanvasDisplaySize()
}

watch(
  canvasSize,
  (nextSize, previousSize) => {
    if (!previousSize)
      return
    void handleCanvasSizeChange(nextSize, previousSize)
  },
)

function findTrainById(id: string): Train | null {
  const rails = clippa.timeline.rails?.rails ?? []
  for (const rail of rails) {
    const train = rail.trains.find(item => item.id === id)
    if (train)
      return train
  }
  return null
}

function handleCanvasPresetChange(value: string): void {
  if (value === canvasPresetId.value)
    return

  editorStore.setCanvasPreset(value)
}

function syncTimelineToSelection(train: Train | null) {
  if (isSyncingFromSelection.value)
    return

  isSyncingFromTimeline.value = true
  if (train) {
    void editorCommandActions.performerSelect({ performerId: train.id })
  }
  else {
    void editorCommandActions.performerClearSelection()
  }

  nextTick(() => {
    isSyncingFromTimeline.value = false
  })
}

function syncSelectionToTimeline(selectedId: string | null) {
  if (isSyncingFromTimeline.value)
    return

  const activeTrain = clippa.timeline.state.activeTrain

  if (!selectedId) {
    if (activeTrain) {
      isSyncingFromSelection.value = true
      activeTrain.updateActive(false)
    }
    nextTick(() => {
      isSyncingFromSelection.value = false
    })
    return
  }

  const train = findTrainById(selectedId)
  if (train && activeTrain !== train) {
    isSyncingFromSelection.value = true
    train.updateActive(true)
  }
  else if (!train) {
    // train might still be creating asynchronously (e.g. hire/init not completed yet)
    trySyncSelectionToTimeline(selectedId, 0)
    return
  }

  nextTick(() => {
    isSyncingFromSelection.value = false
  })
}

function handleActiveTrainChange(train: Train | null) {
  syncTimelineToSelection(train)
}

function trySyncSelectionToTimeline(selectedId: string, attempt: number) {
  if (selectedPerformers.value[0]?.id !== selectedId)
    return

  if (isSyncingFromTimeline.value)
    return

  const train = findTrainById(selectedId)
  if (train) {
    const activeTrain = clippa.timeline.state.activeTrain
    isSyncingFromSelection.value = true
    if (activeTrain !== train)
      train.updateActive(true)
    nextTick(() => {
      isSyncingFromSelection.value = false
    })
    return
  }

  if (attempt >= MAX_TIMELINE_SYNC_RETRIES) {
    const activeTrain = clippa.timeline.state.activeTrain
    if (activeTrain) {
      isSyncingFromSelection.value = true
      activeTrain.updateActive(false)
      nextTick(() => {
        isSyncingFromSelection.value = false
      })
    }
    return
  }

  requestAnimationFrame(() => {
    trySyncSelectionToTimeline(selectedId, attempt + 1)
  })
}

onMounted(async () => {
  await clippa.ready
  clippa.stage.mount('canvas')

  canvasContainerResizeObserver = new ResizeObserver(() => {
    calculateCanvasDisplaySize()
  })
  if (canvasContainerRef.value)
    canvasContainerResizeObserver.observe(canvasContainerRef.value)

  const canvasElement = clippa.stage.app?.canvas as HTMLCanvasElement | undefined
  if (canvasElement) {
    canvasPointerTarget.value = canvasElement
    canvasElement.addEventListener('pointerdown', handleCanvasPointerCapture, { capture: true })
  }

  document.addEventListener('pointerdown', handleDocumentPointerDown, { capture: true })
  document.addEventListener('pointermove', handleCropPointerMove, { capture: true })
  document.addEventListener('pointerup', handleCropPointerUp, { capture: true })
  document.addEventListener('pointercancel', handleCropPointerCancel, { capture: true })

  // 计算初始缩放率
  nextTick(() => {
    calculateCanvasDisplaySize()
  })

  clippa.timeline.state.on('activeTrainChanged', handleActiveTrainChange)
  isTimelineListenerActive = true

  stopSelectionWatch = watch(
    () => [selectedPerformers.value[0]?.id ?? null, selectionRevision.value] as const,
    ([selectedId]) => {
      syncSelectionToTimeline(selectedId)
    },
    { flush: 'post' },
  )

  syncTimelineToSelection(clippa.timeline.state.activeTrain)
})

watch(
  () => [activeMediaCropPerformerId.value, selectedPerformers.value[0]?.id ?? null] as const,
  ([activeId, selectedId]) => {
    if (activeId && selectedId !== activeId)
      void exitCropMode()
    if (!activeId) {
      endCropDrag()
      clearCropPreview()
    }
  },
)

onUnmounted(() => {
  if (canvasPointerTarget.value) {
    canvasPointerTarget.value.removeEventListener('pointerdown', handleCanvasPointerCapture, { capture: true })
    canvasPointerTarget.value = null
  }

  document.removeEventListener('pointerdown', handleDocumentPointerDown, { capture: true })
  document.removeEventListener('pointermove', handleCropPointerMove, { capture: true })
  document.removeEventListener('pointerup', handleCropPointerUp, { capture: true })
  document.removeEventListener('pointercancel', handleCropPointerCancel, { capture: true })
  canvasContainerResizeObserver?.disconnect()
  canvasContainerResizeObserver = null

  if (isTimelineListenerActive) {
    clippa.timeline.state.off('activeTrainChanged', handleActiveTrainChange)
    isTimelineListenerActive = false
  }

  stopSelectionWatch?.()
  stopSelectionWatch = null
})
</script>

<template>
  <div h-full w-full flex flex-col items-center justify-center bg-background relative overflow-hidden>
    <div ref="canvasContainerRef" flex-1 w-full flex items-center justify-center overflow-hidden>
      <div class="flex shrink-0 flex-col items-center gap-2">
        <div
          class="inline-flex max-w-full items-center gap-1 rounded-full border border-border/60 bg-background-elevated/90 px-1.5 py-1 shadow-sm backdrop-blur-sm"
          data-preserve-canvas-selection="true"
        >
          <div
            i-ph-corners-out-bold
            text="[12px]"
            text-foreground-muted
            class="ml-1 shrink-0"
            aria-hidden="true"
          />
          <Select
            :model-value="canvasPresetId"
            :options="canvasPresetOptions"
            size="xs"
            class="min-w-22 rounded-full border-0 bg-secondary/60"
            data-preserve-canvas-selection="true"
            @update:model-value="handleCanvasPresetChange"
          />
        </div>

        <div
          id="canvas"
          ref="canvasWrapperRef"
          rounded-sm overflow-visible border="white/5" relative bg-black
          :style="canvasWrapperStyle"
          @dblclick.capture="handleCanvasDoubleClick"
        >
          <SelectionGroup v-if="!isCropModeActive" :scale-ratio="canvasScaleRatio" />
          <MediaCropBoxOverlay
            v-if="shouldShowRectCropHandles && activeCropPerformer"
            :performer="activeCropPerformer"
            :scale-ratio="canvasScaleRatio"
            :show-side-handles="shouldShowCropSideHandles"
            :show-frame="shouldShowCropFrame"
            @resize-start="handleCropResizeStart"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<style>
#canvas canvas {
  position: absolute;
  width: 100%;
  height: 100%;
  border-radius: inherit;
}

/* 全屏样式 */
#canvas:fullscreen {
  background: #000;
  display: flex;
  align-items: center;
  justify-content: center;
}

#canvas:fullscreen canvas {
  max-width: 100vw;
  max-height: 100vh;
  object-fit: contain;
}
</style>
