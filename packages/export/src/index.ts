import type { ExportOptions, ExportResult, MediaItem } from './types'
import { ExportManager } from './core/ExportManager'
import { VideoExporter } from './core/VideoExporter'

export { ExportManager } from './core/ExportManager'

export { ProgressTracker } from './core/ProgressTracker'

// 导出核心类
export { VideoExporter } from './core/VideoExporter'
// 导出格式相关
export { FormatFactory, VideoFormat } from './formats'

// 导出类型定义
export type {
  ExportConfig,
  ExportError,
  ExporterStatus,
  ExportFormat,
  ExportMetadata,
  ExportOptions,
  ExportProgress,
  ExportResult,
  MediaItem,
} from './types'

export type {
  ExportEventListener,
  ExportEvents,
  ExportEventType,
} from './types/events'
export { CompatibilityUtils } from './utils/compatibility'
export { ExportErrorHandler } from './utils/errorHandler'
export { MemoryManager } from './utils/memoryManager'

// 导出工具类
export { ValidationUtils } from './utils/validation'

/**
 * 创建视频导出器
 */
export function createVideoExporter(
  mediaItems: MediaItem[],
  options?: ExportOptions,
): VideoExporter {
  return new VideoExporter(mediaItems, options)
}

/**
 * 快速导出视频
 */
export async function exportVideo(
  mediaItems: MediaItem[],
  options?: ExportOptions,
): Promise<ExportResult> {
  return await ExportManager.exportVideo(mediaItems, options)
}

/**
 * 快速导出并下载视频
 */
export async function downloadVideo(
  mediaItems: MediaItem[],
  filename?: string,
  options?: ExportOptions,
): Promise<void> {
  await ExportManager.downloadVideo(mediaItems, filename, options)
}
