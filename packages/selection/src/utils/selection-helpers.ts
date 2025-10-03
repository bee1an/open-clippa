import type { SelectionItem } from '../types'

/**
 * 选择框工具函数集合
 */

/**
 * 检查两个选择框是否相交
 */
export function isIntersecting(a: SelectionItem, b: SelectionItem): boolean {
  return !(
    a.x + a.width <= b.x
    || b.x + b.width <= a.x
    || a.y + a.height <= b.y
    || b.y + b.height <= a.y
  )
}

/**
 * 检查点是否在选择框内
 */
export function isPointInSelection(point: { x: number, y: number }, selection: SelectionItem): boolean {
  return (
    point.x >= selection.x
    && point.x <= selection.x + selection.width
    && point.y >= selection.y
    && point.y <= selection.y + selection.height
  )
}

/**
 * 获取多个选择框的联合边界框
 */
export function getUnionBounds(selections: SelectionItem[]): SelectionItem | null {
  if (selections.length === 0)
    return null

  let minX = Number.MAX_SAFE_INTEGER
  let minY = Number.MAX_SAFE_INTEGER
  let maxX = Number.MIN_SAFE_INTEGER
  let maxY = Number.MIN_SAFE_INTEGER

  selections.forEach((selection) => {
    minX = Math.min(minX, selection.x)
    minY = Math.min(minY, selection.y)
    maxX = Math.max(maxX, selection.x + selection.width)
    maxY = Math.max(maxY, selection.y + selection.height)
  })

  return {
    id: 'union-bounds',
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY,
    rotation: 0,
    zIndex: 0,
  }
}

/**
 * 获取选择框的中心点
 */
export function getSelectionCenter(selection: SelectionItem): { x: number, y: number } {
  return {
    x: selection.x + selection.width / 2,
    y: selection.y + selection.height / 2,
  }
}

/**
 * 计算两个选择框之间的距离
 */
export function getDistanceBetween(a: SelectionItem, b: SelectionItem): number {
  const centerA = getSelectionCenter(a)
  const centerB = getSelectionCenter(b)

  const dx = centerA.x - centerB.x
  const dy = centerA.y - centerB.y

  return Math.sqrt(dx * dx + dy * dy)
}

/**
 * 按位置排序选择框（从左到右，从上到下）
 */
export function sortSelectionsByPosition(selections: SelectionItem[]): SelectionItem[] {
  return [...selections].sort((a, b) => {
    if (Math.abs(a.y - b.y) < 50) {
      // 如果在同一行，按x坐标排序
      return a.x - b.x
    }
    // 否则按y坐标排序
    return a.y - b.y
  })
}

/**
 * 按大小排序选择框
 */
export function sortSelectionsBySize(selections: SelectionItem[], order: 'asc' | 'desc' = 'desc'): SelectionItem[] {
  return [...selections].sort((a, b) => {
    const areaA = a.width * a.height
    const areaB = b.width * b.height
    return order === 'desc' ? areaB - areaA : areaA - areaB
  })
}

/**
 * 按z-index排序选择框
 */
export function sortSelectionsByZIndex(selections: SelectionItem[], order: 'asc' | 'desc' = 'desc'): SelectionItem[] {
  return [...selections].sort((a, b) => {
    return order === 'desc' ? b.zIndex - a.zIndex : a.zIndex - b.zIndex
  })
}

/**
 * 将选择框按网格对齐
 */
export function alignToGrid(selection: SelectionItem, gridSize: number): SelectionItem {
  return {
    ...selection,
    x: Math.round(selection.x / gridSize) * gridSize,
    y: Math.round(selection.y / gridSize) * gridSize,
    width: Math.round(selection.width / gridSize) * gridSize,
    height: Math.round(selection.height / gridSize) * gridSize,
  }
}

/**
 * 将选择框限制在指定边界内
 */
export function constrainToBoundary(
  selection: SelectionItem,
  boundary: { x: number, y: number, width: number, height: number },
): SelectionItem {
  const { x, y, width, height } = boundary

  return {
    ...selection,
    x: Math.max(x, Math.min(selection.x, x + width - selection.width)),
    y: Math.max(y, Math.min(selection.y, y + height - selection.height)),
  }
}

/**
 * 检查选择框是否完全在边界内
 */
export function isWithinBoundary(
  selection: SelectionItem,
  boundary: { x: number, y: number, width: number, height: number },
): boolean {
  return (
    selection.x >= boundary.x
    && selection.y >= boundary.y
    && selection.x + selection.width <= boundary.x + boundary.width
    && selection.y + selection.height <= boundary.y + boundary.height
  )
}

/**
 * 克隆选择框
 */
export function cloneSelection(selection: SelectionItem, offsetX = 20, offsetY = 20): SelectionItem {
  return {
    ...selection,
    id: `${selection.id}-clone-${Date.now()}`,
    x: selection.x + offsetX,
    y: selection.y + offsetY,
  }
}

/**
 * 验证选择框数据的有效性
 */
export function validateSelection(selection: any): selection is SelectionItem {
  return (
    selection != null // 修复 null 和 undefined 的情况
    && typeof selection === 'object'
    && typeof selection.id === 'string'
    && typeof selection.x === 'number'
    && typeof selection.y === 'number'
    && typeof selection.width === 'number'
    && typeof selection.height === 'number'
    && typeof selection.rotation === 'number'
    && typeof selection.zIndex === 'number'
    && selection.width > 0
    && selection.height > 0
    && Number.isFinite(selection.x)
    && Number.isFinite(selection.y)
    && Number.isFinite(selection.width)
    && Number.isFinite(selection.height)
    && Number.isFinite(selection.rotation)
    && Number.isFinite(selection.zIndex)
  )
}

/**
 * 标准化选择框数据（修复无效值）
 */
export function normalizeSelection(selection: Partial<SelectionItem>): SelectionItem {
  return {
    id: selection.id || `selection-${Date.now()}`,
    x: Math.max(0, Number.isFinite(selection.x ?? 0) ? selection.x! : 0),
    y: Math.max(0, Number.isFinite(selection.y ?? 0) ? selection.y! : 0),
    width: Math.max(1, Number.isFinite(selection.width ?? 100) ? selection.width! : 100),
    height: Math.max(1, Number.isFinite(selection.height ?? 100) ? selection.height! : 100),
    rotation: Math.max(-360, Math.min(360, Number.isFinite(selection.rotation ?? 0) ? selection.rotation! : 0)),
    zIndex: Math.max(0, Number.isFinite(selection.zIndex ?? 1) ? selection.zIndex! : 1),
    disabled: Boolean(selection.disabled),
    visible: selection.visible !== false, // 默认为true
    locked: Boolean(selection.locked),
    opacity: Math.max(0, Math.min(1, Number.isFinite(Number(selection.opacity ?? 1)) ? Number(selection.opacity!) : 1)),
    style: selection.style || undefined,
  }
}

/**
 * 计算选择框的面积
 */
export function getSelectionArea(selection: SelectionItem): number {
  return selection.width * selection.height
}

/**
 * 计算选择框的周长
 */
export function getSelectionPerimeter(selection: SelectionItem): number {
  return 2 * (selection.width + selection.height)
}

/**
 * 检查选择框是否为正方形
 */
export function isSquare(selection: SelectionItem, tolerance = 0.01): boolean {
  return Math.abs(selection.width - selection.height) <= tolerance
}

/**
 * 检查选择框是否为横向矩形
 */
export function isLandscape(selection: SelectionItem): boolean {
  return selection.width > selection.height
}

/**
 * 检查选择框是否为纵向矩形
 */
export function isPortrait(selection: SelectionItem): boolean {
  return selection.height > selection.width
}
