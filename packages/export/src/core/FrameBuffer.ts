import type { FrameData } from '../types'

/**
 * 帧缓冲区配置
 */
export interface FrameBufferOptions {
  /** 最大缓冲区大小（帧数） */
  maxBufferSize?: number
  /** 内存限制（字节） */
  memoryLimit?: number
  /** 是否启用自动清理 */
  autoCleanup?: boolean
  /** 清理阈值（当达到这个比例时开始清理） */
  cleanupThreshold?: number // 0-1之间
}

/**
 * 帧缓冲区 - 管理帧数据的内存存储和访问
 */
export class FrameBuffer {
  private _frames: FrameData[] = []
  private _options: Required<FrameBufferOptions>
  private _currentMemoryUsage = 0

  constructor(options: FrameBufferOptions = {}) {
    this._options = {
      maxBufferSize: 60, // 默认缓冲2秒的帧（30fps）
      memoryLimit: 100 * 1024 * 1024, // 默认100MB内存限制
      autoCleanup: true,
      cleanupThreshold: 0.8, // 当使用率达到80%时开始清理
      ...options,
    }
  }

  /**
   * 计算帧数据大小
   */
  private _calculateFrameSize(frame: FrameData): number {
    return frame.width * frame.height * 4 // RGBA每像素4字节
  }

  /**
   * 更新内存使用量
   */
  private _updateMemoryUsage(): void {
    this._currentMemoryUsage = this._frames.reduce(
      (total, frame) => total + this._calculateFrameSize(frame),
      0,
    )
  }

  /**
   * 检查是否需要清理
   */
  private _shouldCleanup(): boolean {
    return (
      this._options.autoCleanup && (
        this._frames.length >= this._options.maxBufferSize * this._options.cleanupThreshold
        || this._currentMemoryUsage >= this._options.memoryLimit * this._options.cleanupThreshold
      )
    )
  }

  /**
   * 清理旧的帧数据
   */
  private _cleanup(): void {
    if (!this._options.autoCleanup) {
      return
    }

    const targetSize = Math.floor(this._options.maxBufferSize * 0.6) // 清理到60%
    const targetMemory = Math.floor(this._options.memoryLimit * 0.6)

    while (
      this._frames.length > targetSize
      || this._currentMemoryUsage > targetMemory
    ) {
      if (this._frames.length === 0) {
        break
      }

      const removedFrame = this._frames.shift()!
      this._currentMemoryUsage -= this._calculateFrameSize(removedFrame)

      // 释放帧数据内存
      import('./FrameCapture').then(({ FrameCapture }) => {
        FrameCapture.releaseFrame(removedFrame)
      })
    }
  }

  /**
   * 添加单个帧
   */
  addFrame(frame: FrameData): boolean {
    // 检查帧数据是否有效
    import('./FrameCapture').then(({ FrameCapture }) => {
      if (!FrameCapture.validateFrame(frame)) {
        console.warn('无效的帧数据，已忽略')
        return false
      }
    })

    // 检查是否超过缓冲区限制
    if (this._frames.length >= this._options.maxBufferSize) {
      if (!this._options.autoCleanup) {
        console.warn('帧缓冲区已满，无法添加新帧')
        return false
      }
    }

    // 检查内存限制
    const frameSize = this._calculateFrameSize(frame)
    if (this._currentMemoryUsage + frameSize > this._options.memoryLimit) {
      if (!this._options.autoCleanup) {
        console.warn('内存限制，无法添加新帧')
        return false
      }
    }

    // 清理空间
    if (this._shouldCleanup()) {
      this._cleanup()
    }

    // 添加帧
    this._frames.push(frame)
    this._currentMemoryUsage += frameSize

    return true
  }

  /**
   * 批量添加帧
   */
  addFrames(frames: FrameData[]): number {
    let addedCount = 0

    for (const frame of frames) {
      if (this.addFrame(frame)) {
        addedCount++
      }
      else {
        console.warn(`帧 ${frame.index} 添加失败，可能缓冲区已满`)
      }
    }

    return addedCount
  }

  /**
   * 获取单个帧（FIFO）
   */
  getFrame(): FrameData | null {
    return this._frames.length > 0 ? this._frames.shift()! : null
  }

  /**
   * 查看帧（不移除）
   */
  peekFrame(index: number = 0): FrameData | null {
    return index < this._frames.length ? this._frames[index] : null
  }

  /**
   * 获取指定数量的帧
   */
  getFrames(count: number): FrameData[] {
    const frames: FrameData[] = []

    for (let i = 0; i < count && this._frames.length > 0; i++) {
      const frame = this._frames.shift()!
      frames.push(frame)
      this._currentMemoryUsage -= this._calculateFrameSize(frame)
    }

    return frames
  }

  /**
   * 获取所有帧
   */
  getAllFrames(): FrameData[] {
    const frames = [...this._frames]
    this._frames = []
    this._currentMemoryUsage = 0
    return frames
  }

  /**
   * 按时间戳获取帧
   */
  getFrameByTimestamp(timestamp: number): FrameData | null {
    return this._frames.find(frame => frame.timestamp === timestamp) || null
  }

  /**
   * 按索引获取帧
   */
  getFrameByIndex(index: number): FrameData | null {
    return this._frames.find(frame => frame.index === index) || null
  }

  /**
   * 获取指定时间范围内的帧
   */
  getFramesByTimeRange(startTimestamp: number, endTimestamp: number): FrameData[] {
    return this._frames.filter(
      frame => frame.timestamp >= startTimestamp && frame.timestamp <= endTimestamp,
    )
  }

  /**
   * 检查是否为空
   */
  isEmpty(): boolean {
    return this._frames.length === 0
  }

  /**
   * 获取当前帧数
   */
  getFrameCount(): number {
    return this._frames.length
  }

  /**
   * 获取当前内存使用量
   */
  getMemoryUsage(): number {
    return this._currentMemoryUsage
  }

  /**
   * 获取内存使用情况
   */
  getMemoryInfo(): {
    used: number
    limit: number
    usage: number // 0-1之间
    frames: number
    maxFrames: number
  } {
    return {
      used: this._currentMemoryUsage,
      limit: this._options.memoryLimit,
      usage: this._currentMemoryUsage / this._options.memoryLimit,
      frames: this._frames.length,
      maxFrames: this._options.maxBufferSize,
    }
  }

  /**
   * 清空缓冲区
   */
  clear(): void {
    // 释放所有帧数据内存
    import('./FrameCapture').then(({ FrameCapture }) => {
      FrameCapture.releaseFrames(this._frames)
    })

    this._frames = []
    this._currentMemoryUsage = 0
  }

  /**
   * 修剪缓冲区到指定大小
   */
  trimToSize(maxFrames: number): void {
    while (this._frames.length > maxFrames) {
      const removedFrame = this._frames.shift()!
      this._currentMemoryUsage -= this._calculateFrameSize(removedFrame)

      // 释放帧数据内存
      import('./FrameCapture').then(({ FrameCapture }) => {
        FrameCapture.releaseFrame(removedFrame)
      })
    }
  }

  /**
   * 修剪内存使用到指定限制
   */
  trimToMemoryLimit(memoryLimit: number): void {
    while (this._currentMemoryUsage > memoryLimit && this._frames.length > 0) {
      const removedFrame = this._frames.shift()!
      this._currentMemoryUsage -= this._calculateFrameSize(removedFrame)

      // 释放帧数据内存
      import('./FrameCapture').then(({ FrameCapture }) => {
        FrameCapture.releaseFrame(removedFrame)
      })
    }
  }

  /**
   * 获取缓冲区统计信息
   */
  getStats(): {
    totalFrames: number
    memoryUsage: number
    memoryLimit: number
    bufferSize: number
    maxBufferSize: number
    oldestTimestamp?: number
    newestTimestamp?: number
    averageFrameSize: number
  } {
    const oldestTimestamp = this._frames.length > 0 ? this._frames[0].timestamp : undefined
    const newestTimestamp = this._frames.length > 0
      ? this._frames[this._frames.length - 1].timestamp
      : undefined

    const averageFrameSize = this._frames.length > 0
      ? this._currentMemoryUsage / this._frames.length
      : 0

    return {
      totalFrames: this._frames.length,
      memoryUsage: this._currentMemoryUsage,
      memoryLimit: this._options.memoryLimit,
      bufferSize: this._frames.length,
      maxBufferSize: this._options.maxBufferSize,
      oldestTimestamp,
      newestTimestamp,
      averageFrameSize,
    }
  }

  /**
   * 更新配置选项
   */
  updateOptions(options: Partial<FrameBufferOptions>): void {
    this._options = { ...this._options, ...options }

    // 如果新的限制更严格，立即清理
    if (options.maxBufferSize !== undefined) {
      this.trimToSize(options.maxBufferSize)
    }

    if (options.memoryLimit !== undefined) {
      this.trimToMemoryLimit(options.memoryLimit)
    }
  }

  /**
   * 销毁缓冲区
   */
  destroy(): void {
    this.clear()
  }
}
