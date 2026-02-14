import {
  HOP_BY_HOP_HEADERS,
  KEY_SOURCE_HEADER,
  resolveAllowHttpLocalhost,
  resolveKeySource,
  resolveManagedApiKey,
  resolveManagedUpstreamBase,
  resolveProxyUpstreamBase,
  resolveUpstreamPath,
  UPSTREAM_BASE_HEADER,
} from './proxyShared'

interface ProxyEnv {
  AI_MANAGED_UPSTREAM?: string
  KIMI_UPSTREAM?: string
  AI_MANAGED_API_KEY?: string
  KIMI_API_KEY?: string
  AI_PROXY_ALLOW_LOCALHOST_HTTP?: string
}

interface KimiProxyContext {
  request: Request
  env: ProxyEnv
  params: {
    path?: string | string[]
  }
}

function resolveRawPath(pathParam: string | string[] | undefined): string {
  if (Array.isArray(pathParam))
    return pathParam.join('/')
  if (typeof pathParam === 'string')
    return pathParam
  return ''
}

function isBodyAllowed(method: string): boolean {
  return method !== 'GET' && method !== 'HEAD'
}

function buildProxyHeaders(request: Request): Headers {
  const headers = new Headers(request.headers)
  headers.delete('host')
  HOP_BY_HOP_HEADERS.forEach(header => headers.delete(header))
  headers.delete(KEY_SOURCE_HEADER)
  headers.delete(UPSTREAM_BASE_HEADER)
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
  const keySource = resolveKeySource(request.headers.get(KEY_SOURCE_HEADER))
  const allowHttpLocalhost = resolveAllowHttpLocalhost(env.AI_PROXY_ALLOW_LOCALHOST_HTTP)
  const managedUpstreamBase = resolveManagedUpstreamBase(env, { allowHttpLocalhost })
  const upstreamBaseResult = resolveProxyUpstreamBase({
    keySource,
    managedUpstreamBase,
    requestedUpstreamBase: request.headers.get(UPSTREAM_BASE_HEADER),
    allowHttpLocalhost,
  })
  if (!upstreamBaseResult.ok)
    return jsonError(400, upstreamBaseResult.error)

  const upstreamPath = resolveUpstreamPath(resolveRawPath(params.path))
  const inboundUrl = new URL(request.url)
  const upstreamUrl = new URL(upstreamPath, `${upstreamBaseResult.value}/`)
  upstreamUrl.search = inboundUrl.search

  const headers = buildProxyHeaders(request)
  const authorization = headers.get('authorization')?.trim()
  if (keySource !== 'byok' || !authorization) {
    const managedApiKey = resolveManagedApiKey(env)
    if (managedApiKey) {
      headers.set('authorization', `Bearer ${managedApiKey}`)
    }
    else if (!authorization) {
      headers.delete('authorization')
    }
  }

  if (!headers.get('authorization')) {
    return jsonError(
      500,
      '缺少 Authorization 请求头。请在请求中提供 API Key，或在服务端配置 AI_MANAGED_API_KEY（兼容旧变量 KIMI_API_KEY）。',
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
    return jsonError(502, '上游服务请求失败')
  }
}
