<script setup lang="ts">
import type { CSSProperties } from 'vue'
import type { ThemeName } from '../themes'
import type { ResizeDirection, SelectionItem } from '../types'
import { computed, onMounted, onUnmounted, ref } from 'vue'
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
    transformOrigin: 'top left',
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
    background: 'transparent',
    boxSizing: 'border-box' as const,
    position: 'relative' as const,
    userSelect: 'none',
  }

  // 类型转换以满足 CSSProperties 要求
  return style as CSSProperties
})

// 手柄样式
const handleStyle = computed(() => ({
  position: 'absolute' as const,
  width: `${computedTheme.value.handleSize}px`,
  height: `${computedTheme.value.handleSize}px`,
  backgroundColor: computedTheme.value.handleColor,
  border: '1px solid #fff',
  borderRadius: '2px',
  zIndex: 1,
  pointerEvents: 'auto' as const,
}))

// 旋转手柄样式
const rotateHandleStyle = computed(() => ({
  position: 'absolute' as const,
  top: '-30px',
  left: '50%',
  transform: 'translateX(-50%)',
  width: '20px',
  height: '20px',
  backgroundColor: computedTheme.value.handleColor,
  border: '2px solid #fff',
  borderRadius: '50%',
  cursor: 'grab',
  zIndex: 2,
  pointerEvents: 'auto' as const,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
}))

// 旋转连接线样式
const rotateLineStroke = computed(() => computedTheme.value.handleColor)

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
const { isDragging, startDrag, endDrag, updatePosition, cleanup: cleanupDrag } = useDrag(props.item, {
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
  useRAF: true, // 启用性能优化
  throttleInterval: 16, // 60fps
})

// 调整大小功能
const { isResizing, startResize, endResize, updateSize, cleanup: cleanupResize } = useResize(props.item, {
  minWidth: props.minWidth,
  minHeight: props.minHeight,
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
  useRAF: true, // 启用性能优化
  throttleInterval: 16, // 60fps
  _debug: false, // 调试模式，生产环境应设为false
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
  const angleDelta = currentAngle - rotateStartAngle.value

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
    @mousedown="handleMouseDown"
    @touchstart="handleTouchStart"
    @keydown="handleKeyDown"
  >
    <!-- 选框主体 -->
    <div class="selection-box" :style="boxStyle">
      <!-- 旋转控件 (仅在选中状态下显示) -->
      <template v-if="props.active">
        <!-- 连接线 -->
        <svg
          class="rotate-line"
          :style="{
            position: 'absolute',
            top: '0',
            left: '50%',
            transform: 'translateX(-50%)',
            width: '1px',
            height: '30px',
            zIndex: 1,
            pointerEvents: 'none',
          }"
        >
          <line
            x1="0.5"
            y1="0"
            x2="0.5"
            y2="30"
            :stroke="rotateLineStroke"
            stroke-width="1"
          />
        </svg>

        <!-- 旋转手柄 -->
        <div
          class="rotate-handle"
          :style="rotateHandleStyle"
          @mousedown.stop="handleRotateStart($event)"
          @touchstart.stop="handleRotateStart($event)"
        >
          <svg width="12" height="12" viewBox="0 0 12 12">
            <path
              d="M6 1.5L6 6M6 6L9.5 2.5M6 6L2.5 2.5"
              stroke="white"
              stroke-width="1.5"
              stroke-linecap="round"
              stroke-linejoin="round"
              fill="none"
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
          :style="handleStyle"
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
  transition: transform 0.2s ease;
  opacity: 1;
}

.resize-handle:hover {
  transform: scale(1.2);
}

/* 8个方向的手柄位置 */
.resize-handle-top-left {
  top: calc(-1 * var(--handle-size) / 2);
  left: calc(-1 * var(--handle-size) / 2);
  cursor: nw-resize;
}

.resize-handle-top-right {
  top: calc(-1 * var(--handle-size) / 2);
  right: calc(-1 * var(--handle-size) / 2);
  cursor: ne-resize;
}

.resize-handle-bottom-left {
  bottom: calc(-1 * var(--handle-size) / 2);
  left: calc(-1 * var(--handle-size) / 2);
  cursor: sw-resize;
}

.resize-handle-bottom-right {
  bottom: calc(-1 * var(--handle-size) / 2);
  right: calc(-1 * var(--handle-size) / 2);
  cursor: se-resize;
}

.resize-handle-top {
  top: calc(-1 * var(--handle-size) / 2);
  left: 50%;
  transform: translateX(-50%);
  cursor: n-resize;
}

.resize-handle-top:hover {
  transform: translateX(-50%) scale(1.2);
}

.resize-handle-right {
  top: 50%;
  right: calc(-1 * var(--handle-size) / 2);
  transform: translateY(-50%);
  cursor: e-resize;
}

.resize-handle-right:hover {
  transform: translateY(-50%) scale(1.2);
}

.resize-handle-bottom {
  bottom: calc(-1 * var(--handle-size) / 2);
  left: 50%;
  transform: translateX(-50%);
  cursor: s-resize;
}

.resize-handle-bottom:hover {
  transform: translateX(-50%) scale(1.2);
}

.resize-handle-left {
  top: 50%;
  left: calc(-1 * var(--handle-size) / 2);
  transform: translateY(-50%);
  cursor: w-resize;
}

.resize-handle-left:hover {
  transform: translateY(-50%) scale(1.2);
}

/* 旋转控件样式 */
.rotate-handle {
  transition:
    transform 0.2s ease,
    background-color 0.2s ease;
}

.rotate-handle:hover {
  transform: translateX(-50%) scale(1.1);
  background-color: var(--handle-color, #3b82f6) !important;
}

.rotate-handle:active {
  cursor: 'grabbing';
}

.rotate-line {
  opacity: 0.8;
}

/* 自定义CSS变量 */
.selection-container {
  --handle-size: 8px;
  --handle-color: #3b82f6;
}
</style>
