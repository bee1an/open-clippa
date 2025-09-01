<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import TimelineCmp from './timelineCmp.vue'

// 默认高度和限制
const DEFAULT_HEIGHT = 250
const MIN_HEIGHT = 100
const MAX_HEIGHT = 500

// 响应式数据
const timelineHeight = ref(DEFAULT_HEIGHT)
const isDragging = ref(false)
const dragStartY = ref(0)
const dragStartHeight = ref(0)

// 从localStorage恢复高度
function loadHeightFromStorage() {
  const savedHeight = localStorage.getItem('timelineHeight')
  if (savedHeight) {
    const height = Number.parseInt(savedHeight, 10)
    if (!Number.isNaN(height) && height >= MIN_HEIGHT && height <= MAX_HEIGHT) {
      timelineHeight.value = height
    }
  }
}

// 保存高度到localStorage
function saveHeightToStorage() {
  localStorage.setItem('timelineHeight', timelineHeight.value.toString())
}

// 开始拖动
function startDrag(e: MouseEvent) {
  isDragging.value = true
  dragStartY.value = e.clientY
  dragStartHeight.value = timelineHeight.value

  // 添加全局事件监听器
  document.addEventListener('mousemove', onDrag)
  document.addEventListener('mouseup', stopDrag)

  // 防止文本选择
  document.body.style.userSelect = 'none'
  document.body.style.cursor = 'ns-resize'

  // 阻止事件冒泡
  e.preventDefault()
}

// 拖动过程中
function onDrag(e: MouseEvent) {
  if (!isDragging.value)
    return

  const currentY = e.clientY
  const startY = dragStartY.value

  // 计算高度变化
  // 调整手柄在Timeline上方
  // 如果当前Y大于起始Y，说明鼠标向下移动，应该减少高度
  // 如果当前Y小于起始Y，说明鼠标向上移动，应该增加高度
  const deltaY = currentY - startY
  const newHeight = dragStartHeight.value - deltaY

  // 限制高度范围
  timelineHeight.value = Math.max(MIN_HEIGHT, Math.min(MAX_HEIGHT, newHeight))

  // 阻止事件冒泡
  e.preventDefault()
}

// 停止拖动
function stopDrag(e?: MouseEvent) {
  if (!isDragging.value)
    return

  isDragging.value = false

  // 移除全局事件监听器
  document.removeEventListener('mousemove', onDrag)
  document.removeEventListener('mouseup', stopDrag)

  // 恢复样式
  document.body.style.userSelect = ''
  document.body.style.cursor = ''

  // 保存高度
  saveHeightToStorage()

  // 阻止事件冒泡
  if (e) {
    e.preventDefault()
  }
}

// 组件挂载时
onMounted(() => {
  loadHeightFromStorage()
})

// 组件卸载时
onUnmounted(() => {
  // 清理事件监听器
  document.removeEventListener('mousemove', onDrag)
  document.removeEventListener('mouseup', stopDrag)
})
</script>

<template>
  <div w-full>
    <div
      h-10px
      bg="#333"
      cursor="ns-resize"
      flex="~ justify-center items-center"
      relative
      transition="~ background-color-200"
      hover:bg="#444"
      @mousedown="startDrag"
    >
      <div w-40px h-2px bg="#888" rounded-1px />
    </div>

    <div
      w-full
      overflow-hidden
      :style="{ height: `${timelineHeight}px` }"
    >
      <TimelineCmp />
    </div>
  </div>
</template>
