import type { FrameData } from '../types'

/**
 * 帧捕获选项
 */
export interface FrameCaptureOptions {
  /** 捕获分辨率 */
  resolution?: {
    width: number
    height: number
  }
  /** 是否等待渲染完成 */
  waitForRender?: boolean
  /** 捕获超时时间（毫秒） */
  timeout?: number
  /** 是否启用硬件加速 */
  hardwareAccelerated?: boolean
}

/**
 * 帧捕获器 - 负责从Canvas捕获帧数据
 */
export class FrameCapture {
  private _canvas: HTMLCanvasElement
  private _context: CanvasRenderingContext2D | null = null
  private _options: Required<FrameCaptureOptions>

  constructor(canvas: HTMLCanvasElement, options: FrameCaptureOptions = {}) {
    this._canvas = canvas
    this._options = {
      resolution: {
        width: canvas.width,
        height: canvas.height,
      },
      waitForRender: true,
      timeout: 5000,
      hardwareAccelerated: true,
      ...options,
    }

    this._initializeContext()
  }

  /**
   * 初始化Canvas上下文
   */
  private _initializeContext(): void {
    this._context = this._canvas.getContext('2d', {
      alpha: false,
      desynchronized: this._options.hardwareAccelerated,
      willReadFrequently: true,
    })

    if (!this._context) {
      throw new Error('无法获取Canvas 2D上下文')
    }
  }

  /**
   * 获取Canvas元素
   */
  getCanvas(): HTMLCanvasElement {
    return this._canvas
  }

  /**
   * 获取上下文
   */
  getContext(): CanvasRenderingContext2D {
    if (!this._context) {
      throw new Error('Canvas上下文未初始化')
    }
    return this._context
  }

  /**
   * 同步帧捕获
   */
  captureFrameSync(): FrameData | null {
    try {
      if (!this._context) {
        throw new Error('Canvas上下文未初始化')
      }

      const { width, height } = this._options.resolution
      const imageData = this._context.getImageData(0, 0, width, height)

      return {
        imageData,
        timestamp: performance.now() * 1000, // 转换为微秒
        index: -1, // 需要外部设置
        width,
        height,
      }
    }
    catch (error) {
      console.error('同步帧捕获失败:', error)
      return null
    }
  }

  /**
   * 异步帧捕获（等待渲染完成）
   */
  async captureFrameAsync(index: number = -1): Promise<FrameData | null> {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error(`帧捕获超时 (${this._options.timeout}ms)`))
      }, this._options.timeout)

      try {
        if (this._options.waitForRender) {
          // 使用requestAnimationFrame确保渲染完成
          requestAnimationFrame(() => {
            clearTimeout(timeoutId)
            const frameData = this.captureFrameSync()
            if (frameData) {
              frameData.index = index
            }
            resolve(frameData)
          })
        }
        else {
          // 立即捕获
          clearTimeout(timeoutId)
          const frameData = this.captureFrameSync()
          if (frameData) {
            frameData.index = index
          }
          resolve(frameData)
        }
      }
      catch (error) {
        clearTimeout(timeoutId)
        reject(error)
      }
    })
  }

  /**
   * 批量帧捕获
   */
  async captureFrames(count: number, startIndex: number = 0): Promise<FrameData[]> {
    const frames: FrameData[] = []

    for (let i = 0; i < count; i++) {
      try {
        const frame = await this.captureFrameAsync(startIndex + i)
        if (frame) {
          frames.push(frame)
        }
      }
      catch (error) {
        console.error(`捕获第 ${startIndex + i} 帧失败:`, error)
        // 继续捕获其他帧
      }
    }

    return frames
  }

  /**
   * 带间隔的批量捕获
   */
  async captureFramesWithInterval(
    count: number,
    intervalMs: number,
    startIndex: number = 0,
  ): Promise<FrameData[]> {
    const frames: FrameData[] = []

    for (let i = 0; i < count; i++) {
      const frame = await this.captureFrameAsync(startIndex + i)
      if (frame) {
        frames.push(frame)
      }

      // 等待间隔（除了最后一帧）
      if (i < count - 1 && intervalMs > 0) {
        await new Promise(resolve => setTimeout(resolve, intervalMs))
      }
    }

    return frames
  }

  /**
   * 检查Canvas是否就绪
   */
  isReady(): boolean {
    return !!this._context && this._canvas.width > 0 && this._canvas.height > 0
  }

  /**
   * 获取Canvas信息
   */
  getCanvasInfo(): {
    width: number
    height: number
    resolution: { width: number, height: number }
  } {
    return {
      width: this._canvas.width,
      height: this._canvas.height,
      resolution: this._options.resolution,
    }
  }

  /**
   * 更新捕获选项
   */
  updateOptions(options: Partial<FrameCaptureOptions>): void {
    this._options = { ...this._options, ...options }

    if (options.resolution) {
      // 如果分辨率改变，重新初始化上下文
      this._initializeContext()
    }
  }

  /**
   * 释放帧数据内存
   */
  static releaseFrame(frameData: FrameData): void {
    try {
      // 在支持的浏览器中，手动清理ImageData可以帮助垃圾回收
      if (frameData.imageData && frameData.imageData.data) {
        // 检查数据是否可操作
        const data = frameData.imageData.data
        if (data && data.length > 0) {
          // 对于大数据，分段清理以避免阻塞主线程
          if (data.length > 1024 * 1024) { // 1MB
            // 大数据分批清理
            const chunkSize = 256 * 1024 // 256KB chunks
            for (let i = 0; i < data.length; i += chunkSize) {
              const end = Math.min(i + chunkSize, data.length)
              data.fill(0, i, end)

              // 每清理一段后让出控制权
              if (i % (chunkSize * 4) === 0) {
                setTimeout(() => {}, 0)
              }
            }
          }
          else {
            // 小数据直接清理
            data.fill(0)
          }
        }
      }
    }
    catch (error) {
      console.warn('帧数据清理失败:', error)
    }
  }

  /**
   * 批量释放帧数据
   */
  static releaseFrames(frames: FrameData[]): void {
    frames.forEach(frame => FrameCapture.releaseFrame(frame))
  }

  /**
   * 克隆帧数据
   */
  static cloneFrame(frameData: FrameData): FrameData {
    const newImageData = new ImageData(
      new Uint8ClampedArray(frameData.imageData.data),
      frameData.width,
      frameData.height,
    )

    return {
      imageData: newImageData,
      timestamp: frameData.timestamp,
      index: frameData.index,
      width: frameData.width,
      height: frameData.height,
    }
  }

  /**
   * 检查帧数据是否有效
   */
  static validateFrame(frameData: FrameData): boolean {
    return !!(
      frameData
      && frameData.imageData
      && frameData.imageData.data
      && frameData.imageData.data.length === frameData.width * frameData.height * 4
      && frameData.width > 0
      && frameData.height > 0
    )
  }

  /**
   * 销毁帧捕获器
   */
  destroy(): void {
    this._context = null
    // Canvas元素由外部管理，不在这里销毁
  }
}
