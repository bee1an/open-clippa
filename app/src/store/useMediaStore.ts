import { defineStore } from 'pinia'
import { reactive, ref } from 'vue'

const REMOTE_VIDEO_PROTOCOLS = new Set(['http:', 'https:'])

function isBlobUrl(url: string): boolean {
  return url.startsWith('blob:')
}

function revokeObjectUrlIfNeeded(url?: string): void {
  if (!url || !isBlobUrl(url))
    return
  URL.revokeObjectURL(url)
}

function normalizeRemoteVideoUrl(rawUrl: string): string {
  const value = rawUrl.trim()
  if (value.length === 0)
    throw new Error('视频 URL 不能为空')

  let parsedUrl: URL
  try {
    parsedUrl = new URL(value)
  }
  catch {
    throw new Error('视频 URL 格式无效')
  }

  if (!REMOTE_VIDEO_PROTOCOLS.has(parsedUrl.protocol))
    throw new Error('仅支持 http/https 视频 URL')

  return parsedUrl.toString()
}

function inferVideoNameFromUrl(url: string): string {
  try {
    const parsedUrl = new URL(url)
    const fileName = decodeURIComponent(parsedUrl.pathname.split('/').pop() ?? '')
    if (fileName.trim().length > 0)
      return fileName.trim()
  }
  catch {}

  return `remote-video-${Date.now()}.mp4`
}

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
  file?: File
  source: string | File | Blob
  sourceType: 'file' | 'url'
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

export interface ImageFile {
  id: string
  name: string
  file: File
  url: string
  size?: number
  createdAt?: Date
}

export const useMediaStore = defineStore('media', () => {
  const videoFiles = ref<VideoFile[]>([])
  const imageFiles = ref<ImageFile[]>([])
  const isGeneratingThumbnail = ref(false)

  // 添加视频文件
  function addVideoFile(file: File): VideoFile {
    const videoFile: VideoFile = reactive({
      id: crypto.randomUUID(),
      name: file.name,
      file,
      source: file,
      sourceType: 'file',
      url: URL.createObjectURL(file),
      duration: 0,
      size: file.size,
      createdAt: new Date(),
      // Initialize new enhanced fields
      metadata: createDefaultVideoMetadata(),
      thumbnails: createDefaultThumbnailSet(),
      processingStatus: createDefaultProcessingStatus(),
    })

    videoFiles.value.push(videoFile)

    // 异步生成缩略图和获取视频信息
    generateVideoInfo(videoFile)

    return videoFile
  }

  // 通过 URL 添加视频资源
  function addVideoFromUrl(url: string, name?: string): VideoFile {
    const normalizedUrl = normalizeRemoteVideoUrl(url)
    const resolvedName = name?.trim().length ? name.trim() : inferVideoNameFromUrl(normalizedUrl)

    const videoFile: VideoFile = reactive({
      id: crypto.randomUUID(),
      name: resolvedName,
      source: normalizedUrl,
      sourceType: 'url',
      url: normalizedUrl,
      duration: 0,
      size: 0,
      createdAt: new Date(),
      metadata: createDefaultVideoMetadata(),
      thumbnails: createDefaultThumbnailSet(),
      processingStatus: createDefaultProcessingStatus(),
    })

    videoFiles.value.push(videoFile)
    generateVideoInfo(videoFile)
    return videoFile
  }

  // 删除视频文件
  function removeVideoFile(id: string) {
    const index = videoFiles.value.findIndex(v => v.id === id)
    if (index > -1) {
      const videoFile = videoFiles.value[index]
      // 清理 URL 对象
      revokeObjectUrlIfNeeded(videoFile.url)
      if (videoFile.thumbnail) {
        revokeObjectUrlIfNeeded(videoFile.thumbnail)
      }
      // 清理新的缩略图结构
      if (videoFile.thumbnails.primary) {
        revokeObjectUrlIfNeeded(videoFile.thumbnails.primary)
      }
      videoFile.thumbnails.frames.forEach((frame) => {
        revokeObjectUrlIfNeeded(frame.url)
      })
      videoFiles.value.splice(index, 1)
    }
  }

  // 清空所有视频文件
  function clearVideoFiles() {
    videoFiles.value.forEach((videoFile) => {
      revokeObjectUrlIfNeeded(videoFile.url)
      if (videoFile.thumbnail) {
        revokeObjectUrlIfNeeded(videoFile.thumbnail)
      }
      // 清理新的缩略图结构
      if (videoFile.thumbnails.primary) {
        revokeObjectUrlIfNeeded(videoFile.thumbnails.primary)
      }
      videoFile.thumbnails.frames.forEach((frame) => {
        revokeObjectUrlIfNeeded(frame.url)
      })
    })
    videoFiles.value = []
  }

  // 添加图片文件
  function addImageFile(file: File): ImageFile {
    const imageFile: ImageFile = reactive({
      id: crypto.randomUUID(),
      name: file.name,
      file,
      url: URL.createObjectURL(file),
      size: file.size,
      createdAt: new Date(),
    })

    imageFiles.value.push(imageFile)
    return imageFile
  }

  // 删除图片文件
  function removeImageFile(id: string) {
    const index = imageFiles.value.findIndex(v => v.id === id)
    if (index > -1) {
      const imageFile = imageFiles.value[index]
      URL.revokeObjectURL(imageFile.url)
      imageFiles.value.splice(index, 1)
    }
  }

  // 清空所有图片文件
  function clearImageFiles() {
    imageFiles.value.forEach((imageFile) => {
      URL.revokeObjectURL(imageFile.url)
    })
    imageFiles.value = []
  }

  // 生成视频缩略图和获取视频信息
  async function generateVideoInfo(videoFile: VideoFile) {
    try {
      isGeneratingThumbnail.value = true
      videoFile.thumbnails.generating = true

      // 使用 codec 子包生成缩略图
      const { generateThumbnailWithCodec } = await import('@/utils/thumbnailGenerator')

      try {
        const thumbnailUrl = await generateThumbnailWithCodec(videoFile)

        // 保存缩略图
        videoFile.thumbnail = thumbnailUrl // Keep for backward compatibility
        videoFile.thumbnails.primary = thumbnailUrl
        videoFile.thumbnails.frames.push({
          url: thumbnailUrl,
          timestamp: 1, // 1秒位置
        })

        // 标记处理完成
        videoFile.processingStatus.thumbnailsGenerated = true
        videoFile.processingStatus.metadataExtracted = true
      }
      catch (error) {
        console.error('使用 codec 生成缩略图失败:', error)
        // 生成失败时不设置缩略图，使用默认图片
        videoFile.processingStatus.thumbnailsGenerated = false
        videoFile.processingStatus.metadataExtracted = false
      }
    }
    catch (error) {
      console.error('生成视频信息失败:', error)
      videoFile.processingStatus.error = error instanceof Error ? error.message : '未知错误'
      videoFile.processingStatus.thumbnailsGenerated = false
      videoFile.processingStatus.metadataExtracted = false
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
    videoFiles,
    imageFiles,
    isGeneratingThumbnail,
    addVideoFile,
    addVideoFromUrl,
    removeVideoFile,
    clearVideoFiles,
    addImageFile,
    removeImageFile,
    clearImageFiles,
    formatFileSize,
    formatDuration,
  }
})
