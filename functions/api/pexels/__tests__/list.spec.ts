import { afterEach, describe, expect, it, vi } from 'vitest'
import { onRequest } from '../list'

function createJsonResponse(payload: unknown, status: number): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
    },
  })
}

describe('functions/api/pexels/list', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns 503 when PEXELS_API_KEY is missing', async () => {
    const response = await onRequest({
      request: new Request('https://clippc.com/api/pexels/list?kind=image'),
      env: {},
    })

    expect(response.status).toBe(503)
    await expect(response.json()).resolves.toMatchObject({
      ok: false,
      error: 'PEXELS_API_KEY is not configured',
    })
  })

  it('returns image list with pagination', async () => {
    const fetchMock = vi.fn(async () => {
      return createJsonResponse({
        total_results: 120,
        photos: [
          {
            id: 1,
            width: 1200,
            height: 800,
            alt: 'cat',
            src: {
              original: 'https://images.pexels.com/photos/1/original.jpg',
              medium: 'https://images.pexels.com/photos/1/medium.jpg',
            },
          },
        ],
      }, 200)
    })
    vi.stubGlobal('fetch', fetchMock)

    const response = await onRequest({
      request: new Request('https://clippc.com/api/pexels/list?kind=image&page=2&perPage=12&query=cat'),
      env: {
        PEXELS_API_KEY: 'pexels-key',
      },
    })

    expect(response.status).toBe(200)
    const [requestUrl] = fetchMock.mock.calls[0]
    const parsedUrl = new URL(requestUrl)
    expect(parsedUrl.pathname).toBe('/v1/search')
    expect(parsedUrl.searchParams.get('page')).toBe('2')
    expect(parsedUrl.searchParams.get('per_page')).toBe('12')
    expect(parsedUrl.searchParams.get('query')).toBe('cat')

    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      data: {
        provider: 'pexels',
        kind: 'image',
        page: 2,
        perPage: 12,
        total: 120,
        assets: [
          {
            externalId: '1',
            sourceUrl: 'https://images.pexels.com/photos/1/original.jpg',
          },
        ],
      },
    })
  })

  it('returns video list and applies duration filters', async () => {
    const fetchMock = vi.fn(async () => {
      return createJsonResponse({
        total_results: 10,
        videos: [
          {
            id: 2,
            duration: 9.2,
            image: 'https://images.pexels.com/videos/2/preview.jpeg',
            video_files: [
              {
                file_type: 'video/mp4',
                quality: 'hd',
                width: 1920,
                height: 1080,
                link: 'https://player.vimeo.com/external/2-hd.mp4',
              },
            ],
          },
        ],
      }, 200)
    })
    vi.stubGlobal('fetch', fetchMock)

    const response = await onRequest({
      request: new Request('https://clippc.com/api/pexels/list?kind=video&minDurationSec=3&maxDurationSec=12'),
      env: {
        PEXELS_API_KEY: 'pexels-key',
      },
    })

    expect(response.status).toBe(200)
    const [requestUrl] = fetchMock.mock.calls[0]
    const parsedUrl = new URL(requestUrl)
    expect(parsedUrl.pathname).toBe('/videos/popular')
    expect(parsedUrl.searchParams.get('min_duration')).toBe('3')
    expect(parsedUrl.searchParams.get('max_duration')).toBe('12')

    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      data: {
        kind: 'video',
        assets: [
          {
            externalId: '2',
            sourceUrl: 'https://player.vimeo.com/external/2-hd.mp4',
            durationMs: 9200,
          },
        ],
      },
    })
  })

  it('returns 400 for invalid list parameters', async () => {
    const response = await onRequest({
      request: new Request('https://clippc.com/api/pexels/list?kind=image&page=0'),
      env: {
        PEXELS_API_KEY: 'pexels-key',
      },
    })

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toMatchObject({
      ok: false,
      error: 'page must be >= 1',
    })
  })
})
