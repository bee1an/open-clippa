const DEFAULT_PEXELS_API_BASE = 'https://api.pexels.com'
const PEXELS_RANDOM_PAGE_MIN = 1
const PEXELS_RANDOM_PAGE_MAX = 20
const PEXELS_PER_PAGE = 80
const PEXELS_LIST_DEFAULT_PAGE = 1
const PEXELS_LIST_DEFAULT_PER_PAGE = 24
const PEXELS_LIST_MAX_PER_PAGE = 80

const PEXELS_ORIENTATION_VALUES = ['landscape', 'portrait', 'square'] as const
type PexelsOrientation = typeof PEXELS_ORIENTATION_VALUES[number]
const PEXELS_ORIENTATION_SET = new Set<string>(PEXELS_ORIENTATION_VALUES)

type PexelsKind = 'image' | 'video'

export interface PexelsProxyEnv {
  PEXELS_API_KEY?: string
  PEXELS_API_BASE?: string
}

interface PexelsSearchInput {
  kind: PexelsKind
  query?: string
  orientation: PexelsOrientation
  minDurationSec?: number
  maxDurationSec?: number
}

interface PexelsRandomRequestInput extends PexelsSearchInput {}

interface PexelsListRequestInput extends PexelsSearchInput {
  page: number
  perPage: number
}

interface PexelsRandomAsset {
  sourceUrl: string
  previewUrl: string
  width: number
  height: number
  durationMs?: number
  name: string
  authorName?: string
  authorUrl?: string
  externalId: string
}

type ParseRequestResult
  = | { ok: true, data: PexelsRandomRequestInput }
    | { ok: false, error: string }

type ParseListRequestResult
  = | { ok: true, data: PexelsListRequestInput }
    | { ok: false, error: string }

type FetchPayloadResult
  = | { ok: true, payload: unknown }
    | { ok: false, status: number, error: string }

type RandomAssetResult
  = | { ok: true, asset: PexelsRandomAsset }
    | { ok: false, status: number, error: string }

type ListAssetsResult
  = | {
    ok: true
    assets: PexelsRandomAsset[]
    total: number | null
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

function asFiniteNumber(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value))
    return null
  return value
}

function clampNonNegative(value: number | null): number {
  if (value === null || value < 0)
    return 0
  return value
}

function parseOptionalNonNegativeNumber(value: string | null, fieldName: string): { ok: true, value?: number } | { ok: false, error: string } {
  if (value === null)
    return { ok: true }

  const parsed = Number(value)
  if (!Number.isFinite(parsed))
    return { ok: false, error: `${fieldName} must be a finite number` }
  if (parsed < 0)
    return { ok: false, error: `${fieldName} must be >= 0` }

  return {
    ok: true,
    value: Math.floor(parsed),
  }
}

function parseOptionalPositiveInteger(
  value: string | null,
  fieldName: string,
  fallback: number,
  minValue: number,
  maxValue: number,
): { ok: true, value: number } | { ok: false, error: string } {
  if (value === null)
    return { ok: true, value: fallback }

  const parsed = Number(value)
  if (!Number.isFinite(parsed))
    return { ok: false, error: `${fieldName} must be a finite number` }

  const normalized = Math.floor(parsed)
  if (normalized < minValue)
    return { ok: false, error: `${fieldName} must be >= ${minValue}` }

  return {
    ok: true,
    value: Math.min(maxValue, normalized),
  }
}

function parseRandomRequest(url: URL): ParseRequestResult {
  const kindRaw = resolveNonEmptyString(url.searchParams.get('kind'))?.toLowerCase()
  if (kindRaw !== 'image' && kindRaw !== 'video') {
    return {
      ok: false,
      error: 'kind must be image or video',
    }
  }

  const orientationRaw = resolveNonEmptyString(url.searchParams.get('orientation'))?.toLowerCase() ?? 'landscape'
  if (!PEXELS_ORIENTATION_SET.has(orientationRaw)) {
    return {
      ok: false,
      error: `orientation must be one of: ${PEXELS_ORIENTATION_VALUES.join(', ')}`,
    }
  }

  const minDurationParsed = parseOptionalNonNegativeNumber(url.searchParams.get('minDurationSec'), 'minDurationSec')
  if (!minDurationParsed.ok)
    return minDurationParsed

  const maxDurationParsed = parseOptionalNonNegativeNumber(url.searchParams.get('maxDurationSec'), 'maxDurationSec')
  if (!maxDurationParsed.ok)
    return maxDurationParsed

  if (minDurationParsed.value !== undefined && maxDurationParsed.value !== undefined && maxDurationParsed.value < minDurationParsed.value) {
    return {
      ok: false,
      error: 'maxDurationSec must be >= minDurationSec',
    }
  }

  const query = resolveNonEmptyString(url.searchParams.get('query')) ?? undefined

  return {
    ok: true,
    data: {
      kind: kindRaw,
      query,
      orientation: orientationRaw as PexelsOrientation,
      minDurationSec: minDurationParsed.value,
      maxDurationSec: maxDurationParsed.value,
    },
  }
}

function parseListRequest(url: URL): ParseListRequestResult {
  const base = parseRandomRequest(url)
  if (!base.ok)
    return base

  const page = parseOptionalPositiveInteger(
    url.searchParams.get('page'),
    'page',
    PEXELS_LIST_DEFAULT_PAGE,
    1,
    Number.MAX_SAFE_INTEGER,
  )
  if (!page.ok)
    return page

  const perPage = parseOptionalPositiveInteger(
    url.searchParams.get('perPage'),
    'perPage',
    PEXELS_LIST_DEFAULT_PER_PAGE,
    1,
    PEXELS_LIST_MAX_PER_PAGE,
  )
  if (!perPage.ok)
    return perPage

  return {
    ok: true,
    data: {
      ...base.data,
      page: page.value,
      perPage: perPage.value,
    },
  }
}

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/g, '')
}

function resolveApiBase(env: PexelsProxyEnv): string {
  const candidate = resolveNonEmptyString(env.PEXELS_API_BASE) ?? DEFAULT_PEXELS_API_BASE
  try {
    const parsed = new URL(candidate)
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:')
      return DEFAULT_PEXELS_API_BASE

    parsed.search = ''
    parsed.hash = ''
    return trimTrailingSlash(parsed.toString())
  }
  catch {
    return DEFAULT_PEXELS_API_BASE
  }
}

function chooseRandomPage(): number {
  return Math.floor(Math.random() * (PEXELS_RANDOM_PAGE_MAX - PEXELS_RANDOM_PAGE_MIN + 1)) + PEXELS_RANDOM_PAGE_MIN
}

function pickRandomItem<T>(list: T[]): T | null {
  if (list.length === 0)
    return null

  const index = Math.floor(Math.random() * list.length)
  return list[index] ?? null
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
    const data = asRecord(payload)
    if (!data)
      return null

    return resolveNonEmptyString(data.error)
      ?? resolveNonEmptyString(data.message)
      ?? null
  }
  catch {
    return null
  }
}

function buildPexelsSearchParams(
  input: PexelsSearchInput,
  page: number,
  perPage: number,
): URLSearchParams {
  const params = new URLSearchParams()
  params.set('per_page', String(perPage))
  params.set('page', String(page))
  params.set('orientation', input.orientation)

  if (input.query)
    params.set('query', input.query)

  if (input.kind === 'video') {
    if (typeof input.minDurationSec === 'number')
      params.set('min_duration', String(input.minDurationSec))
    if (typeof input.maxDurationSec === 'number')
      params.set('max_duration', String(input.maxDurationSec))
  }

  return params
}

async function fetchPexelsPayload(url: URL, apiKey: string): Promise<FetchPayloadResult> {
  let response: Response
  try {
    response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        authorization: apiKey,
      },
    })
  }
  catch {
    return {
      ok: false,
      status: 502,
      error: 'Pexels upstream request failed',
    }
  }

  if (!response.ok) {
    const upstreamMessage = await readUpstreamErrorMessage(response)
    if (response.status === 429) {
      return {
        ok: false,
        status: 429,
        error: upstreamMessage ?? 'Pexels rate limit exceeded',
      }
    }

    if (response.status === 401 || response.status === 403) {
      return {
        ok: false,
        status: 502,
        error: upstreamMessage ?? 'Pexels authentication failed',
      }
    }

    if (response.status >= 500) {
      return {
        ok: false,
        status: 502,
        error: upstreamMessage ?? 'Pexels upstream service unavailable',
      }
    }

    return {
      ok: false,
      status: response.status,
      error: upstreamMessage ?? `Pexels request failed (HTTP ${response.status})`,
    }
  }

  try {
    const payload = await response.json()
    return {
      ok: true,
      payload,
    }
  }
  catch {
    return {
      ok: false,
      status: 502,
      error: 'Invalid JSON response from Pexels',
    }
  }
}

function toImageAssets(payload: unknown): PexelsRandomAsset[] {
  const data = asRecord(payload)
  if (!data)
    return []

  const photos = asArray(data.photos)
  return photos
    .map((item): PexelsRandomAsset | null => {
      const photo = asRecord(item)
      if (!photo)
        return null

      const src = asRecord(photo.src)
      if (!src)
        return null

      const sourceUrl = resolveNonEmptyString(src.original)
        ?? resolveNonEmptyString(src.large2x)
        ?? resolveNonEmptyString(src.large)
        ?? resolveNonEmptyString(src.medium)
      if (!sourceUrl)
        return null

      const previewUrl = resolveNonEmptyString(src.medium)
        ?? resolveNonEmptyString(src.small)
        ?? sourceUrl

      const id = asFiniteNumber(photo.id)
      const externalId = id === null ? sourceUrl : String(Math.trunc(id))

      return {
        sourceUrl,
        previewUrl,
        width: clampNonNegative(asFiniteNumber(photo.width)),
        height: clampNonNegative(asFiniteNumber(photo.height)),
        name: resolveNonEmptyString(photo.alt) ?? `pexels-image-${externalId}`,
        authorName: resolveNonEmptyString(photo.photographer) ?? undefined,
        authorUrl: resolveNonEmptyString(photo.photographer_url) ?? undefined,
        externalId,
      }
    })
    .filter((item): item is PexelsRandomAsset => item !== null)
}

interface PexelsVideoFile {
  link: string
  fileType: string
  quality?: string
  width: number
  height: number
}

function toVideoFiles(payload: unknown): PexelsVideoFile[] {
  return asArray(payload)
    .map((item): PexelsVideoFile | null => {
      const file = asRecord(item)
      if (!file)
        return null

      const link = resolveNonEmptyString(file.link)
      if (!link)
        return null

      return {
        link,
        fileType: resolveNonEmptyString(file.file_type)?.toLowerCase() ?? '',
        quality: resolveNonEmptyString(file.quality)?.toLowerCase() ?? undefined,
        width: clampNonNegative(asFiniteNumber(file.width)),
        height: clampNonNegative(asFiniteNumber(file.height)),
      }
    })
    .filter((item): item is PexelsVideoFile => item !== null)
}

function pickHighestResolutionVideoFile(files: PexelsVideoFile[]): PexelsVideoFile | null {
  if (files.length === 0)
    return null

  return files.reduce((best, current) => {
    const bestPixels = best.width * best.height
    const currentPixels = current.width * current.height
    return currentPixels > bestPixels ? current : best
  })
}

function pickVideoFile(videoFiles: PexelsVideoFile[]): PexelsVideoFile | null {
  if (videoFiles.length === 0)
    return null

  const mp4Files = videoFiles.filter((file) => {
    return file.fileType.includes('mp4') || file.link.toLowerCase().includes('.mp4')
  })

  const hdMp4Files = mp4Files.filter(file => file.quality === 'hd')
  if (hdMp4Files.length > 0)
    return pickHighestResolutionVideoFile(hdMp4Files)

  if (mp4Files.length > 0)
    return pickHighestResolutionVideoFile(mp4Files)

  return videoFiles[0]
}

function toVideoAssets(payload: unknown): PexelsRandomAsset[] {
  const data = asRecord(payload)
  if (!data)
    return []

  const videos = asArray(data.videos)
  return videos
    .map((item): PexelsRandomAsset | null => {
      const video = asRecord(item)
      if (!video)
        return null

      const selectedFile = pickVideoFile(toVideoFiles(video.video_files))
      if (!selectedFile)
        return null

      const id = asFiniteNumber(video.id)
      const externalId = id === null ? selectedFile.link : String(Math.trunc(id))
      const durationSec = asFiniteNumber(video.duration)

      const user = asRecord(video.user)
      const authorName = resolveNonEmptyString(user?.name) ?? undefined
      const authorUrl = resolveNonEmptyString(user?.url) ?? undefined

      return {
        sourceUrl: selectedFile.link,
        previewUrl: resolveNonEmptyString(video.image) ?? selectedFile.link,
        width: selectedFile.width > 0 ? selectedFile.width : clampNonNegative(asFiniteNumber(video.width)),
        height: selectedFile.height > 0 ? selectedFile.height : clampNonNegative(asFiniteNumber(video.height)),
        durationMs: durationSec === null ? undefined : Math.max(0, Math.round(durationSec * 1000)),
        name: `pexels-video-${externalId}`,
        authorName,
        authorUrl,
        externalId,
      }
    })
    .filter((item): item is PexelsRandomAsset => item !== null)
}

async function fetchAssetPage(
  input: PexelsSearchInput,
  apiBase: string,
  apiKey: string,
  page: number,
  perPage: number = PEXELS_PER_PAGE,
): Promise<FetchPayloadResult> {
  const endpoint = input.kind === 'image'
    ? input.query
      ? '/v1/search'
      : '/v1/curated'
    : input.query
      ? '/videos/search'
      : '/videos/popular'

  const requestUrl = new URL(endpoint, `${apiBase}/`)
  requestUrl.search = buildPexelsSearchParams(input, page, perPage).toString()

  return await fetchPexelsPayload(requestUrl, apiKey)
}

function toAssetsByKind(kind: PexelsKind, payload: unknown): PexelsRandomAsset[] {
  return kind === 'image' ? toImageAssets(payload) : toVideoAssets(payload)
}

async function fetchRandomAsset(
  input: PexelsRandomRequestInput,
  env: PexelsProxyEnv,
): Promise<RandomAssetResult> {
  const apiKey = resolveNonEmptyString(env.PEXELS_API_KEY)
  if (!apiKey) {
    return {
      ok: false,
      status: 503,
      error: 'PEXELS_API_KEY is not configured',
    }
  }

  const apiBase = resolveApiBase(env)
  const firstPage = chooseRandomPage()

  const firstPageResult = await fetchAssetPage(input, apiBase, apiKey, firstPage)
  if (!firstPageResult.ok)
    return firstPageResult

  const firstPageAssets = toAssetsByKind(input.kind, firstPageResult.payload)
  const firstRandomAsset = pickRandomItem(firstPageAssets)
  if (firstRandomAsset) {
    return {
      ok: true,
      asset: firstRandomAsset,
    }
  }

  if (firstPage === 1) {
    return {
      ok: false,
      status: 404,
      error: `No ${input.kind} assets found from Pexels`,
    }
  }

  const fallbackResult = await fetchAssetPage(input, apiBase, apiKey, 1)
  if (!fallbackResult.ok)
    return fallbackResult

  const fallbackAssets = toAssetsByKind(input.kind, fallbackResult.payload)
  const fallbackRandomAsset = pickRandomItem(fallbackAssets)
  if (!fallbackRandomAsset) {
    return {
      ok: false,
      status: 404,
      error: `No ${input.kind} assets found from Pexels`,
    }
  }

  return {
    ok: true,
    asset: fallbackRandomAsset,
  }
}

function extractTotalCount(payload: unknown): number | null {
  const data = asRecord(payload)
  if (!data)
    return null

  const total = asFiniteNumber(data.total_results)
  if (total === null)
    return null

  return Math.max(0, Math.floor(total))
}

async function fetchListAssets(
  input: PexelsListRequestInput,
  env: PexelsProxyEnv,
): Promise<ListAssetsResult> {
  const apiKey = resolveNonEmptyString(env.PEXELS_API_KEY)
  if (!apiKey) {
    return {
      ok: false,
      status: 503,
      error: 'PEXELS_API_KEY is not configured',
    }
  }

  const apiBase = resolveApiBase(env)
  const pageResult = await fetchAssetPage(
    input,
    apiBase,
    apiKey,
    input.page,
    input.perPage,
  )
  if (!pageResult.ok)
    return pageResult

  return {
    ok: true,
    assets: toAssetsByKind(input.kind, pageResult.payload),
    total: extractTotalCount(pageResult.payload),
  }
}

export async function handlePexelsRandomRequest(
  request: Request,
  env: PexelsProxyEnv,
): Promise<Response> {
  if (request.method.toUpperCase() !== 'GET') {
    return toJsonResponse(405, {
      ok: false,
      error: 'Method not allowed',
    })
  }

  const requestUrl = new URL(request.url)
  const parsedInput = parseRandomRequest(requestUrl)
  if (!parsedInput.ok) {
    return toJsonResponse(400, {
      ok: false,
      error: parsedInput.error,
    })
  }

  const randomResult = await fetchRandomAsset(parsedInput.data, env)
  if (!randomResult.ok) {
    return toJsonResponse(randomResult.status, {
      ok: false,
      error: randomResult.error,
    })
  }

  return toJsonResponse(200, {
    ok: true,
    data: {
      provider: 'pexels',
      kind: parsedInput.data.kind,
      asset: randomResult.asset,
    },
  })
}

export async function handlePexelsListRequest(
  request: Request,
  env: PexelsProxyEnv,
): Promise<Response> {
  if (request.method.toUpperCase() !== 'GET') {
    return toJsonResponse(405, {
      ok: false,
      error: 'Method not allowed',
    })
  }

  const requestUrl = new URL(request.url)
  const parsedInput = parseListRequest(requestUrl)
  if (!parsedInput.ok) {
    return toJsonResponse(400, {
      ok: false,
      error: parsedInput.error,
    })
  }

  const listResult = await fetchListAssets(parsedInput.data, env)
  if (!listResult.ok) {
    return toJsonResponse(listResult.status, {
      ok: false,
      error: listResult.error,
    })
  }

  return toJsonResponse(200, {
    ok: true,
    data: {
      provider: 'pexels',
      kind: parsedInput.data.kind,
      page: parsedInput.data.page,
      perPage: parsedInput.data.perPage,
      total: listResult.total,
      assets: listResult.assets,
    },
  })
}
