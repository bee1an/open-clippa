import type { ComputedRef, Ref } from 'vue'
import type { DragState, ResizeDirection, ResizeState, SelectionItem } from '../types'
import { computed } from 'vue'
import { useDrag } from './useDrag'
import { useResize } from './useResize'

export interface UseSelectionOptions {
  /** 拖拽配置 */
  drag?: {
    /** 边界限制 */
    boundary?: {
      minX?: number
      minY?: number
      maxX?: number
      maxY?: number
    }
    /** 拖拽开始回调 */
    onStart?: (event: MouseEvent | TouchEvent) => void
    /** 拖拽结束回调 */
    onEnd?: (event: MouseEvent | TouchEvent) => void
    /** 拖拽更新回调 */
    onUpdate?: (x: number, y: number) => void
    /** 节流间隔（毫秒） */
    throttleInterval?: number
    /** 是否启用requestAnimationFrame优化 */
    useRAF?: boolean
  }
  /** 调整大小配置 */
  resize?: {
    /** 最小宽度 */
    minWidth?: number
    /** 最小高度 */
    minHeight?: number
    /** 最大宽度 */
    maxWidth?: number
    /** 最大高度 */
    maxHeight?: number
    /** 边界限制 */
    boundary?: {
      minX?: number
      minY?: number
      maxX?: number
      maxY?: number
    }
    /** 是否保持宽高比 */
    keepAspectRatio?: boolean
    /** 调整开始回调 */
    onStart?: (direction: string, event: MouseEvent | TouchEvent) => void
    /** 调整结束回调 */
    onEnd?: (event: MouseEvent | TouchEvent) => void
    /** 调整更新回调 */
    onUpdate?: (x: number, y: number, width: number, height: number) => void
    /** 节流间隔（毫秒） */
    throttleInterval?: number
    /** 是否启用requestAnimationFrame优化 */
    useRAF?: boolean
    /** 是否启用调试模式 */
    _debug?: boolean
  }
  /** 通用事件回调 */
  on?: {
    /** 选择开始回调（拖拽或调整大小） */
    onStart?: (type: 'drag' | 'resize', event: MouseEvent | TouchEvent) => void
    /** 选择结束回调（拖拽或调整大小） */
    onEnd?: (type: 'drag' | 'resize', event: MouseEvent | TouchEvent) => void
    /** 选择更新回调 */
    onUpdate?: (
      data: { x: number, y: number } | { x: number, y: number, width: number, height: number },
      type: 'drag' | 'resize',
    ) => void
  }
}

/**
 * 统一的选择框交互 composable
 * 提供拖拽和调整大小的完整功能
 */
export function useSelection(
  item: Ref<SelectionItem> | SelectionItem,
  options: UseSelectionOptions = {},
): {
  // 状态
  isDragging: Ref<boolean>
  isResizing: Ref<boolean>
  isInteracting: ComputedRef<boolean>
  interactionType: ComputedRef<'drag' | 'resize' | null>
  dragState: Ref<DragState>
  resizeState: Ref<ResizeState>

  // 拖拽方法
  startDrag: (event: MouseEvent | TouchEvent) => void
  endDrag: (event: MouseEvent | TouchEvent) => void
  updatePosition: (event: MouseEvent | TouchEvent) => void
  setPosition: (x: number, y: number) => void

  // 调整大小方法
  startResize: (direction: ResizeDirection, event: MouseEvent | TouchEvent) => void
  endResize: (event: MouseEvent | TouchEvent) => void
  updateSize: (event: MouseEvent | TouchEvent) => void
  setSize: (x: number, y: number, width: number, height: number) => void

  // 统一方法
  cleanup: () => void
  reset: () => void
} {
  const { drag, resize, on } = options

  // 拖拽功能
  const dragApi = useDrag(item, {
    boundary: drag?.boundary,
    onStart: (event) => {
      drag?.onStart?.(event)
      on?.onStart?.('drag', event)
    },
    onEnd: (event) => {
      drag?.onEnd?.(event)
      on?.onEnd?.('drag', event)
    },
    onUpdate: (x, y) => {
      drag?.onUpdate?.(x, y)
      on?.onUpdate?.({ x, y }, 'drag')
    },
    throttleInterval: drag?.throttleInterval,
    useRAF: drag?.useRAF,
  })

  // 调整大小功能
  const resizeApi = useResize(item, {
    minWidth: resize?.minWidth,
    minHeight: resize?.minHeight,
    maxWidth: resize?.maxWidth,
    maxHeight: resize?.maxHeight,
    boundary: resize?.boundary,
    keepAspectRatio: resize?.keepAspectRatio,
    onStart: (direction, event) => {
      resize?.onStart?.(direction, event)
      on?.onStart?.('resize', event)
    },
    onEnd: (event) => {
      resize?.onEnd?.(event)
      on?.onEnd?.('resize', event)
    },
    onUpdate: (x, y, width, height) => {
      resize?.onUpdate?.(x, y, width, height)
      on?.onUpdate?.({ x, y, width, height }, 'resize')
    },
    throttleInterval: resize?.throttleInterval,
    useRAF: resize?.useRAF,
    ...resize,
    _debug: resize?._debug,
  })

  // 组合状态
  const isInteracting = computed<boolean>(() =>
    dragApi.isDragging.value || resizeApi.isResizing.value,
  )

  const interactionType = computed<'drag' | 'resize' | null>(() => {
    if (dragApi.isDragging.value)
      return 'drag'
    if (resizeApi.isResizing.value)
      return 'resize'
    return null
  })

  // 统一的清理函数
  const cleanup = (): void => {
    dragApi.cleanup()
    resizeApi.cleanup()
  }

  // 统一的重置函数
  const reset = (): void => {
    dragApi.resetPosition()
    resizeApi.resetSize()
  }

  return {
    // 状态
    isDragging: dragApi.isDragging,
    isResizing: resizeApi.isResizing,
    isInteracting,
    interactionType,
    dragState: dragApi.dragState,
    resizeState: resizeApi.resizeState,

    // 拖拽方法
    startDrag: dragApi.startDrag,
    endDrag: dragApi.endDrag,
    updatePosition: dragApi.updatePosition,
    setPosition: dragApi.setPosition,

    // 调整大小方法
    startResize: resizeApi.startResize,
    endResize: resizeApi.endResize,
    updateSize: resizeApi.updateSize,
    setSize: resizeApi.setSize,

    // 统一方法
    cleanup,
    reset,
  }
}
