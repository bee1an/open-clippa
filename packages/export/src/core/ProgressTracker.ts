import type {
  ExportEventListener,
  ExportEvents,
  ExportEventType,
  ExportProgress,
} from '../types'
import { EventBus } from '@clippa/utils'

/**
 * 进度追踪器，用于监控导出进度和发射事件
 */
export class ProgressTracker extends EventBus<ExportEvents> {
  private _progress: ExportProgress = { progress: 0, loaded: 0, total: 0 }
  private _startTime = 0
  private _isDestroyed = false

  constructor() {
    super()
    this._startTime = Date.now()
  }

  /**
   * 获取当前进度
   */
  getProgress(): ExportProgress {
    return { ...this._progress }
  }

  /**
   * 更新进度
   */
  updateProgress(progress: Partial<ExportProgress>): void {
    if (this._isDestroyed)
      return

    this._progress = { ...this._progress, ...progress }
    this.emit('progress', this._progress)
  }

  /**
   * 设置当前阶段
   */
  setStage(stage: ExportProgress['stage'], message?: string): void {
    if (this._isDestroyed)
      return

    this._progress.stage = stage
    this._progress.message = message
    this.emit('stage-change', stage || '', message)
  }

  /**
   * 重置进度
   */
  reset(): void {
    this._progress = { progress: 0, loaded: 0, total: 0 }
    this._startTime = Date.now()
    this.emit('progress', this._progress)
  }

  /**
   * 完成进度
   */
  complete(): void {
    this._progress.progress = 100
    this._progress.stage = 'completed'
    this.emit('progress', this._progress)
  }

  /**
   * 获取已用时间（毫秒）
   */
  getElapsedTime(): number {
    return Date.now() - this._startTime
  }

  /**
   * 重写on方法，添加销毁检查
   */
  on<T extends ExportEventType>(event: T, listener: ExportEventListener<T>): void {
    if (this._isDestroyed)
      return
    super.on(event, listener)
  }

  /**
   * 重写once方法，添加销毁检查
   */
  once<T extends ExportEventType>(event: T, listener: ExportEventListener<T>): void {
    if (this._isDestroyed)
      return
    super.once(event, listener)
  }

  /**
   * 重写emit方法，添加销毁检查
   */
  emit<T extends ExportEventType>(event: T, ...args: ExportEvents[T]): void {
    if (this._isDestroyed)
      return
    super.emit(event, ...args)
  }

  /**
   * 销毁进度追踪器
   */
  destroy(): void {
    this._isDestroyed = true
    // 清理所有事件监听器
    this._events = {} as any
  }

  /**
   * 检查是否已销毁
   */
  isDestroyed(): boolean {
    return this._isDestroyed
  }
}
