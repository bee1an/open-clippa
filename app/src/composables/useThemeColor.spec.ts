import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  DEFAULT_THEME_PRIMARY_COLOR,
  normalizeHexColor,
  THEME_COLOR_STORAGE_KEY,
  useThemeColor,
} from './useThemeColor'

interface MockStorageLike {
  getItem: (key: string) => string | null
  setItem: (key: string, value: string) => void
}

function createMockStorage(initial: Record<string, string> = {}): MockStorageLike {
  const data = new Map<string, string>(Object.entries(initial))
  return {
    getItem(key) {
      return data.get(key) ?? null
    },
    setItem(key, value) {
      data.set(key, value)
    },
  }
}

function createMockStyleTarget() {
  const vars = new Map<string, string>()
  return {
    setProperty(name: string, value: string) {
      vars.set(name, value)
    },
    get(name: string) {
      return vars.get(name)
    },
  }
}

describe('useThemeColor', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', createMockStorage())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('normalizes short and long hex colors', () => {
    expect(normalizeHexColor('#abc')).toBe('#aabbcc')
    expect(normalizeHexColor('2563eb')).toBe('#2563eb')
    expect(normalizeHexColor('invalid')).toBeNull()
  })

  it('applies color tokens and persists selected color', () => {
    const styleTarget = createMockStyleTarget()
    const { setPrimaryColor } = useThemeColor()

    const result = setPrimaryColor('#2563eb', styleTarget)

    expect(result).toBe(true)
    expect(styleTarget.get('--primary')).toBe('221 83% 53%')
    expect(styleTarget.get('--primary-hover')).toBe('221 83% 46%')
    expect(styleTarget.get('--logo-accent-start')).toBe('221 83% 59%')
    expect(styleTarget.get('--logo-accent-end')).toBe('221 83% 41%')
    expect(localStorage.getItem(THEME_COLOR_STORAGE_KEY)).toBe('#2563eb')
  })

  it('resets to default theme primary color', () => {
    const styleTarget = createMockStyleTarget()
    const { setPrimaryColor, resetPrimaryColor } = useThemeColor()

    setPrimaryColor('#7c3aed', styleTarget)
    resetPrimaryColor(styleTarget)

    expect(localStorage.getItem(THEME_COLOR_STORAGE_KEY)).toBe(DEFAULT_THEME_PRIMARY_COLOR)
    expect(styleTarget.get('--primary')).toBe('347 77% 50%')
  })
})
