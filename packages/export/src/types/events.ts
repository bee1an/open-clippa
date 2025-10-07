import type { ExportError, ExporterStatus, ExportProgress, ExportResult } from './index'

/**
 * 导出事件类型定义
 */
export type ExportEvents = {
  /** 进度更新事件 */
  'progress': [ExportProgress]
  /** 状态变更事件 */
  'status-change': [ExporterStatus, ExporterStatus]
  /** 导出完成事件 */
  'completed': [ExportResult]
  /** 导出错误事件 */
  'error': [ExportError]
  /** 导出取消事件 */
  'cancelled': [string?]
  /** 阶段变更事件 */
  'stage-change': [string, string?]
}

/**
 * 导出事件类型
 */
export type ExportEventType = keyof ExportEvents

/**
 * 事件监听器类型
 */
export type ExportEventListener<T extends ExportEventType> = (...args: ExportEvents[T]) => void
