export function useDragDrop() {
  const isDragging: Ref<boolean> = ref(false)
  let dragCounter = 0

  /**
   * 处理拖拽进入事件
   */
  function onDragEnter(event: DragEvent) {
    event.preventDefault()
    event.stopPropagation()
    dragCounter++
    if (dragCounter === 1) {
      isDragging.value = true
    }
  }

  /**
   * 处理拖拽离开事件
   */
  function onDragLeave(event: DragEvent) {
    event.preventDefault()
    event.stopPropagation()
    dragCounter--
    if (dragCounter === 0) {
      isDragging.value = false
    }
  }

  /**
   * 处理拖拽悬停事件
   */
  function onDragOver(event: DragEvent) {
    event.preventDefault()
  }

  /**
   * 处理放置事件
   */
  function onDrop(event: DragEvent, callback?: (event: DragEvent) => void) {
    event.preventDefault()
    event.stopPropagation()
    dragCounter = 0
    isDragging.value = false
    callback?.(event)
  }

  /**
   * 重置拖拽状态
   */
  function resetDragState() {
    dragCounter = 0
    isDragging.value = false
  }

  return {
    isDragging,
    onDragEnter,
    onDragLeave,
    onDragOver,
    onDrop,
    resetDragState,
  }
}
