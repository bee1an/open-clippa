import type { MaybeArray } from 'type-aide'
import type { VideoExportOptions, VideoExportProgress } from './codec'
import type { Performer } from './performer'
import { VideoTrain } from '@clippa/timeline'
import { Director, Stage, Theater } from './canvas'
import { VideoExporter } from './codec'
import { Timeline } from './timeline'
import { EventBus } from './utils'

export interface ClippaEvents {
  exportStart: [options: VideoExportOptions]
  exportProgress: [progress: VideoExportProgress]
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
  async exportVideo(options?: VideoExportOptions): Promise<Blob> {
    if (this._isExporting) {
      throw new Error('正在导出中，请等待完成')
    }

    this._isExporting = true

    try {
      // 获取 theater中的所有表演者
      const performers = this.theater.performers

      if (performers.length === 0) {
        throw new Error('没有可导出的视频内容')
      }

      // 发射导出开始事件
      this.emit('exportStart', options || {})

      // 创建视频导出器
      this._videoExporter = new VideoExporter(performers, options)

      // 执行导出
      const blob = await this._videoExporter.export()

      // 清理资源
      this._videoExporter.destroy()
      this._videoExporter = null

      // 先重置导出状态，再发射完成事件
      this._isExporting = false

      // 发射导出完成事件
      this.emit('exportComplete', blob)

      return blob
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
  async downloadVideo(filename?: string, options?: VideoExportOptions): Promise<void> {
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
  getExportProgress(): VideoExportProgress | null {
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
  static async isExportSupported(options?: VideoExportOptions): Promise<boolean> {
    try {
      return await VideoExporter.isSupported(options)
    }
    catch {
      return false
    }
  }
}
