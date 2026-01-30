<script setup lang="ts">
// 默认高度和限制
const DEFAULT_HEIGHT = 250
const MIN_HEIGHT = 100
const MAX_HEIGHT = 500

// 使用VueUse的useStorage来管理高度状态
const timelineHeight = useStorage('timelineHeight', DEFAULT_HEIGHT)

// 拖动状态
const isDragging = ref(false)
const dragStartY = ref(0)
const dragStartHeight = ref(0)

// 开始拖动
function startDrag(e: MouseEvent) {
  isDragging.value = true
  dragStartY.value = e.clientY
  dragStartHeight.value = timelineHeight.value

  // 使用VueUse的事件监听器，自动管理事件绑定和解绑
  const removeMouseMoveListener = useEventListener(document, 'mousemove', onDrag)
  const removeMouseUpListener = useEventListener(document, 'mouseup', (event: MouseEvent) => {
    stopDrag(event)
    // 移除事件监听器
    removeMouseMoveListener()
    removeMouseUpListener()
  })

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

  // 阻止事件冒泡
  if (e) {
    e.preventDefault()
  }
}

// 组件挂载时
onMounted(() => {
  // 使用VueUse的useStorage已经自动处理了存储的加载
  // 但我们仍然需要确保高度在有效范围内
  const height = timelineHeight.value
  if (height < MIN_HEIGHT || height > MAX_HEIGHT) {
    timelineHeight.value = DEFAULT_HEIGHT
  }
})
</script>

<template>
  <div w-full class="flex flex-col">
    <!-- Resize Handle -->
    <div
      h-1.5
      bg-zinc-800
      cursor-row-resize
      w-full
      transition="colors duration-200"
      hover:bg-blue-600
      border-t border-zinc-700
      flex items-center justify-center
      class="group relative z-20"
      @mousedown="startDrag"
    >
      <!-- Visual cue for dragging -->
      <div class="w-12 h-1 rounded-full bg-zinc-600 opacity-50 group-hover:opacity-100 transition-opacity absolute top-0.5" />
    </div>

    <PlaybackControls />

    <div
      w-full
      overflow-hidden
      class="bg-zinc-900 border-t border-zinc-800"
      :style="{ height: `${timelineHeight}px` }"
    >
      <TimelineWrapper />
    </div>
  </div>
</template>
