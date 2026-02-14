import type { AiApiKeySource, AiProviderId, AiSettings } from '@clippc/ai'
import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'

interface PersistedAiSettings {
  provider?: AiProviderId
  apiKeySource?: AiApiKeySource
  apiKey?: string
  baseUrl?: string
  model?: string
  panelOpen?: boolean
}

export const AI_SETTINGS_STORAGE_KEY = 'open-clippa.ai.settings.v1'
export const DEFAULT_AI_PROVIDER: AiProviderId = 'kimi'
export const DEFAULT_API_KEY_SOURCE: AiApiKeySource = 'managed'
export const DEV_PROXY_KIMI_BASE_URL = '/api/kimi'
export const DIRECT_KIMI_BASE_URL = 'https://integrate.api.nvidia.com/v1'
export const DEFAULT_KIMI_BASE_URL = ''
export const DEFAULT_KIMI_MODEL = ''
export const ENV_AI_BASE_URL = import.meta.env.VITE_AI_BASE_URL
export const ENV_KIMI_BASE_URL = import.meta.env.VITE_KIMI_BASE_URL
export const ENV_KIMI_MODEL = import.meta.env.VITE_KIMI_MODEL

const LEGACY_BASE_URLS = new Set([
  '/api/kimi',
  'https://integrate.api.nvidia.com',
  'https://integrate.api.nvidia.com/v1',
])

const LEGACY_KIMI_MODELS = new Set([
  'nvidia/kimi-k2.5-free',
  'kimi-k2.5-free',
])

function resolveNonEmptyString(value: unknown): string | null {
  if (typeof value !== 'string')
    return null

  const normalized = value.trim()
  if (normalized.length === 0)
    return null
  return normalized
}

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/g, '')
}

function stripChatCompletionsSuffix(value: string): string {
  const normalized = trimTrailingSlash(value)
  if (normalized.toLowerCase().endsWith('/chat/completions'))
    return normalized.slice(0, -'/chat/completions'.length)
  return normalized
}

function normalizeBaseUrl(value: string): string {
  const normalized = stripChatCompletionsSuffix(value.trim())
  if (!normalized)
    return ''

  return trimTrailingSlash(normalized)
}

function migrateLegacyBaseUrl(value: string): string {
  const normalized = normalizeBaseUrl(value)
  if (LEGACY_BASE_URLS.has(normalized))
    return ''
  return normalized
}

function normalizeProvider(provider: unknown): AiProviderId {
  return provider === 'kimi' ? 'kimi' : DEFAULT_AI_PROVIDER
}

function normalizeApiKeySource(source: unknown): AiApiKeySource {
  return source === 'byok' ? 'byok' : DEFAULT_API_KEY_SOURCE
}

function normalizeModel(model: string): string {
  const normalized = model.trim()
  if (!normalized)
    return ''

  if (LEGACY_KIMI_MODELS.has(normalized))
    return ''
  return normalized
}

function loadPersistedSettings(): PersistedAiSettings {
  if (typeof localStorage === 'undefined')
    return {}

  try {
    const raw = localStorage.getItem(AI_SETTINGS_STORAGE_KEY)
    if (!raw)
      return {}

    const parsed = JSON.parse(raw) as PersistedAiSettings
    if (!parsed || typeof parsed !== 'object')
      return {}
    return parsed
  }
  catch {
    return {}
  }
}

export const useAiSettingsStore = defineStore('ai-settings', () => {
  const persisted = loadPersistedSettings()
  const persistedBaseUrl = typeof persisted.baseUrl === 'string'
    ? migrateLegacyBaseUrl(persisted.baseUrl)
    : null
  const envBaseUrl = resolveNonEmptyString(ENV_AI_BASE_URL)
    ?? resolveNonEmptyString(ENV_KIMI_BASE_URL)
  const persistedModel = typeof persisted.model === 'string'
    ? normalizeModel(persisted.model)
    : null
  const envModel = resolveNonEmptyString(ENV_KIMI_MODEL)

  const initialBaseUrl = (() => {
    if (persistedBaseUrl !== null)
      return persistedBaseUrl

    if (envBaseUrl)
      return migrateLegacyBaseUrl(envBaseUrl)

    return DEFAULT_KIMI_BASE_URL
  })()

  const initialModel = (() => {
    if (persistedModel !== null)
      return persistedModel
    if (envModel)
      return normalizeModel(envModel)
    return DEFAULT_KIMI_MODEL
  })()

  const provider = ref<AiProviderId>(normalizeProvider(persisted.provider))
  const apiKeySource = ref<AiApiKeySource>(normalizeApiKeySource(persisted.apiKeySource))
  const apiKey = ref(resolveNonEmptyString(persisted.apiKey) ?? '')
  const baseUrl = ref(initialBaseUrl)
  const model = ref(initialModel)
  const panelOpen = ref(typeof persisted.panelOpen === 'boolean' ? persisted.panelOpen : true)

  const settings = computed<AiSettings>(() => {
    return {
      provider: provider.value,
      apiKeySource: apiKeySource.value,
      apiKey: apiKey.value,
      baseUrl: baseUrl.value,
      model: model.value,
      panelOpen: panelOpen.value,
    }
  })

  const persistSettings = (): void => {
    if (typeof localStorage === 'undefined')
      return

    const payload: PersistedAiSettings = {
      provider: provider.value,
      apiKeySource: apiKeySource.value,
      apiKey: apiKey.value,
      baseUrl: baseUrl.value,
      model: model.value,
      panelOpen: panelOpen.value,
    }

    localStorage.setItem(AI_SETTINGS_STORAGE_KEY, JSON.stringify(payload))
  }

  watch([provider, apiKeySource, apiKey, baseUrl, model, panelOpen], persistSettings)

  function updateSettings(patch: Partial<AiSettings>): void {
    if (patch.provider !== undefined)
      provider.value = normalizeProvider(patch.provider)
    if (patch.apiKeySource !== undefined)
      apiKeySource.value = normalizeApiKeySource(patch.apiKeySource)
    if (patch.apiKey !== undefined)
      apiKey.value = patch.apiKey
    if (patch.baseUrl !== undefined)
      baseUrl.value = normalizeBaseUrl(patch.baseUrl)
    if (patch.model !== undefined)
      model.value = normalizeModel(patch.model)
    if (patch.panelOpen !== undefined)
      panelOpen.value = patch.panelOpen
  }

  function setPanelOpen(open: boolean): void {
    panelOpen.value = open
  }

  function resetSettings(): void {
    provider.value = DEFAULT_AI_PROVIDER
    apiKeySource.value = DEFAULT_API_KEY_SOURCE
    apiKey.value = ''
    baseUrl.value = DEFAULT_KIMI_BASE_URL
    model.value = DEFAULT_KIMI_MODEL
    panelOpen.value = true
  }

  return {
    provider,
    apiKeySource,
    apiKey,
    baseUrl,
    model,
    panelOpen,
    settings,
    updateSettings,
    setPanelOpen,
    resetSettings,
  }
})
