<script setup lang="ts">
import type { CSSProperties } from 'vue'
import type { ThemeName } from '../themes'
import type { ResizeDirection, SelectionItem } from '../types'
import { computed, onMounted, onUnmounted, ref, toRef } from 'vue'
import { useDrag } from '../composables/useDrag'
import { useResize } from '../composables/useResize'
import { getTheme, mergeTheme } from '../themes'

interface Props {
  /** 选框数据 */
  item: SelectionItem
  /** 主题名称 */
  theme?: ThemeName
  /** 自定义样式 */
  customStyle?: Partial<SelectionItem['style']>
  /** 最小宽度 */
  minWidth?: number
  /** 最小高度 */
  minHeight?: number
  /** 是否禁用拖拽 */
  disabled?: boolean
  /** 是否激活状态 */
  active?: boolean
}

interface Emits {
  /** 选框更新事件 */
  (event: 'update', item: SelectionItem): void
  /** 选框删除事件 */
  (event: 'delete', id: string): void
  /** 选框选中事件 */
  (event: 'select', id: string): void
  /** 选框失去焦点事件 */
  (event: 'blur', id: string): void
  /** 拖拽开始事件 */
  (event: 'dragStart', id: string, dragEvent: MouseEvent | TouchEvent): void
  /** 拖拽中事件 */
  (event: 'drag', id: string, item: SelectionItem): void
  /** 拖拽结束事件 */
  (event: 'dragEnd', id: string, dragEvent: MouseEvent | TouchEvent): void
  /** 调整大小开始事件 */
  (event: 'resizeStart', id: string, direction: ResizeDirection, resizeEvent: MouseEvent | TouchEvent): void
  /** 调整大小中事件 */
  (event: 'resize', id: string, direction: ResizeDirection, item: SelectionItem): void
  /** 调整大小结束事件 */
  (event: 'resizeEnd', id: string, resizeEvent: MouseEvent | TouchEvent): void
  /** 旋转开始事件 */
  (event: 'rotateStart', id: string, rotateEvent: MouseEvent | TouchEvent): void
  /** 旋转中事件 */
  (event: 'rotate', id: string, item: SelectionItem): void
  /** 旋转结束事件 */
  (event: 'rotateEnd', id: string, rotateEvent: MouseEvent | TouchEvent): void
  /** 鼠标进入事件 */
  (event: 'mouseEnter', id: string, mouseEvent: MouseEvent): void
  /** 鼠标离开事件 */
  (event: 'mouseLeave', id: string, mouseEvent: MouseEvent): void
}

const props = withDefaults(defineProps<Props>(), {
  theme: 'default',
  minWidth: 20,
  minHeight: 20,
  disabled: false,
  active: true,
})

const emit = defineEmits<Emits>()

const containerRef = ref<HTMLElement>()
const isRotating = ref(false)
const rotateStartAngle = ref(0)
const initialRotation = ref(0)

// 计算主题样式
const computedTheme = computed(() => {
  const baseTheme = getTheme(props.theme)
  return props.customStyle ? mergeTheme(baseTheme, props.customStyle) : baseTheme
})

const handleColor = computed(() => computedTheme.value.handleColor || '#d6d6dc')

const handleBackgroundColor = computed(() => {
  const customHandleBackground = computedTheme.value['--selection-handle-bg']
  if (typeof customHandleBackground === 'string')
    return customHandleBackground

  return '#1f2026'
})

// 容器样式
const containerStyle = computed(() => {
  const style = {
    position: 'absolute' as const,
    left: `${props.item.x}px`,
    top: `${props.item.y}px`,
    width: `${props.item.width}px`,
    height: `${props.item.height}px`,
    zIndex: props.item.zIndex,
    transform: `rotate(${props.item.rotation}deg)`,
    transformOrigin: 'center center',
    pointerEvents: props.disabled ? 'none' : 'auto',
    opacity: props.disabled ? 0.5 : 1,
    cursor: props.disabled ? 'not-allowed' : 'move',
    outline: 'none',
  }

  // 类型转换以满足 CSSProperties 要求
  return style as CSSProperties
})

// 选框样式
const boxStyle = computed(() => {
  const style = {
    width: '100%',
    height: '100%',
    border: computedTheme.value.border,
    background: computedTheme.value.background ?? 'transparent',
    boxSizing: 'border-box' as const,
    position: 'relative' as const,
    userSelect: 'none',
    borderRadius: computedTheme.value.borderRadius ?? '4px',
    boxShadow: computedTheme.value.boxShadow ?? '0 0 0 1px rgba(0, 0, 0, 0.35)',
  }

  // 类型转换以满足 CSSProperties 要求
  return style as CSSProperties
})

// 手柄样式
// Updated for square look as requested
const commonHandleStyle = computed(() => ({
  position: 'absolute' as const,
  backgroundColor: handleBackgroundColor.value,
  border: `1px solid ${handleColor.value}`,
  zIndex: 1,
  pointerEvents: 'auto' as const,
  boxShadow: '0 0 0 1px rgba(0, 0, 0, 0.65), 0 1px 2px rgba(0, 0, 0, 0.45)',
}))

function getHandleStyle(direction: ResizeDirection) {
  const size = computedTheme.value.handleSize || 10
  const common = commonHandleStyle.value

  if (direction.includes('-')) {
    // 顶点：保持方形
    return {
      ...common,
      width: `${size}px`,
      height: `${size}px`,
      borderRadius: '2px',
    }
  }

  // 非顶点：使用长方形
  const isVertical = direction === 'left' || direction === 'right'
  const longSide = Math.max(16, size * 2.5)
  const shortSide = Math.max(4, size * 0.6)

  return {
    ...common,
    width: `${isVertical ? shortSide : longSide}px`,
    height: `${isVertical ? longSide : shortSide}px`,
    borderRadius: '4px',
  }
}

// 旋转手柄样式
const rotateHandleStyle = computed(() => ({
  position: 'absolute' as const,
  top: '-36px',
  left: '50%',
  transform: 'translateX(-50%)',
  width: '22px',
  height: '22px',
  backgroundColor: handleBackgroundColor.value,
  border: `1px solid ${handleColor.value}`,
  borderRadius: '999px',
  cursor: 'grab',
  zIndex: 2,
  pointerEvents: 'auto' as const,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: handleColor.value,
  boxShadow: '0 0 0 1px rgba(0, 0, 0, 0.58), 0 2px 6px rgba(0, 0, 0, 0.45)',
}))

// 旋转连接线样式
const rotateLineStroke = computed(() => handleColor.value)

// 8个调整方向
const resizeDirections: ResizeDirection[] = [
  'top-left',
  'top-right',
  'bottom-left',
  'bottom-right',
  'top',
  'right',
  'bottom',
  'left',
]

// 拖拽功能
const { isDragging, startDrag, endDrag, updatePosition, cleanup: cleanupDrag } = useDrag(toRef(props, 'item'), {
  onStart: (event) => {
    if (props.disabled)
      return
    emit('dragStart', props.item.id, event)
    emit('select', props.item.id)
  },
  onEnd: (event) => {
    if (props.disabled)
      return
    emit('dragEnd', props.item.id, event)
    emit('update', { ...props.item })
  },
  onUpdate: (x, y) => {
    if (props.disabled)
      return
    const updatedItem = { ...props.item, x, y }
    emit('update', updatedItem)
  },
  useRAF: false, // 禁用 RAF 节流，允许实时更新
  throttleInterval: 0, // 禁用节流间隔
})

const shouldKeepAspectRatio = (direction: ResizeDirection): boolean => direction.includes('-')

// 调整大小功能
const { isResizing, startResize, endResize, updateSize, cleanup: cleanupResize } = useResize(toRef(props, 'item'), {
  minWidth: props.minWidth,
  minHeight: props.minHeight,
  keepAspectRatio: shouldKeepAspectRatio,
  onStart: (direction, event) => {
    if (props.disabled)
      return
    emit('resizeStart', props.item.id, direction, event)
    emit('select', props.item.id)
  },
  onEnd: (event) => {
    if (props.disabled)
      return
    emit('resizeEnd', props.item.id, event)
    emit('update', { ...props.item })
  },
  onUpdate: (x, y, width, height) => {
    if (props.disabled)
      return
    const updatedItem = { ...props.item, x, y, width, height }
    emit('update', updatedItem)
  },
  useRAF: false, // 禁用 RAF 节流，允许实时更新
  throttleInterval: 0, // 禁用节流间隔
})

function startExternalDrag(clientX: number, clientY: number) {
  if (props.disabled || isResizing.value || isDragging.value)
    return

  const event = new MouseEvent('mousedown', {
    clientX,
    clientY,
    button: 0,
  })

  startDrag(event)
}

defineExpose({
  startExternalDrag,
})

// 鼠标事件处理
function handleMouseDown(event: MouseEvent) {
  if (props.disabled || event.button !== 0)
    return
  startDrag(event)
}

function handleTouchStart(event: TouchEvent) {
  if (props.disabled)
    return
  const touch = event.touches[0]
  startDrag(touch as any)
}

// 调整大小事件处理
function handleResizeStart(direction: ResizeDirection, event: MouseEvent | TouchEvent) {
  if (props.disabled)
    return
  startResize(direction, event)
}

// 旋转功能处理
function handleRotateStart(event: MouseEvent | TouchEvent) {
  if (props.disabled)
    return

  isRotating.value = true
  initialRotation.value = props.item.rotation

  const rect = containerRef.value?.getBoundingClientRect()
  if (!rect)
    return

  const centerX = rect.left + rect.width / 2
  const centerY = rect.top + rect.height / 2

  let clientX: number, clientY: number
  if ('touches' in event) {
    clientX = event.touches[0].clientX
    clientY = event.touches[0].clientY
  }
  else {
    clientX = event.clientX
    clientY = event.clientY
  }

  // 计算开始时鼠标相对于选框中心的角度
  rotateStartAngle.value = Math.atan2(clientY - centerY, clientX - centerX) * 180 / Math.PI

  emit('select', props.item.id)
}

function updateRotation(clientX: number, clientY: number) {
  if (!isRotating.value || !containerRef.value)
    return

  const rect = containerRef.value.getBoundingClientRect()
  const centerX = rect.left + rect.width / 2
  const centerY = rect.top + rect.height / 2

  // 计算当前鼠标相对于选框中心的角度
  const currentAngle = Math.atan2(clientY - centerY, clientX - centerX) * 180 / Math.PI

  // 计算角度变化量
  let angleDelta = currentAngle - rotateStartAngle.value

  // 标准化角度变化量到 -180 到 180 度之间，防止跨越 ±180 度时的跳变
  if (angleDelta > 180) {
    angleDelta -= 360
  }
  else if (angleDelta < -180) {
    angleDelta += 360
  }

  // 更新旋转角度：初始角度 + 角度变化量
  let newRotation = initialRotation.value + angleDelta

  // 标准化角度到 0-360 度范围
  newRotation = ((newRotation % 360) + 360) % 360

  const updatedItem = { ...props.item, rotation: newRotation }
  emit('update', updatedItem)
}

function handleRotateEnd() {
  if (isRotating.value) {
    isRotating.value = false
    emit('update', { ...props.item })
  }
}

// 键盘事件处理
function handleKeyDown(event: KeyboardEvent) {
  if (props.disabled)
    return

  switch (event.key) {
    case 'Delete':
    case 'Backspace': {
      event.preventDefault()
      emit('delete', props.item.id)
      break
    }
    case 'ArrowUp': {
      event.preventDefault()
      const newY = props.item.y - (event.shiftKey ? 10 : 1)
      emit('update', { ...props.item, y: newY })
      break
    }
    case 'ArrowDown': {
      event.preventDefault()
      const newY2 = props.item.y + (event.shiftKey ? 10 : 1)
      emit('update', { ...props.item, y: newY2 })
      break
    }
    case 'ArrowLeft': {
      event.preventDefault()
      const newX = props.item.x - (event.shiftKey ? 10 : 1)
      emit('update', { ...props.item, x: newX })
      break
    }
    case 'ArrowRight': {
      event.preventDefault()
      const newX2 = props.item.x + (event.shiftKey ? 10 : 1)
      emit('update', { ...props.item, x: newX2 })
      break
    }
  }
}

// 全局事件监听
function handleMouseMove(event: MouseEvent) {
  if (isDragging.value) {
    updatePosition(event)
  }
  else if (isResizing.value) {
    updateSize(event)
  }
  else if (isRotating.value) {
    updateRotation(event.clientX, event.clientY)
  }
}

function handleTouchMove(event: TouchEvent) {
  if (event.touches.length > 0) {
    const touch = event.touches[0]
    if (isDragging.value) {
      updatePosition(touch as any)
    }
    else if (isResizing.value) {
      updateSize(touch as any)
    }
    else if (isRotating.value) {
      updateRotation(touch.clientX, touch.clientY)
    }
  }
}

function handleMouseUp(event: MouseEvent) {
  if (isDragging.value) {
    endDrag(event)
  }
  else if (isResizing.value) {
    endResize(event)
  }
  else if (isRotating.value) {
    handleRotateEnd()
  }
}

function handleTouchEnd(event: TouchEvent) {
  if (isDragging.value) {
    endDrag(event as any)
  }
  else if (isResizing.value) {
    endResize(event as any)
  }
  else if (isRotating.value) {
    handleRotateEnd()
  }
}

// 生命周期
onMounted(() => {
  document.addEventListener('mousemove', handleMouseMove)
  document.addEventListener('mouseup', handleMouseUp)
  document.addEventListener('touchmove', handleTouchMove, { passive: false })
  document.addEventListener('touchend', handleTouchEnd)
})

onUnmounted(() => {
  document.removeEventListener('mousemove', handleMouseMove)
  document.removeEventListener('mouseup', handleMouseUp)
  document.removeEventListener('touchmove', handleTouchMove)
  document.removeEventListener('touchend', handleTouchEnd)

  // 清理性能优化相关状态
  cleanupDrag()
  cleanupResize()
})
</script>

<template>
  <div
    ref="containerRef"
    class="selection-container"
    :style="containerStyle"
    tabindex="-1"
    @pointerdown.stop
    @mousedown.stop="handleMouseDown"
    @touchstart.stop="handleTouchStart"
    @keydown="handleKeyDown"
  >
    <!-- 选框主体 -->
    <div class="selection-box" :style="boxStyle">
      <!-- 旋转控件 (仅在选中状态下显示) -->
      <template v-if="props.active">
        <!-- 连接线 -->
        <div
          class="rotate-line"
          :style="{
            position: 'absolute',
            top: '-24px',
            left: '50%',
            height: '24px',
            width: '1px',
            backgroundColor: rotateLineStroke,
            transform: 'translateX(-50%)',
            zIndex: 1,
            pointerEvents: 'none',
          }"
        />

        <!-- 旋转手柄 -->
        <div
          class="rotate-handle"
          :style="rotateHandleStyle"
          @mousedown.stop="handleRotateStart($event)"
          @touchstart.stop="handleRotateStart($event)"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" :style="{ color: handleColor }">
            <path
              d="M21 12C21 16.9706 16.9706 21 12 21C9.696 21 7.59041 20.1375 5.99999 18.7M3 12C3 7.02944 7.02944 3 12 3C14.304 3 16.4096 3.8625 18 5.3M18 5.3V1M18 5.3H13.5M6 18.7V23M6 18.7H10.5"
              fill="none"
              stroke="currentColor"
              stroke-width="2.5"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
        </div>
      </template>

      <!-- 8个调整大小的手柄 (仅在选中状态下显示) -->
      <template v-for="direction in resizeDirections" :key="direction">
        <div
          v-if="props.active"
          :data-direction="direction"
          class="resize-handle" :class="[`resize-handle-${direction}`]"
          :style="getHandleStyle(direction)"
          @mousedown.stop="handleResizeStart(direction, $event)"
          @touchstart.stop="handleResizeStart(direction, $event)"
        />
      </template>
    </div>
  </div>
</template>

<style scoped>
.selection-container {
  transition: box-shadow 0.2s ease;
}

.selection-box {
  transition:
    background-color 0.2s ease,
    border-color 0.2s ease;
}

.resize-handle {
  transition: transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
  opacity: 1;
}

.resize-handle:hover {
  transform: translate(var(--tx, 0), var(--ty, 0)) scale(1.3) !important;
  z-index: 10 !important;
}

/* 8个方向的手柄位置 */
/* Use translate to center handle on the anchor point */
.resize-handle-top-left {
  top: 0;
  left: 0;
  --tx: -50%;
  --ty: -50%;
  transform: translate(-50%, -50%);
  cursor: nw-resize;
}

.resize-handle-top-right {
  top: 0;
  right: 0;
  --tx: 50%;
  --ty: -50%;
  transform: translate(50%, -50%);
  cursor: ne-resize;
}

.resize-handle-bottom-left {
  bottom: 0;
  left: 0;
  --tx: -50%;
  --ty: 50%;
  transform: translate(-50%, 50%);
  cursor: sw-resize;
}

.resize-handle-bottom-right {
  bottom: 0;
  right: 0;
  --tx: 50%;
  --ty: 50%;
  transform: translate(50%, 50%);
  cursor: se-resize;
}

.resize-handle-top {
  top: 0;
  left: 50%;
  --tx: -50%;
  --ty: -50%;
  transform: translate(-50%, -50%);
  cursor: n-resize;
}

.resize-handle-right {
  top: 50%;
  right: 0;
  --tx: 50%;
  --ty: -50%;
  transform: translate(50%, -50%);
  cursor: e-resize;
}

.resize-handle-bottom {
  bottom: 0;
  left: 50%;
  --tx: -50%;
  --ty: 50%;
  transform: translate(-50%, 50%);
  cursor: s-resize;
}

.resize-handle-left {
  top: 50%;
  left: 0;
  --tx: -50%;
  --ty: -50%;
  transform: translate(-50%, -50%);
  cursor: w-resize;
}

/* 旋转控件样式 */
.rotate-handle {
  transition:
    transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1),
    background-color 0.2s ease;
}

.rotate-handle:hover {
  transform: translateX(-50%) scale(1.15);
}

.rotate-handle:active {
  cursor: grabbing;
}

.rotate-line {
  opacity: 0.8;
}

/* 自定义CSS变量 */
.selection-container {
  --handle-size: 8px;
}
</style>
