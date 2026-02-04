<script setup lang="ts">
import type { ResizeDirection, SelectionItem } from '@clippa/selection'
import { Selection } from '@clippa/selection'
import { storeToRefs } from 'pinia'
import { computed, nextTick, ref, watch } from 'vue'
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
type SelectionExpose = {
  startExternalDrag?: (clientX: number, clientY: number) => void
}

const { selectedPerformers, pendingSelectionDrag } = storeToRefs(performerStore)
const selectionRef = ref<SelectionExpose | null>(null)

type BoundsLike = {
  x: number
  y: number
  width: number
  height: number
  rotation?: number
}

const rotateVector = (x: number, y: number, rotation: number): { x: number, y: number } => {
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

const toCenterRotationPosition = (bounds: BoundsLike): { x: number, y: number } => {
  const rotation = bounds.rotation ?? 0
  const offset = rotateVector(bounds.width / 2, bounds.height / 2, rotation)
  const centerX = bounds.x + offset.x
  const centerY = bounds.y + offset.y

  return {
    x: centerX - bounds.width / 2,
    y: centerY - bounds.height / 2,
  }
}

const toTopLeftRotationBounds = (item: BoundsLike): BoundsLike => {
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
  if (!currentSelection.value)
    return

  const canvasItem: BoundsLike = {
    x: item.x / scaleRatio.value,
    y: item.y / scaleRatio.value,
    width: item.width / scaleRatio.value,
    height: item.height / scaleRatio.value,
    rotation: item.rotation,
  }

  const topLeftBounds = toTopLeftRotationBounds(canvasItem)

  // 更新 performer 属性
  const performer = performerStore.getAllPerformers().find(p => p.id === currentSelection.value?.id)
  if (performer) {
    const currentBounds = performer.getBounds()
    const currentScaleX = performer.sprite?.scale.x ?? 1
    const currentScaleY = performer.sprite?.scale.y ?? 1

    const widthRatio = currentBounds.width ? topLeftBounds.width / currentBounds.width : 1
    const heightRatio = currentBounds.height ? topLeftBounds.height / currentBounds.height : 1

    if (currentBounds.width && currentBounds.height && (Math.abs(widthRatio - 1) > 1e-3 || Math.abs(heightRatio - 1) > 1e-3)) {
      performer.setScale(currentScaleX * widthRatio, currentScaleY * heightRatio)
    }

    if (topLeftBounds.x !== currentBounds.x || topLeftBounds.y !== currentBounds.y) {
      performer.setPosition(topLeftBounds.x, topLeftBounds.y)
    }

    // 更新旋转
    if (item.rotation !== undefined) {
      performer.setRotation(item.rotation)
    }
  }
}

function handleSelectionResize(_id: string, _direction: ResizeDirection, item: SelectionItem) {
  // resizing 过程中也会触发 update 事件，这里只需要转发给统一的处理函数
  // 或者如果 Selection.vue 在 resize 过程中不仅 emit resize 还 emit update，
  // 那么这里其实可以留空，或者为了实时响应性 specifically handle it.
  // Selection.vue's useResize emits 'update' onEnd.
  // During resize (onUpdate), it emits 'resize' AND 'update'.
  // So handleSelectionUpdate is sufficient for both realtime and final updates.
  handleSelectionUpdate(item)
}

function handleSelectionSelect(id: string) {
  performerStore.selectPerformer(id)
}

function handleSelectionDelete(id: string) {
  performerStore.removePerformer(id)
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
      :min-width="20"
      :min-height="20"
      @update="handleSelectionUpdate"
      @resize="handleSelectionResize"
      @select="handleSelectionSelect"
      @delete="handleSelectionDelete"
    />
  </div>
</template>
