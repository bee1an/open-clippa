import type { ExportOptions, MediaItem } from '../types'

/**
 * 参数验证工具
 */
export class ValidationUtils {
  /**
   * 验证媒体项数组
   */
  static validateMediaItems(mediaItems: MediaItem[]): void {
    if (!Array.isArray(mediaItems)) {
      throw new TypeError('媒体项必须是数组')
    }

    if (mediaItems.length === 0) {
      throw new Error('至少需要一个媒体项')
    }

    mediaItems.forEach((item, index) => {
      this.validateMediaItem(item, index)
    })
  }

  /**
   * 验证单个媒体项
   */
  static validateMediaItem(item: MediaItem, index?: number): void {
    const itemPrefix = index !== undefined ? `媒体项[${index}]` : '媒体项'

    if (!item.src) {
      throw new Error(`${itemPrefix}缺少媒体源`)
    }

    if (item.start !== undefined && (typeof item.start !== 'number' || item.start < 0)) {
      throw new Error(`${itemPrefix}的开始时间必须是非负数`)
    }

    if (item.duration !== undefined && (typeof item.duration !== 'number' || item.duration <= 0)) {
      throw new Error(`${itemPrefix}的持续时间必须是正数`)
    }

    if (item.playbackRate !== undefined && (typeof item.playbackRate !== 'number' || item.playbackRate <= 0)) {
      throw new Error(`${itemPrefix}的播放速率必须是正数`)
    }

    if (item.volume !== undefined && (typeof item.volume !== 'number' || item.volume < 0 || item.volume > 1)) {
      throw new Error(`${itemPrefix}的音量必须在0-1之间`)
    }

    if (item.position) {
      this.validatePosition(item.position, `${itemPrefix}.position`)
    }
  }

  /**
   * 验证位置信息
   */
  static validatePosition(position: MediaItem['position'], prefix: string): void {
    if (typeof position !== 'object') {
      throw new TypeError(`${prefix}必须是对象`)
    }

    if (position.x !== undefined && (typeof position.x !== 'number')) {
      throw new Error(`${prefix}.x必须是数字`)
    }

    if (position.y !== undefined && (typeof position.y !== 'number')) {
      throw new Error(`${prefix}.y必须是数字`)
    }

    if (position.width !== undefined && (typeof position.width !== 'number' || position.width <= 0)) {
      throw new Error(`${prefix}.width必须是正数`)
    }

    if (position.height !== undefined && (typeof position.height !== 'number' || position.height <= 0)) {
      throw new Error(`${prefix}.height必须是正数`)
    }
  }

  /**
   * 验证导出选项
   */
  static validateExportOptions(options: ExportOptions): void {
    if (!options || typeof options !== 'object') {
      return // 允许空选项
    }

    if (options.width !== undefined) {
      if (typeof options.width !== 'number' || options.width < 16 || options.width > 8192) {
        throw new Error('视频宽度必须在 16-8192 像素之间')
      }
    }

    if (options.height !== undefined) {
      if (typeof options.height !== 'number' || options.height < 16 || options.height > 8192) {
        throw new Error('视频高度必须在 16-8192 像素之间')
      }
    }

    if (options.bitrate !== undefined) {
      if (typeof options.bitrate !== 'number' || options.bitrate < 1000 || options.bitrate > 50000000) {
        throw new Error('比特率必须在 1-50000 kbps 之间')
      }
    }

    if (options.frameRate !== undefined) {
      if (typeof options.frameRate !== 'number' || options.frameRate < 1 || options.frameRate > 120) {
        throw new Error('帧率必须在 1-120 fps 之间')
      }
    }

    if (options.quality !== undefined) {
      if (!['low', 'medium', 'high'].includes(options.quality)) {
        throw new Error('质量必须是 low、medium 或 high')
      }
    }

    if (options.audio !== undefined && typeof options.audio !== 'boolean') {
      throw new Error('audio选项必须是布尔值')
    }

    if (options.bgColor !== undefined) {
      if (typeof options.bgColor !== 'string') {
        throw new TypeError('背景颜色必须是字符串')
      }
      // 简单的颜色格式验证
      if (!options.bgColor.match(/^(#[0-9a-fA-F]{3,6}|rgb\(|rgba\(|hsl\(|hsla\()/)) {
        console.warn('背景颜色格式可能不正确:', options.bgColor)
      }
    }

    if (options.videoCodec !== undefined && typeof options.videoCodec !== 'string') {
      throw new Error('视频编解码器必须是字符串')
    }

    if (options.audioCodec !== undefined && typeof options.audioCodec !== 'string') {
      throw new Error('音频编解码器必须是字符串')
    }

    if (options.metaDataTags !== undefined) {
      if (typeof options.metaDataTags !== 'object' || Array.isArray(options.metaDataTags)) {
        throw new TypeError('元数据标签必须是对象')
      }
    }
  }

  /**
   * 验证文件名
   */
  static validateFilename(filename: string): void {
    if (typeof filename !== 'string') {
      throw new TypeError('文件名必须是字符串')
    }

    if (filename.trim() === '') {
      throw new Error('文件名不能为空')
    }

    // 检查非法字符
    const disallowedChars = /[<>:"/\\|?*]/

    // 检查控制字符（逐个字符检查，避免在正则中使用控制字符）
    let hasControlChars = false
    for (let i = 0; i < filename.length; i++) {
      const charCode = filename.charCodeAt(i)
      if ((charCode >= 0 && charCode <= 31) || charCode === 127) {
        hasControlChars = true
        break
      }
    }

    if (disallowedChars.test(filename) || hasControlChars) {
      throw new Error('文件名包含非法字符')
    }

    // 检查保留名称（Windows）
    const reservedNames = /^(?:CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(?:\..*)?$/i
    if (reservedNames.test(filename)) {
      throw new Error('文件名使用了系统保留名称')
    }

    // 检查长度
    if (filename.length > 255) {
      throw new Error('文件名过长（最多255字符）')
    }
  }

  /**
   * 验证URL
   */
  static isValidUrl(url: string): boolean {
    try {
      new URL(url)
      return true
    }
    catch {
      return false
    }
  }

  /**
   * 验证数据大小
   */
  static validateDataSize(size: number, maxSize?: number): void {
    if (typeof size !== 'number' || size < 0) {
      throw new Error('数据大小必须是非负数')
    }

    if (maxSize !== undefined && size > maxSize) {
      throw new Error(`数据大小超过限制 (${maxSize} 字节)`)
    }
  }
}
