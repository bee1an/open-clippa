interface ProxyEnv {
  KIMI_UPSTREAM?: string
  KIMI_API_KEY?: string
}

interface KimiProxyContext {
  request: Request
  env: ProxyEnv
  params: {
    path?: string | string[]
  }
}

const DEFAULT_KIMI_UPSTREAM = 'https://integrate.api.nvidia.com'
const KEY_SOURCE_HEADER = 'x-clippc-key-source'

const HOP_BY_HOP_HEADERS = [
  'connection',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade',
]

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/g, '')
}

function resolveRawPath(pathParam: string | string[] | undefined): string {
  if (Array.isArray(pathParam))
    return pathParam.join('/')
  if (typeof pathParam === 'string')
    return pathParam
  return ''
}

function resolveUpstreamBase(env: ProxyEnv): string {
  const candidate = env.KIMI_UPSTREAM?.trim() || DEFAULT_KIMI_UPSTREAM
  if (!/^https?:\/\//i.test(candidate))
    return DEFAULT_KIMI_UPSTREAM
  return trimTrailingSlash(candidate)
}

function resolveUpstreamPath(baseUrl: string, rawPath: string): string {
  let normalizedPath = rawPath.replace(/^\/+/g, '')
  if (!normalizedPath)
    normalizedPath = 'v1/chat/completions'

  const lowerBaseUrl = baseUrl.toLowerCase()
  if (lowerBaseUrl.endsWith('/v1') && normalizedPath.toLowerCase().startsWith('v1/'))
    normalizedPath = normalizedPath.slice(3)

  return normalizedPath
}

function isBodyAllowed(method: string): boolean {
  return method !== 'GET' && method !== 'HEAD'
}

function resolveKeySource(value: string | null): 'managed' | 'byok' {
  return value?.trim().toLowerCase() === 'byok' ? 'byok' : 'managed'
}

function buildProxyHeaders(request: Request, env: ProxyEnv): Headers {
  const headers = new Headers(request.headers)
  headers.delete('host')
  HOP_BY_HOP_HEADERS.forEach(header => headers.delete(header))
  const keySource = resolveKeySource(headers.get(KEY_SOURCE_HEADER))
  headers.delete(KEY_SOURCE_HEADER)

  const authorization = headers.get('authorization')?.trim()
  if (keySource === 'byok' && authorization)
    return headers

  const secret = env.KIMI_API_KEY?.trim()
  if (secret) {
    // Managed mode uses server-side secret when available.
    headers.set('authorization', `Bearer ${secret}`)
    return headers
  }

  if (authorization)
    return headers

  return headers
}

function jsonError(status: number, message: string): Response {
  return new Response(
    JSON.stringify({
      ok: false,
      error: message,
    }),
    {
      status,
      headers: {
        'content-type': 'application/json; charset=utf-8',
      },
    },
  )
}

export async function onRequest(context: KimiProxyContext): Promise<Response> {
  const { request, env, params } = context
  const upstreamBaseUrl = resolveUpstreamBase(env)
  const upstreamPath = resolveUpstreamPath(upstreamBaseUrl, resolveRawPath(params.path))
  const inboundUrl = new URL(request.url)
  const upstreamUrl = new URL(`${upstreamBaseUrl}/${upstreamPath}`)
  upstreamUrl.search = inboundUrl.search

  const headers = buildProxyHeaders(request, env)
  if (!headers.get('authorization')) {
    return jsonError(
      500,
      'Missing Authorization header. Provide API key in request or set KIMI_API_KEY secret.',
    )
  }

  try {
    const upstreamResponse = await fetch(upstreamUrl.toString(), {
      method: request.method,
      headers,
      body: isBodyAllowed(request.method) ? request.body : null,
      redirect: 'manual',
    })

    const responseHeaders = new Headers(upstreamResponse.headers)
    HOP_BY_HOP_HEADERS.forEach(header => responseHeaders.delete(header))
    responseHeaders.set('x-clippc-ai-proxy', 'cloudflare-pages')

    return new Response(upstreamResponse.body, {
      status: upstreamResponse.status,
      statusText: upstreamResponse.statusText,
      headers: responseHeaders,
    })
  }
  catch {
    return jsonError(502, 'Kimi upstream request failed')
  }
}
