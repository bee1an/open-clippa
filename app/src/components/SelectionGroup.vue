<script setup lang="ts">
import type { CSSProperties } from 'vue'
import { storeToRefs } from 'pinia'
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { usePerformerStore } from '@/store/usePerformerStore'

// Props
interface Props {
  scaleRatio?: number
}

const { scaleRatio = 1 } = defineProps<Props>()

const performerStore = usePerformerStore()
const { getSelectedPerformers } = storeToRefs(performerStore)

// Selection DOM 引用
const selectionRef = ref<HTMLElement>()

// 拖拽状态
const isDragging = ref(false)
const dragStartPos = ref({ x: 0, y: 0 })
const selectionStartPos = ref({ x: 0, y: 0 })

function selectionToCanvasCoords(selectionX: number, selectionY: number) {
  return {
    x: selectionX,
    y: selectionY,
  }
}

// 计算当前选中的 performer (单选模式)
const currentSelection = computed(() => {
  const selected = getSelectedPerformers.value
  return selected.length > 0 ? selected[0] : null
})

// 计算选择框的样式
const selectionStyle = computed<CSSProperties>(() => {
  if (!currentSelection.value)
    return { display: 'none' }

  const bounds = currentSelection.value.getBounds()
  const { x, y, width, height, rotation = 0 } = bounds

  // 应用缩放率：将 Canvas 坐标转换为 DOM 坐标
  const scaledX = x * scaleRatio
  const scaledY = y * scaleRatio
  const scaledWidth = width * scaleRatio
  const scaledHeight = height * scaleRatio

  return {
    display: 'block',
    position: 'absolute',
    left: `${scaledX}px`,
    top: `${scaledY}px`,
    width: `${scaledWidth}px`,
    height: `${scaledHeight}px`,
    transform: `rotate(${rotation}deg)`,
    border: '2px solid #3b82f6',
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    cursor: isDragging.value ? 'grabbing' : 'grab',
    pointerEvents: 'auto',
    boxSizing: 'border-box' as const,
    zIndex: 1000,
  }
})

// 拖拽处理函数
function handleMouseDown(event: MouseEvent) {
  if (!currentSelection.value)
    return

  event.preventDefault()
  isDragging.value = true
  dragStartPos.value = { x: event.clientX, y: event.clientY }

  const bounds = currentSelection.value.getBounds()
  // 将 Canvas 坐标转换为 DOM 坐标作为拖拽起始位置
  const domX = bounds.x * scaleRatio
  const domY = bounds.y * scaleRatio
  selectionStartPos.value = { x: domX, y: domY }

  document.addEventListener('mousemove', handleMouseMove)
  document.addEventListener('mouseup', handleMouseUp)
}

function handleMouseMove(event: MouseEvent) {
  if (!isDragging.value || !currentSelection.value)
    return

  const deltaX = event.clientX - dragStartPos.value.x
  const deltaY = event.clientY - dragStartPos.value.y

  const newX = selectionStartPos.value.x + deltaX
  const newY = selectionStartPos.value.y + deltaY

  // 将 DOM 坐标转换为 Canvas 坐标
  const canvasX = newX / scaleRatio
  const canvasY = newY / scaleRatio
  const canvasCoords = selectionToCanvasCoords(canvasX, canvasY)

  const performer = performerStore.getAllPerformers.find(p => p.id === currentSelection.value?.id)
  if (performer) {
    performer.setPosition(canvasCoords.x, canvasCoords.y)
  }
}

function handleMouseUp() {
  isDragging.value = false
  document.removeEventListener('mousemove', handleMouseMove)
  document.removeEventListener('mouseup', handleMouseUp)
}

// 监听 selectedPerformers 变化
watch(() => currentSelection.value?.id, (newId, oldId) => {
  if (newId !== oldId) {
    // 选中状态改变时的处理
    nextTick(() => {
      if (currentSelection.value && selectionRef.value) {
        // 可以在这里添加选中的视觉反馈
      }
    })
  }
}, { immediate: true })

// 组件挂载时的初始化
onMounted(() => {
  // 可以在这里添加全局事件监听
})
</script>

<template>
  <div class="selection-group-container">
    <div
      v-if="currentSelection"
      ref="selectionRef"
      :style="selectionStyle"
      class="selection-box"
      @mousedown="handleMouseDown"
    >
      <!-- 调整大小的手柄 (预留扩展) -->
      <div class="resize-handle top-left" />
      <div class="resize-handle top-right" />
      <div class="resize-handle bottom-left" />
      <div class="resize-handle bottom-right" />

      <!-- 移动手柄 (中心) -->
      <div class="move-handle" />
    </div>
  </div>
</template>

<style scoped>
.selection-group-container {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
}

.selection-box {
  user-select: none;
  transition:
    border-color 0.2s ease,
    background-color 0.2s ease;
}

.selection-box:hover {
  border-color: #2563eb;
  background-color: rgba(37, 99, 235, 0.15);
}

.resize-handle {
  position: absolute;
  width: 8px;
  height: 8px;
  background: #3b82f6;
  border: 1px solid white;
  border-radius: 50%;
  opacity: 0;
  transition: opacity 0.2s ease;
}

.selection-box:hover .resize-handle {
  opacity: 1;
}

.resize-handle.top-left {
  top: -4px;
  left: -4px;
  cursor: nw-resize;
}

.resize-handle.top-right {
  top: -4px;
  right: -4px;
  cursor: ne-resize;
}

.resize-handle.bottom-left {
  bottom: -4px;
  left: -4px;
  cursor: sw-resize;
}

.resize-handle.bottom-right {
  bottom: -4px;
  right: -4px;
  cursor: se-resize;
}

.move-handle {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 12px;
  height: 12px;
  background: #3b82f6;
  border: 2px solid white;
  border-radius: 50%;
  opacity: 0;
  transition: opacity 0.2s ease;
  cursor: move;
}

.selection-box:hover .move-handle {
  opacity: 1;
}
</style>
