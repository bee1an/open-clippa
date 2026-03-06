const DEFAULT_JAMENDO_API_BASE = 'https://api.jamendo.com/v3.0'
const JAMENDO_DEFAULT_LIMIT = 12
const JAMENDO_MAX_LIMIT = 50

export interface JamendoProxyEnv {
  JAMENDO_CLIENT_ID?: string
  JAMENDO_API_BASE?: string
}

interface JamendoSearchRequestInput {
  query: string
  page: number
  limit: number
}

interface JamendoTrackAsset {
  id: string
  name: string
  durationMs: number
  audioUrl: string
  imageUrl?: string
  artistName?: string
  albumName?: string
  licenseUrl?: string
  shareUrl?: string
  audioDownloadAllowed: boolean
  audioDownloadUrl?: string
}

type ParseSearchRequestResult
  = | { ok: true, data: JamendoSearchRequestInput }
    | { ok: false, error: string }

type FetchPayloadResult
  = | { ok: true, payload: unknown }
    | { ok: false, status: number, error: string }

type SearchTracksResult
  = | {
    ok: true
    tracks: JamendoTrackAsset[]
    total: number | null
    page: number
    limit: number
  }
  | {
    ok: false
    status: number
    error: string
  }

function resolveNonEmptyString(value: unknown): string | null {
  if (typeof value !== 'string')
    return null

  const normalized = value.trim()
  if (normalized.length === 0)
    return null

  return normalized
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object')
    return null

  return value as Record<string, unknown>
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : []
}

function asNumberLike(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value))
    return value

  if (typeof value === 'string') {
    const parsed = Number(value)
    if (Number.isFinite(parsed))
      return parsed
  }

  return null
}

function asStringLike(value: unknown): string | null {
  if (typeof value === 'string') {
    const normalized = value.trim()
    return normalized.length > 0 ? normalized : null
  }

  if (typeof value === 'number' && Number.isFinite(value))
    return String(value)

  return null
}

function parsePositiveInteger(
  value: string | null,
  fieldName: string,
  fallback: number,
  maxValue: number,
): { ok: true, value: number } | { ok: false, error: string } {
  if (value === null)
    return { ok: true, value: fallback }

  const parsed = Number(value)
  if (!Number.isFinite(parsed))
    return { ok: false, error: `${fieldName} must be a finite number` }

  const normalized = Math.floor(parsed)
  if (normalized < 1)
    return { ok: false, error: `${fieldName} must be >= 1` }

  return {
    ok: true,
    value: Math.min(maxValue, normalized),
  }
}

function parseSearchRequest(url: URL): ParseSearchRequestResult {
  const query = resolveNonEmptyString(url.searchParams.get('query'))
  if (!query) {
    return {
      ok: false,
      error: 'query is required',
    }
  }

  const page = parsePositiveInteger(url.searchParams.get('page'), 'page', 1, Number.MAX_SAFE_INTEGER)
  if (!page.ok)
    return page

  const limit = parsePositiveInteger(url.searchParams.get('limit'), 'limit', JAMENDO_DEFAULT_LIMIT, JAMENDO_MAX_LIMIT)
  if (!limit.ok)
    return limit

  return {
    ok: true,
    data: {
      query,
      page: page.value,
      limit: limit.value,
    },
  }
}

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/g, '')
}

function resolveApiBase(env: JamendoProxyEnv): string {
  const candidate = resolveNonEmptyString(env.JAMENDO_API_BASE) ?? DEFAULT_JAMENDO_API_BASE
  try {
    const parsed = new URL(candidate)
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:')
      return DEFAULT_JAMENDO_API_BASE

    parsed.search = ''
    parsed.hash = ''
    return trimTrailingSlash(parsed.toString())
  }
  catch {
    return DEFAULT_JAMENDO_API_BASE
  }
}

function toJsonResponse(status: number, payload: unknown): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
    },
  })
}

async function readUpstreamErrorMessage(response: Response): Promise<string | null> {
  try {
    const payload = await response.json()
    const record = asRecord(payload)
    if (!record)
      return null

    const headers = asRecord(record.headers)
    return resolveNonEmptyString(headers?.error_message)
      ?? resolveNonEmptyString(record.error)
      ?? resolveNonEmptyString(record.message)
      ?? null
  }
  catch {
    return null
  }
}

async function fetchJamendoPayload(url: URL): Promise<FetchPayloadResult> {
  let response: Response
  try {
    response = await fetch(url.toString(), { method: 'GET' })
  }
  catch {
    return {
      ok: false,
      status: 502,
      error: 'Jamendo upstream request failed',
    }
  }

  if (!response.ok) {
    const upstreamMessage = await readUpstreamErrorMessage(response)
    if (response.status === 401 || response.status === 403) {
      return {
        ok: false,
        status: 502,
        error: upstreamMessage ?? 'Jamendo authentication failed',
      }
    }

    if (response.status === 429) {
      return {
        ok: false,
        status: 429,
        error: upstreamMessage ?? 'Jamendo rate limit exceeded',
      }
    }

    if (response.status >= 500) {
      return {
        ok: false,
        status: 502,
        error: upstreamMessage ?? 'Jamendo upstream service unavailable',
      }
    }

    return {
      ok: false,
      status: response.status,
      error: upstreamMessage ?? `Jamendo request failed (HTTP ${response.status})`,
    }
  }

  try {
    return {
      ok: true,
      payload: await response.json(),
    }
  }
  catch {
    return {
      ok: false,
      status: 502,
      error: 'Invalid JSON response from Jamendo',
    }
  }
}

function toTrackAsset(payload: unknown): JamendoTrackAsset | null {
  const track = asRecord(payload)
  if (!track)
    return null

  const id = asStringLike(track.id)
  const name = resolveNonEmptyString(track.name)
  const audioUrl = resolveNonEmptyString(track.audio)
  if (!id || !name || !audioUrl)
    return null

  const durationSec = asNumberLike(track.duration) ?? 0
  const audioDownloadAllowed = Boolean(track.audiodownload_allowed)

  return {
    id,
    name,
    durationMs: Math.max(0, Math.round(durationSec * 1000)),
    audioUrl,
    imageUrl: resolveNonEmptyString(track.image)
      ?? resolveNonEmptyString(track.album_image)
      ?? undefined,
    artistName: resolveNonEmptyString(track.artist_name) ?? undefined,
    albumName: resolveNonEmptyString(track.album_name) ?? undefined,
    licenseUrl: resolveNonEmptyString(track.license_ccurl) ?? undefined,
    shareUrl: resolveNonEmptyString(track.shareurl) ?? undefined,
    audioDownloadAllowed,
    audioDownloadUrl: audioDownloadAllowed
      ? resolveNonEmptyString(track.audiodownload) ?? undefined
      : undefined,
  }
}

function extractTotalCount(payload: unknown): number | null {
  const record = asRecord(payload)
  const headers = asRecord(record?.headers)
  const fullCount = asNumberLike(headers?.results_fullcount)
  if (fullCount !== null)
    return Math.max(0, Math.floor(fullCount))

  const resultCount = asNumberLike(headers?.results_count)
  if (resultCount !== null)
    return Math.max(0, Math.floor(resultCount))

  return null
}

async function searchTracks(
  input: JamendoSearchRequestInput,
  env: JamendoProxyEnv,
): Promise<SearchTracksResult> {
  const clientId = resolveNonEmptyString(env.JAMENDO_CLIENT_ID)
  if (!clientId) {
    return {
      ok: false,
      status: 503,
      error: 'JAMENDO_CLIENT_ID is not configured',
    }
  }

  const apiBase = resolveApiBase(env)
  const requestUrl = new URL('tracks/', `${apiBase}/`)
  requestUrl.searchParams.set('client_id', clientId)
  requestUrl.searchParams.set('format', 'json')
  requestUrl.searchParams.set('search', input.query)
  requestUrl.searchParams.set('limit', String(input.limit))
  requestUrl.searchParams.set('offset', String((input.page - 1) * input.limit))
  requestUrl.searchParams.set('order', 'relevance')
  requestUrl.searchParams.set('audioformat', 'mp32')
  requestUrl.searchParams.set('imagesize', '300')
  requestUrl.searchParams.set('include', 'licenses')
  requestUrl.searchParams.set('type', 'single albumtrack')
  requestUrl.searchParams.set('fullcount', 'true')

  const payloadResult = await fetchJamendoPayload(requestUrl)
  if (!payloadResult.ok)
    return payloadResult

  const record = asRecord(payloadResult.payload)
  const tracks = asArray(record?.results)
    .map(toTrackAsset)
    .filter((item): item is JamendoTrackAsset => item !== null)

  return {
    ok: true,
    tracks,
    total: extractTotalCount(payloadResult.payload),
    page: input.page,
    limit: input.limit,
  }
}

export async function handleJamendoSearchRequest(
  request: Request,
  env: JamendoProxyEnv,
): Promise<Response> {
  if (request.method.toUpperCase() !== 'GET') {
    return toJsonResponse(405, {
      ok: false,
      error: 'Method not allowed',
    })
  }

  const requestUrl = new URL(request.url)
  const parsedInput = parseSearchRequest(requestUrl)
  if (!parsedInput.ok) {
    return toJsonResponse(400, {
      ok: false,
      error: parsedInput.error,
    })
  }

  const result = await searchTracks(parsedInput.data, env)
  if (!result.ok) {
    return toJsonResponse(result.status, {
      ok: false,
      error: result.error,
    })
  }

  return toJsonResponse(200, {
    ok: true,
    data: {
      provider: 'jamendo',
      page: result.page,
      limit: result.limit,
      total: result.total,
      tracks: result.tracks,
    },
  })
}
