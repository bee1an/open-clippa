export const AUTO_SCROLL_THRESHOLD_PX = 48

export function isNearBottom(
  scrollTop: number,
  clientHeight: number,
  scrollHeight: number,
  threshold: number = AUTO_SCROLL_THRESHOLD_PX,
): boolean {
  return scrollTop + clientHeight >= scrollHeight - threshold
}

export function shouldSubmitOnEnter(options: {
  key: string
  shiftKey: boolean
  isComposing: boolean
}): boolean {
  return options.key === 'Enter' && !options.shiftKey && !options.isComposing
}

export function buildMissingSettingsMessage(settings: {
  apiKey: string
  baseUrl: string
  model: string
}): string | null {
  const missing: string[] = []
  if (settings.apiKey.trim().length === 0)
    missing.push('API Key')
  if (settings.baseUrl.trim().length === 0)
    missing.push('Base URL')
  if (settings.model.trim().length === 0)
    missing.push('Model')

  if (missing.length === 0)
    return null

  return `Missing required settings: ${missing.join(', ')}`
}
