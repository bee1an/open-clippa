import type { ExportOptions, ExportResult, MediaItem } from './types'
import { ExportManager } from './core/ExportManager'

/**
 * 便捷函数 - 创建视频导出器
 */
export function createVideoExporter(
  mediaItems: MediaItem[],
  options?: ExportOptions,
): any {
  return ExportManager.createVideoExporter(mediaItems, options)
}

/**
 * 便捷函数 - 快速导出视频
 */
export async function exportVideo(
  mediaItems: MediaItem[],
  options?: ExportOptions,
): Promise<ExportResult> {
  return await ExportManager.exportVideo(mediaItems, options)
}

/**
 * 便捷函数 - 快速导出并下载视频
 */
export async function downloadVideo(
  mediaItems: MediaItem[],
  filename?: string,
  options?: ExportOptions,
): Promise<void> {
  await ExportManager.downloadVideo(mediaItems, filename, options)
}
