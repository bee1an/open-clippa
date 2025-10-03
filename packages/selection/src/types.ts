export interface SelectionItem {
  /** 唯一标识符 */
  id: string
  /** X坐标位置 */
  x: number
  /** Y坐标位置 */
  y: number
  /** 宽度 */
  width: number
  /** 高度 */
  height: number
  /** 旋转角度（度数） */
  rotation: number
  /** 层级 */
  zIndex: number
  /** 自定义样式 */
  style?: SelectionStyle
  /** 是否禁用 */
  disabled?: boolean
  /** 是否可见 */
  visible?: boolean
  /** 是否锁定（不能拖拽或调整大小） */
  locked?: boolean
  /** 透明度 */
  opacity?: number
}

export interface SelectionStyle {
  /** 边框样式 */
  border?: string
  /** 背景样式 */
  background?: string
  /** 调整手柄颜色 */
  handleColor?: string
  /** 调整手柄大小 */
  handleSize?: number
  /** 边框圆角 */
  borderRadius?: string
  /** 阴影样式 */
  boxShadow?: string
  /** 自定义CSS属性 */
  [key: `--${string}`]: string | number | undefined
}

export type ResizeDirection
  = | 'top-left'
    | 'top-right'
    | 'bottom-left'
    | 'bottom-right'
    | 'top'
    | 'right'
    | 'bottom'
    | 'left'

export type SelectionEvents = {
  /** 选框更新事件 */
  update: [item: SelectionItem]
  /** 选框删除事件 */
  delete: [id: string]
  /** 选框选中事件 */
  select: [id: string]
  /** 选框失去焦点事件 */
  blur: [id: string]
  /** 拖拽开始事件 */
  dragStart: [id: string, event: MouseEvent | TouchEvent]
  /** 拖拽中事件 */
  drag: [id: string, item: SelectionItem]
  /** 拖拽结束事件 */
  dragEnd: [id: string, event: MouseEvent | TouchEvent]
  /** 调整大小开始事件 */
  resizeStart: [id: string, direction: ResizeDirection, event: MouseEvent | TouchEvent]
  /** 调整大小中事件 */
  resize: [id: string, direction: ResizeDirection, item: SelectionItem]
  /** 调整大小结束事件 */
  resizeEnd: [id: string, event: MouseEvent | TouchEvent]
  /** 旋转开始事件 */
  rotateStart: [id: string, event: MouseEvent | TouchEvent]
  /** 旋转中事件 */
  rotate: [id: string, item: SelectionItem]
  /** 旋转结束事件 */
  rotateEnd: [id: string, event: MouseEvent | TouchEvent]
  /** 鼠标进入事件 */
  mouseEnter: [id: string, event: MouseEvent]
  /** 鼠标离开事件 */
  mouseLeave: [id: string, event: MouseEvent]
}

export interface DragState {
  isDragging: boolean
  startX: number
  startY: number
  originalX: number
  originalY: number
}

export interface ResizeState {
  isResizing: boolean
  direction: ResizeDirection | null
  startX: number
  startY: number
  originalX: number
  originalY: number
  originalWidth: number
  originalHeight: number
}

// 边界约束类型
export interface BoundaryConstraints {
  minX?: number
  minY?: number
  maxX?: number
  maxY?: number
}

// 性能选项类型
export interface PerformanceOptions {
  /** 节流间隔（毫秒） */
  throttleInterval?: number
  /** 是否启用requestAnimationFrame优化 */
  useRAF?: boolean
  /** 是否启用调试模式 */
  debug?: boolean
}

// 坐标类型
export interface Coordinate {
  x: number
  y: number
}

// 尺寸类型
export interface Size {
  width: number
  height: number
}

// 矩形区域类型
export interface Rectangle extends Coordinate, Size {}

// 角点类型
export type Corner = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'

// 主题相关类型
export interface ThemeColors {
  primary: string
  secondary: string
  accent: string
  background: string
  border: string
  handle: string
  text: string
}

export interface ThemeSettings {
  colors: ThemeColors
  handleSize: number
  borderWidth: number
  borderRadius: number
  shadows: boolean
  transitions: boolean
}
