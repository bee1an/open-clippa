export * from './VideoFormat'

/**
 * 格式工厂 - 根据格式类型创建对应的导出器
 */
export class FormatFactory {
  /**
   * 根据格式创建导出器
   */
  static async createExporter(format: 'mp4' | 'webm'): Promise<any> {
    switch (format) {
      case 'mp4': {
        const { VideoFormat } = await import('./VideoFormat')
        return VideoFormat
      }
      case 'webm': {
        const { VideoFormat: WebMFormat } = await import('./VideoFormat')
        return WebMFormat
      }
      default:
        throw new Error(`不支持的格式: ${format}`)
    }
  }

  /**
   * 获取所有支持的格式
   */
  static getSupportedFormats(): string[] {
    return ['mp4', 'webm']
  }

  /**
   * 检查格式是否支持
   */
  static async isFormatSupported(format: string): Promise<boolean> {
    try {
      await this.createExporter(format as any)
      return true
    }
    catch {
      return false
    }
  }
}
