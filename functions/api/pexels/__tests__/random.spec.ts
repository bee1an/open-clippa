import { afterEach, describe, expect, it, vi } from 'vitest'
import { onRequest } from '../random'

function createJsonResponse(payload: unknown, status: number): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
    },
  })
}

describe('functions/api/pexels/random', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns error when PEXELS_API_KEY is missing', async () => {
    const response = await onRequest({
      request: new Request('https://clippc.com/api/pexels/random?kind=image'),
      env: {},
    })

    expect(response.status).toBe(503)
    await expect(response.json()).resolves.toMatchObject({
      ok: false,
      error: 'PEXELS_API_KEY is not configured',
    })
  })

  it('returns random image asset from curated endpoint', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0)
    const fetchMock = vi.fn(async () => {
      return createJsonResponse({
        photos: [
          {
            id: 100,
            width: 1920,
            height: 1080,
            alt: 'hero-shot',
            photographer: 'alice',
            photographer_url: 'https://pexels.com/@alice',
            src: {
              original: 'https://images.pexels.com/photos/100/original.jpg',
              medium: 'https://images.pexels.com/photos/100/medium.jpg',
            },
          },
        ],
      }, 200)
    })
    vi.stubGlobal('fetch', fetchMock)

    const response = await onRequest({
      request: new Request('https://clippc.com/api/pexels/random?kind=image'),
      env: {
        PEXELS_API_KEY: 'pexels-key',
      },
    })

    expect(response.status).toBe(200)
    expect(fetchMock).toHaveBeenCalledTimes(1)

    const [requestUrl, requestInit] = fetchMock.mock.calls[0]
    const parsedUrl = new URL(requestUrl)
    expect(parsedUrl.pathname).toBe('/v1/curated')
    expect(parsedUrl.searchParams.get('per_page')).toBe('80')
    expect(parsedUrl.searchParams.get('page')).toBe('1')
    expect(parsedUrl.searchParams.get('orientation')).toBe('landscape')
    expect(requestInit.headers.authorization).toBe('pexels-key')

    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      data: {
        provider: 'pexels',
        kind: 'image',
        asset: {
          sourceUrl: 'https://images.pexels.com/photos/100/original.jpg',
          previewUrl: 'https://images.pexels.com/photos/100/medium.jpg',
          width: 1920,
          height: 1080,
          name: 'hero-shot',
          authorName: 'alice',
          authorUrl: 'https://pexels.com/@alice',
          externalId: '100',
        },
      },
    })
  })

  it('returns random video asset and prefers hd mp4 file', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0)
    const fetchMock = vi.fn(async () => {
      return createJsonResponse({
        videos: [
          {
            id: 200,
            width: 3840,
            height: 2160,
            duration: 12.8,
            image: 'https://images.pexels.com/videos/200/preview.jpeg',
            user: {
              name: 'bob',
              url: 'https://pexels.com/@bob',
            },
            video_files: [
              {
                file_type: 'video/mp4',
                quality: 'sd',
                width: 640,
                height: 360,
                link: 'https://player.vimeo.com/external/200-sd.mp4',
              },
              {
                file_type: 'video/mp4',
                quality: 'hd',
                width: 1920,
                height: 1080,
                link: 'https://player.vimeo.com/external/200-hd.mp4',
              },
            ],
          },
        ],
      }, 200)
    })
    vi.stubGlobal('fetch', fetchMock)

    const response = await onRequest({
      request: new Request('https://clippc.com/api/pexels/random?kind=video&query=drone&minDurationSec=3&maxDurationSec=20'),
      env: {
        PEXELS_API_KEY: 'pexels-key',
      },
    })

    expect(response.status).toBe(200)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [requestUrl] = fetchMock.mock.calls[0]
    const parsedUrl = new URL(requestUrl)
    expect(parsedUrl.pathname).toBe('/videos/search')
    expect(parsedUrl.searchParams.get('query')).toBe('drone')
    expect(parsedUrl.searchParams.get('min_duration')).toBe('3')
    expect(parsedUrl.searchParams.get('max_duration')).toBe('20')

    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      data: {
        provider: 'pexels',
        kind: 'video',
        asset: {
          sourceUrl: 'https://player.vimeo.com/external/200-hd.mp4',
          durationMs: 12800,
          width: 1920,
          height: 1080,
          authorName: 'bob',
          authorUrl: 'https://pexels.com/@bob',
          externalId: '200',
        },
      },
    })
  })

  it('retries with page=1 when first random page has no assets', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.95)
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(createJsonResponse({ photos: [] }, 200))
      .mockResolvedValueOnce(createJsonResponse({
        photos: [
          {
            id: 300,
            width: 1200,
            height: 800,
            src: {
              original: 'https://images.pexels.com/photos/300/original.jpg',
              medium: 'https://images.pexels.com/photos/300/medium.jpg',
            },
          },
        ],
      }, 200))
    vi.stubGlobal('fetch', fetchMock)

    const response = await onRequest({
      request: new Request('https://clippc.com/api/pexels/random?kind=image'),
      env: {
        PEXELS_API_KEY: 'pexels-key',
      },
    })

    expect(response.status).toBe(200)
    expect(fetchMock).toHaveBeenCalledTimes(2)

    const firstRequestUrl = new URL(fetchMock.mock.calls[0][0])
    const secondRequestUrl = new URL(fetchMock.mock.calls[1][0])
    expect(firstRequestUrl.searchParams.get('page')).not.toBe('1')
    expect(secondRequestUrl.searchParams.get('page')).toBe('1')
  })

  it('maps pexels rate limit to 429', async () => {
    const fetchMock = vi.fn(async () => {
      return createJsonResponse({ error: 'Too many requests' }, 429)
    })
    vi.stubGlobal('fetch', fetchMock)

    const response = await onRequest({
      request: new Request('https://clippc.com/api/pexels/random?kind=image'),
      env: {
        PEXELS_API_KEY: 'pexels-key',
      },
    })

    expect(response.status).toBe(429)
    await expect(response.json()).resolves.toMatchObject({
      ok: false,
      error: 'Too many requests',
    })
  })

  it('maps pexels 5xx to gateway error', async () => {
    const fetchMock = vi.fn(async () => {
      return createJsonResponse({ error: 'upstream unavailable' }, 503)
    })
    vi.stubGlobal('fetch', fetchMock)

    const response = await onRequest({
      request: new Request('https://clippc.com/api/pexels/random?kind=video'),
      env: {
        PEXELS_API_KEY: 'pexels-key',
      },
    })

    expect(response.status).toBe(502)
    await expect(response.json()).resolves.toMatchObject({
      ok: false,
      error: 'upstream unavailable',
    })
  })
})
