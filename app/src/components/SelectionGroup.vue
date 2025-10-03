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
const { getSelectedPerformers } = storeToRefs(performerStore)

// 计算当前选中的 performer (单选模式)
const currentSelection = computed(() => {
  const selected = getSelectedPerformers.value
  return selected.length > 0 ? selected[0] : null
})

// 将 performer bounds 转换为 SelectionItem（已应用缩放率的DOM坐标）
const selectionItem = computed<SelectionItem | null>(() => {
  if (!currentSelection.value)
    return null

  const bounds = currentSelection.value.getBounds()

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
    zIndex: currentSelection.value.zIndex || 1,
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

  // 更新 performer 位置
  const performer = performerStore.getAllPerformers.find(p => p.id === currentSelection.value?.id)
  if (performer) {
    performer.setPosition(canvasX, canvasY)
  }
}

function handleSelectionResize(id: string, direction: ResizeDirection, item: SelectionItem) {
  if (!currentSelection.value)
    return

  // 将 DOM 坐标转换回 Canvas 坐标
  const canvasX = item.x / scaleRatio
  const canvasY = item.y / scaleRatio
  const canvasWidth = item.width / scaleRatio
  const canvasHeight = item.height / scaleRatio

  // 更新 performer 位置和尺寸
  const performer = performerStore.getAllPerformers.find(p => p.id === currentSelection.value?.id)
  if (performer) {
    performer.setPosition(canvasX, canvasY)
    performer.setScale(canvasWidth / performer.getBounds().width, canvasHeight / performer.getBounds().height)
  }
}

function handleSelectionSelect(id: string) {
  performerStore.selectPerformer(id)
}

function handleSelectionDelete(id: string) {
  performerStore.removePerformer(id)
}
</script>

<template>
  <div class="selection-group-container">
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

<style scoped>
.selection-group-container {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
}
</style>
