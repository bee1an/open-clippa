import { defineStore } from 'pinia'

// Validation functions for new data structures
export function createDefaultVideoMetadata(): VideoMetadata {
  return {
    resolution: { width: 0, height: 0 },
    frameRate: 0,
    codec: 'unknown',
    bitrate: 0,
    aspectRatio: '16:9',
    colorSpace: undefined,
    audioTracks: [],
  }
}

export function createDefaultThumbnailSet(): ThumbnailSet {
  return {
    primary: '',
    frames: [],
    generating: false,
  }
}

export function createDefaultProcessingStatus(): ProcessingStatus {
  return {
    metadataExtracted: false,
    thumbnailsGenerated: false,
    error: undefined,
  }
}

export function validateVideoMetadata(metadata: Partial<VideoMetadata>): VideoMetadata {
  const defaults = createDefaultVideoMetadata()
  return {
    resolution: metadata.resolution || defaults.resolution,
    frameRate: metadata.frameRate || defaults.frameRate,
    codec: metadata.codec || defaults.codec,
    bitrate: metadata.bitrate || defaults.bitrate,
    aspectRatio: metadata.aspectRatio || defaults.aspectRatio,
    colorSpace: metadata.colorSpace,
    audioTracks: metadata.audioTracks || defaults.audioTracks,
  }
}

export function validateThumbnailSet(thumbnails: Partial<ThumbnailSet>): ThumbnailSet {
  const defaults = createDefaultThumbnailSet()
  return {
    primary: thumbnails.primary || defaults.primary,
    frames: thumbnails.frames || defaults.frames,
    generating: thumbnails.generating ?? defaults.generating,
  }
}

// Helper function to calculate aspect ratio
function calculateAspectRatio(width: number, height: number): string {
  if (width === 0 || height === 0)
    return '16:9'

  const gcd = (a: number, b: number): number => b === 0 ? a : gcd(b, a % b)
  const divisor = gcd(width, height)
  const aspectWidth = width / divisor
  const aspectHeight = height / divisor

  // Common aspect ratios
  if (aspectWidth === 16 && aspectHeight === 9)
    return '16:9'
  if (aspectWidth === 4 && aspectHeight === 3)
    return '4:3'
  if (aspectWidth === 21 && aspectHeight === 9)
    return '21:9'
  if (aspectWidth === 1 && aspectHeight === 1)
    return '1:1'

  return `${aspectWidth}:${aspectHeight}`
}

// Audio track information
export interface AudioTrackInfo {
  index: number
  codec: string
  channels: number
  sampleRate: number
  bitrate?: number
}

// Video metadata interface
export interface VideoMetadata {
  resolution: { width: number, height: number }
  frameRate: number
  codec: string
  bitrate: number
  aspectRatio: string
  colorSpace?: string
  audioTracks: AudioTrackInfo[]
}

// Thumbnail frame for preview animations
export interface ThumbnailFrame {
  url: string
  timestamp: number // Position in video (seconds)
}

// Thumbnail set for multiple frames
export interface ThumbnailSet {
  primary: string // Main thumbnail URL
  frames: ThumbnailFrame[] // Multiple frames for preview animation
  generating: boolean
}

// Processing status tracking
export interface ProcessingStatus {
  metadataExtracted: boolean
  thumbnailsGenerated: boolean
  error?: string
}

// Enhanced VideoFile interface
export interface VideoFile {
  id: string
  name: string
  file: File
  url: string
  duration: number
  size: number
  thumbnail?: string // Keep for backward compatibility
  createdAt: Date
  // New enhanced fields
  metadata: VideoMetadata
  thumbnails: ThumbnailSet
  processingStatus: ProcessingStatus
}

export const useMediaStore = defineStore('media', () => {
  const videoFiles = ref<VideoFile[]>([])
  const isGeneratingThumbnail = ref(false)

  // 添加视频文件
  function addVideoFile(file: File): VideoFile {
    const videoFile: VideoFile = {
      id: crypto.randomUUID(),
      name: file.name,
      file,
      url: URL.createObjectURL(file),
      duration: 0,
      size: file.size,
      createdAt: new Date(),
      // Initialize new enhanced fields
      metadata: createDefaultVideoMetadata(),
      thumbnails: createDefaultThumbnailSet(),
      processingStatus: createDefaultProcessingStatus(),
    }

    videoFiles.value.push(videoFile)

    // 异步生成缩略图和获取视频信息
    generateVideoInfo(videoFile)

    return videoFile
  }

  // 删除视频文件
  function removeVideoFile(id: string) {
    const index = videoFiles.value.findIndex(v => v.id === id)
    if (index > -1) {
      const videoFile = videoFiles.value[index]
      // 清理 URL 对象
      URL.revokeObjectURL(videoFile.url)
      if (videoFile.thumbnail) {
        URL.revokeObjectURL(videoFile.thumbnail)
      }
      // 清理新的缩略图结构
      if (videoFile.thumbnails.primary) {
        URL.revokeObjectURL(videoFile.thumbnails.primary)
      }
      videoFile.thumbnails.frames.forEach((frame) => {
        URL.revokeObjectURL(frame.url)
      })
      videoFiles.value.splice(index, 1)
    }
  }

  // 清空所有视频文件
  function clearVideoFiles() {
    videoFiles.value.forEach((videoFile) => {
      URL.revokeObjectURL(videoFile.url)
      if (videoFile.thumbnail) {
        URL.revokeObjectURL(videoFile.thumbnail)
      }
      // 清理新的缩略图结构
      if (videoFile.thumbnails.primary) {
        URL.revokeObjectURL(videoFile.thumbnails.primary)
      }
      videoFile.thumbnails.frames.forEach((frame) => {
        URL.revokeObjectURL(frame.url)
      })
    })
    videoFiles.value = []
  }

  // 生成视频缩略图和获取视频信息
  async function generateVideoInfo(videoFile: VideoFile) {
    try {
      isGeneratingThumbnail.value = true
      videoFile.thumbnails.generating = true

      // 创建视频元素
      const video = document.createElement('video')
      video.src = videoFile.url
      video.muted = true
      video.preload = 'metadata'
      video.crossOrigin = 'anonymous'

      // 添加到 DOM 中（某些浏览器需要）
      video.style.position = 'absolute'
      video.style.top = '-9999px'
      video.style.left = '-9999px'
      document.body.appendChild(video)

      try {
        // 等待视频元数据加载
        await new Promise<void>((resolve, reject) => {
          const timeout = setTimeout(() => {
            reject(new Error('视频加载超时'))
          }, 10000)

          video.addEventListener('loadedmetadata', () => {
            clearTimeout(timeout)
            videoFile.duration = video.duration * 1000

            // Extract metadata
            videoFile.metadata = {
              resolution: {
                width: video.videoWidth,
                height: video.videoHeight,
              },
              frameRate: 30, // Default, will be enhanced later
              codec: 'unknown', // Will be enhanced with MediaInfo API later
              bitrate: 0, // Will be enhanced later
              aspectRatio: calculateAspectRatio(video.videoWidth, video.videoHeight),
              colorSpace: undefined,
              audioTracks: [], // Will be enhanced later
            }

            videoFile.processingStatus.metadataExtracted = true
            resolve()
          })

          video.addEventListener('error', () => {
            clearTimeout(timeout)
            reject(new Error('视频加载失败'))
          })
        })

        // 跳转到指定时间点
        const seekTime = Math.min(2, video.duration * 0.1) // 取10%位置或2秒
        video.currentTime = seekTime

        // 等待跳转完成并生成缩略图
        await new Promise<void>((resolve) => {
          const timeout = setTimeout(() => {
            // 缩略图生成超时
            resolve()
          }, 8000)

          video.addEventListener('seeked', () => {
            clearTimeout(timeout)

            // 等待视频帧渲染
            setTimeout(() => {
              try {
                const canvas = document.createElement('canvas')
                const ctx = canvas.getContext('2d')

                if (ctx && video.videoWidth > 0 && video.videoHeight > 0) {
                  // 设置缩略图尺寸，保持16:9比例
                  canvas.width = 160
                  canvas.height = 90

                  // 绘制视频帧
                  ctx.drawImage(video, 0, 0, canvas.width, canvas.height)

                  // 转换为 blob
                  canvas.toBlob((blob) => {
                    if (blob) {
                      const thumbnailUrl = URL.createObjectURL(blob)
                      videoFile.thumbnail = thumbnailUrl // Keep for backward compatibility
                      videoFile.thumbnails.primary = thumbnailUrl
                      videoFile.thumbnails.frames.push({
                        url: thumbnailUrl,
                        timestamp: seekTime,
                      })
                      videoFile.processingStatus.thumbnailsGenerated = true
                      // 缩略图生成成功
                    }
                    resolve()
                  }, 'image/jpeg', 0.9)
                }
                else {
                  // 视频尺寸无效
                  resolve()
                }
              }
              catch (error) {
                console.error('缩略图生成失败:', error)
                resolve()
              }
            }, 100) // 等待100ms确保帧渲染完成
          })
        })
      }
      finally {
        // 清理 DOM
        document.body.removeChild(video)
      }
    }
    catch (error) {
      console.error('生成视频信息失败:', error)
      videoFile.processingStatus.error = error instanceof Error ? error.message : '未知错误'
    }
    finally {
      isGeneratingThumbnail.value = false
      videoFile.thumbnails.generating = false
    }
  }

  // 格式化文件大小
  function formatFileSize(bytes: number): string {
    if (bytes === 0)
      return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return `${Number.parseFloat((bytes / k ** i).toFixed(2))} ${sizes[i]}`
  }

  // 格式化时长
  function formatDuration(ms: number): string {
    const seconds = Math.floor(ms / 1000)
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = seconds % 60
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`
  }

  return {
    videoFiles: readonly(videoFiles),
    isGeneratingThumbnail: readonly(isGeneratingThumbnail),
    addVideoFile,
    removeVideoFile,
    clearVideoFiles,
    formatFileSize,
    formatDuration,
  }
})
