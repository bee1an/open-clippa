import type { AiApiKeySource } from '@clippc/ai'
import { resolveProxyUpstreamBase } from '@clippc/ai'
import { defineStore } from 'pinia'
import { ref } from 'vue'
import { useAiSettingsStore } from './useAiSettingsStore'

const MODELS_PROXY_PATH = '/api/kimi/models'
const KEY_SOURCE_HEADER = 'x-clippc-key-source'
const UPSTREAM_BASE_HEADER = 'x-clippc-upstream-base'

export interface AiModelItem {
  id: string
  label: string
  raw?: unknown
}

export interface AiModelCatalogState {
  items: AiModelItem[]
  loading: boolean
  loaded: boolean
  error: string | null
  lastLoadedAt: number | null
}

export interface FetchModelsSettings {
  apiKeySource: AiApiKeySource
  apiKey: string
  baseUrl: string
}

function resolveNonEmptyString(value: unknown): string | null {
  if (typeof value !== 'string')
    return null

  const normalized = value.trim()
  if (!normalized)
    return null
  return normalized
}

function resolveModelsProxyUrl(): string {
  if (typeof window === 'undefined' || !window.location)
    return MODELS_PROXY_PATH

  const baseCandidate = /^https?:\/\//i.test(window.location.origin)
    ? window.location.origin
    : window.location.href

  try {
    return new URL(MODELS_PROXY_PATH, baseCandidate).toString()
  }
  catch {
    return MODELS_PROXY_PATH
  }
}

function normalizeModelEntry(entry: unknown): AiModelItem | null {
  if (!entry || typeof entry !== 'object')
    return null

  const normalized = entry as Record<string, unknown>
  const id = resolveNonEmptyString(normalized.id)
    ?? resolveNonEmptyString(normalized.model)
    ?? resolveNonEmptyString(normalized.name)
  if (!id)
    return null

  const label = resolveNonEmptyString(normalized.name)
    ?? resolveNonEmptyString(normalized.id)
    ?? resolveNonEmptyString(normalized.model)
    ?? id

  return {
    id,
    label,
    raw: entry,
  }
}

function normalizeModelResponse(payload: unknown): AiModelItem[] {
  if (!payload || typeof payload !== 'object')
    return []

  const data = (payload as { data?: unknown }).data
  if (!Array.isArray(data))
    return []

  const deduped = new Map<string, AiModelItem>()
  data.forEach((entry) => {
    const item = normalizeModelEntry(entry)
    if (!item)
      return
    if (!deduped.has(item.id))
      deduped.set(item.id, item)
  })

  return Array.from(deduped.values()).sort((a, b) => a.label.localeCompare(b.label, 'zh-Hans-CN'))
}

async function resolveErrorMessage(response: Response): Promise<string> {
  try {
    const payload = await response.json() as {
      error?: unknown
      message?: unknown
    }
    const detail = resolveNonEmptyString(payload.error) ?? resolveNonEmptyString(payload.message)
    if (detail)
      return `获取模型失败：${detail}`
  }
  catch {
  }

  return `获取模型失败（HTTP ${response.status}）`
}

function buildRequestHeaders(settings: FetchModelsSettings): Headers {
  const headers = new Headers()
  headers.set(KEY_SOURCE_HEADER, settings.apiKeySource)

  if (settings.apiKeySource === 'managed')
    return headers

  const apiKey = settings.apiKey.trim()
  headers.set('authorization', `Bearer ${apiKey}`)

  const upstreamBase = resolveProxyUpstreamBase(settings.baseUrl)
  if (upstreamBase)
    headers.set(UPSTREAM_BASE_HEADER, upstreamBase)

  return headers
}

function validateFetchModelsSettings(settings: FetchModelsSettings): string | null {
  if (settings.apiKeySource !== 'byok')
    return null

  if (settings.apiKey.trim().length === 0)
    return '请先填写 API 密钥。'
  if (settings.baseUrl.trim().length === 0)
    return '请先填写接口地址。'
  return null
}

export async function fetchModels(settings: FetchModelsSettings): Promise<AiModelItem[]> {
  const validationError = validateFetchModelsSettings(settings)
  if (validationError)
    throw new Error(validationError)

  const response = await fetch(resolveModelsProxyUrl(), {
    method: 'GET',
    headers: buildRequestHeaders(settings),
  })

  if (!response.ok)
    throw new Error(await resolveErrorMessage(response))

  const payload = await response.json()
  return normalizeModelResponse(payload)
}

function resolveClientErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim().length > 0)
    return error.message.trim()
  return '获取模型失败，请稍后重试。'
}

export const useAiModelCatalogStore = defineStore('ai-model-catalog', () => {
  const aiSettingsStore = useAiSettingsStore()
  const items = ref<AiModelItem[]>([])
  const loading = ref(false)
  const loaded = ref(false)
  const error = ref<string | null>(null)
  const lastLoadedAt = ref<number | null>(null)

  async function fetchModelCatalog(settings?: FetchModelsSettings): Promise<AiModelItem[]> {
    if (loading.value)
      return items.value

    const targetSettings = settings ?? {
      apiKeySource: aiSettingsStore.apiKeySource,
      apiKey: aiSettingsStore.apiKey,
      baseUrl: aiSettingsStore.baseUrl,
    }

    loading.value = true
    error.value = null
    try {
      const nextItems = await fetchModels(targetSettings)
      items.value = nextItems
      loaded.value = true
      lastLoadedAt.value = Date.now()
      return nextItems
    }
    catch (requestError) {
      items.value = []
      loaded.value = false
      error.value = resolveClientErrorMessage(requestError)
      return []
    }
    finally {
      loading.value = false
    }
  }

  function resetCatalog(): void {
    items.value = []
    loading.value = false
    loaded.value = false
    error.value = null
    lastLoadedAt.value = null
  }

  return {
    items,
    loading,
    loaded,
    error,
    lastLoadedAt,
    fetchModelCatalog,
    resetCatalog,
  }
})
