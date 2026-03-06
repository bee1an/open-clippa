import { afterEach, describe, expect, it, vi } from 'vitest'
import { onRequest } from '../search'

function createJsonResponse(payload: unknown, status: number): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
    },
  })
}

describe('functions/api/jamendo/search', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns 503 when JAMENDO_CLIENT_ID is missing', async () => {
    const response = await onRequest({
      request: new Request('https://clippc.com/api/jamendo/search?query=ambient'),
      env: {},
    })

    expect(response.status).toBe(503)
    await expect(response.json()).resolves.toMatchObject({
      ok: false,
      error: 'JAMENDO_CLIENT_ID is not configured',
    })
  })

  it('returns mapped jamendo tracks and pagination', async () => {
    const fetchMock = vi.fn(async () => {
      return createJsonResponse({
        headers: {
          results_count: 1,
          results_fullcount: 37,
        },
        results: [
          {
            id: 'track-1',
            name: 'Night Drive',
            duration: 183,
            audio: 'https://cdn.jamendo.com/track-1.mp3',
            image: 'https://img.jamendo.com/track-1.jpg',
            artist_name: 'Atlas',
            album_name: 'Roads',
            license_ccurl: 'https://creativecommons.org/licenses/by/4.0/',
            shareurl: 'https://www.jamendo.com/track/1',
            audiodownload_allowed: true,
            audiodownload: 'https://cdn.jamendo.com/track-1-download.mp3',
          },
        ],
      }, 200)
    })
    vi.stubGlobal('fetch', fetchMock)

    const response = await onRequest({
      request: new Request('https://clippc.com/api/jamendo/search?query=night&page=2&limit=10'),
      env: {
        JAMENDO_CLIENT_ID: 'jamendo-client',
      },
    })

    expect(response.status).toBe(200)
    const [requestUrl] = fetchMock.mock.calls[0]
    const parsedUrl = new URL(requestUrl)
    expect(parsedUrl.pathname).toBe('/v3.0/tracks/')
    expect(parsedUrl.searchParams.get('client_id')).toBe('jamendo-client')
    expect(parsedUrl.searchParams.get('search')).toBe('night')
    expect(parsedUrl.searchParams.get('limit')).toBe('10')
    expect(parsedUrl.searchParams.get('offset')).toBe('10')
    expect(parsedUrl.searchParams.get('audioformat')).toBe('mp32')

    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      data: {
        provider: 'jamendo',
        page: 2,
        limit: 10,
        total: 37,
        tracks: [
          {
            id: 'track-1',
            name: 'Night Drive',
            durationMs: 183000,
            audioUrl: 'https://cdn.jamendo.com/track-1.mp3',
            artistName: 'Atlas',
            albumName: 'Roads',
            audioDownloadAllowed: true,
          },
        ],
      },
    })
  })

  it('returns 400 for invalid query parameters', async () => {
    const response = await onRequest({
      request: new Request('https://clippc.com/api/jamendo/search?query=&page=0'),
      env: {
        JAMENDO_CLIENT_ID: 'jamendo-client',
      },
    })

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toMatchObject({
      ok: false,
      error: 'query is required',
    })
  })

  it('maps jamendo upstream auth failures to gateway error', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => {
      return createJsonResponse({
        headers: {
          error_message: 'Invalid client id',
        },
      }, 403)
    }))

    const response = await onRequest({
      request: new Request('https://clippc.com/api/jamendo/search?query=ambient'),
      env: {
        JAMENDO_CLIENT_ID: 'broken-client',
      },
    })

    expect(response.status).toBe(502)
    await expect(response.json()).resolves.toMatchObject({
      ok: false,
      error: 'Invalid client id',
    })
  })
})
