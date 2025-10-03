import type { Ref } from 'vue'
import type { ResizeDirection, ResizeState, SelectionItem } from '../types'
import { ref } from 'vue'

interface UseResizeOptions {
  /** 最小宽度 */
  minWidth?: number
  /** 最小高度 */
  minHeight?: number
  /** 最大宽度 */
  maxWidth?: number
  /** 最大高度 */
  maxHeight?: number
  /** 调整开始回调 */
  onStart?: (direction: ResizeDirection, event: MouseEvent | TouchEvent) => void
  /** 调整结束回调 */
  onEnd?: (event: MouseEvent | TouchEvent) => void
  /** 调整更新回调 */
  onUpdate?: (x: number, y: number, width: number, height: number) => void
  /** 边界限制 */
  boundary?: {
    minX?: number
    minY?: number
    maxX?: number
    maxY?: number
  }
  /** 是否保持宽高比 */
  keepAspectRatio?: boolean
  /** 节流间隔（毫秒），默认16ms (60fps） */
  throttleInterval?: number
  /** 是否启用requestAnimationFrame优化 */
  useRAF?: boolean
}

export function useResize(
  item: Ref<SelectionItem> | SelectionItem,
  options: UseResizeOptions = {},
): {
  isResizing: Ref<boolean>
  resizeState: Ref<ResizeState>
  startResize: (direction: ResizeDirection, event: MouseEvent | TouchEvent) => void
  endResize: (event: MouseEvent | TouchEvent) => void
  updateSize: (event: MouseEvent | TouchEvent) => void
  setSize: (x: number, y: number, width: number, height: number) => void
  resetSize: () => void
  cleanup: () => void
} {
  const {
    minWidth = 20,
    minHeight = 20,
    maxWidth = Number.MAX_SAFE_INTEGER,
    maxHeight = Number.MAX_SAFE_INTEGER,
    onStart,
    onEnd,
    onUpdate,
    boundary,
    keepAspectRatio = false,
    throttleInterval = 16,
    useRAF = true,
  } = options

  // 响应式调整状态
  const isResizing = ref(false)
  const resizeState = ref<ResizeState>({
    isResizing: false,
    direction: null,
    startX: 0,
    startY: 0,
    originalX: 0,
    originalY: 0,
    originalWidth: 0,
    originalHeight: 0,
  })

  // 性能优化相关状态
  let rafId: number | null = null
  let lastUpdateTime = 0
  let pendingUpdate = false

  // 缓存三角函数计算结果
  const trigCache = new Map<number, { cos: number, sin: number }>()

  // 获取缓存的三角函数值
  const getCachedTrig = (rotation: number): { cos: number, sin: number } => {
    const normalizedRotation = Math.round(rotation * 100) / 100 // 保留两位小数

    if (!trigCache.has(normalizedRotation)) {
      const radians = (normalizedRotation * Math.PI) / 180
      trigCache.set(normalizedRotation, {
        cos: Math.cos(radians),
        sin: Math.sin(radians),
      })
    }

    return trigCache.get(normalizedRotation)!
  }

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

      // 验证尺寸的合理性
      if (currentItem.width <= 0 || currentItem.height <= 0) {
        return {
          ...currentItem,
          width: Math.max(20, currentItem.width),
          height: Math.max(20, currentItem.height),
        }
      }

      return currentItem
    }
    catch (_error) {
      console.error('[useResize] Error getting current item:', _error)
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

  // 安全的边界和尺寸限制检查 (not currently used in this component)
  const _safeGetConstraints = (): {
    minWidth: number
    minHeight: number
    maxWidth: number
    maxHeight: number
    boundary: {
      minX?: number
      minY?: number
      maxX?: number
      maxY?: number
    } | null
  } => {
    try {
      return {
        minWidth: Math.max(1, minWidth ?? 20),
        minHeight: Math.max(1, minHeight ?? 20),
        maxWidth: Math.max(minWidth ?? 20, maxWidth ?? Number.MAX_SAFE_INTEGER),
        maxHeight: Math.max(minHeight ?? 20, maxHeight ?? Number.MAX_SAFE_INTEGER),
        boundary: boundary
          ? {
              minX: Math.max(0, boundary.minX ?? 0),
              minY: Math.max(0, boundary.minY ?? 0),
              maxX: Math.min(Number.MAX_SAFE_INTEGER, boundary.maxX ?? Number.MAX_SAFE_INTEGER),
              maxY: Math.min(Number.MAX_SAFE_INTEGER, boundary.maxY ?? Number.MAX_SAFE_INTEGER),
            }
          : null,
      }
    }
    catch (_error) {
      console.warn('[useResize] Invalid constraints configuration:', _error)
      return {
        minWidth: 20,
        minHeight: 20,
        maxWidth: Number.MAX_SAFE_INTEGER,
        maxHeight: Number.MAX_SAFE_INTEGER,
        boundary: null,
      }
    }
  }

  // 开始调整大小（带错误处理）
  const startResize = (direction: ResizeDirection, event: MouseEvent | TouchEvent): void => {
    try {
      // 验证方向参数
      if (!direction || typeof direction !== 'string') {
        throw new Error('Invalid resize direction')
      }

      // 验证事件对象
      if (!event || typeof event !== 'object') {
        throw new Error('Invalid event object')
      }

      const currentItem = getCurrentItem()

      // 检查是否已禁用调整
      if (currentItem.disabled) {
        return
      }

      // 检查是否已锁定
      if (currentItem.locked) {
        return
      }

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

      resizeState.value = {
        isResizing: true,
        direction,
        startX: clientX,
        startY: clientY,
        originalX: currentItem.x,
        originalY: currentItem.y,
        originalWidth: currentItem.width,
        originalHeight: currentItem.height,
      }

      isResizing.value = true

      onStart?.(direction, event)
    }
    catch (_error) {
      console.error('[useResize] Error starting resize:', _error)
      // 确保状态正确重置
      isResizing.value = false
      resizeState.value = {
        isResizing: false,
        direction: null,
        startX: 0,
        startY: 0,
        originalX: 0,
        originalY: 0,
        originalWidth: 0,
        originalHeight: 0,
      }
    }
  }

  // 结束调整大小
  const endResize = (event: MouseEvent | TouchEvent): void => {
    if (!isResizing.value)
      return

    // 清理性能优化状态
    if (rafId !== null) {
      cancelAnimationFrame(rafId)
      rafId = null
    }
    pendingUpdate = false

    resizeState.value = {
      isResizing: false,
      direction: null,
      startX: 0,
      startY: 0,
      originalX: 0,
      originalY: 0,
      originalWidth: 0,
      originalHeight: 0,
    }

    isResizing.value = false
    onEnd?.(event)
  }

  // 清理函数
  const cleanup = (): void => {
    if (rafId !== null) {
      cancelAnimationFrame(rafId)
      rafId = null
    }
    pendingUpdate = false
    trigCache.clear()
  }

  // 计算新的大小和位置
  const calculateNewDimensions = (deltaX: number, deltaY: number): { x: number, y: number, width: number, height: number } => {
    const { direction, originalX, originalY, originalWidth, originalHeight } = resizeState.value
    const currentItem = getCurrentItem()
    const rotation = currentItem.rotation || 0

    let newX = originalX
    let newY = originalY
    let newWidth = originalWidth
    let newHeight = originalHeight

    // 如果有旋转角度，使用基于角点固定的逻辑
    if (rotation !== 0) {
      // 使用缓存的三角函数值
      const { cos, sin } = getCachedTrig(rotation)

      // 将鼠标移动向量转换到元素的本地坐标系
      // 这里使用正确的反变换公式
      const localDeltaX = deltaX * cos + deltaY * sin
      const localDeltaY = -deltaX * sin + deltaY * cos

      // Debug logging would happen here if debug flag is true

      // 计算四个角点的全局坐标（基于左上角旋转中心）
      // 左上角点 (TL) - 旋转中心，位置不变
      const tlX = originalX
      const tlY = originalY

      // 右上角点 (TR)
      const trX = originalX + originalWidth * cos
      const trY = originalY + originalWidth * sin

      // 右下角点 (BR)
      const brX = originalX + originalWidth * cos - originalHeight * sin
      const brY = originalY + originalWidth * sin + originalHeight * cos

      // 左下角点 (BL)
      const blX = originalX - originalHeight * sin
      const blY = originalY + originalHeight * cos

      // 根据拖拽方向计算新的尺寸和位置
      switch (direction) {
        case 'bottom-right':
          // 固定左上角点，只改变宽高，位置不变
          newWidth = Math.max(10, originalWidth + localDeltaX)
          newHeight = Math.max(10, originalHeight + localDeltaY)
          newX = tlX // 保持左上角不变
          newY = tlY
          break

        case 'top-left':
          // 固定右下角点，需要重新计算位置
          newWidth = Math.max(10, originalWidth - localDeltaX)
          newHeight = Math.max(10, originalHeight - localDeltaY)
          // 新的左上角位置 = 固定右下角位置 - 新的右上角向量 - 新的左下角向量
          newX = brX - newWidth * cos + newHeight * sin
          newY = brY - newWidth * sin - newHeight * cos
          break

        case 'top-right':
          // 固定左下角点
          newWidth = Math.max(10, originalWidth + localDeltaX)
          newHeight = Math.max(10, originalHeight - localDeltaY)
          // 新的左上角位置 = 固定左下角位置 - 新的左下角向量
          newX = blX - newHeight * sin
          newY = blY - newHeight * cos
          break

        case 'bottom-left':
          // 固定右上角点
          newWidth = Math.max(10, originalWidth - localDeltaX)
          newHeight = Math.max(10, originalHeight + deltaY)
          // 新的左上角位置 = 固定右上角位置 - 新的右上角向量
          newX = trX - newWidth * cos
          newY = trY - newWidth * sin
          break

        case 'right':
          // 固定左边线，只改变宽度，位置不变
          newWidth = Math.max(10, originalWidth + localDeltaX)
          newX = tlX // 保持左上角不变
          newY = tlY
          break

        case 'left':
          // 固定右边线
          newWidth = Math.max(10, originalWidth - localDeltaX)
          // 新的左上角位置 = 固定右上角位置 - 新的右上角向量
          newX = trX - newWidth * cos
          newY = trY - newWidth * sin
          break

        case 'bottom':
          // 固定上边线，只改变高度，位置不变
          newHeight = Math.max(10, originalHeight + localDeltaY)
          newX = tlX // 保持左上角不变
          newY = tlY
          break

        case 'top':
          // 固定下边线
          newHeight = Math.max(10, originalHeight - localDeltaY)
          // 新的左上角位置 = 固定左下角位置 - 新的左下角向量
          newX = blX - newHeight * sin
          newY = blY - newHeight * cos
          break
      }

      // Debug logging would happen here if debug flag is true
    }
    else {
      // 没有旋转时的正常逻辑
      switch (direction) {
        case 'top-left':
          newX = originalX + deltaX
          newY = originalY + deltaY
          newWidth = originalWidth - deltaX
          newHeight = originalHeight - deltaY
          break

        case 'top-right':
          newY = originalY + deltaY
          newWidth = originalWidth + deltaX
          newHeight = originalHeight - deltaY
          break

        case 'bottom-left':
          newX = originalX + deltaX
          newWidth = originalWidth - deltaX
          newHeight = originalHeight + deltaY
          break

        case 'bottom-right':
          newWidth = originalWidth + deltaX
          newHeight = originalHeight + deltaY
          break

        case 'top':
          newY = originalY + deltaY
          newHeight = originalHeight - deltaY
          break

        case 'right':
          newWidth = originalWidth + deltaX
          break

        case 'bottom':
          newHeight = originalHeight + deltaY
          break

        case 'left':
          newX = originalX + deltaX
          newWidth = originalWidth - deltaX
          break
      }
    }

    // 保持宽高比
    if (keepAspectRatio && originalWidth > 0 && originalHeight > 0) {
      const aspectRatio = originalWidth / originalHeight

      if (direction?.includes('left') || direction?.includes('right')) {
        // 以宽度为准
        newHeight = newWidth / aspectRatio
      }
      else {
        // 以高度为准
        newWidth = newHeight * aspectRatio
      }
    }

    return { x: newX, y: newY, width: newWidth, height: newHeight }
  }

  // 应用限制
  const applyConstraints = (dimensions: { x: number, y: number, width: number, height: number }): { x: number, y: number, width: number, height: number } => {
    let { x, y, width, height } = dimensions

    // 最小尺寸限制
    width = Math.max(minWidth, width)
    height = Math.max(minHeight, height)

    // 最大尺寸限制
    width = Math.min(maxWidth, width)
    height = Math.min(maxHeight, height)

    // 如果因为最小尺寸限制调整了宽度/高度，需要重新计算位置
    const { direction, originalX, originalY, originalWidth, originalHeight } = resizeState.value

    if (direction?.includes('left') && width !== dimensions.width) {
      x = originalX + originalWidth - width
    }

    if (direction?.includes('top') && height !== dimensions.height) {
      y = originalY + originalHeight - height
    }

    // 边界限制
    if (boundary) {
      x = Math.max(boundary.minX ?? 0, x)
      y = Math.max(boundary.minY ?? 0, y)

      if (boundary.maxX !== undefined) {
        const maxX = boundary.maxX - width
        x = Math.min(maxX, x)
      }

      if (boundary.maxY !== undefined) {
        const maxY = boundary.maxY - height
        y = Math.min(maxY, y)
      }
    }

    return { x, y, width, height }
  }

  // 优化的更新函数
  const scheduleUpdate = (x: number, y: number, width: number, height: number): void => {
    if (rafId !== null) {
      return // 已有更新在队列中
    }

    if (useRAF) {
      rafId = requestAnimationFrame(() => {
        onUpdate?.(x, y, width, height)
        rafId = null
      })
    }
    else {
      // 使用简单的节流
      const now = Date.now()
      if (now - lastUpdateTime >= throttleInterval) {
        onUpdate?.(x, y, width, height)
        lastUpdateTime = now
      }
      else {
        pendingUpdate = true
        setTimeout(() => {
          if (pendingUpdate) {
            onUpdate?.(x, y, width, height)
            pendingUpdate = false
          }
        }, throttleInterval)
      }
    }
  }

  // 更新大小
  const updateSize = (event: MouseEvent | TouchEvent): void => {
    if (!isResizing.value)
      return

    const clientX = 'touches' in event ? event.touches[0].clientX : event.clientX
    const clientY = 'touches' in event ? event.touches[0].clientY : event.clientY

    const deltaX = clientX - resizeState.value.startX
    const deltaY = clientY - resizeState.value.startY

    // 计算新尺寸
    const newDimensions = calculateNewDimensions(deltaX, deltaY)

    // 应用限制
    const constrainedDimensions = applyConstraints(newDimensions)

    scheduleUpdate(
      constrainedDimensions.x,
      constrainedDimensions.y,
      constrainedDimensions.width,
      constrainedDimensions.height,
    )
  }

  // 设置大小（外部调用）
  const setSize = (x: number, y: number, width: number, height: number): void => {
    const constrainedDimensions = applyConstraints({ x, y, width, height })
    onUpdate?.(
      constrainedDimensions.x,
      constrainedDimensions.y,
      constrainedDimensions.width,
      constrainedDimensions.height,
    )
  }

  // 重置到原始大小
  const resetSize = (): void => {
    const { originalX, originalY, originalWidth, originalHeight } = resizeState.value
    setSize(originalX, originalY, originalWidth, originalHeight)
  }

  return {
    isResizing,
    resizeState,
    startResize,
    endResize,
    updateSize,
    setSize,
    resetSize,
    cleanup,
  }
}
