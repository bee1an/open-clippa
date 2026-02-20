<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { useLayoutStore } from '@/store/useLayoutStore'

// 默认高度和限制
const DEFAULT_HEIGHT = 162
const MIN_HEIGHT = 100
const MAX_HEIGHT = 500

const layoutStore = useLayoutStore()
const { timelineHidden } = storeToRefs(layoutStore)

// 使用VueUse的useStorage来管理高度状态
const timelineHeight = useStorage('timelineHeight', DEFAULT_HEIGHT)

// 拖动状态
const isDragging = ref(false)
const dragStartY = ref(0)
const dragStartHeight = ref(0)

const resizeHandleStyle = computed(() => {
  return {
    height: timelineHidden.value ? '0px' : '6px',
    opacity: timelineHidden.value ? 0 : 1,
  }
})
const timelineBodyStyle = computed(() => {
  return {
    height: timelineHidden.value ? '0px' : `${timelineHeight.value}px`,
    opacity: timelineHidden.value ? 0 : 1,
  }
})
const resizeHandleClass = computed(() => {
  return isDragging.value
    ? 'hover:bg-muted/50 overflow-hidden'
    : 'hover:bg-muted/50 transition-all duration-300 ease-[cubic-bezier(0.25,1,0.5,1)] overflow-hidden'
})
const timelineBodyClass = computed(() => {
  return isDragging.value
    ? ''
    : 'transition-all duration-300 ease-[cubic-bezier(0.25,1,0.5,1)]'
})

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
  <div
    class="flex flex-col z-10 mx-4 mb-4 rounded-2xl border border-border shadow-sm bg-background-elevated overflow-hidden isolate"
  >
    <!-- Resize Handle -->
    <div
      h-1.5 w-full cursor-row-resize flex items-center justify-center group relative z-20 bg-background-elevated transition-colors
      :class="[resizeHandleClass, timelineHidden ? 'pointer-events-none' : '']"
      :style="resizeHandleStyle"
      @mousedown="startDrag"
    >
      <!-- Visual cue for dragging -->
      <div
        w-12 h-1 rounded-full bg="border/50"
        class="group-hover:bg-primary/50 transition-colors"
      />
    </div>

    <Transition name="timeline-controls" mode="out-in">
      <PlaybackControls :key="timelineHidden ? 'compact' : 'full'" :compact="timelineHidden" border-t border="border/50" />
    </Transition>

    <div
      w-full
      overflow-hidden
      bg-background-elevated
      :class="[timelineBodyClass, timelineHidden ? 'pointer-events-none' : '']"
      :style="timelineBodyStyle"
    >
      <TimelineWrapper />
    </div>
  </div>
</template>

<style scoped>
.timeline-controls-enter-active,
.timeline-controls-leave-active {
  transition:
    opacity 180ms ease,
    transform 180ms ease;
}

.timeline-controls-enter-from,
.timeline-controls-leave-to {
  opacity: 0;
  transform: translateY(4px);
}
</style>
