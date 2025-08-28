import type { Train } from './train'

export interface TrainOption {
  start: number
  duration: number
}

export type TrainEvents = {
  /**
   * 拖拽开始
   */
  moveStart: []

  /**
   * 每一次移动前
   *
   * 这里使用对象的形式是为了让触发事件的时候可以修改这个参数
   */
  beforeMove: [{ xValue: number }, target: Train]

  /**
   * 每一次移动后
   */
  afterMove: [target: Train]

  /**
   * 拖拽结束
   */
  moveEnd: [target: Train]

  /**
   * 左侧调整器的值变化前
   */
  beforeLeftResize: [{ xValue: number, wValue: number, disdrawable: boolean }, target: Train]

  /**
   * 右侧调整器pointerdown
   */
  rightResizeStart: [target: Train]

  /**
   * 右侧调整器的值变化前
   */
  beforeRightResize: [{ wValue: number, disdrawable: boolean }, target: Train ]

  /**
   * 右侧调整器pointerup
   */
  rightResizeEnd: [target: Train]

  /**
   * start changed
   */
  startChanged: []

  /**
   * duration changed
   */
  durationChanged: []
}

export type TrainDragStatus
  = | 'normal' // 常规态
    | 'static' // 静态
    | 'translucent' // 半透明
    | 'free' // 游离
