import { defineStore } from 'pinia'
import { reactive, ref } from 'vue'

const REMOTE_ASSET_PROTOCOLS = new Set(['http:', 'https:'])
const PEXELS_RANDOM_ENDPOINT = '/api/pexels/random'
const PEXELS_ORIENTATION_VALUES = ['landscape', 'portrait', 'square'] as const
const PEXELS_ORIENTATION_SET = new Set<string>(PEXELS_ORIENTATION_VALUES)

export type PexelsOrientation = typeof PEXELS_ORIENTATION_VALUES[number]
export type MediaStoreErrorCode = 'INVALID_ARGUMENT' | 'NOT_READY'

interface PexelsRandomAssetPayload {
  sourceUrl: string
  previewUrl: string
  width: number
  height: number
  durationMs?: number
  name: string
  authorName?: string
  authorUrl?: string
  externalId: string
}

interface PexelsRandomResponse {
  ok: boolean
  error?: unknown
  data?: {
    provider?: unknown
    kind?: unknown
    asset?: unknown
  }
}

export interface ImportRandomImageFromPexelsOptions {
  query?: string
  orientation?: PexelsOrientation
  name?: string
}

export interface ImportRandomVideoFromPexelsOptions {
  query?: string
  orientation?: PexelsOrientation
  minDurationSec?: number
  maxDurationSec?: number
  name?: string
}

export class MediaStoreError extends Error {
  readonly code: MediaStoreErrorCode

  constructor(code: MediaStoreErrorCode, message: string) {
    super(message)
    this.name = 'MediaStoreError'
    this.code = code
  }
}

function isBlobUrl(url: string): boolean {
  return url.startsWith('blob:')
}

function revokeObjectUrlIfNeeded(url?: string): void {
  if (!url || !isBlobUrl(url))
    return
  URL.revokeObjectURL(url)
}

function normalizeRemoteAssetUrl(rawUrl: string, assetLabel: string): string {
  const value = rawUrl.trim()
  if (value.length === 0)
    throw new Error(`${assetLabel} URL 不能为空`)

  let parsedUrl: URL
  try {
    parsedUrl = new URL(value)
  }
  catch {
    throw new Error(`${assetLabel} URL 格式无效`)
  }

  if (!REMOTE_ASSET_PROTOCOLS.has(parsedUrl.protocol))
    throw new Error(`仅支持 http/https ${assetLabel} URL`)

  return parsedUrl.toString()
}

function normalizeRemoteVideoUrl(rawUrl: string): string {
  return normalizeRemoteAssetUrl(rawUrl, '视频')
}

function normalizeRemoteImageUrl(rawUrl: string): string {
  return normalizeRemoteAssetUrl(rawUrl, '图片')
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

function inferImageNameFromUrl(url: string): string {
  try {
    const parsedUrl = new URL(url)
    const fileName = decodeURIComponent(parsedUrl.pathname.split('/').pop() ?? '')
    if (fileName.trim().length > 0)
      return fileName.trim()
  }
  catch {}

  return `remote-image-${Date.now()}.jpg`
}

function isRemoteUrlSource(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0
}

function resolveOptionalString(value: string | undefined): string | undefined {
  const normalized = value?.trim()
  if (!normalized)
    return undefined
  return normalized
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object')
    return null
  return value as Record<string, unknown>
}

function resolveRandomOrientation(value: PexelsOrientation | undefined): PexelsOrientation {
  if (!value)
    return 'landscape'

  if (!PEXELS_ORIENTATION_SET.has(value))
    throw new MediaStoreError('INVALID_ARGUMENT', `orientation must be one of: ${PEXELS_ORIENTATION_VALUES.join(', ')}`)

  return value
}

function resolveOptionalNonNegativeInteger(
  value: number | undefined,
  fieldName: string,
): number | undefined {
  if (value === undefined)
    return undefined

  if (!Number.isFinite(value))
    throw new MediaStoreError('INVALID_ARGUMENT', `${fieldName} must be a finite number`)
  if (value < 0)
    throw new MediaStoreError('INVALID_ARGUMENT', `${fieldName} must be >= 0`)

  return Math.floor(value)
}

function resolvePexelsEndpointUrl(searchParams: URLSearchParams): string {
  if (typeof window === 'undefined' || !window.location)
    return `${PEXELS_RANDOM_ENDPOINT}?${searchParams.toString()}`

  const origin = /^https?:\/\//i.test(window.location.origin)
    ? window.location.origin
    : window.location.href

  try {
    const requestUrl = new URL(PEXELS_RANDOM_ENDPOINT, origin)
    requestUrl.search = searchParams.toString()
    return requestUrl.toString()
  }
  catch {
    return `${PEXELS_RANDOM_ENDPOINT}?${searchParams.toString()}`
  }
}

function resolveRemoteErrorMessage(payload: unknown, status: number): string {
  const record = asRecord(payload)
  if (record) {
    const detail = resolveOptionalString(typeof record.error === 'string' ? record.error : undefined)
      ?? resolveOptionalString(typeof record.message === 'string' ? record.message : undefined)
    if (detail)
      return detail
  }

  return `Pexels 请求失败（HTTP ${status}）`
}

function toPexelsAsset(payload: unknown): PexelsRandomAssetPayload | null {
  const record = asRecord(payload)
  if (!record)
    return null

  const sourceUrl = resolveOptionalString(typeof record.sourceUrl === 'string' ? record.sourceUrl : undefined)
  const previewUrl = resolveOptionalString(typeof record.previewUrl === 'string' ? record.previewUrl : undefined)
  const externalId = resolveOptionalString(typeof record.externalId === 'string' ? record.externalId : undefined)
  const name = resolveOptionalString(typeof record.name === 'string' ? record.name : undefined)
  const width = typeof record.width === 'number' && Number.isFinite(record.width) ? Math.max(0, Math.floor(record.width)) : 0
  const height = typeof record.height === 'number' && Number.isFinite(record.height) ? Math.max(0, Math.floor(record.height)) : 0
  const durationMs = typeof record.durationMs === 'number' && Number.isFinite(record.durationMs)
    ? Math.max(0, Math.floor(record.durationMs))
    : undefined

  if (!sourceUrl || !previewUrl || !externalId || !name)
    return null

  return {
    sourceUrl,
    previewUrl,
    width,
    height,
    durationMs,
    name,
    authorName: resolveOptionalString(typeof record.authorName === 'string' ? record.authorName : undefined),
    authorUrl: resolveOptionalString(typeof record.authorUrl === 'string' ? record.authorUrl : undefined),
    externalId,
  }
}

async function requestRandomPexelsAsset(
  kind: 'image' | 'video',
  options: {
    query?: string
    orientation?: PexelsOrientation
    minDurationSec?: number
    maxDurationSec?: number
  } = {},
): Promise<PexelsRandomAssetPayload> {
  const query = resolveOptionalString(options.query)
  const orientation = resolveRandomOrientation(options.orientation)
  const minDurationSec = resolveOptionalNonNegativeInteger(options.minDurationSec, 'minDurationSec')
  const maxDurationSec = resolveOptionalNonNegativeInteger(options.maxDurationSec, 'maxDurationSec')

  if (minDurationSec !== undefined && maxDurationSec !== undefined && maxDurationSec < minDurationSec)
    throw new MediaStoreError('INVALID_ARGUMENT', 'maxDurationSec must be >= minDurationSec')

  const searchParams = new URLSearchParams({
    kind,
    orientation,
  })
  if (query)
    searchParams.set('query', query)
  if (kind === 'video') {
    if (minDurationSec !== undefined)
      searchParams.set('minDurationSec', String(minDurationSec))
    if (maxDurationSec !== undefined)
      searchParams.set('maxDurationSec', String(maxDurationSec))
  }

  const requestUrl = resolvePexelsEndpointUrl(searchParams)
  let response: Response
  try {
    response = await fetch(requestUrl, {
      method: 'GET',
    })
  }
  catch {
    throw new MediaStoreError('NOT_READY', 'Pexels 服务请求失败')
  }

  let payload: PexelsRandomResponse | unknown = null
  try {
    payload = await response.json()
  }
  catch {
    payload = null
  }

  if (!response.ok)
    throw new MediaStoreError('NOT_READY', resolveRemoteErrorMessage(payload, response.status))

  const record = payload as PexelsRandomResponse
  const asset = toPexelsAsset(record?.data?.asset)
  if (!record?.ok || record?.data?.provider !== 'pexels' || record?.data?.kind !== kind || !asset)
    throw new MediaStoreError('NOT_READY', 'Pexels 响应格式无效')

  return asset
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
  file?: File
  source: string | File | Blob
  sourceType: 'file' | 'url'
  url: string
  size?: number
  createdAt?: Date
}

export const useMediaStore = defineStore('media', () => {
  const videoFiles = ref<VideoFile[]>([])
  const imageFiles = ref<ImageFile[]>([])
  const isGeneratingThumbnail = ref(false)

  function findRemoteVideoByUrl(url: string): VideoFile | undefined {
    return videoFiles.value.find((file) => {
      if (file.sourceType !== 'url')
        return false
      if (file.url === url)
        return true
      return isRemoteUrlSource(file.source) && file.source === url
    })
  }

  function findRemoteImageByUrl(url: string): ImageFile | undefined {
    return imageFiles.value.find((file) => {
      if (file.sourceType !== 'url')
        return false
      if (file.url === url)
        return true
      return isRemoteUrlSource(file.source) && file.source === url
    })
  }

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
    const existing = findRemoteVideoByUrl(normalizedUrl)
    if (existing)
      return existing

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
      source: file,
      sourceType: 'file',
      url: URL.createObjectURL(file),
      size: file.size,
      createdAt: new Date(),
    })

    imageFiles.value.push(imageFile)
    return imageFile
  }

  // 通过 URL 添加图片资源
  function addImageFromUrl(url: string, name?: string): ImageFile {
    const normalizedUrl = normalizeRemoteImageUrl(url)
    const existing = findRemoteImageByUrl(normalizedUrl)
    if (existing)
      return existing

    const resolvedName = name?.trim().length ? name.trim() : inferImageNameFromUrl(normalizedUrl)

    const imageFile: ImageFile = reactive({
      id: crypto.randomUUID(),
      name: resolvedName,
      source: normalizedUrl,
      sourceType: 'url',
      url: normalizedUrl,
      size: 0,
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
      revokeObjectUrlIfNeeded(imageFile.url)
      imageFiles.value.splice(index, 1)
    }
  }

  // 清空所有图片文件
  function clearImageFiles() {
    imageFiles.value.forEach((imageFile) => {
      revokeObjectUrlIfNeeded(imageFile.url)
    })
    imageFiles.value = []
  }

  async function importRandomImageFromPexels(
    options: ImportRandomImageFromPexelsOptions = {},
  ): Promise<ImageFile> {
    const asset = await requestRandomPexelsAsset('image', {
      query: options.query,
      orientation: options.orientation,
    })

    return addImageFromUrl(asset.sourceUrl, resolveOptionalString(options.name) ?? asset.name)
  }

  async function importRandomVideoFromPexels(
    options: ImportRandomVideoFromPexelsOptions = {},
  ): Promise<VideoFile> {
    const asset = await requestRandomPexelsAsset('video', {
      query: options.query,
      orientation: options.orientation,
      minDurationSec: options.minDurationSec,
      maxDurationSec: options.maxDurationSec,
    })

    const videoFile = addVideoFromUrl(asset.sourceUrl, resolveOptionalString(options.name) ?? asset.name)
    if (typeof asset.durationMs === 'number' && asset.durationMs > 0)
      videoFile.duration = asset.durationMs

    if (asset.width > 0 && asset.height > 0)
      videoFile.metadata.resolution = { width: asset.width, height: asset.height }

    return videoFile
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
    addImageFromUrl,
    importRandomImageFromPexels,
    importRandomVideoFromPexels,
    removeImageFile,
    clearImageFiles,
    formatFileSize,
    formatDuration,
  }
})
