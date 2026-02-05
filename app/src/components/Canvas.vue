<script setup lang="ts">
import type { Train } from 'open-clippa'
import type { PerformerConfig, VideoPerformerConfig } from '@/store/usePerformerStore'
import { storeToRefs } from 'pinia'
import { nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { useEditorStore } from '@/store'
import { usePerformerStore } from '@/store/usePerformerStore'
import { loadVideoMetadata } from '@/utils/media'
import SelectionGroup from './SelectionGroup.vue'

const CANVAS_WIDTH = 996
const CANVAS_HEIGHT = CANVAS_WIDTH / 16 * 9

const editorStore = useEditorStore()
const performerStore = usePerformerStore()
const { currentTime, duration } = storeToRefs(editorStore)
const { selectedPerformers } = storeToRefs(performerStore)
const { clippa } = editorStore
clippa.stage.init({ width: CANVAS_WIDTH, height: CANVAS_HEIGHT })

const sliderValue = ref(0)
const isSyncingFromTimeline = ref(false)
const isSyncingFromSelection = ref(false)
const canvasPointerTarget = ref<HTMLCanvasElement | null>(null)
const canvasWrapperRef = ref<HTMLElement | null>(null)
let stopSelectionWatch: (() => void) | null = null
let isTimelineListenerActive = false

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
    return
  }

  const target = hitPerformers.sort((a, b) => (b.zIndex ?? 0) - (a.zIndex ?? 0))[0]
  if (!target)
    return

  performerStore.selectPerformer(target.id)
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

function handleDocumentPointerDown(event: PointerEvent) {
  const wrapper = canvasWrapperRef.value
  const target = event.target as Node | null
  if (!wrapper || !target)
    return

  if (wrapper.contains(target))
    return

  performerStore.clearSelection()
  performerStore.clearPendingSelectionDrag()
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

  isSyncingFromSelection.value = true
  const activeTrain = clippa.timeline.state.activeTrain

  if (!selectedId) {
    if (activeTrain)
      activeTrain.updateActive(false)
    nextTick(() => {
      isSyncingFromSelection.value = false
    })
    return
  }

  const train = findTrainById(selectedId)
  if (train && activeTrain !== train)
    train.updateActive(true)

  nextTick(() => {
    isSyncingFromSelection.value = false
  })
}

const handleActiveTrainChange = (train: Train | null) => {
  syncTimelineToSelection(train)
}

// 创建 performer 的辅助函数
async function createVideoPerformer(config: Omit<VideoPerformerConfig, 'duration'>): Promise<void> {
  const { duration, width, height } = await loadVideoMetadata(config.src as string)

  const performerConfig: PerformerConfig = {
    ...config,
    duration: duration || 5000,
    width: (config.width ?? width) || CANVAS_WIDTH,
    height: (config.height ?? height) || CANVAS_HEIGHT,
  }

  const performer = performerStore.addPerformer(performerConfig)

  // 将 performer 添加到 clippa
  clippa.hire(performer)
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

  // 使用 performer store 创建视频对象
  await createVideoPerformer({
    id: 'video1',
    src: 'https://pixijs.com/assets/video.mp4',
    start: 0,
    x: 0,
    y: 0,
    zIndex: 0,
  })

  clippa.timeline.state.on('activeTrainChanged', handleActiveTrainChange)
  isTimelineListenerActive = true

  stopSelectionWatch = watch(
    () => selectedPerformers.value.map(item => item.id),
    (ids) => {
      syncSelectionToTimeline(ids[0] ?? null)
    },
    { flush: 'post' },
  )

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
