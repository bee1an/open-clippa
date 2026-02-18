import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createDefaultProcessingStatus,
  createDefaultThumbnailSet,
  createDefaultVideoMetadata,
  MediaStoreError,
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

function createJsonResponse(payload: unknown, status: number = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
    },
  })
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
  let revokeObjectURLSpy: { mockRestore: () => void }
  let createObjectURLSpy: { mockRestore: () => void }
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
    expect(video.file).toBe(file)
    expect(video.source).toBe(file)
    expect(video.sourceType).toBe('file')
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

  it('adds remote video url and keeps external url without revoke', async () => {
    generateThumbnailWithCodecMock.mockResolvedValue('blob:remote-thumb')
    const store = useMediaStore()

    const video = store.addVideoFromUrl('https://cdn.example.com/media/intro.mp4')

    expect(video.name).toBe('intro.mp4')
    expect(video.source).toBe('https://cdn.example.com/media/intro.mp4')
    expect(video.sourceType).toBe('url')
    expect(video.file).toBeUndefined()
    expect(video.url).toBe('https://cdn.example.com/media/intro.mp4')

    await vi.waitFor(() => {
      expect(generateThumbnailWithCodecMock).toHaveBeenCalledWith(video)
    })

    store.removeVideoFile(video.id)

    expect(revokeObjectURLSpy).toHaveBeenCalledWith('blob:remote-thumb')
    expect(revokeObjectURLSpy).not.toHaveBeenCalledWith('https://cdn.example.com/media/intro.mp4')
  })

  it('deduplicates remote video url import', () => {
    const store = useMediaStore()

    const first = store.addVideoFromUrl('https://cdn.example.com/media/intro.mp4')
    const duplicate = store.addVideoFromUrl('https://cdn.example.com/media/intro.mp4')

    expect(store.videoFiles).toHaveLength(1)
    expect(duplicate.id).toBe(first.id)
  })

  it('moves duplicated remote video to top of media list', () => {
    const store = useMediaStore()

    const first = store.addVideoFromUrl('https://cdn.example.com/media/intro.mp4')
    const second = store.addVideoFromUrl('https://cdn.example.com/media/scene.mp4')
    const duplicatedFirst = store.addVideoFromUrl('https://cdn.example.com/media/intro.mp4')

    expect(duplicatedFirst.id).toBe(first.id)
    expect(store.videoFiles).toHaveLength(2)
    expect(store.videoFiles[0]?.id).toBe(first.id)
    expect(store.videoFiles[1]?.id).toBe(second.id)
  })

  it('rejects invalid remote video url', () => {
    const store = useMediaStore()

    expect(() => store.addVideoFromUrl('')).toThrow('视频 URL 不能为空')
    expect(() => store.addVideoFromUrl('not-a-url')).toThrow('视频 URL 格式无效')
    expect(() => store.addVideoFromUrl('ftp://cdn.example.com/video.mp4')).toThrow('仅支持 http/https 视频 URL')
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

  it('supports image add/remove with local and remote sources', () => {
    const store = useMediaStore()
    const localImage = store.addImageFile(createMockFile('cover.png', 'image/png'))
    const remoteImage = store.addImageFromUrl('https://cdn.example.com/cover.jpg')
    const duplicateRemoteImage = store.addImageFromUrl('https://cdn.example.com/cover.jpg')

    expect(store.imageFiles).toHaveLength(2)
    expect(localImage.id).toBe('id-0')
    expect(localImage.url).toBe('blob:mock-0')
    expect(localImage.sourceType).toBe('file')
    expect(localImage.source).toBe(localImage.file)
    expect(remoteImage.id).toBe('id-1')
    expect(duplicateRemoteImage.id).toBe(remoteImage.id)
    expect(remoteImage.url).toBe('https://cdn.example.com/cover.jpg')
    expect(remoteImage.sourceType).toBe('url')
    expect(remoteImage.file).toBeUndefined()

    store.removeImageFile(localImage.id)
    expect(store.imageFiles).toHaveLength(1)
    expect(revokeObjectURLSpy).toHaveBeenCalledWith('blob:mock-0')
    store.removeImageFile(remoteImage.id)
    expect(store.imageFiles).toHaveLength(0)
    expect(revokeObjectURLSpy).not.toHaveBeenCalledWith('https://cdn.example.com/cover.jpg')

    expect(store.formatFileSize(0)).toBe('0 B')
    expect(store.formatFileSize(1536)).toBe('1.5 KB')
    expect(store.formatDuration(61000)).toBe('1:01')
    expect(store.formatDuration(3599000)).toBe('59:59')
  })

  it('moves duplicated remote image to top of media list', () => {
    const store = useMediaStore()

    const first = store.addImageFromUrl('https://cdn.example.com/a.jpg')
    const second = store.addImageFromUrl('https://cdn.example.com/b.jpg')
    const duplicatedFirst = store.addImageFromUrl('https://cdn.example.com/a.jpg')

    expect(duplicatedFirst.id).toBe(first.id)
    expect(store.imageFiles).toHaveLength(2)
    expect(store.imageFiles[0]?.id).toBe(first.id)
    expect(store.imageFiles[1]?.id).toBe(second.id)
  })

  it('imports random image from pexels', async () => {
    generateThumbnailWithCodecMock.mockResolvedValue('blob:thumbnail')
    vi.stubGlobal('fetch', vi.fn(async () => {
      return createJsonResponse({
        ok: true,
        data: {
          provider: 'pexels',
          kind: 'image',
          asset: {
            sourceUrl: 'https://images.pexels.com/photos/100/pexels-photo-100.jpeg',
            previewUrl: 'https://images.pexels.com/photos/100/preview.jpeg',
            width: 1920,
            height: 1080,
            name: 'pexels-image-100',
            externalId: '100',
          },
        },
      })
    }))

    const store = useMediaStore()
    const image = await store.importRandomImageFromPexels({
      query: 'city',
      orientation: 'landscape',
    })

    expect(image.sourceType).toBe('url')
    expect(image.url).toBe('https://images.pexels.com/photos/100/pexels-photo-100.jpeg')
    expect(image.name).toBe('pexels-image-100')
    expect(store.imageFiles).toHaveLength(1)
    expect((globalThis.fetch as any).mock.calls[0][0]).toContain('/api/pexels/random?')
  })

  it('imports random video from pexels and applies returned duration', async () => {
    generateThumbnailWithCodecMock.mockResolvedValue('blob:remote-thumb')
    vi.stubGlobal('fetch', vi.fn(async () => {
      return createJsonResponse({
        ok: true,
        data: {
          provider: 'pexels',
          kind: 'video',
          asset: {
            sourceUrl: 'https://player.vimeo.com/external/123.hd.mp4',
            previewUrl: 'https://images.pexels.com/videos/123/preview.jpeg',
            width: 1280,
            height: 720,
            durationMs: 9000,
            name: 'pexels-video-123',
            externalId: '123',
          },
        },
      })
    }))

    const store = useMediaStore()
    const video = await store.importRandomVideoFromPexels({
      query: 'nature',
      minDurationSec: 3,
      maxDurationSec: 12,
    })

    expect(video.sourceType).toBe('url')
    expect(video.url).toBe('https://player.vimeo.com/external/123.hd.mp4')
    expect(video.duration).toBe(9000)
    expect(video.metadata.resolution).toEqual({
      width: 1280,
      height: 720,
    })
    expect(store.videoFiles).toHaveLength(1)
  })

  it('throws INVALID_ARGUMENT for invalid pexels duration range', async () => {
    const store = useMediaStore()

    await expect(store.importRandomVideoFromPexels({
      minDurationSec: 8,
      maxDurationSec: 2,
    })).rejects.toBeInstanceOf(MediaStoreError)

    await expect(store.importRandomVideoFromPexels({
      minDurationSec: -1,
    })).rejects.toThrow('minDurationSec must be >= 0')
  })

  it('maps pexels upstream failure to NOT_READY', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => {
      return createJsonResponse({
        ok: false,
        error: 'PEXELS_API_KEY is not configured',
      }, 503)
    }))

    const store = useMediaStore()
    await expect(store.importRandomImageFromPexels()).rejects.toMatchObject({
      code: 'NOT_READY',
      message: 'PEXELS_API_KEY is not configured',
    })

    expect(store.formatFileSize(0)).toBe('0 B')
    expect((globalThis.fetch as any).mock.calls).toHaveLength(1)
  })
})
