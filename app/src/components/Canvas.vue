<script setup lang="ts">
import type { CanvasSize, Train } from 'clippc'
import type { VideoPerformerConfig } from '@/store/usePerformerStore'
import { storeToRefs } from 'pinia'
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { Select } from '@/components/ui/select'
import { useEditorStore } from '@/store'
import { useMediaStore } from '@/store/useMediaStore'
import { usePerformerStore } from '@/store/usePerformerStore'
import { loadVideoMetadata } from '@/utils/media'
import SelectionGroup from './SelectionGroup.vue'

const DEFAULT_TEST_VIDEOS = [
  { id: 'video-test-legacy', src: 'https://pixijs.com/assets/video.mp4' },
  { id: 'video-test-bunny', src: '/bunny.mp4' },
] as const
const MAX_TIMELINE_SYNC_RETRIES = 24

const editorStore = useEditorStore()
const mediaStore = useMediaStore()
const performerStore = usePerformerStore()
const { currentTime, duration, canvasPresetId, canvasSize } = storeToRefs(editorStore)
const { selectedPerformers, selectionRevision } = storeToRefs(performerStore)
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

function handleCanvasPointerDown(event: PointerEvent) {
  const app = clippa.stage.app
  if (!app)
    return

  const canvasElement = app.canvas as HTMLCanvasElement
  const rect = canvasElement.getBoundingClientRect()
  const clientX = event.clientX
  const clientY = event.clientY

  if (clientX < rect.left || clientX > rect.right || clientY < rect.top || clientY > rect.bottom)
    return

  const ratio = canvasScaleRatio.value || 1
  const canvasX = (clientX - rect.left) / ratio
  const canvasY = (clientY - rect.top) / ratio

  const hitPerformers = Array.from(clippa.stage.performers)
    .filter(performer => performer.containsPoint(canvasX, canvasY))

  if (hitPerformers.length === 0) {
    performerStore.clearSelection()
    performerStore.clearPendingSelectionDrag()
    syncSelectionToTimeline(null)
    return
  }

  const target = hitPerformers.sort((a, b) => (b.zIndex ?? 0) - (a.zIndex ?? 0))[0]
  if (!target)
    return

  performerStore.selectPerformer(target.id)
  syncSelectionToTimeline(target.id)
  performerStore.requestSelectionDrag({
    id: target.id,
    clientX: event.clientX,
    clientY: event.clientY,
    timestamp: Date.now(),
  })
}

function handleCanvasPointerCapture(event: PointerEvent) {
  event.stopPropagation()
  handleCanvasPointerDown(event)
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

  performerStore.clearSelection()
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

function resolveDefaultVideoUrl(src: string): string {
  return new URL(src, window.location.href).toString()
}

function handleCanvasPresetChange(value: string): void {
  if (value === canvasPresetId.value)
    return

  editorStore.setCanvasPreset(value)
}

function ensureDefaultVideoAssets() {
  return DEFAULT_TEST_VIDEOS.map((video) => {
    const sourceUrl = resolveDefaultVideoUrl(video.src)
    const existingAsset = mediaStore.videoFiles.find(asset => asset.sourceType === 'url' && asset.url === sourceUrl)
    const asset = existingAsset ?? mediaStore.addVideoFromUrl(sourceUrl)
    return {
      ...video,
      sourceUrl,
      source: asset.source,
    }
  })
}

function syncTimelineToSelection(train: Train | null) {
  if (isSyncingFromSelection.value)
    return

  isSyncingFromTimeline.value = true
  if (train) {
    performerStore.selectPerformer(train.id)
  }
  else {
    performerStore.clearSelection()
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

async function ensureDefaultVideoPerformer(): Promise<void> {
  const defaultVideos = ensureDefaultVideoAssets()
  const defaultTestVideoIds = defaultVideos.map(video => video.id)
  const defaultTestVideoIdSet = new Set<string>(defaultTestVideoIds)
  if (performerStore.getAllPerformers().some(item => defaultTestVideoIdSet.has(item.id)))
    return
  if (defaultTestVideoIds.some(id => Boolean(findTrainById(id))))
    return

  const layoutWidth = canvasSize.value.width / DEFAULT_TEST_VIDEOS.length
  const layoutHeight = canvasSize.value.height
  const clipConfigs: Array<Omit<VideoPerformerConfig, 'type'>> = []

  for (const [index, defaultVideo] of defaultVideos.entries()) {
    const { duration, width, height } = await loadVideoMetadata(defaultVideo.sourceUrl)
    const sourceDuration = Math.max(1000, Math.round(duration || 5000))

    const sourceWidth = width > 0 ? width : layoutWidth
    const sourceHeight = height > 0 ? height : layoutHeight
    const containScale = Math.min(layoutWidth / sourceWidth, layoutHeight / sourceHeight)
    const displayWidth = Math.max(1, Math.floor(sourceWidth * containScale))
    const displayHeight = Math.max(1, Math.floor(sourceHeight * containScale))

    clipConfigs.push({
      id: defaultVideo.id,
      src: defaultVideo.source,
      start: 0,
      duration: sourceDuration,
      sourceStart: 0,
      sourceDuration,
      x: Math.round(index * layoutWidth + (layoutWidth - displayWidth) / 2),
      y: Math.round((layoutHeight - displayHeight) / 2),
      width: displayWidth,
      height: displayHeight,
      zIndex: index,
    })
  }

  for (const clipConfig of clipConfigs) {
    const performer = performerStore.addPerformer(clipConfig)
    await clippa.hire(performer)
  }
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

  try {
    await ensureDefaultVideoPerformer()
  }
  catch (error) {
    console.warn('Default test video bootstrap failed:', error)
  }

  syncTimelineToSelection(clippa.timeline.state.activeTrain)
})

onUnmounted(() => {
  if (canvasPointerTarget.value) {
    canvasPointerTarget.value.removeEventListener('pointerdown', handleCanvasPointerCapture, { capture: true })
    canvasPointerTarget.value = null
  }

  document.removeEventListener('pointerdown', handleDocumentPointerDown, { capture: true })
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
          @pointerdown="handleCanvasPointerDown"
        >
          <SelectionGroup :scale-ratio="canvasScaleRatio" />
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
