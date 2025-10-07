import type { CanvasExportOptions } from './core/CanvasExporter'
import type { ExportOptions, ExportResult, MediaItem } from './types'
import { CanvasExporter } from './core/CanvasExporter'
import { ExportManager } from './core/ExportManager'
import { VideoExporter } from './core/VideoExporter'

export { CanvasExporter } from './core/CanvasExporter'

export type { CanvasExportOptions } from './core/CanvasExporter'

export { ExportManager } from './core/ExportManager'
export { FrameBuffer } from './core/FrameBuffer'
// 导出帧捕获相关
export { FrameCapture } from './core/FrameCapture'

export { ProgressTracker } from './core/ProgressTracker'
// 导出核心类
export { VideoExporter } from './core/VideoExporter'
// 导出编码器
export { WebAVEncoder } from './encoders'

export type { EncoderConfig, EncodingProgress } from './encoders'
// 导出格式相关
export { FormatFactory, VideoFormat } from './formats'

export type { FrameData } from './types'

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
 * 创建Canvas导出器
 */
export function createCanvasExporter(
  director: any, // TODO: 添加正确的Director类型
  options?: Partial<Omit<CanvasExportOptions, 'director'>>,
): CanvasExporter {
  const canvasOptions: Partial<CanvasExportOptions> = { ...options, director }
  return new CanvasExporter(director, canvasOptions)
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
 * 快速导出Canvas视频
 */
export async function exportCanvas(
  director: any, // TODO: 添加正确的Director类型
  options?: Partial<Omit<CanvasExportOptions, 'director'>>,
): Promise<ExportResult> {
  const canvasOptions: CanvasExportOptions = { ...options, director }
  return await ExportManager.exportCanvas(director, canvasOptions)
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

/**
 * 快速导出并下载Canvas视频
 */
export async function downloadCanvas(
  director: any, // TODO: 添加正确的Director类型
  filename?: string,
  options?: Partial<Omit<CanvasExportOptions, 'director'>>,
): Promise<void> {
  const canvasOptions: CanvasExportOptions = { ...options, director }
  await ExportManager.downloadCanvas(director, filename, canvasOptions)
}
