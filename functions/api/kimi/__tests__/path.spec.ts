import { afterEach, describe, expect, it, vi } from 'vitest'
import { onRequest } from '../[[path]]'

describe('functions/api/kimi/[[path]]', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('rejects private upstream base url in byok mode', async () => {
    const response = await onRequest({
      request: new Request('https://clippc.com/api/kimi/chat/completions', {
        method: 'POST',
        headers: {
          'x-clippc-key-source': 'byok',
          'x-clippc-upstream-base': 'https://192.168.1.2/v1',
          'authorization': 'Bearer user-key',
        },
      }),
      env: {},
      params: {
        path: 'chat/completions',
      },
    })

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toMatchObject({
      ok: false,
      error: expect.stringContaining('Private IP'),
    })
  })

  it('uses byok upstream header in preference to managed upstream', async () => {
    const fetchMock = vi.fn(async () => new Response('ok', { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    const response = await onRequest({
      request: new Request('https://clippc.com/api/kimi/chat/completions?stream=true', {
        method: 'POST',
        headers: {
          'x-clippc-key-source': 'byok',
          'x-clippc-upstream-base': 'https://api.openai.com/v1',
          'authorization': 'Bearer user-key',
          'content-type': 'application/json',
        },
        body: JSON.stringify({}),
      }),
      env: {
        AI_MANAGED_UPSTREAM: 'https://managed.example.com/v1',
        AI_MANAGED_API_KEY: 'managed-secret',
      },
      params: {
        path: 'chat/completions',
      },
    })

    expect(response.status).toBe(200)
    expect(fetchMock).toHaveBeenCalledTimes(1)

    const [requestUrl, requestInit] = fetchMock.mock.calls[0]
    expect(requestUrl).toBe('https://api.openai.com/v1/chat/completions?stream=true')
    expect(requestInit.headers.get('authorization')).toBe('Bearer user-key')
  })

  it('keeps managed upstream host when path looks like absolute url', async () => {
    const fetchMock = vi.fn(async () => new Response('ok', { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    const response = await onRequest({
      request: new Request('https://clippc.com/api/kimi/https://attacker.example/v1/chat/completions?stream=true', {
        method: 'POST',
        headers: {
          'x-clippc-key-source': 'managed',
          'content-type': 'application/json',
        },
        body: JSON.stringify({}),
      }),
      env: {
        AI_MANAGED_UPSTREAM: 'https://managed.example.com/v1',
        AI_MANAGED_API_KEY: 'managed-secret',
      },
      params: {
        path: 'https://attacker.example/v1/chat/completions',
      },
    })

    expect(response.status).toBe(200)
    expect(fetchMock).toHaveBeenCalledTimes(1)

    const [requestUrl, requestInit] = fetchMock.mock.calls[0]
    expect(requestUrl).toBe('https://managed.example.com/v1/https://attacker.example/v1/chat/completions?stream=true')
    expect(requestInit.headers.get('authorization')).toBe('Bearer managed-secret')
  })

  it('keeps sse response stream untouched', async () => {
    const fetchMock = vi.fn(async () => {
      const encoder = new TextEncoder()
      const body = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(encoder.encode('data: hello\n\n'))
          controller.close()
        },
      })

      return new Response(body, {
        status: 200,
        headers: {
          'content-type': 'text/event-stream',
        },
      })
    })
    vi.stubGlobal('fetch', fetchMock)

    const response = await onRequest({
      request: new Request('https://clippc.com/api/kimi/chat/completions', {
        method: 'POST',
        headers: {
          'x-clippc-key-source': 'managed',
          'content-type': 'application/json',
        },
        body: JSON.stringify({ stream: true }),
      }),
      env: {
        AI_MANAGED_UPSTREAM: 'https://managed.example.com/v1',
        AI_MANAGED_API_KEY: 'managed-secret',
      },
      params: {
        path: 'chat/completions',
      },
    })

    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toBe('text/event-stream')
    await expect(response.text()).resolves.toBe('data: hello\n\n')
  })
})
