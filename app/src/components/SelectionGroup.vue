<script setup lang="ts">
import type { ResizeDirection, SelectionItem } from '@clippc/selection'
import { Image, Video } from '@clippc/performer'
import { Selection } from '@clippc/selection'
import { storeToRefs } from 'pinia'
import { computed, nextTick, onUnmounted, ref, watch } from 'vue'
import { useEditorCommandActions } from '@/composables/useEditorCommandActions'
import { useEditorStore } from '@/store'
import { usePerformerStore } from '@/store/usePerformerStore'

// Props
interface Props {
  scaleRatio?: number
}

const props = withDefaults(defineProps<Props>(), {
  scaleRatio: 1,
})

const scaleRatio = computed(() => props.scaleRatio)

const performerStore = usePerformerStore()
const editorStore = useEditorStore()
const editorCommandActions = useEditorCommandActions()
const { currentTime } = storeToRefs(editorStore)
interface SelectionExpose {
  startExternalDrag?: (clientX: number, clientY: number) => void
}

const { selectedPerformers, pendingSelectionDrag } = storeToRefs(performerStore)
const selectionRef = ref<SelectionExpose | null>(null)
const activeResizeDirection = ref<ResizeDirection | null>(null)
const activeGestureTransactionId = ref<string | null>(null)
const isGestureTransactionStarting = ref(false)

const selectionCustomStyle = {
  'border': '1.5px solid hsl(var(--foreground) / 0.92)',
  'background': 'hsl(var(--foreground) / 0.04)',
  'handleColor': 'hsl(var(--foreground) / 0.88)',
  'handleSize': 9,
  'borderRadius': '4px',
  'boxShadow': '0 0 0 1px hsl(var(--background) / 0.72), 0 12px 28px rgb(0 0 0 / 0.32)',
  '--selection-handle-bg': 'hsl(var(--background-overlay))',
} as const

interface BoundsLike {
  x: number
  y: number
  width: number
  height: number
  rotation?: number
}

function rotateVector(x: number, y: number, rotation: number): { x: number, y: number } {
  if (!rotation) {
    return { x, y }
  }

  const radians = rotation * Math.PI / 180
  const cos = Math.cos(radians)
  const sin = Math.sin(radians)

  return {
    x: x * cos - y * sin,
    y: x * sin + y * cos,
  }
}

function toCenterRotationPosition(bounds: BoundsLike): { x: number, y: number } {
  const rotation = bounds.rotation ?? 0
  const offset = rotateVector(bounds.width / 2, bounds.height / 2, rotation)
  const centerX = bounds.x + offset.x
  const centerY = bounds.y + offset.y

  return {
    x: centerX - bounds.width / 2,
    y: centerY - bounds.height / 2,
  }
}

function toTopLeftRotationBounds(item: BoundsLike): BoundsLike {
  const rotation = item.rotation ?? 0
  const centerX = item.x + item.width / 2
  const centerY = item.y + item.height / 2
  const offset = rotateVector(item.width / 2, item.height / 2, rotation)

  return {
    x: centerX - offset.x,
    y: centerY - offset.y,
    width: item.width,
    height: item.height,
    rotation,
  }
}

function isSideResizeDirection(direction: ResizeDirection): direction is 'top' | 'right' | 'bottom' | 'left' {
  return direction === 'top' || direction === 'right' || direction === 'bottom' || direction === 'left'
}

function isCroppablePerformer(performer: unknown): performer is Image | Video {
  return performer instanceof Image || performer instanceof Video
}

function isPromiseLike<T>(value: T | Promise<T>): value is Promise<T> {
  return typeof (value as Promise<T> | undefined)?.then === 'function'
}

function beginGestureTransaction(label: string): void {
  if (activeGestureTransactionId.value || isGestureTransactionStarting.value)
    return

  isGestureTransactionStarting.value = true
  const transaction = editorCommandActions.historyBeginTransaction({
    source: 'ui',
    label,
  })

  const applyBeginResult = (beginResult: { ok: true, data: { transactionId: string } } | { ok: false }) => {
    if (!beginResult.ok)
      return

    activeGestureTransactionId.value = beginResult.data.transactionId
    void editorCommandActions.historyCheckpoint({
      source: 'ui',
      label: `${label} Start`,
    })
  }

  if (isPromiseLike(transaction)) {
    void transaction
      .then(applyBeginResult)
      .finally(() => {
        isGestureTransactionStarting.value = false
      })
    return
  }

  isGestureTransactionStarting.value = false
  applyBeginResult(transaction)
}

async function endGestureTransaction(label: string): Promise<void> {
  const transactionId = activeGestureTransactionId.value
  if (!transactionId)
    return

  await editorCommandActions.historyCheckpoint({
    source: 'ui',
    label: `${label} End`,
  })

  await editorCommandActions.historyEndTransaction(transactionId)
  activeGestureTransactionId.value = null
}

async function cancelGestureTransaction(): Promise<void> {
  const transactionId = activeGestureTransactionId.value
  if (!transactionId)
    return

  await editorCommandActions.historyCancelTransaction(transactionId)
  activeGestureTransactionId.value = null
}

// 计算当前选中的 performer 信息（包含响应式 bounds）
const currentSelectionInfo = computed(() => {
  return selectedPerformers.value.length > 0 ? selectedPerformers.value[0] : null
})

// 计算当前选中的 performer 实例
const currentSelection = computed(() => {
  const selected = performerStore.getSelectedPerformers()
  return selected.length > 0 ? selected[0] : null
})

// 将 performer bounds 转换为 SelectionItem（已应用缩放率的DOM坐标）
const selectionItem = computed<SelectionItem | null>(() => {
  if (!currentSelectionInfo.value || !currentSelection.value)
    return null

  // 当 currentTime 不在选中 performer 的时间范围内时，隐藏选框
  const performer = currentSelection.value
  const start = performer.start ?? 0
  const end = start + (performer.duration ?? 0)
  if (currentTime.value < start || currentTime.value >= end)
    return null

  const bounds = currentSelectionInfo.value.bounds
  const centerPosition = toCenterRotationPosition(bounds)

  const scaledX = centerPosition.x * scaleRatio.value
  const scaledY = centerPosition.y * scaleRatio.value
  const scaledWidth = bounds.width * scaleRatio.value
  const scaledHeight = bounds.height * scaleRatio.value

  return {
    id: currentSelection.value.id,
    x: scaledX,
    y: scaledY,
    width: scaledWidth,
    height: scaledHeight,
    rotation: bounds.rotation || 0,
    zIndex: currentSelection.value.zIndex ?? 1,
    visible: true,
    disabled: false,
  }
})

// Selection组件事件处理函数
function handleSelectionUpdate(item: SelectionItem) {
  const performer = currentSelection.value
  if (!performer)
    return

  if (isGestureTransactionStarting.value && !activeGestureTransactionId.value)
    return

  const canvasItem: BoundsLike = {
    x: item.x / scaleRatio.value,
    y: item.y / scaleRatio.value,
    width: item.width / scaleRatio.value,
    height: item.height / scaleRatio.value,
    rotation: item.rotation,
  }

  const topLeftBounds = toTopLeftRotationBounds(canvasItem)

  if (
    activeResizeDirection.value
    && isSideResizeDirection(activeResizeDirection.value)
    && isCroppablePerformer(performer)
  ) {
    performer.applySideCropResize({
      direction: activeResizeDirection.value,
      targetVisibleWidth: topLeftBounds.width,
      targetVisibleHeight: topLeftBounds.height,
    })

    const nextBounds = performer.getBaseBounds()
    if (Math.abs(topLeftBounds.x - nextBounds.x) > 1e-3 || Math.abs(topLeftBounds.y - nextBounds.y) > 1e-3) {
      performer.setPosition(topLeftBounds.x, topLeftBounds.y)
    }

    if (item.rotation !== undefined && Math.abs((nextBounds.rotation ?? 0) - item.rotation) > 1e-3) {
      performer.setRotation(item.rotation)
    }

    return
  }

  void editorCommandActions.performerUpdateTransform({
    performerId: performer.id,
    x: topLeftBounds.x,
    y: topLeftBounds.y,
    width: topLeftBounds.width,
    height: topLeftBounds.height,
    rotation: item.rotation,
  })
}

function handleSelectionResizeStart(_id: string, direction: ResizeDirection) {
  activeResizeDirection.value = direction
  beginGestureTransaction('Resize Performer')
}

function handleSelectionResizeEnd() {
  activeResizeDirection.value = null
  void endGestureTransaction('Resize Performer')
}

function handleSelectionDragStart() {
  beginGestureTransaction('Move Performer')
}

function handleSelectionDragEnd() {
  void endGestureTransaction('Move Performer')
}

function handleSelectionRotateStart() {
  beginGestureTransaction('Rotate Performer')
}

function handleSelectionRotateEnd() {
  void endGestureTransaction('Rotate Performer')
}

watch(currentSelection, (value) => {
  if (!value) {
    activeResizeDirection.value = null
    void cancelGestureTransaction()
  }
})

watch(selectionItem, (value) => {
  if (!value) {
    activeResizeDirection.value = null
    void cancelGestureTransaction()
  }
})

function handleSelectionSelect(id: string) {
  void editorCommandActions.performerSelect({ performerId: id })
}

function handleSelectionDelete(id: string) {
  void editorCommandActions.performerRemove({ performerId: id })
}

watch(
  [selectionItem, pendingSelectionDrag],
  async ([item, pending]) => {
    if (!item || !pending || pending.id !== item.id)
      return

    await nextTick()

    selectionRef.value?.startExternalDrag?.(pending.clientX, pending.clientY)
    performerStore.consumeSelectionDrag(pending.id)
  },
  { flush: 'post' },
)

onUnmounted(() => {
  void cancelGestureTransaction()
})
</script>

<template>
  <div
    absolute
    inset-0
    w-full
    h-full
    pointer-events-none
    z-1
  >
    <Selection
      v-if="selectionItem"
      ref="selectionRef"
      :item="selectionItem"
      :active="true"
      :custom-style="selectionCustomStyle"
      :min-width="20"
      :min-height="20"
      @update="handleSelectionUpdate"
      @drag-start="handleSelectionDragStart"
      @drag-end="handleSelectionDragEnd"
      @resize-start="handleSelectionResizeStart"
      @resize-end="handleSelectionResizeEnd"
      @rotate-start="handleSelectionRotateStart"
      @rotate-end="handleSelectionRotateEnd"
      @select="handleSelectionSelect"
      @delete="handleSelectionDelete"
    />
  </div>
</template>
