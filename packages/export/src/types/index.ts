/**
 * 通用导出选项接口
 */
export interface ExportOptions {
  /** 视频宽度 */
  width?: number
  /** 视频高度 */
  height?: number
  /** 比特率 (bps) */
  bitrate?: number
  /** 帧率 */
  frameRate?: number
  /** 导出质量 */
  quality?: 'low' | 'medium' | 'high'
  /** 是否包含音频 */
  audio?: boolean
  /** 背景颜色 */
  bgColor?: string
  /** 视频编解码器 */
  videoCodec?: string
  /** 音频编解码器 */
  audioCodec?: string
  /** 元数据标签 */
  metaDataTags?: Record<string, string>
}

/**
 * 导出进度信息
 */
export interface ExportProgress {
  /** 进度百分比 (0-100) */
  progress: number
  /** 已加载字节数 */
  loaded: number
  /** 总字节数 */
  total: number
  /** 当前阶段 */
  stage?: 'preparing' | 'processing' | 'encoding' | 'finalizing' | 'completed'
  /** 当前操作描述 */
  message?: string
}

/**
 * 导出元数据
 */
export interface ExportMetadata {
  /** 视频宽度 */
  width: number
  /** 视频高度 */
  height: number
  /** 时长 (微秒) */
  duration: number
  /** 帧率 */
  frameRate: number
  /** 是否包含音频 */
  hasAudio: boolean
  /** 比特率 */
  bitrate: number
  /** 视频编解码器 */
  videoCodec: string
  /** 音频编解码器 */
  audioCodec?: string
  /** 文件大小估计 (字节) */
  estimatedSize?: number
}

/**
 * 导出媒体项描述
 */
export interface MediaItem {
  /** 媒体源URL或数据 */
  src: string | ArrayBuffer | Uint8Array | ReadableStream<Uint8Array>
  /** 开始时间 (毫秒) */
  start?: number
  /** 持续时间 (毫秒) */
  duration?: number
  /** 位置信息 */
  position?: {
    x?: number
    y?: number
    width?: number
    height?: number
  }
  /** 播放速率 */
  playbackRate?: number
  /** 音量 (0-1) */
  volume?: number
  /** 是否静音 */
  muted?: boolean
}

/**
 * 导出结果
 */
export interface ExportResult {
  /** 导出的Blob数据 */
  blob: Blob
  /** 文件名建议 */
  filename?: string
  /** 文件MIME类型 */
  mimeType: string
  /** 文件大小 */
  size: number
  /** 导出元数据 */
  metadata: ExportMetadata
  /** 导出耗时 (毫秒) */
  exportTime: number
}

/**
 * 导出错误类型
 */
export interface ExportError {
  code: 'UNSUPPORTED_FORMAT' | 'INVALID_OPTIONS' | 'PROCESSING_ERROR' | 'NETWORK_ERROR' | 'TIMEOUT' | 'UNKNOWN' | 'MEMORY_ERROR' | 'PERMISSION_ERROR'
  message: string
  details?: any
}

/**
 * 导出器状态
 */
export type ExporterStatus = 'idle' | 'preparing' | 'exporting' | 'completed' | 'error' | 'cancelled'

/**
 * 导出格式类型
 */
export type ExportFormat = 'mp4' | 'webm' | 'mov' | 'avi' | 'gif' | 'png' | 'jpg' | 'wav' | 'mp3'

/**
 * 导出配置
 */
export interface ExportConfig {
  /** 导出格式 */
  format: ExportFormat
  /** 导出选项 */
  options?: ExportOptions
  /** 输出文件名 */
  filename?: string
  /** 是否覆盖已存在文件 */
  overwrite?: boolean
}

/**
 * Canvas导出选项
 */
export interface CanvasExportOptions extends ExportOptions {
  /** Director实例 */
  director: any // TODO: 添加正确的Director类型导入
  /** 导出分辨率 */
  resolution?: {
    width: number
    height: number
  }
  /** 帧率 */
  frameRate?: number
  /** 视频编解码器 */
  videoCodec?: string
  /** 音频编解码器 */
  audioCodec?: string
}

/**
 * 编码器配置
 */
export interface EncoderConfig {
  /** 视频宽度 */
  width: number
  /** 视频高度 */
  height: number
  /** 视频编解码器 */
  videoCodec?: string
  /** 音频编解码器 */
  audioCodec?: string
  /** 比特率 */
  bitrate?: number
  /** 帧率 */
  frameRate?: number
  /** 关键帧间隔 */
  keyframeInterval?: number
  /** 是否包含音频 */
  audio?: boolean
}

/**
 * 帧数据接口
 */
export interface FrameData {
  /** ImageData对象 */
  imageData: ImageData
  /** 时间戳（微秒） */
  timestamp: number
  /** 帧索引 */
  index: number
  /** 帧宽度 */
  width: number
  /** 帧高度 */
  height: number
}

/**
 * 编码进度信息
 */
export interface EncodingProgress {
  /** 已编码帧数 */
  encodedFrames: number
  /** 总帧数 */
  totalFrames: number
  /** 当前进度百分比 */
  progress: number
  /** 当前阶段 */
  stage: 'initializing' | 'encoding' | 'finalizing' | 'completed'
  /** 编码速度（fps） */
  encodingSpeed?: number
  /** 预计剩余时间（秒） */
  estimatedTimeRemaining?: number
}

export * from './events'
