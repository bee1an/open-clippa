import type { ExportFormat, ExportOptions } from '../types'

/**
 * 浏览器兼容性检测工具
 */
export class CompatibilityUtils {
  /**
   * 检测WebCodecs API支持
   */
  static isWebCodecsSupported(): boolean {
    return !!(globalThis.VideoEncoder && globalThis.VideoDecoder && globalThis.MediaRecorder)
  }

  /**
   * 检测MediaRecorder API支持
   */
  static isMediaRecorderSupported(): boolean {
    return !!globalThis.MediaRecorder
  }

  /**
   * 检测ReadableStream支持
   */
  static isReadableStreamSupported(): boolean {
    return !!globalThis.ReadableStream
  }

  /**
   * 检测Blob支持
   */
  static isBlobSupported(): boolean {
    return !!globalThis.Blob
  }

  /**
   * 检测Canvas支持
   */
  static isCanvasSupported(): boolean {
    try {
      const canvas = document.createElement('canvas')
      return !!(canvas.getContext && canvas.getContext('2d'))
    }
    catch {
      return false
    }
  }

  /**
   * 检测WebGL支持
   */
  static isWebGLSupported(): boolean {
    try {
      const canvas = document.createElement('canvas')
      return !!(canvas.getContext && (canvas.getContext('webgl') || canvas.getContext('experimental-webgl')))
    }
    catch {
      return false
    }
  }

  /**
   * 获取浏览器信息
   */
  static getBrowserInfo(): {
    name: string
    version: string
    isMobile: boolean
    platform: string
  } {
    const userAgent = navigator.userAgent
    let name = 'Unknown'
    let version = 'Unknown'

    // 检测浏览器类型
    if (userAgent.includes('Chrome')) {
      name = 'Chrome'
      const match = userAgent.match(/Chrome\/(\d+)/)
      if (match)
        version = match[1]
    }
    else if (userAgent.includes('Firefox')) {
      name = 'Firefox'
      const match = userAgent.match(/Firefox\/(\d+)/)
      if (match)
        version = match[1]
    }
    else if (userAgent.includes('Safari')) {
      name = 'Safari'
      const match = userAgent.match(/Version\/(\d+)/)
      if (match)
        version = match[1]
    }
    else if (userAgent.includes('Edge')) {
      name = 'Edge'
      const match = userAgent.match(/Edge\/(\d+)/)
      if (match)
        version = match[1]
    }

    return {
      name,
      version,
      isMobile: /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent),
      platform: navigator.platform || 'Unknown',
    }
  }

  /**
   * 检测格式兼容性
   */
  static async isFormatSupported(format: ExportFormat, options?: ExportOptions): Promise<boolean> {
    const webCodecsSupported = this.isWebCodecsSupported()

    switch (format) {
      case 'mp4':
        return webCodecsSupported && await this._checkMP4Support(options)
      case 'webm':
        return webCodecsSupported && await this._checkWebMSupport(options)
      case 'gif':
        return this.isCanvasSupported()
      case 'png':
      case 'jpg':
        return this.isCanvasSupported()
      case 'wav':
      case 'mp3':
        return this.isMediaRecorderSupported()
      default:
        return false
    }
  }

  /**
   * 检测MP4格式支持
   */
  private static async _checkMP4Support(options?: ExportOptions): Promise<boolean> {
    try {
      // 检查H.264编码器支持
      if (options?.videoCodec && options.videoCodec.startsWith('avc')) {
        const support = await globalThis.VideoEncoder.isConfigSupported({
          codec: options.videoCodec,
          width: options.width || 1920,
          height: options.height || 1080,
          bitrate: options.bitrate || 5000000,
        })
        return !!support.supported
      }
      return true
    }
    catch {
      return false
    }
  }

  /**
   * 检测WebM格式支持
   */
  private static async _checkWebMSupport(options?: ExportOptions): Promise<boolean> {
    try {
      // 检查VP9编码器支持
      if (options?.videoCodec && options.videoCodec.includes('vp09')) {
        const support = await globalThis.VideoEncoder.isConfigSupported({
          codec: options.videoCodec,
          width: options.width || 1920,
          height: options.height || 1080,
          bitrate: options.bitrate || 5000000,
        })
        return !!support.supported
      }
      return true
    }
    catch {
      return false
    }
  }

  /**
   * 获取兼容性报告
   */
  static getCompatibilityReport(): {
    webCodecs: boolean
    mediaRecorder: boolean
    readableStream: boolean
    blob: boolean
    canvas: boolean
    webgl: boolean
    browser: ReturnType<typeof CompatibilityUtils.getBrowserInfo>
    supportedFormats: ExportFormat[]
    recommendations: string[]
  } {
    const browser = this.getBrowserInfo()
    const webCodecs = this.isWebCodecsSupported()
    const mediaRecorder = this.isMediaRecorderSupported()
    const readableStream = this.isReadableStreamSupported()
    const blob = this.isBlobSupported()
    const canvas = this.isCanvasSupported()
    const webgl = this.isWebGLSupported()

    const supportedFormats: ExportFormat[] = []
    const recommendations: string[] = []

    // 检查支持格式
    if (webCodecs) {
      supportedFormats.push('mp4', 'webm')
    }
    if (mediaRecorder) {
      supportedFormats.push('wav', 'mp3')
    }
    if (canvas) {
      supportedFormats.push('png', 'jpg', 'gif')
    }

    // 生成建议
    if (!webCodecs) {
      if (browser.name === 'Chrome' && Number.parseInt(browser.version) >= 94) {
        recommendations.push('Chrome浏览器支持WebCodecs，请确保已启用相关实验性功能')
      }
      else if (browser.name === 'Firefox') {
        recommendations.push('Firefox对WebCodecs支持有限，建议使用Chrome或Edge浏览器')
      }
      else if (browser.name === 'Safari') {
        recommendations.push('Safari目前不支持WebCodecs API，建议使用Chrome或Edge浏览器')
      }
      else {
        recommendations.push('当前浏览器不支持WebCodecs API，建议升级到最新版Chrome或Edge')
      }
    }

    if (browser.isMobile) {
      recommendations.push('移动设备的导出性能可能有限，建议使用桌面设备')
    }

    if (!webgl) {
      recommendations.push('WebGL不支持，某些渲染功能可能受限')
    }

    return {
      webCodecs,
      mediaRecorder,
      readableStream,
      blob,
      canvas,
      webgl,
      browser,
      supportedFormats,
      recommendations,
    }
  }

  /**
   * 检查内存使用情况
   */
  static getMemoryInfo(): {
    usedJSHeapSize?: number
    totalJSHeapSize?: number
    jsHeapSizeLimit?: number
    deviceMemory?: number
  } {
    const info: any = {}

    // 如果有Performance API
    if ('memory' in performance) {
      const memory = (performance as any).memory
      info.usedJSHeapSize = memory.usedJSHeapSize
      info.totalJSHeapSize = memory.totalJSHeapSize
      info.jsHeapSizeLimit = memory.jsHeapSizeLimit
    }

    // 设备内存
    if ('deviceMemory' in navigator) {
      info.deviceMemory = (navigator as any).deviceMemory
    }

    return info
  }

  /**
   * 检查是否有足够内存进行导出
   */
  static hasEnoughMemory(estimatedSize: number): boolean {
    const memory = this.getMemoryInfo()

    if (memory.jsHeapSizeLimit) {
      // 确保预估大小不超过堆限制的20%
      return estimatedSize < memory.jsHeapSizeLimit * 0.2
    }

    // 如果无法获取内存信息，假设有足够内存
    return true
  }
}
