<script setup lang="ts">
import type { ResizeDirection, SelectionItem } from '@clippa/selection'
import { Selection } from '@clippa/selection'
import { storeToRefs } from 'pinia'
import { computed } from 'vue'
import { usePerformerStore } from '@/store/usePerformerStore'

// Props
interface Props {
  scaleRatio?: number
}

const { scaleRatio = 1 } = defineProps<Props>()

const performerStore = usePerformerStore()
const { selectedPerformers } = storeToRefs(performerStore)

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

  // 使用响应式 bounds 信息，而不是直接调用 getBounds()
  const bounds = currentSelectionInfo.value.bounds

  // 应用缩放率：将 Canvas 坐标转换为 DOM 坐标
  const scaledX = bounds.x * scaleRatio
  const scaledY = bounds.y * scaleRatio
  const scaledWidth = bounds.width * scaleRatio
  const scaledHeight = bounds.height * scaleRatio

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

  // 将 DOM 坐标转换回 Canvas 坐标
  const canvasX = item.x / scaleRatio
  const canvasY = item.y / scaleRatio
  const canvasWidth = item.width / scaleRatio
  const canvasHeight = item.height / scaleRatio

  // 更新 performer 属性
  const performer = performerStore.getAllPerformers().find(p => p.id === currentSelection.value?.id)
  if (performer) {
    const currentBounds = performer.getBounds()

    // 更新位置
    performer.setPosition(canvasX, canvasY)

    // 更新尺寸（通过缩放）
    if (canvasWidth !== currentBounds.width || canvasHeight !== currentBounds.height) {
      performer.setScale(
        canvasWidth / currentBounds.width,
        canvasHeight / currentBounds.height
      )
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
