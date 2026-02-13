import type { AiProviderId, AiSettings } from '@clippc/ai'
import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'

interface PersistedAiSettings {
  provider?: AiProviderId
  apiKey?: string
  baseUrl?: string
  model?: string
  panelOpen?: boolean
}

export const AI_SETTINGS_STORAGE_KEY = 'open-clippa.ai.settings.v1'
export const DEFAULT_AI_PROVIDER: AiProviderId = 'kimi'
export const DEV_PROXY_KIMI_BASE_URL = '/api/kimi'
export const DIRECT_KIMI_BASE_URL = 'https://integrate.api.nvidia.com/v1'
export const DEFAULT_KIMI_BASE_URL = DEV_PROXY_KIMI_BASE_URL
export const DEFAULT_KIMI_MODEL = 'moonshotai/kimi-k2.5'
export const ENV_KIMI_BASE_URL = import.meta.env.VITE_KIMI_BASE_URL
export const ENV_KIMI_MODEL = import.meta.env.VITE_KIMI_MODEL
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

function normalizeProvider(provider: unknown): AiProviderId {
  return provider === 'kimi' ? 'kimi' : DEFAULT_AI_PROVIDER
}

function normalizeModel(model: string): string {
  if (LEGACY_KIMI_MODELS.has(model))
    return DEFAULT_KIMI_MODEL
  return model
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
  const persistedBaseUrl = resolveNonEmptyString(persisted.baseUrl)
  const envBaseUrl = resolveNonEmptyString(ENV_KIMI_BASE_URL)
  const persistedModel = resolveNonEmptyString(persisted.model)
  const envModel = resolveNonEmptyString(ENV_KIMI_MODEL)

  const initialBaseUrl = (() => {
    if (envBaseUrl)
      return envBaseUrl

    if (!persistedBaseUrl)
      return DEFAULT_KIMI_BASE_URL

    // Migrate legacy direct URL to local reverse-proxy path.
    if (persistedBaseUrl === DIRECT_KIMI_BASE_URL)
      return DEV_PROXY_KIMI_BASE_URL

    return persistedBaseUrl
  })()

  const initialModel = (() => {
    if (envModel)
      return normalizeModel(envModel)
    if (persistedModel)
      return normalizeModel(persistedModel)
    return DEFAULT_KIMI_MODEL
  })()

  const provider = ref<AiProviderId>(normalizeProvider(persisted.provider))
  const apiKey = ref(resolveNonEmptyString(persisted.apiKey) ?? '')
  const baseUrl = ref(initialBaseUrl)
  const model = ref(initialModel)
  const panelOpen = ref(typeof persisted.panelOpen === 'boolean' ? persisted.panelOpen : false)

  const settings = computed<AiSettings>(() => {
    return {
      provider: provider.value,
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
      apiKey: apiKey.value,
      baseUrl: baseUrl.value,
      model: model.value,
      panelOpen: panelOpen.value,
    }

    localStorage.setItem(AI_SETTINGS_STORAGE_KEY, JSON.stringify(payload))
  }

  watch([provider, apiKey, baseUrl, model, panelOpen], persistSettings)

  function updateSettings(patch: Partial<AiSettings>): void {
    if (patch.provider !== undefined)
      provider.value = normalizeProvider(patch.provider)
    if (patch.apiKey !== undefined)
      apiKey.value = patch.apiKey
    if (patch.baseUrl !== undefined)
      baseUrl.value = patch.baseUrl
    if (patch.model !== undefined)
      model.value = patch.model
    if (patch.panelOpen !== undefined)
      panelOpen.value = patch.panelOpen
  }

  function setPanelOpen(open: boolean): void {
    panelOpen.value = open
  }

  function resetSettings(): void {
    provider.value = DEFAULT_AI_PROVIDER
    apiKey.value = ''
    baseUrl.value = DEFAULT_KIMI_BASE_URL
    model.value = DEFAULT_KIMI_MODEL
    panelOpen.value = false
  }

  return {
    provider,
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
