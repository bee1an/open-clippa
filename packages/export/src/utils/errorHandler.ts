import type { ExportError } from '../types'

/**
 * 统一错误处理机制
 */
export class ExportErrorHandler {
  private static _errorCodes: Record<string, ExportError['code']> = {
    UNSUPPORTED_FORMAT: 'UNSUPPORTED_FORMAT',
    INVALID_OPTIONS: 'INVALID_OPTIONS',
    PROCESSING_ERROR: 'PROCESSING_ERROR',
    NETWORK_ERROR: 'NETWORK_ERROR',
    TIMEOUT: 'TIMEOUT',
    MEMORY_ERROR: 'MEMORY_ERROR',
    PERMISSION_ERROR: 'PERMISSION_ERROR',
    UNKNOWN: 'UNKNOWN',
  }

  /**
   * 创建标准化的导出错误
   */
  static createError(
    code: keyof typeof ExportErrorHandler._errorCodes,
    message: string,
    details?: any,
  ): ExportError {
    return {
      code: ExportErrorHandler._errorCodes[code],
      message,
      details,
    }
  }

  /**
   * 处理并标准化错误
   */
  static handleError(error: unknown, context?: string): ExportError {
    // 检查是否已经是标准化的错误对象
    if (error && typeof error === 'object' && 'code' in error && 'message' in error) {
      return error as ExportError
    }

    if (error instanceof Error) {
      return this._analyzeError(error, context)
    }

    if (typeof error === 'string') {
      return this.createError('UNKNOWN', error, { context })
    }

    return this.createError('UNKNOWN', '未知错误', { error, context })
  }

  /**
   * 分析错误类型
   */
  private static _analyzeError(error: Error, context?: string): ExportError {
    const message = error.message.toLowerCase()
    const stack = error.stack

    // 网络相关错误
    if (message.includes('network') || message.includes('fetch') || message.includes('connection')) {
      return this.createError('NETWORK_ERROR', `网络错误: ${error.message}`, { stack, context })
    }

    // 超时错误
    if (message.includes('timeout') || message.includes('time out')) {
      return this.createError('TIMEOUT', `操作超时: ${error.message}`, { stack, context })
    }

    // 权限错误
    if (message.includes('permission') || message.includes('denied') || message.includes('forbidden')) {
      return this.createError('PERMISSION_ERROR', `权限不足: ${error.message}`, { stack, context })
    }

    // 内存错误
    if (message.includes('memory') || message.includes('out of memory') || message.includes('heap')) {
      return this.createError('MEMORY_ERROR', `内存不足: ${error.message}`, { stack, context })
    }

    // 编解码器错误
    if (message.includes('codec') || message.includes('webcodecs') || message.includes('encoder')) {
      return this.createError('UNSUPPORTED_FORMAT', `编解码器错误: ${error.message}`, { stack, context })
    }

    // 参数验证错误
    if (message.includes('invalid') || message.includes('required') || message.includes('must be')) {
      return this.createError('INVALID_OPTIONS', `参数错误: ${error.message}`, { stack, context })
    }

    // 通用处理错误
    return this.createError('PROCESSING_ERROR', `处理错误: ${error.message}`, { stack, context })
  }

  /**
   * 获取用户友好的错误信息
   */
  static getUserFriendlyMessage(error: ExportError): string {
    switch (error.code) {
      case 'UNSUPPORTED_FORMAT':
        return '当前浏览器不支持此格式，请尝试其他格式或使用最新版Chrome浏览器'

      case 'INVALID_OPTIONS':
        return '导出参数不正确，请检查导出设置'

      case 'PROCESSING_ERROR':
        return '视频处理时发生错误，请检查媒体文件是否损坏'

      case 'NETWORK_ERROR':
        return '网络连接错误，请检查网络连接后重试'

      case 'TIMEOUT':
        return '操作超时，请检查网络连接或尝试较小的文件'

      case 'MEMORY_ERROR':
        return '内存不足，请关闭其他应用或尝试较小的文件'

      case 'PERMISSION_ERROR':
        return '没有足够的权限执行此操作'

      case 'UNKNOWN':
      default:
        return '发生未知错误，请重试或联系技术支持'
    }
  }

  /**
   * 获取错误解决建议
   */
  static getErrorSolution(error: ExportError): string[] {
    switch (error.code) {
      case 'UNSUPPORTED_FORMAT':
        return [
          '使用Chrome 94+或Edge 94+浏览器',
          '尝试导出为MP4格式',
          '检查浏览器是否启用了WebCodecs API',
        ]

      case 'INVALID_OPTIONS':
        return [
          '检查视频尺寸设置（16-8192像素）',
          '检查比特率设置（1-50000 kbps）',
          '检查帧率设置（1-120 fps）',
        ]

      case 'PROCESSING_ERROR':
        return [
          '确保媒体文件格式正确',
          '检查媒体文件是否损坏',
          '尝试较小的文件或较低的分辨率',
        ]

      case 'NETWORK_ERROR':
        return [
          '检查网络连接',
          '刷新页面重试',
          '检查防火墙设置',
        ]

      case 'TIMEOUT':
        return [
          '检查网络速度',
          '尝试较小的文件',
          '关闭其他网络应用',
        ]

      case 'MEMORY_ERROR':
        return [
          '关闭其他浏览器标签页',
          '关闭其他应用程序',
          '尝试较小的文件或较低的分辨率',
        ]

      case 'PERMISSION_ERROR':
        return [
          '检查浏览器权限设置',
          '使用HTTPS协议',
          '联系管理员获取权限',
        ]

      case 'UNKNOWN':
      default:
        return [
          '刷新页面重试',
          '检查浏览器控制台错误信息',
          '联系技术支持',
        ]
    }
  }

  /**
   * 记录错误
   */
  static logError(error: ExportError, additionalInfo?: Record<string, any>): void {
    const logData = {
      timestamp: new Date().toISOString(),
      error: {
        code: error.code,
        message: error.message,
        details: error.details,
      },
      additionalInfo,
      userAgent: navigator.userAgent,
      url: window.location.href,
    }

    console.error('Export Error:', logData)

    // 这里可以添加错误上报逻辑
    // this._reportError(logData)
  }

  /**
   * 错误上报（可选实现）
   */
  private static async _reportError(_errorData: any): Promise<void> {
    // 实现错误上报逻辑
    // 例如发送到错误监控服务
    try {
      // await fetch('/api/errors', {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify(_errorData)
      // })
    }
    catch (error) {
      console.warn('Failed to report error:', error)
    }
  }

  /**
   * 重试机制
   */
  static async withRetry<T>(
    operation: () => Promise<T>,
    maxRetries = 3,
    delay = 1000,
    context?: string,
  ): Promise<T> {
    let lastError: Error | null = null

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await operation()
      }
      catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error))

        if (attempt === maxRetries) {
          const exportError = this.handleError(lastError, context)
          this.logError(exportError, { attempt, maxRetries })
          throw exportError
        }

        // 计算延迟时间（指数退避）
        const retryDelay = delay * 2 ** (attempt - 1)
        console.warn(`操作失败，${retryDelay}ms后重试 (${attempt}/${maxRetries}):`, lastError.message)

        await new Promise(resolve => setTimeout(resolve, retryDelay))
      }
    }

    throw new Error(lastError?.message || 'Unknown error')
  }
}
