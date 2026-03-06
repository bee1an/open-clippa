import { defineStore } from 'pinia'
import { markRaw, reactive, ref } from 'vue'
import { readFileFromHandle } from '@/persistence/fileSystemAccess'
import { inspectMediaSource } from '@/utils/media'

const REMOTE_ASSET_PROTOCOLS = new Set(['http:', 'https:'])
const PEXELS_RANDOM_ENDPOINT = '/api/pexels/random'
const JAMENDO_SEARCH_ENDPOINT = '/api/jamendo/search'
const PEXELS_ORIENTATION_VALUES = ['landscape', 'portrait', 'square'] as const
const PEXELS_ORIENTATION_SET = new Set<string>(PEXELS_ORIENTATION_VALUES)
const VIDEO_EXTENSIONS = ['.mp4', '.avi', '.mov', '.mkv', '.webm', '.flv', '.wmv', '.m4v', '.3gp']
const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.svg', '.heic']
const AUDIO_EXTENSIONS = ['.mp3', '.wav', '.aac', '.m4a', '.ogg', '.opus', '.flac', '.weba']

export type PexelsOrientation = typeof PEXELS_ORIENTATION_VALUES[number]
export type MediaStoreErrorCode = 'INVALID_ARGUMENT' | 'NOT_READY'
export type MediaAssetSourceType = 'file' | 'url' | 'handle'

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

interface JamendoSearchResponse {
  ok: boolean
  error?: unknown
  data?: {
    provider?: unknown
    page?: unknown
    limit?: unknown
    total?: unknown
    tracks?: unknown
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

export interface SearchJamendoTracksOptions {
  query: string
  page?: number
  limit?: number
}

export interface JamendoTrack {
  id: string
  name: string
  duration: number
  audioUrl: string
  imageUrl?: string
  artistName?: string
  albumName?: string
  licenseUrl?: string
  shareUrl?: string
  audioDownloadAllowed: boolean
  audioDownloadUrl?: string
}

export interface JamendoTrackSearchResult {
  page: number
  limit: number
  total: number | null
  tracks: JamendoTrack[]
}

export interface AudioTrackInfo {
  index: number
  codec: string
  channels: number
  sampleRate: number
  bitrate?: number
}

export interface MediaWaveform {
  sampleCount: number
  peaks: number[]
}

export interface VideoMetadata {
  resolution: { width: number, height: number }
  frameRate: number
  codec: string
  bitrate: number
  aspectRatio: string
  colorSpace?: string
  audioTracks: AudioTrackInfo[]
  waveform: MediaWaveform
}

export interface AudioMetadata {
  codec: string
  bitrate: number
  channels: number
  sampleRate: number
  waveform: MediaWaveform
}

export interface ThumbnailFrame {
  url: string
  timestamp: number
}

export interface ThumbnailSet {
  primary: string
  frames: ThumbnailFrame[]
  generating: boolean
}

export interface ProcessingStatus {
  metadataExtracted: boolean
  thumbnailsGenerated: boolean
  error?: string
}

interface MediaFileBase {
  id: string
  name: string
  file?: File
  source: string | File | Blob
  sourceType: MediaAssetSourceType
  fileHandle?: FileSystemFileHandle
  url: string
  size: number
  createdAt: Date
}

export interface VideoFile extends MediaFileBase {
  duration: number
  thumbnail?: string
  metadata: VideoMetadata
  thumbnails: ThumbnailSet
  processingStatus: ProcessingStatus
}

export interface AudioFile extends MediaFileBase {
  duration: number
  metadata: AudioMetadata
  processingStatus: ProcessingStatus
}

export interface ImageFile extends MediaFileBase {}

export class MediaStoreError extends Error {
  readonly code: MediaStoreErrorCode

  constructor(code: MediaStoreErrorCode, message: string) {
    super(message)
    this.name = 'MediaStoreError'
    this.code = code
  }
}

export function createDefaultWaveform(sampleCount: number = 96): MediaWaveform {
  return {
    sampleCount,
    peaks: Array.from({ length: sampleCount }, () => 0),
  }
}

export function createDefaultAudioMetadata(): AudioMetadata {
  return {
    codec: 'unknown',
    bitrate: 0,
    channels: 0,
    sampleRate: 0,
    waveform: createDefaultWaveform(),
  }
}

export function createDefaultVideoMetadata(): VideoMetadata {
  return {
    resolution: { width: 0, height: 0 },
    frameRate: 0,
    codec: 'unknown',
    bitrate: 0,
    aspectRatio: '16:9',
    colorSpace: undefined,
    audioTracks: [],
    waveform: createDefaultWaveform(),
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
    waveform: metadata.waveform || defaults.waveform,
  }
}

export function validateAudioMetadata(metadata: Partial<AudioMetadata>): AudioMetadata {
  const defaults = createDefaultAudioMetadata()
  return {
    codec: metadata.codec || defaults.codec,
    bitrate: metadata.bitrate || defaults.bitrate,
    channels: metadata.channels || defaults.channels,
    sampleRate: metadata.sampleRate || defaults.sampleRate,
    waveform: metadata.waveform || defaults.waveform,
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

function normalizeRemoteAudioUrl(rawUrl: string): string {
  return normalizeRemoteAssetUrl(rawUrl, '音频')
}

function inferNameFromUrl(url: string, fallbackPrefix: string, fallbackExtension: string): string {
  try {
    const parsedUrl = new URL(url)
    const fileName = decodeURIComponent(parsedUrl.pathname.split('/').pop() ?? '')
    if (fileName.trim().length > 0)
      return fileName.trim()
  }
  catch {}

  return `${fallbackPrefix}-${Date.now()}${fallbackExtension}`
}

function isRemoteUrlSource(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0
}

function hasExtension(name: string, extensions: string[]): boolean {
  const normalizedName = name.toLowerCase()
  return extensions.some(extension => normalizedName.endsWith(extension))
}

function isVideoFileLike(file: File): boolean {
  if (file.type.toLowerCase().startsWith('video/'))
    return true

  return hasExtension(file.name, VIDEO_EXTENSIONS)
}

function isImageFileLike(file: File): boolean {
  if (file.type.toLowerCase().startsWith('image/'))
    return true

  return hasExtension(file.name, IMAGE_EXTENSIONS)
}

function isAudioFileLike(file: File): boolean {
  if (file.type.toLowerCase().startsWith('audio/'))
    return true

  return hasExtension(file.name, AUDIO_EXTENSIONS)
}

function resolveOptionalString(value: string | undefined): string | undefined {
  const normalized = value?.trim()
  if (!normalized)
    return undefined

  return normalized
}

function normalizeFileHandle(handle: FileSystemFileHandle | undefined): FileSystemFileHandle | undefined {
  if (!handle)
    return undefined

  return markRaw(handle)
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object')
    return null

  return value as Record<string, unknown>
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : []
}

function resolveRandomOrientation(value: PexelsOrientation | undefined): PexelsOrientation {
  if (!value)
    return 'landscape'

  if (!PEXELS_ORIENTATION_SET.has(value))
    throw new MediaStoreError('INVALID_ARGUMENT', `orientation must be one of: ${PEXELS_ORIENTATION_VALUES.join(', ')}`)

  return value
}

function resolvePositiveInteger(value: number | undefined, fieldName: string, fallback: number, maxValue: number): number {
  if (value === undefined)
    return fallback

  if (!Number.isFinite(value))
    throw new MediaStoreError('INVALID_ARGUMENT', `${fieldName} must be a finite number`)

  const normalized = Math.floor(value)
  if (normalized < 1)
    throw new MediaStoreError('INVALID_ARGUMENT', `${fieldName} must be >= 1`)

  return Math.min(maxValue, normalized)
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

function calculateAspectRatio(width: number, height: number): string {
  if (width === 0 || height === 0)
    return '16:9'

  const gcd = (a: number, b: number): number => {
    return b === 0 ? a : gcd(b, a % b)
  }

  const divisor = gcd(width, height)
  const aspectWidth = width / divisor
  const aspectHeight = height / divisor

  if (aspectWidth > 9 || aspectHeight > 9) {
    const ratio = width / height
    if (ratio > 1.7)
      return '16:9'
    if (ratio > 1.5)
      return '3:2'
    if (ratio > 1.3)
      return '4:3'
    if (ratio > 0.9)
      return '1:1'
    return '9:16'
  }

  return `${aspectWidth}:${aspectHeight}`
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

function toJamendoTrack(payload: unknown): JamendoTrack | null {
  const record = asRecord(payload)
  if (!record)
    return null

  const id = resolveOptionalString(typeof record.id === 'string' ? record.id : undefined)
  const name = resolveOptionalString(typeof record.name === 'string' ? record.name : undefined)
  const audioUrl = resolveOptionalString(typeof record.audioUrl === 'string' ? record.audioUrl : undefined)
  const duration = typeof record.durationMs === 'number' && Number.isFinite(record.durationMs)
    ? Math.max(0, Math.floor(record.durationMs))
    : 0

  if (!id || !name || !audioUrl)
    return null

  return {
    id,
    name,
    duration,
    audioUrl,
    imageUrl: resolveOptionalString(typeof record.imageUrl === 'string' ? record.imageUrl : undefined) ?? undefined,
    artistName: resolveOptionalString(typeof record.artistName === 'string' ? record.artistName : undefined) ?? undefined,
    albumName: resolveOptionalString(typeof record.albumName === 'string' ? record.albumName : undefined) ?? undefined,
    licenseUrl: resolveOptionalString(typeof record.licenseUrl === 'string' ? record.licenseUrl : undefined) ?? undefined,
    shareUrl: resolveOptionalString(typeof record.shareUrl === 'string' ? record.shareUrl : undefined) ?? undefined,
    audioDownloadAllowed: record.audioDownloadAllowed === true,
    audioDownloadUrl: resolveOptionalString(typeof record.audioDownloadUrl === 'string' ? record.audioDownloadUrl : undefined) ?? undefined,
  }
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
    response = await fetch(requestUrl, { method: 'GET' })
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

async function requestJamendoTracks(
  options: SearchJamendoTracksOptions,
): Promise<JamendoTrackSearchResult> {
  const query = resolveOptionalString(options.query)
  if (!query)
    throw new MediaStoreError('INVALID_ARGUMENT', 'query is required')

  const page = resolvePositiveInteger(options.page, 'page', 1, Number.MAX_SAFE_INTEGER)
  const limit = resolvePositiveInteger(options.limit, 'limit', 12, 50)
  const searchParams = new URLSearchParams({
    query,
    page: String(page),
    limit: String(limit),
  })

  const requestUrl = typeof window === 'undefined' || !window.location
    ? `${JAMENDO_SEARCH_ENDPOINT}?${searchParams.toString()}`
    : new URL(`${JAMENDO_SEARCH_ENDPOINT}?${searchParams.toString()}`, window.location.origin).toString()

  let response: Response
  try {
    response = await fetch(requestUrl, { method: 'GET' })
  }
  catch {
    throw new MediaStoreError('NOT_READY', 'Jamendo 服务请求失败')
  }

  let payload: JamendoSearchResponse | unknown = null
  try {
    payload = await response.json()
  }
  catch {
    payload = null
  }

  if (!response.ok)
    throw new MediaStoreError('NOT_READY', resolveRemoteErrorMessage(payload, response.status))

  const record = payload as JamendoSearchResponse
  const tracks = asArray(record?.data?.tracks)
    .map(toJamendoTrack)
    .filter((item): item is JamendoTrack => item !== null)

  if (!record?.ok || record?.data?.provider !== 'jamendo')
    throw new MediaStoreError('NOT_READY', 'Jamendo 响应格式无效')

  return {
    page,
    limit,
    total: typeof record.data?.total === 'number' && Number.isFinite(record.data.total)
      ? Math.max(0, Math.floor(record.data.total))
      : null,
    tracks,
  }
}

export const useMediaStore = defineStore('media', () => {
  const videoFiles = ref<VideoFile[]>([])
  const audioFiles = ref<AudioFile[]>([])
  const imageFiles = ref<ImageFile[]>([])
  const isGeneratingThumbnail = ref(false)
  const persistenceRevision = ref(0)

  function markPersistenceDirty(): void {
    persistenceRevision.value += 1
  }

  function moveItemToTop<T extends { id: string }>(items: T[], targetId: string): T | undefined {
    const index = items.findIndex(file => file.id === targetId)
    if (index <= 0)
      return items[index]

    const [file] = items.splice(index, 1)
    if (file)
      items.unshift(file)

    return file
  }

  function findRemoteByUrl<T extends { sourceType: MediaAssetSourceType, url: string, source: string | File | Blob }>(
    items: T[],
    url: string,
  ): T | undefined {
    return items.find((file) => {
      if (file.sourceType !== 'url')
        return false
      if (file.url === url)
        return true
      return isRemoteUrlSource(file.source) && file.source === url
    })
  }

  function createBaseFile<T extends MediaFileBase>(
    payload: Omit<T, 'createdAt'> & { createdAt?: Date },
  ): T {
    return reactive({
      ...payload,
      createdAt: payload.createdAt ?? new Date(),
    }) as T
  }

  function createVideoFile(
    payload: {
      id?: string
      name: string
      source: string | File | Blob
      sourceType: MediaAssetSourceType
      url: string
      size?: number
      file?: File
      fileHandle?: FileSystemFileHandle
    },
  ): VideoFile {
    return createBaseFile<VideoFile>({
      id: payload.id ?? crypto.randomUUID(),
      name: payload.name,
      file: payload.file,
      source: payload.source,
      sourceType: payload.sourceType,
      fileHandle: normalizeFileHandle(payload.fileHandle),
      url: payload.url,
      duration: 0,
      size: payload.size ?? payload.file?.size ?? 0,
      thumbnail: '',
      metadata: createDefaultVideoMetadata(),
      thumbnails: createDefaultThumbnailSet(),
      processingStatus: createDefaultProcessingStatus(),
    })
  }

  function createAudioFile(
    payload: {
      id?: string
      name: string
      source: string | File | Blob
      sourceType: MediaAssetSourceType
      url: string
      size?: number
      file?: File
      fileHandle?: FileSystemFileHandle
    },
  ): AudioFile {
    return createBaseFile<AudioFile>({
      id: payload.id ?? crypto.randomUUID(),
      name: payload.name,
      file: payload.file,
      source: payload.source,
      sourceType: payload.sourceType,
      fileHandle: normalizeFileHandle(payload.fileHandle),
      url: payload.url,
      duration: 0,
      size: payload.size ?? payload.file?.size ?? 0,
      metadata: createDefaultAudioMetadata(),
      processingStatus: createDefaultProcessingStatus(),
    })
  }

  function createImageFile(
    payload: {
      id?: string
      name: string
      source: string | File | Blob
      sourceType: MediaAssetSourceType
      url: string
      size?: number
      file?: File
      fileHandle?: FileSystemFileHandle
    },
  ): ImageFile {
    return createBaseFile<ImageFile>({
      id: payload.id ?? crypto.randomUUID(),
      name: payload.name,
      file: payload.file,
      source: payload.source,
      sourceType: payload.sourceType,
      fileHandle: normalizeFileHandle(payload.fileHandle),
      url: payload.url,
      size: payload.size ?? payload.file?.size ?? 0,
    })
  }

  function cleanupVideoFile(videoFile: VideoFile): void {
    revokeObjectUrlIfNeeded(videoFile.url)
    if (videoFile.thumbnail)
      revokeObjectUrlIfNeeded(videoFile.thumbnail)
    if (videoFile.thumbnails.primary)
      revokeObjectUrlIfNeeded(videoFile.thumbnails.primary)
    videoFile.thumbnails.frames.forEach((frame) => {
      revokeObjectUrlIfNeeded(frame.url)
    })
  }

  function cleanupAudioFile(audioFile: AudioFile): void {
    revokeObjectUrlIfNeeded(audioFile.url)
  }

  function cleanupImageFile(imageFile: ImageFile): void {
    revokeObjectUrlIfNeeded(imageFile.url)
  }

  function setAudioMetadata(audioFile: AudioFile, metadata: Awaited<ReturnType<typeof inspectMediaSource>>): void {
    const primaryTrack = metadata.audioTracks[0]
    audioFile.duration = metadata.durationMs
    audioFile.metadata = validateAudioMetadata({
      codec: primaryTrack?.codec ?? 'unknown',
      bitrate: primaryTrack?.bitrate ?? 0,
      channels: primaryTrack?.channels ?? 0,
      sampleRate: primaryTrack?.sampleRate ?? 0,
      waveform: metadata.waveform
        ? {
            sampleCount: metadata.waveform.sampleCount,
            peaks: [...metadata.waveform.peaks],
          }
        : createDefaultWaveform(),
    })
  }

  function setVideoMetadata(videoFile: VideoFile, metadata: Awaited<ReturnType<typeof inspectMediaSource>>): void {
    videoFile.duration = metadata.durationMs
    videoFile.metadata = validateVideoMetadata({
      resolution: {
        width: metadata.video?.width ?? 0,
        height: metadata.video?.height ?? 0,
      },
      frameRate: metadata.video?.frameRate ?? 0,
      codec: metadata.video?.codec ?? 'unknown',
      bitrate: metadata.video?.bitrate ?? 0,
      aspectRatio: calculateAspectRatio(
        metadata.video?.width ?? 0,
        metadata.video?.height ?? 0,
      ),
      audioTracks: metadata.audioTracks.map(track => ({
        index: track.index,
        codec: track.codec,
        channels: track.channels,
        sampleRate: track.sampleRate,
        bitrate: track.bitrate,
      })),
      waveform: metadata.waveform
        ? {
            sampleCount: metadata.waveform.sampleCount,
            peaks: [...metadata.waveform.peaks],
          }
        : createDefaultWaveform(),
    })
  }

  async function generateVideoInfo(videoFile: VideoFile): Promise<void> {
    try {
      isGeneratingThumbnail.value = true
      videoFile.thumbnails.generating = true

      const metadata = await inspectMediaSource(videoFile.file ?? videoFile.url)
      setVideoMetadata(videoFile, metadata)

      const { generateThumbnailWithCodec } = await import('@/utils/thumbnailGenerator')
      const thumbnailUrl = await generateThumbnailWithCodec(videoFile)

      videoFile.thumbnail = thumbnailUrl
      videoFile.thumbnails.primary = thumbnailUrl
      videoFile.thumbnails.frames = [{ url: thumbnailUrl, timestamp: 1 }]
      videoFile.processingStatus.thumbnailsGenerated = true
      videoFile.processingStatus.metadataExtracted = true
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

  async function generateAudioInfo(audioFile: AudioFile): Promise<void> {
    try {
      const metadata = await inspectMediaSource(audioFile.file ?? audioFile.url)
      setAudioMetadata(audioFile, metadata)
      audioFile.processingStatus.metadataExtracted = true
      audioFile.processingStatus.thumbnailsGenerated = true
    }
    catch (error) {
      console.error('生成音频信息失败:', error)
      audioFile.processingStatus.error = error instanceof Error ? error.message : '未知错误'
      audioFile.processingStatus.metadataExtracted = false
      audioFile.processingStatus.thumbnailsGenerated = false
    }
  }

  function addVideoFile(
    file: File,
    options: {
      id?: string
      sourceType?: 'file' | 'handle'
      fileHandle?: FileSystemFileHandle
    } = {},
  ): VideoFile {
    const objectUrl = URL.createObjectURL(file)
    const videoFile = createVideoFile({
      id: options.id,
      name: file.name,
      file,
      source: objectUrl,
      sourceType: options.sourceType ?? 'file',
      fileHandle: options.fileHandle,
      url: objectUrl,
      size: file.size,
    })

    videoFiles.value.unshift(videoFile)
    void generateVideoInfo(videoFile)
    markPersistenceDirty()
    return videoFile
  }

  function addVideoFromUrl(url: string, name?: string, id?: string): VideoFile {
    const normalizedUrl = normalizeRemoteVideoUrl(url)
    const existing = findRemoteByUrl(videoFiles.value, normalizedUrl)
    if (existing)
      return moveItemToTop(videoFiles.value, existing.id) ?? existing

    const videoFile = createVideoFile({
      id,
      name: name?.trim().length ? name.trim() : inferNameFromUrl(normalizedUrl, 'remote-video', '.mp4'),
      source: normalizedUrl,
      sourceType: 'url',
      url: normalizedUrl,
    })

    videoFiles.value.unshift(videoFile)
    void generateVideoInfo(videoFile)
    markPersistenceDirty()
    return videoFile
  }

  async function addVideoFromFileHandle(
    handle: FileSystemFileHandle,
    options: { id?: string, requestPermission?: boolean } = {},
  ): Promise<VideoFile> {
    const file = await readFileFromHandle(handle, { requestPermission: options.requestPermission })
    if (!isVideoFileLike(file))
      throw new MediaStoreError('INVALID_ARGUMENT', `Unsupported video file type: ${file.name}`)

    return addVideoFile(file, {
      id: options.id,
      sourceType: 'handle',
      fileHandle: handle,
    })
  }

  function addAudioFile(
    file: File,
    options: {
      id?: string
      sourceType?: 'file' | 'handle'
      fileHandle?: FileSystemFileHandle
    } = {},
  ): AudioFile {
    const objectUrl = URL.createObjectURL(file)
    const audioFile = createAudioFile({
      id: options.id,
      name: file.name,
      file,
      source: objectUrl,
      sourceType: options.sourceType ?? 'file',
      fileHandle: options.fileHandle,
      url: objectUrl,
      size: file.size,
    })

    audioFiles.value.unshift(audioFile)
    void generateAudioInfo(audioFile)
    markPersistenceDirty()
    return audioFile
  }

  function addAudioFromUrl(url: string, name?: string, id?: string): AudioFile {
    const normalizedUrl = normalizeRemoteAudioUrl(url)
    const existing = findRemoteByUrl(audioFiles.value, normalizedUrl)
    if (existing)
      return moveItemToTop(audioFiles.value, existing.id) ?? existing

    const audioFile = createAudioFile({
      id,
      name: name?.trim().length ? name.trim() : inferNameFromUrl(normalizedUrl, 'remote-audio', '.mp3'),
      source: normalizedUrl,
      sourceType: 'url',
      url: normalizedUrl,
    })

    audioFiles.value.unshift(audioFile)
    void generateAudioInfo(audioFile)
    markPersistenceDirty()
    return audioFile
  }

  async function addAudioFromFileHandle(
    handle: FileSystemFileHandle,
    options: { id?: string, requestPermission?: boolean } = {},
  ): Promise<AudioFile> {
    const file = await readFileFromHandle(handle, { requestPermission: options.requestPermission })
    if (!isAudioFileLike(file))
      throw new MediaStoreError('INVALID_ARGUMENT', `Unsupported audio file type: ${file.name}`)

    return addAudioFile(file, {
      id: options.id,
      sourceType: 'handle',
      fileHandle: handle,
    })
  }

  function addImageFile(
    file: File,
    options: {
      id?: string
      sourceType?: 'file' | 'handle'
      fileHandle?: FileSystemFileHandle
    } = {},
  ): ImageFile {
    const objectUrl = URL.createObjectURL(file)
    const imageFile = createImageFile({
      id: options.id,
      name: file.name,
      file,
      source: objectUrl,
      sourceType: options.sourceType ?? 'file',
      fileHandle: options.fileHandle,
      url: objectUrl,
      size: file.size,
    })

    imageFiles.value.unshift(imageFile)
    markPersistenceDirty()
    return imageFile
  }

  function addImageFromUrl(url: string, name?: string, id?: string): ImageFile {
    const normalizedUrl = normalizeRemoteImageUrl(url)
    const existing = findRemoteByUrl(imageFiles.value, normalizedUrl)
    if (existing)
      return moveItemToTop(imageFiles.value, existing.id) ?? existing

    const imageFile = createImageFile({
      id,
      name: name?.trim().length ? name.trim() : inferNameFromUrl(normalizedUrl, 'remote-image', '.jpg'),
      source: normalizedUrl,
      sourceType: 'url',
      url: normalizedUrl,
    })

    imageFiles.value.unshift(imageFile)
    markPersistenceDirty()
    return imageFile
  }

  async function addImageFromFileHandle(
    handle: FileSystemFileHandle,
    options: { id?: string, requestPermission?: boolean } = {},
  ): Promise<ImageFile> {
    const file = await readFileFromHandle(handle, { requestPermission: options.requestPermission })
    if (!isImageFileLike(file))
      throw new MediaStoreError('INVALID_ARGUMENT', `Unsupported image file type: ${file.name}`)

    return addImageFile(file, {
      id: options.id,
      sourceType: 'handle',
      fileHandle: handle,
    })
  }

  function removeVideoFile(id: string): void {
    const index = videoFiles.value.findIndex(file => file.id === id)
    if (index === -1)
      return

    const [videoFile] = videoFiles.value.splice(index, 1)
    if (videoFile)
      cleanupVideoFile(videoFile)
    markPersistenceDirty()
  }

  function removeAudioFile(id: string): void {
    const index = audioFiles.value.findIndex(file => file.id === id)
    if (index === -1)
      return

    const [audioFile] = audioFiles.value.splice(index, 1)
    if (audioFile)
      cleanupAudioFile(audioFile)
    markPersistenceDirty()
  }

  function removeImageFile(id: string): void {
    const index = imageFiles.value.findIndex(file => file.id === id)
    if (index === -1)
      return

    const [imageFile] = imageFiles.value.splice(index, 1)
    if (imageFile)
      cleanupImageFile(imageFile)
    markPersistenceDirty()
  }

  function clearVideoFiles(): void {
    videoFiles.value.forEach(cleanupVideoFile)
    videoFiles.value = []
    markPersistenceDirty()
  }

  function clearAudioFiles(): void {
    audioFiles.value.forEach(cleanupAudioFile)
    audioFiles.value = []
    markPersistenceDirty()
  }

  function clearImageFiles(): void {
    imageFiles.value.forEach(cleanupImageFile)
    imageFiles.value = []
    markPersistenceDirty()
  }

  function clearAllMedia(): void {
    clearVideoFiles()
    clearAudioFiles()
    clearImageFiles()
  }

  async function importFromFileHandles(handles: FileSystemFileHandle[]): Promise<void> {
    for (const handle of handles) {
      const file = await readFileFromHandle(handle)

      if (isVideoFileLike(file)) {
        addVideoFile(file, { sourceType: 'handle', fileHandle: handle })
        continue
      }

      if (isAudioFileLike(file)) {
        addAudioFile(file, { sourceType: 'handle', fileHandle: handle })
        continue
      }

      if (isImageFileLike(file))
        addImageFile(file, { sourceType: 'handle', fileHandle: handle })
    }
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

    if (asset.width > 0 && asset.height > 0) {
      videoFile.metadata = {
        ...videoFile.metadata,
        resolution: { width: asset.width, height: asset.height },
        aspectRatio: calculateAspectRatio(asset.width, asset.height),
      }
    }

    return videoFile
  }

  async function searchJamendoTracks(
    options: SearchJamendoTracksOptions,
  ): Promise<JamendoTrackSearchResult> {
    return await requestJamendoTracks(options)
  }

  function importJamendoTrack(track: JamendoTrack): AudioFile {
    const assetName = track.artistName
      ? `${track.artistName} - ${track.name}`
      : track.name

    return addAudioFromUrl(track.audioUrl, assetName, `jamendo-${track.id}`)
  }

  function formatFileSize(bytes: number): string {
    if (bytes === 0)
      return '0 B'

    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return `${Number.parseFloat((bytes / k ** i).toFixed(2))} ${sizes[i]}`
  }

  function formatDuration(ms: number): string {
    const seconds = Math.floor(ms / 1000)
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = seconds % 60
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`
  }

  return {
    videoFiles,
    audioFiles,
    imageFiles,
    isGeneratingThumbnail,
    persistenceRevision,
    addVideoFile,
    addVideoFromUrl,
    addVideoFromFileHandle,
    addAudioFile,
    addAudioFromUrl,
    addAudioFromFileHandle,
    addImageFile,
    addImageFromUrl,
    addImageFromFileHandle,
    importFromFileHandles,
    importRandomImageFromPexels,
    importRandomVideoFromPexels,
    searchJamendoTracks,
    importJamendoTrack,
    removeVideoFile,
    removeAudioFile,
    removeImageFile,
    clearVideoFiles,
    clearAudioFiles,
    clearImageFiles,
    clearAllMedia,
    formatFileSize,
    formatDuration,
  }
})
