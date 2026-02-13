import { describe, expect, it } from 'vitest'
import { buildMissingSettingsMessage, isNearBottom, shouldSubmitOnEnter } from './chatPanel.helpers'

describe('chatPanel helpers', () => {
  it('detects whether scroll position is near bottom', () => {
    expect(isNearBottom(500, 200, 720)).toBe(true)
    expect(isNearBottom(100, 200, 720)).toBe(false)
  })

  it('handles enter submit behavior', () => {
    expect(shouldSubmitOnEnter({ key: 'Enter', shiftKey: false, isComposing: false })).toBe(true)
    expect(shouldSubmitOnEnter({ key: 'Enter', shiftKey: true, isComposing: false })).toBe(false)
    expect(shouldSubmitOnEnter({ key: 'Enter', shiftKey: false, isComposing: true })).toBe(false)
    expect(shouldSubmitOnEnter({ key: 'A', shiftKey: false, isComposing: false })).toBe(false)
  })

  it('builds missing settings message', () => {
    expect(buildMissingSettingsMessage({
      apiKeySource: 'byok',
      apiKey: '',
      baseUrl: '',
      model: '',
    })).toBe('Missing required settings: API Key, Base URL, Model')

    expect(buildMissingSettingsMessage({
      apiKeySource: 'managed',
      apiKey: '',
      baseUrl: '',
      model: '',
    })).toBe('Missing required settings: Base URL, Model')

    expect(buildMissingSettingsMessage({
      apiKeySource: 'managed',
      apiKey: 'k',
      baseUrl: 'https://host',
      model: 'kimi',
    })).toBeNull()
  })
})
