import type { ExportFormat, ExportOptions, ExportResult, MediaItem } from '../types'
import { VideoExporter } from './VideoExporter'

/**
 * 导出管理器 - 统一的导出入口
 */
export class ExportManager {
  /**
   * 创建视频导出器
   */
  static createVideoExporter(mediaItems: MediaItem[], options?: ExportOptions): VideoExporter {
    return new VideoExporter(mediaItems, options)
  }

  /**
   * 快速导出视频 - 简化接口
   */
  static async exportVideo(
    mediaItems: MediaItem[],
    options?: ExportOptions,
  ): Promise<ExportResult> {
    const exporter = new VideoExporter(mediaItems, options)
    return await exporter.export()
  }

  /**
   * 快速导出并下载视频
   */
  static async downloadVideo(
    mediaItems: MediaItem[],
    filename?: string,
    options?: ExportOptions,
  ): Promise<void> {
    const exporter = new VideoExporter(mediaItems, options)
    await exporter.download(filename)
  }

  /**
   * 检查格式支持情况
   */
  static async checkSupport(format: ExportFormat, options?: ExportOptions): Promise<boolean> {
    switch (format) {
      case 'mp4':
      case 'webm':
        return await VideoExporter.isSupported(options)
      default:
        return false
    }
  }

  /**
   * 获取推荐的导出选项
   */
  static getRecommendedOptions(format: ExportFormat, quality: 'low' | 'medium' | 'high' = 'medium'): ExportOptions {
    switch (quality) {
      case 'low':
        return {
          width: 1280,
          height: 720,
          bitrate: 2000000, // 2 Mbps
          frameRate: 24,
          quality: 'low',
          videoCodec: format === 'webm' ? 'vp09.00.10.08' : 'avc1.42E01F',
        }
      case 'medium':
        return {
          width: 1920,
          height: 1080,
          bitrate: 5000000, // 5 Mbps
          frameRate: 30,
          quality: 'medium',
          videoCodec: format === 'webm' ? 'vp09.00.10.08' : 'avc1.42E032',
        }
      case 'high':
        return {
          width: 1920,
          height: 1080,
          bitrate: 10000000, // 10 Mbps
          frameRate: 60,
          quality: 'high',
          videoCodec: format === 'webm' ? 'vp09.00.10.08' : 'avc1.640032',
        }
    }
  }
}
