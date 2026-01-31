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
  <div w-full flex flex-col bg-background-elevated border-t border-border z-10>
    <!-- Resize Handle -->
    <div
      h-1 w-full cursor-row-resize flex items-center justify-center group relative z-20 bg-background class="hover:bg-primary/10" transition-colors
      @mousedown="startDrag"
    >
      <!-- Visual cue for dragging -->
      <div
        w-8 h-0.5 rounded-full bg-border class="group-hover:bg-primary/50 transition-colors"
      />
    </div>

    <PlaybackControls />

    <div
      w-full
      overflow-hidden
      bg-background-elevated
      :style="{ height: `${timelineHeight}px` }"
    >
      <TimelineWrapper />
    </div>
  </div>
</template>
