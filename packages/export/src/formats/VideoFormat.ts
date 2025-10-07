import type { ExportOptions, ExportResult, MediaItem } from '../types'
import { VideoExporter } from '../core/VideoExporter'

/**
 * 视频格式导出实现
 */
export class VideoFormat {
  /**
   * 导出MP4格式
   */
  static async exportMP4(
    mediaItems: MediaItem[],
    options?: ExportOptions,
  ): Promise<ExportResult> {
    const mp4Options = {
      ...options,
      videoCodec: 'avc1.42E032',
      audioCodec: 'aac',
    }

    const exporter = new VideoExporter(mediaItems, mp4Options)
    return await exporter.export()
  }

  /**
   * 导出WebM格式
   */
  static async exportWebM(
    mediaItems: MediaItem[],
    options?: ExportOptions,
  ): Promise<ExportResult> {
    const webmOptions = {
      ...options,
      videoCodec: 'vp09.00.10.08',
      audioCodec: 'opus',
    }

    const exporter = new VideoExporter(mediaItems, webmOptions)
    return await exporter.export()
  }

  /**
   * 获取支持的编解码器
   */
  static getSupportedCodecs(): {
    video: string[]
    audio: string[]
  } {
    return {
      video: [
        'avc1.42E01F', // H.264 Baseline
        'avc1.42E032', // H.264 Main
        'avc1.640032', // H.264 High
        'vp09.00.10.08', // VP9
        'hev1.1.6.L93.B0', // H.265 (实验性)
      ],
      audio: [
        'aac', // AAC
        'opus', // Opus
        'mp4a.40.2', // MPEG-4 AAC LC
      ],
    }
  }

  /**
   * 检查编解码器支持
   */
  static async checkCodecSupport(codec: string): Promise<boolean> {
    try {
      if (!globalThis.VideoEncoder) {
        return false
      }

      const support = await globalThis.VideoEncoder.isConfigSupported({
        codec,
        width: 1920,
        height: 1080,
        bitrate: 5000000,
      })

      return !!support.supported
    }
    catch {
      return false
    }
  }

  /**
   * 获取推荐的编解码器
   */
  static getRecommendedCodec(format: 'mp4' | 'webm', quality: 'low' | 'medium' | 'high' = 'medium'): {
    video: string
    audio: string
  } {
    switch (format) {
      case 'mp4':
        switch (quality) {
          case 'low':
            return { video: 'avc1.42E01F', audio: 'aac' }
          case 'medium':
            return { video: 'avc1.42E032', audio: 'aac' }
          case 'high':
            return { video: 'avc1.640032', audio: 'aac' }
        }
        break

      case 'webm':
        switch (quality) {
          case 'low':
            return { video: 'vp09.00.10.08', audio: 'opus' }
          case 'medium':
            return { video: 'vp09.00.10.08', audio: 'opus' }
          case 'high':
            return { video: 'vp09.00.10.08', audio: 'opus' }
        }
    }
  }
}
