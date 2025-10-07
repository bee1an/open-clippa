import type { MaybeArray } from 'type-aide'
import type { ExportOptions, ExportProgress, MediaItem } from './export'
import type { Performer } from './performer'
import { VideoTrain } from '@clippa/timeline'
import { Director, Stage, Theater } from './canvas'
import { VideoExporter } from './export'
import { Timeline } from './timeline'
import { EventBus } from './utils'

export interface ClippaEvents {
  exportStart: [options: ExportOptions]
  exportProgress: [progress: ExportProgress]
  exportComplete: [blob: Blob]
  exportError: [error: Error]
  [key: string]: unknown[]
  [key: symbol]: unknown[]
}

export class Clippa extends EventBus<ClippaEvents> {
  theater = new Theater()
  stage: Stage
  director: Director
  timeline: Timeline
  ready: Promise<void>
  private _videoExporter: VideoExporter | null = null
  private _isExporting: boolean = false

  constructor() {
    super()
    this.stage = new Stage()
    this.director = new Director({ stage: this.stage, theater: this.theater })

    this.timeline = new Timeline()

    this.ready = Promise.all([this.stage.ready, this.timeline.ready]) as any

    this.timeline.on('play', () => {
      this.director.play()
    })
    this.timeline.on('pause', () => {
      this.director.pause()
    })
    this.timeline.on('seeked', (time) => {
      this.director.seek(time)
    })
  }

  /**
   * 雇佣表演者
   */
  async hire(p: Performer): Promise<void> {
    this.theater.hire(p)

    // 创建VideoTrain实例，传递必要的参数
    const videoTrain = new VideoTrain({
      id: `video-${Date.now()}`,
      start: p.start,
      duration: p.duration,
      src: (p as any).src || '',
    })
    this.timeline.addTrainByZIndex(videoTrain, p.zIndex)
    await videoTrain.init()
  }

  /**
   * 解雇表演者
   */
  fire(p: Performer): void {
    this.theater.fire(p)
  }

  show(performers: MaybeArray<Performer>): void {
    this.stage.add(performers)
  }

  hide(performers: MaybeArray<Performer>): void {
    this.stage.remove(performers)
  }

  play(): void {
    this.timeline.play()
  }

  pause(): void {
    this.timeline.pause()
  }

  seek(time: number): void {
    this.timeline.seek(time)
  }

  /**
   * 导出当前时间轴的所有视频
   * @param options - 导出选项
   * @returns Promise<Blob> - MP4 文件 Blob
   */
  async exportVideo(options?: ExportOptions): Promise<Blob> {
    if (this._isExporting) {
      throw new Error('正在导出中，请等待完成')
    }

    this._isExporting = true

    try {
      // 获取 theater中的所有表演者并转换为 MediaItems
      const performers = this.theater.performers
      const mediaItems = performers.map((performer): MediaItem => {
        // 类型断言：performer 可能有额外的媒体属性
        const performerWithMedia = performer as any
        return {
          src: performerWithMedia.src || performerWithMedia.url || '',
          start: performer.start || 0,
          duration: performer.duration || 5000,
          position: {
            x: performerWithMedia.x || 0,
            y: performerWithMedia.y || 0,
            width: performerWithMedia.width || 1920,
            height: performerWithMedia.height || 1080,
          },
          playbackRate: performerWithMedia.playbackRate || 1,
          volume: performerWithMedia.volume || 1,
          muted: performerWithMedia.muted || false,
        }
      })

      if (mediaItems.length === 0) {
        throw new Error('没有可导出的视频内容')
      }

      // 发射导出开始事件
      this.emit('exportStart', options || {})

      // 创建视频导出器
      this._videoExporter = new VideoExporter(mediaItems, options)

      // 执行导出
      const result = await this._videoExporter.export()

      // 清理资源
      this._videoExporter.destroy()
      this._videoExporter = null

      // 先重置导出状态，再发射完成事件
      this._isExporting = false

      // 发射导出完成事件（使用 result.blob）
      this.emit('exportComplete', result.blob)
      return result.blob
    }
    catch (error) {
      console.error('视频导出失败:', error)
      this.emit('exportError', error instanceof Error ? error : new Error(String(error)))
      throw error
    }
    finally {
      // 确保无论如何都重置状态
      this._isExporting = false
    }
  }

  /**
   * 导出并下载视频
   * @param filename - 文件名，可选
   * @param options - 导出选项
   */
  async downloadVideo(filename?: string, options?: ExportOptions): Promise<void> {
    try {
      const blob = await this.exportVideo(options)

      const defaultFilename = `clippa-export-${Date.now()}.mp4`
      const downloadFilename = filename || defaultFilename

      // 创建下载链接
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = downloadFilename

      // 触发下载
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)

      // 清理URL
      setTimeout(() => URL.revokeObjectURL(url), 100)
    }
    catch (error) {
      console.error('视频下载失败:', error)
      throw error
    }
  }

  /**
   * 获取导出进度
   */
  getExportProgress(): ExportProgress | null {
    if (!this._videoExporter) {
      return null
    }

    const progress = this._videoExporter.getProgress()

    // 如果进度发生变化，发射进度事件
    if (progress && progress.progress > 0) {
      this.emit('exportProgress', progress)
    }

    return progress
  }

  /**
   * 是否正在导出
   */
  isExporting(): boolean {
    return this._isExporting
  }

  /**
   * 取消导出
   */
  cancelExport(): void {
    if (this._isExporting && this._videoExporter) {
      this._videoExporter.cancel()
      this._isExporting = false
    }
  }

  /**
   * 检查浏览器是否支持视频导出
   */
  static async isExportSupported(options?: ExportOptions): Promise<boolean> {
    try {
      return await VideoExporter.isSupported(options)
    }
    catch {
      return false
    }
  }
}
