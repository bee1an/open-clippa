<script setup lang="ts">
import type { Train } from 'open-clippa'
import type { VideoPerformerConfig } from '@/store/usePerformerStore'
import { storeToRefs } from 'pinia'
import { nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { useEditorStore } from '@/store'
import { usePerformerStore } from '@/store/usePerformerStore'
import { loadVideoMetadata } from '@/utils/media'
import SelectionGroup from './SelectionGroup.vue'

const CANVAS_WIDTH = 996
const CANVAS_HEIGHT = CANVAS_WIDTH / 16 * 9
const DEFAULT_TEST_VIDEO_IDS = ['video1-a', 'video1-b'] as const
const DEFAULT_TEST_VIDEO_SRC = 'https://pixijs.com/assets/video.mp4'
const DEFAULT_TEST_VIDEO_CLIP_TARGET_MS = 20000
const MAX_TIMELINE_SYNC_RETRIES = 24

const editorStore = useEditorStore()
const performerStore = usePerformerStore()
const { currentTime, duration } = storeToRefs(editorStore)
const { selectedPerformers, selectionRevision } = storeToRefs(performerStore)
const { clippa } = editorStore
clippa.stage.init({ width: CANVAS_WIDTH, height: CANVAS_HEIGHT })

const sliderValue = ref(0)
const isSyncingFromTimeline = ref(false)
const isSyncingFromSelection = ref(false)
const canvasPointerTarget = ref<HTMLCanvasElement | null>(null)
const canvasWrapperRef = ref<HTMLElement | null>(null)
let stopSelectionWatch: (() => void) | null = null
let isTimelineListenerActive = false
const PRESERVE_SELECTION_ATTR = 'data-preserve-canvas-selection'

// Canvas 缩放率
const canvasScaleRatio = ref(1)

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

function findTrainById(id: string): Train | null {
  const rails = clippa.timeline.rails?.rails ?? []
  for (const rail of rails) {
    const train = rail.trains.find(item => item.id === id)
    if (train)
      return train
  }
  return null
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
  const defaultTestVideoIdSet = new Set<string>(DEFAULT_TEST_VIDEO_IDS)
  if (performerStore.getAllPerformers().some(item => defaultTestVideoIdSet.has(item.id)))
    return
  if (DEFAULT_TEST_VIDEO_IDS.some(id => Boolean(findTrainById(id))))
    return

  const { duration, width, height } = await loadVideoMetadata(DEFAULT_TEST_VIDEO_SRC)
  const sourceDuration = Math.max(1000, Math.round(duration || 5000))
  const clipDuration = Math.min(
    DEFAULT_TEST_VIDEO_CLIP_TARGET_MS,
    Math.max(500, Math.floor(sourceDuration / 2)),
  )
  // const secondSourceStart = Math.min(sourceDuration - clipDuration, clipDuration)

  const clipConfigs: Array<Omit<VideoPerformerConfig, 'type'>> = [
    {
      id: DEFAULT_TEST_VIDEO_IDS[0],
      src: DEFAULT_TEST_VIDEO_SRC,
      start: 0,
      duration: clipDuration,
      sourceStart: 0,
      sourceDuration,
      x: 0,
      y: 0,
      width: width || CANVAS_WIDTH,
      height: height || CANVAS_HEIGHT,
      zIndex: 0,
    },
    // {
    //   id: DEFAULT_TEST_VIDEO_IDS[1],
    //   src: DEFAULT_TEST_VIDEO_SRC,
    //   start: clipDuration,
    //   duration: clipDuration,
    //   sourceStart: secondSourceStart,
    //   sourceDuration,
    //   x: 0,
    //   y: 0,
    //   width: width || CANVAS_WIDTH,
    //   height: height || CANVAS_HEIGHT,
    //   zIndex: 0,
    // },
  ]

  for (const clipConfig of clipConfigs) {
    const performer = performerStore.addPerformer(clipConfig)
    await clippa.hire(performer)
  }
}

onMounted(async () => {
  await clippa.ready
  clippa.stage.mount('canvas')

  const canvasElement = clippa.stage.app?.canvas as HTMLCanvasElement | undefined
  if (canvasElement) {
    canvasPointerTarget.value = canvasElement
    canvasElement.addEventListener('pointerdown', handleCanvasPointerCapture, { capture: true })
  }

  document.addEventListener('pointerdown', handleDocumentPointerDown, { capture: true })

  // 计算初始缩放率
  nextTick(() => {
    calculateCanvasScaleRatio()
  })

  // 监听 window 大小变化
  window.addEventListener('resize', calculateCanvasScaleRatio)

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
  window.removeEventListener('resize', calculateCanvasScaleRatio)

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
    <!-- Background Pattern - Subtle -->

    <div
      id="canvas"
      ref="canvasWrapperRef"
      flex-1 aspect-video max-h="[85%]" max-w="[95%]" rounded-sm overflow-visible border="white/5" relative bg-black
      @pointerdown="handleCanvasPointerDown"
    >
      <!-- Selection Group 组件 -->
      <SelectionGroup :scale-ratio="canvasScaleRatio" />
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
