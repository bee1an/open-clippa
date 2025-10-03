import type { Ref } from 'vue'
import type { DragState, SelectionItem } from '../types'
import { ref } from 'vue'

interface UseDragOptions {
  /** 拖拽开始回调 */
  onStart?: (event: MouseEvent | TouchEvent) => void
  /** 拖拽结束回调 */
  onEnd?: (event: MouseEvent | TouchEvent) => void
  /** 拖拽更新回调 */
  onUpdate?: (x: number, y: number) => void
  /** 边界限制 */
  boundary?: {
    minX?: number
    minY?: number
    maxX?: number
    maxY?: number
  }
  /** 节流间隔（毫秒），默认16ms (60fps） */
  throttleInterval?: number
  /** 是否启用requestAnimationFrame优化 */
  useRAF?: boolean
}

export function useDrag(
  item: Ref<SelectionItem> | SelectionItem,
  options: UseDragOptions = {},
): {
  isDragging: Ref<boolean>
  dragState: Ref<DragState>
  startDrag: (event: MouseEvent | TouchEvent) => void
  endDrag: (event: MouseEvent | TouchEvent) => void
  updatePosition: (event: MouseEvent | TouchEvent) => void
  setPosition: (x: number, y: number) => void
  resetPosition: () => void
  cleanup: () => void
} {
  const {
    onStart,
    onEnd,
    onUpdate,
    boundary,
    throttleInterval = 16,
    useRAF = true,
  } = options

  // 响应式拖拽状态
  const isDragging = ref(false)
  const dragState = ref<DragState>({
    isDragging: false,
    startX: 0,
    startY: 0,
    originalX: 0,
    originalY: 0,
  })

  // 性能优化相关状态
  let rafId: number | null = null
  let lastUpdateTime = 0
  let pendingUpdate = false

  // 获取当前item值（带错误处理）
  const getCurrentItem = (): SelectionItem => {
    try {
      const currentItem = 'value' in item ? item.value : item

      // 验证item的基本结构
      if (!currentItem || typeof currentItem !== 'object') {
        throw new Error('Invalid item: must be an object')
      }

      if (typeof currentItem.id !== 'string') {
        throw new TypeError('Invalid item: id must be a string')
      }

      if (typeof currentItem.x !== 'number' || typeof currentItem.y !== 'number') {
        throw new TypeError('Invalid item: x and y must be numbers')
      }

      if (typeof currentItem.width !== 'number' || typeof currentItem.height !== 'number') {
        throw new TypeError('Invalid item: width and height must be numbers')
      }

      return currentItem
    }
    catch (error) {
      console.error('[useDrag] Error getting current item:', error)
      // 返回一个默认的安全值
      return {
        id: 'fallback',
        x: 0,
        y: 0,
        width: 100,
        height: 100,
        rotation: 0,
        zIndex: 1,
      }
    }
  }

  // 安全的边界检查函数
  const safeGetBoundary = (): { minX: number, minY: number, maxX: number, maxY: number } | null => {
    if (!boundary)
      return null

    try {
      return {
        minX: Math.max(0, boundary.minX ?? 0),
        minY: Math.max(0, boundary.minY ?? 0),
        maxX: Math.min(Number.MAX_SAFE_INTEGER, boundary.maxX ?? Number.MAX_SAFE_INTEGER),
        maxY: Math.min(Number.MAX_SAFE_INTEGER, boundary.maxY ?? Number.MAX_SAFE_INTEGER),
      }
    }
    catch (error) {
      console.warn('[useDrag] Invalid boundary configuration:', error)
      return null
    }
  }

  // 开始拖拽（带错误处理）
  const startDrag = (event: MouseEvent | TouchEvent): void => {
    try {
      // 验证事件对象
      if (!event || typeof event !== 'object') {
        throw new Error('Invalid event object')
      }

      const currentItem = getCurrentItem()

      // 安全获取客户端坐标
      let clientX: number, clientY: number

      if ('touches' in event) {
        if (!event.touches || event.touches.length === 0) {
          throw new Error('Touch event has no touch points')
        }
        clientX = event.touches[0].clientX
        clientY = event.touches[0].clientY
      }
      else {
        clientX = event.clientX
        clientY = event.clientY
      }

      // 验证坐标值
      if (!Number.isFinite(clientX) || !Number.isFinite(clientY)) {
        throw new TypeError('Invalid client coordinates')
      }

      // 检查是否已禁用拖拽
      if (currentItem.disabled) {
        console.warn('[useDrag] Item is disabled, cannot start drag')
        return
      }

      dragState.value = {
        isDragging: true,
        startX: clientX,
        startY: clientY,
        originalX: currentItem.x,
        originalY: currentItem.y,
      }

      isDragging.value = true
      onStart?.(event)
    }
    catch (error) {
      console.error('[useDrag] Error starting drag:', error)
      // 确保状态正确重置
      isDragging.value = false
      dragState.value = {
        isDragging: false,
        startX: 0,
        startY: 0,
        originalX: 0,
        originalY: 0,
      }
    }
  }

  // 结束拖拽
  const endDrag = (event: MouseEvent | TouchEvent): void => {
    if (!isDragging.value)
      return

    // 清理性能优化状态
    if (rafId !== null) {
      cancelAnimationFrame(rafId)
      rafId = null
    }
    pendingUpdate = false

    dragState.value = {
      isDragging: false,
      startX: 0,
      startY: 0,
      originalX: 0,
      originalY: 0,
    }

    isDragging.value = false
    onEnd?.(event)
  }

  // 清理函数
  const cleanup = (): void => {
    if (rafId !== null) {
      cancelAnimationFrame(rafId)
      rafId = null
    }
    pendingUpdate = false
  }

  // 优化的更新位置函数
  const scheduleUpdate = (newX: number, newY: number): void => {
    if (rafId !== null) {
      return // 已有更新在队列中
    }

    if (useRAF) {
      rafId = requestAnimationFrame(() => {
        onUpdate?.(newX, newY)
        rafId = null
      })
    }
    else {
      // 使用简单的节流
      const now = Date.now()
      if (now - lastUpdateTime >= throttleInterval) {
        onUpdate?.(newX, newY)
        lastUpdateTime = now
      }
      else {
        pendingUpdate = true
        setTimeout(() => {
          if (pendingUpdate) {
            onUpdate?.(newX, newY)
            pendingUpdate = false
          }
        }, throttleInterval)
      }
    }
  }

  // 计算新位置（带边界检查和错误处理）
  const calculateNewPosition = (clientX: number, clientY: number): { x: number, y: number } => {
    try {
      // 验证输入坐标
      if (!Number.isFinite(clientX) || !Number.isFinite(clientY)) {
        throw new TypeError('Invalid client coordinates in calculateNewPosition')
      }

      const deltaX = clientX - dragState.value.startX
      const deltaY = clientY - dragState.value.startY

      let newX = dragState.value.originalX + deltaX
      let newY = dragState.value.originalY + deltaY

      // 获取安全的边界配置
      const safeBoundary = safeGetBoundary()
      if (safeBoundary) {
        const currentItem = getCurrentItem()

        // 应用边界限制，确保值在有效范围内
        newX = Math.max(safeBoundary.minX, newX)
        newY = Math.max(safeBoundary.minY, newY)

        // 最大边界要考虑元素尺寸
        const maxX = safeBoundary.maxX - currentItem.width
        const maxY = safeBoundary.maxY - currentItem.height

        newX = Math.min(maxX, newX)
        newY = Math.min(maxY, newY)

        // 确保结果仍然是有效数字
        newX = Number.isFinite(newX) ? newX : dragState.value.originalX
        newY = Number.isFinite(newY) ? newY : dragState.value.originalY
      }

      // 防止极值情况
      newX = Math.max(Number.MIN_SAFE_INTEGER, Math.min(Number.MAX_SAFE_INTEGER, newX))
      newY = Math.max(Number.MIN_SAFE_INTEGER, Math.min(Number.MAX_SAFE_INTEGER, newY))

      return { x: newX, y: newY }
    }
    catch (error) {
      console.error('[useDrag] Error calculating new position:', error)
      // 返回原始位置作为安全回退
      return {
        x: dragState.value.originalX,
        y: dragState.value.originalY,
      }
    }
  }

  // 更新位置（对外接口）
  const updatePosition = (event: MouseEvent | TouchEvent): void => {
    if (!isDragging.value)
      return

    const clientX = 'touches' in event ? event.touches[0].clientX : event.clientX
    const clientY = 'touches' in event ? event.touches[0].clientY : event.clientY

    const { x: newX, y: newY } = calculateNewPosition(clientX, clientY)
    scheduleUpdate(newX, newY)
  }

  // 设置位置（外部调用）
  const setPosition = (x: number, y: number): void => {
    onUpdate?.(x, y)
  }

  // 重置到原始位置
  const resetPosition = (): void => {
    const currentItem = getCurrentItem()
    setPosition(dragState.value.originalX || currentItem.x, dragState.value.originalY || currentItem.y)
  }

  return {
    isDragging,
    dragState,
    startDrag,
    endDrag,
    updatePosition,
    setPosition,
    resetPosition,
    cleanup,
  }
}
