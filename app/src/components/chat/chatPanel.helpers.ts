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
  apiKeySource: 'managed' | 'byok'
  apiKey: string
  baseUrl: string
  model: string
}): string | null {
  const missing: string[] = []
  if (settings.apiKeySource === 'byok' && settings.apiKey.trim().length === 0)
    missing.push('API 密钥')
  if (settings.apiKeySource === 'byok' && settings.baseUrl.trim().length === 0)
    missing.push('接口地址')
  if (settings.model.trim().length === 0)
    missing.push('模型')

  if (missing.length === 0)
    return null

  return `缺少必要配置：${missing.join('、')}`
}
