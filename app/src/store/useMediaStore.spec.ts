import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createDefaultProcessingStatus,
  createDefaultThumbnailSet,
  createDefaultVideoMetadata,
  useMediaStore,
  validateThumbnailSet,
  validateVideoMetadata,
} from './useMediaStore'

const { generateThumbnailWithCodecMock } = vi.hoisted(() => {
  return {
    generateThumbnailWithCodecMock: vi.fn(),
  }
})

vi.mock('@/utils/thumbnailGenerator', () => {
  return {
    generateThumbnailWithCodec: generateThumbnailWithCodecMock,
  }
})

function createMockFile(name: string, type: string, content: string = 'content'): File {
  if (typeof File !== 'undefined')
    return new File([content], name, { type })

  const blob = new Blob([content], { type }) as File & { name?: string }
  Object.defineProperty(blob, 'name', { value: name })
  return blob as File
}

async function flushTasks(): Promise<void> {
  await Promise.resolve()
  await Promise.resolve()
  await Promise.resolve()
}

describe('useMediaStore helpers', () => {
  it('creates stable defaults', () => {
    expect(createDefaultVideoMetadata()).toEqual({
      resolution: { width: 0, height: 0 },
      frameRate: 0,
      codec: 'unknown',
      bitrate: 0,
      aspectRatio: '16:9',
      colorSpace: undefined,
      audioTracks: [],
    })

    expect(createDefaultThumbnailSet()).toEqual({
      primary: '',
      frames: [],
      generating: false,
    })

    expect(createDefaultProcessingStatus()).toEqual({
      metadataExtracted: false,
      thumbnailsGenerated: false,
      error: undefined,
    })
  })

  it('validates and fills metadata defaults', () => {
    expect(validateVideoMetadata({
      frameRate: 24,
      codec: 'h264',
      audioTracks: [{ index: 0, codec: 'aac', channels: 2, sampleRate: 48000 }],
    })).toEqual({
      resolution: { width: 0, height: 0 },
      frameRate: 24,
      codec: 'h264',
      bitrate: 0,
      aspectRatio: '16:9',
      colorSpace: undefined,
      audioTracks: [{ index: 0, codec: 'aac', channels: 2, sampleRate: 48000 }],
    })

    expect(validateThumbnailSet({
      primary: 'blob:thumb',
      frames: [{ url: 'blob:f1', timestamp: 1 }],
      generating: true,
    })).toEqual({
      primary: 'blob:thumb',
      frames: [{ url: 'blob:f1', timestamp: 1 }],
      generating: true,
    })
  })
})

describe('useMediaStore', () => {
  let revokeObjectURLSpy: ReturnType<typeof vi.spyOn>
  let createObjectURLSpy: ReturnType<typeof vi.spyOn>
  let objectUrlIndex: number

  beforeEach(() => {
    setActivePinia(createPinia())
    generateThumbnailWithCodecMock.mockReset()

    objectUrlIndex = 0
    createObjectURLSpy = vi.spyOn(URL, 'createObjectURL').mockImplementation(() => `blob:mock-${objectUrlIndex++}`)
    revokeObjectURLSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})

    let id = 0
    vi.stubGlobal('crypto', {
      randomUUID: vi.fn(() => `id-${id++}`),
    })
  })

  afterEach(() => {
    createObjectURLSpy.mockRestore()
    revokeObjectURLSpy.mockRestore()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('adds video and updates thumbnail status when generation succeeds', async () => {
    generateThumbnailWithCodecMock.mockResolvedValue('blob:thumbnail')

    const store = useMediaStore()
    const file = createMockFile('video.mp4', 'video/mp4')
    const video = store.addVideoFile(file)

    expect(store.videoFiles).toHaveLength(1)
    expect(video.id).toBe('id-0')
    expect(video.url).toBe('blob:mock-0')
    expect(video.thumbnails.generating).toBe(true)
    expect(store.isGeneratingThumbnail).toBe(true)

    await vi.waitFor(() => {
      expect(generateThumbnailWithCodecMock).toHaveBeenCalledTimes(1)
    })

    expect(generateThumbnailWithCodecMock).toHaveBeenCalledWith(video)
    expect(video.thumbnail).toBe('blob:thumbnail')
    expect(video.thumbnails.primary).toBe('blob:thumbnail')
    expect(video.thumbnails.frames).toEqual([{ url: 'blob:thumbnail', timestamp: 1 }])
    expect(video.processingStatus.thumbnailsGenerated).toBe(true)
    expect(video.processingStatus.metadataExtracted).toBe(true)
    expect(video.thumbnails.generating).toBe(false)
    expect(store.isGeneratingThumbnail).toBe(false)
  })

  it('handles thumbnail generation failure and keeps state recoverable', async () => {
    generateThumbnailWithCodecMock.mockRejectedValue(new Error('thumbnail failed'))
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const store = useMediaStore()
    const file = createMockFile('broken.mp4', 'video/mp4')
    const video = store.addVideoFile(file)

    await vi.waitFor(() => {
      expect(video.thumbnails.generating).toBe(false)
    })

    expect(video.processingStatus.thumbnailsGenerated).toBe(false)
    expect(video.processingStatus.metadataExtracted).toBe(false)
    expect(video.thumbnails.generating).toBe(false)
    expect(store.isGeneratingThumbnail).toBe(false)
    expect(consoleErrorSpy).toHaveBeenCalled()
  })

  it('removes video and revokes all related object URLs', async () => {
    generateThumbnailWithCodecMock.mockResolvedValue('blob:auto-thumb')
    const store = useMediaStore()
    const file = createMockFile('cleanup.mp4', 'video/mp4')
    const video = store.addVideoFile(file)
    await flushTasks()

    video.thumbnail = 'blob:legacy-thumb'
    video.thumbnails.primary = 'blob:primary-thumb'
    video.thumbnails.frames = [
      { url: 'blob:frame-1', timestamp: 1 },
      { url: 'blob:frame-2', timestamp: 2 },
    ]

    store.removeVideoFile(video.id)

    expect(store.videoFiles).toHaveLength(0)
    expect(revokeObjectURLSpy).toHaveBeenCalledWith(video.url)
    expect(revokeObjectURLSpy).toHaveBeenCalledWith('blob:legacy-thumb')
    expect(revokeObjectURLSpy).toHaveBeenCalledWith('blob:primary-thumb')
    expect(revokeObjectURLSpy).toHaveBeenCalledWith('blob:frame-1')
    expect(revokeObjectURLSpy).toHaveBeenCalledWith('blob:frame-2')
  })

  it('clears video and image collections with URL cleanup', async () => {
    generateThumbnailWithCodecMock.mockResolvedValue('blob:auto-thumb')
    const store = useMediaStore()

    const videoA = store.addVideoFile(createMockFile('a.mp4', 'video/mp4'))
    const videoB = store.addVideoFile(createMockFile('b.mp4', 'video/mp4'))
    await flushTasks()

    videoA.thumbnail = 'blob:a-thumb'
    videoA.thumbnails.primary = 'blob:a-primary'
    videoA.thumbnails.frames = [{ url: 'blob:a-frame', timestamp: 1 }]

    videoB.thumbnail = 'blob:b-thumb'
    videoB.thumbnails.primary = 'blob:b-primary'
    videoB.thumbnails.frames = [{ url: 'blob:b-frame', timestamp: 1 }]

    store.addImageFile(createMockFile('a.png', 'image/png'))
    store.addImageFile(createMockFile('b.png', 'image/png'))

    expect(store.videoFiles).toHaveLength(2)
    expect(store.imageFiles).toHaveLength(2)

    store.clearVideoFiles()
    store.clearImageFiles()

    expect(store.videoFiles).toHaveLength(0)
    expect(store.imageFiles).toHaveLength(0)
    expect(revokeObjectURLSpy).toHaveBeenCalledWith('blob:a-thumb')
    expect(revokeObjectURLSpy).toHaveBeenCalledWith('blob:b-thumb')
    expect(revokeObjectURLSpy).toHaveBeenCalledWith('blob:a-frame')
    expect(revokeObjectURLSpy).toHaveBeenCalledWith('blob:b-frame')
  })

  it('supports image add/remove and formatter helpers', () => {
    const store = useMediaStore()
    const image = store.addImageFile(createMockFile('cover.png', 'image/png'))

    expect(store.imageFiles).toHaveLength(1)
    expect(image.id).toBe('id-0')
    expect(image.url).toBe('blob:mock-0')

    store.removeImageFile(image.id)
    expect(store.imageFiles).toHaveLength(0)
    expect(revokeObjectURLSpy).toHaveBeenCalledWith('blob:mock-0')

    expect(store.formatFileSize(0)).toBe('0 B')
    expect(store.formatFileSize(1536)).toBe('1.5 KB')
    expect(store.formatDuration(61000)).toBe('1:01')
    expect(store.formatDuration(3599000)).toBe('59:59')
  })
})
