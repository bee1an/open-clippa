export const KEY_SOURCE_HEADER = 'x-clippc-key-source'
export const UPSTREAM_BASE_HEADER = 'x-clippc-upstream-base'
export const DEFAULT_MANAGED_UPSTREAM = 'https://integrate.api.nvidia.com/v1'

export const HOP_BY_HOP_HEADERS = [
  'connection',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade',
]

export type ProxyKeySource = 'managed' | 'byok'

export interface ManagedUpstreamEnv {
  AI_MANAGED_UPSTREAM?: string
  KIMI_UPSTREAM?: string
}

export interface ManagedApiKeyEnv {
  AI_MANAGED_API_KEY?: string
  KIMI_API_KEY?: string
}

function resolveNonEmptyString(value: string | undefined): string | null {
  const normalized = value?.trim()
  if (!normalized)
    return null
  return normalized
}

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/g, '')
}

function trimTrailingDot(value: string): string {
  return value.replace(/\.+$/g, '')
}

function stripChatCompletionsSuffix(pathname: string): string {
  const normalized = trimTrailingSlash(pathname)
  if (normalized.toLowerCase().endsWith('/chat/completions'))
    return normalized.slice(0, -'/chat/completions'.length)
  return normalized
}

function normalizeIpv4(hostname: string): number[] | null {
  const parts = hostname.split('.')
  if (parts.length !== 4)
    return null

  const octets = parts.map((part) => {
    if (!/^\d+$/.test(part))
      return Number.NaN
    return Number.parseInt(part, 10)
  })

  if (octets.some(octet => Number.isNaN(octet) || octet < 0 || octet > 255))
    return null

  return octets
}

function isPrivateIpv4(hostname: string): boolean {
  const octets = normalizeIpv4(hostname)
  if (!octets)
    return false

  const [a, b] = octets
  if (a === 0 || a === 10 || a === 127)
    return true
  if (a === 169 && b === 254)
    return true
  if (a === 172 && b >= 16 && b <= 31)
    return true
  if (a === 192 && b === 168)
    return true
  if (a === 100 && b >= 64 && b <= 127)
    return true

  return false
}

function isPrivateIpv6(hostname: string): boolean {
  const normalized = hostname.toLowerCase()
  if (!normalized.includes(':'))
    return false

  if (normalized === '::1' || normalized === '::')
    return true

  const mappedIpv4Match = normalized.match(/:(\d+\.\d+\.\d+\.\d+)$/)
  if (mappedIpv4Match && isPrivateIpv4(mappedIpv4Match[1]))
    return true

  const firstHextet = normalized
    .split(':')
    .find(part => part.length > 0)

  if (!firstHextet)
    return false

  const first = Number.parseInt(firstHextet, 16)
  if (Number.isNaN(first))
    return true

  // fc00::/7 unique local unicast
  if ((first & 0xFE00) === 0xFC00)
    return true
  // fe80::/10 link-local unicast
  if ((first & 0xFFC0) === 0xFE80)
    return true

  return false
}

function isLocalHostname(hostname: string): boolean {
  return hostname === 'localhost' || hostname.endsWith('.localhost')
}

export function resolveHeaderValue(value: string | string[] | null | undefined): string | null {
  if (typeof value === 'string') {
    const normalized = value.trim()
    return normalized.length > 0 ? normalized : null
  }

  if (Array.isArray(value)) {
    const first = value[0]?.trim()
    return first || null
  }

  return null
}

export function resolveKeySource(value: string | null | undefined): ProxyKeySource {
  return value?.trim().toLowerCase() === 'byok' ? 'byok' : 'managed'
}

interface NormalizeUpstreamBaseOptions {
  allowHttpLocalhost?: boolean
  appendDefaultV1ForRoot?: boolean
}

type NormalizeUpstreamBaseResult
  = { ok: true, value: string }
    | { ok: false, error: string }

export function normalizeUpstreamBase(
  rawBaseUrl: string,
  options: NormalizeUpstreamBaseOptions = {},
): NormalizeUpstreamBaseResult {
  const candidate = rawBaseUrl.trim()
  if (candidate.length === 0)
    return { ok: false, error: 'Upstream base URL is empty.' }

  let parsed: URL
  try {
    parsed = new URL(candidate)
  }
  catch {
    return { ok: false, error: 'Upstream base URL must be an absolute URL.' }
  }

  const protocol = parsed.protocol.toLowerCase()
  const hostname = trimTrailingDot(parsed.hostname.toLowerCase())
  const allowHttpLocalhost = options.allowHttpLocalhost === true

  const httpLocalhostAllowed = allowHttpLocalhost
    && protocol === 'http:'
    && isLocalHostname(hostname)

  if (protocol !== 'https:' && !httpLocalhostAllowed) {
    return {
      ok: false,
      error: 'Only https upstream is allowed.',
    }
  }

  if (isLocalHostname(hostname) && !httpLocalhostAllowed) {
    return {
      ok: false,
      error: 'localhost upstream is not allowed.',
    }
  }

  if (isPrivateIpv4(hostname) || isPrivateIpv6(hostname)) {
    return {
      ok: false,
      error: 'Private IP upstream is not allowed.',
    }
  }

  if (parsed.username || parsed.password) {
    return {
      ok: false,
      error: 'Upstream base URL must not include credentials.',
    }
  }

  let pathname = stripChatCompletionsSuffix(parsed.pathname)
  if (options.appendDefaultV1ForRoot && (pathname === '' || pathname === '/'))
    pathname = '/v1'

  parsed.pathname = pathname || '/'
  parsed.search = ''
  parsed.hash = ''

  return {
    ok: true,
    value: trimTrailingSlash(parsed.toString()),
  }
}

export function resolveManagedUpstreamBase(
  env: ManagedUpstreamEnv,
  options: { allowHttpLocalhost?: boolean } = {},
): string {
  const preferred = resolveNonEmptyString(env.AI_MANAGED_UPSTREAM)
    ?? resolveNonEmptyString(env.KIMI_UPSTREAM)
    ?? DEFAULT_MANAGED_UPSTREAM

  const resolved = normalizeUpstreamBase(preferred, {
    allowHttpLocalhost: options.allowHttpLocalhost,
    appendDefaultV1ForRoot: true,
  })

  if (resolved.ok)
    return resolved.value

  return DEFAULT_MANAGED_UPSTREAM
}

export function resolveManagedApiKey(env: ManagedApiKeyEnv): string {
  return resolveNonEmptyString(env.AI_MANAGED_API_KEY)
    ?? resolveNonEmptyString(env.KIMI_API_KEY)
    ?? ''
}

interface ResolveProxyUpstreamBaseOptions {
  keySource: ProxyKeySource
  managedUpstreamBase: string
  requestedUpstreamBase: string | null | undefined
  allowHttpLocalhost?: boolean
}

type ResolveProxyUpstreamBaseResult
  = { ok: true, value: string }
    | { ok: false, error: string }

export function resolveProxyUpstreamBase(
  options: ResolveProxyUpstreamBaseOptions,
): ResolveProxyUpstreamBaseResult {
  if (options.keySource === 'managed') {
    return {
      ok: true,
      value: options.managedUpstreamBase,
    }
  }

  const requested = resolveHeaderValue(options.requestedUpstreamBase ?? null)
  if (!requested) {
    // Legacy compatibility: missing upstream header falls back to managed target.
    return {
      ok: true,
      value: options.managedUpstreamBase,
    }
  }

  return normalizeUpstreamBase(requested, {
    allowHttpLocalhost: options.allowHttpLocalhost,
    appendDefaultV1ForRoot: false,
  })
}

export function resolveUpstreamPath(rawPath: string): string {
  const normalizedPath = rawPath.replace(/^\/+/g, '')
  if (normalizedPath.length === 0)
    return './chat/completions'

  // Always return a relative-reference path so `new URL(path, base)` can never
  // treat user-controlled input as an absolute URL with a different host.
  return `./${normalizedPath}`
}

export function resolveAllowHttpLocalhost(value: string | undefined): boolean {
  return value?.trim().toLowerCase() === 'true'
}
