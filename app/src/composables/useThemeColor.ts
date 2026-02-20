import { computed, readonly, ref } from 'vue'

export interface ThemeColorPreset {
  id: ThemeColorPresetId
  label: string
  hex: string
}

export type ThemeColorPresetId = 'rose' | 'blue' | 'emerald' | 'amber' | 'violet' | 'cyan'

interface StyleTarget {
  setProperty: (propertyName: string, value: string) => void
}

const THEME_COLOR_STORAGE_KEY = 'open-clippa.theme.primary-color.v1'
const DEFAULT_THEME_PRIMARY_COLOR = '#e11d48'

const THEME_COLOR_PRESETS: ThemeColorPreset[] = [
  { id: 'rose', label: 'Rose', hex: '#e11d48' },
  { id: 'blue', label: 'Blue', hex: '#2563eb' },
  { id: 'emerald', label: 'Emerald', hex: '#059669' },
  { id: 'amber', label: 'Amber', hex: '#d97706' },
  { id: 'violet', label: 'Violet', hex: '#7c3aed' },
  { id: 'cyan', label: 'Cyan', hex: '#0891b2' },
]

const primaryColor = ref(DEFAULT_THEME_PRIMARY_COLOR)
let hasInitializedThemeColor = false

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

function toHex(value: string): string | null {
  const normalized = value.trim().toLowerCase()
  if (!normalized)
    return null

  const withPrefix = normalized.startsWith('#') ? normalized : `#${normalized}`
  if (/^#[\da-f]{3}$/i.test(withPrefix)) {
    const shortHex = withPrefix.slice(1)
    return `#${shortHex[0]}${shortHex[0]}${shortHex[1]}${shortHex[1]}${shortHex[2]}${shortHex[2]}`
  }

  if (/^#[\da-f]{6}$/i.test(withPrefix))
    return withPrefix

  return null
}

function hexToHsl(hex: string): { h: number, s: number, l: number } {
  const red = Number.parseInt(hex.slice(1, 3), 16) / 255
  const green = Number.parseInt(hex.slice(3, 5), 16) / 255
  const blue = Number.parseInt(hex.slice(5, 7), 16) / 255
  const max = Math.max(red, green, blue)
  const min = Math.min(red, green, blue)
  const delta = max - min
  let hue = 0

  if (delta !== 0) {
    if (max === red)
      hue = ((green - blue) / delta) % 6
    else if (max === green)
      hue = (blue - red) / delta + 2
    else
      hue = (red - green) / delta + 4
  }

  hue = Math.round(hue * 60)
  if (hue < 0)
    hue += 360

  const lightness = (max + min) / 2
  const saturation = delta === 0
    ? 0
    : delta / (1 - Math.abs(2 * lightness - 1))

  return {
    h: hue,
    s: Math.round(saturation * 100),
    l: Math.round(lightness * 100),
  }
}

function toHslToken(value: { h: number, s: number, l: number }): string {
  return `${value.h} ${value.s}% ${value.l}%`
}

function resolveStyleTarget(styleTarget?: StyleTarget): StyleTarget | null {
  if (styleTarget)
    return styleTarget
  if (typeof document === 'undefined')
    return null
  return document.documentElement.style
}

function persistPrimaryColor(color: string): void {
  if (typeof localStorage === 'undefined')
    return

  try {
    localStorage.setItem(THEME_COLOR_STORAGE_KEY, color)
  }
  catch {
    // Ignore storage write failures and keep runtime theme state only.
  }
}

function readPersistedPrimaryColor(): string | null {
  if (typeof localStorage === 'undefined')
    return null

  try {
    const value = localStorage.getItem(THEME_COLOR_STORAGE_KEY)
    if (!value)
      return null
    return toHex(value)
  }
  catch {
    return null
  }
}

function applyPrimaryColorTokens(color: string, styleTarget?: StyleTarget): boolean {
  const target = resolveStyleTarget(styleTarget)
  if (!target)
    return false

  const colorHsl = hexToHsl(color)
  const hoverLightness = clamp(colorHsl.l - 7, 0, 100)
  const logoStartLightness = clamp(colorHsl.l + 6, 0, 100)
  const logoEndLightness = clamp(colorHsl.l - 12, 0, 100)
  const primaryForeground = colorHsl.l >= 58 ? '0 0% 8%' : '0 0% 100%'

  target.setProperty('--primary', toHslToken(colorHsl))
  target.setProperty('--primary-hover', toHslToken({ ...colorHsl, l: hoverLightness }))
  target.setProperty('--primary-glow', `${toHslToken(colorHsl)} / 0.25`)
  target.setProperty('--primary-foreground', primaryForeground)
  target.setProperty('--ring', toHslToken(colorHsl))
  target.setProperty('--logo-accent-start', toHslToken({ ...colorHsl, l: logoStartLightness }))
  target.setProperty('--logo-accent-end', toHslToken({ ...colorHsl, l: logoEndLightness }))
  return true
}

function updatePrimaryColor(color: string, styleTarget?: StyleTarget): boolean {
  const normalized = toHex(color)
  if (!normalized)
    return false

  primaryColor.value = normalized
  persistPrimaryColor(normalized)
  applyPrimaryColorTokens(normalized, styleTarget)
  return true
}

export function initializeThemeColor(styleTarget?: StyleTarget): string {
  const persisted = readPersistedPrimaryColor()
  const nextColor = persisted ?? DEFAULT_THEME_PRIMARY_COLOR
  primaryColor.value = nextColor
  applyPrimaryColorTokens(nextColor, styleTarget)
  hasInitializedThemeColor = true
  return nextColor
}

export function useThemeColor() {
  if (!hasInitializedThemeColor)
    initializeThemeColor()

  const activePresetId = computed<ThemeColorPresetId | null>(() => {
    const matched = THEME_COLOR_PRESETS.find(preset => preset.hex === primaryColor.value)
    return matched?.id ?? null
  })

  function setPrimaryColor(color: string, styleTarget?: StyleTarget): boolean {
    return updatePrimaryColor(color, styleTarget)
  }

  function setPrimaryPreset(presetId: ThemeColorPresetId, styleTarget?: StyleTarget): boolean {
    const preset = THEME_COLOR_PRESETS.find(item => item.id === presetId)
    if (!preset)
      return false
    return updatePrimaryColor(preset.hex, styleTarget)
  }

  function resetPrimaryColor(styleTarget?: StyleTarget): boolean {
    return updatePrimaryColor(DEFAULT_THEME_PRIMARY_COLOR, styleTarget)
  }

  return {
    primaryColor: readonly(primaryColor),
    activePresetId,
    themeColorPresets: THEME_COLOR_PRESETS,
    setPrimaryColor,
    setPrimaryPreset,
    resetPrimaryColor,
  }
}

export {
  DEFAULT_THEME_PRIMARY_COLOR,
  THEME_COLOR_PRESETS,
  THEME_COLOR_STORAGE_KEY,
  toHex as normalizeHexColor,
}
