import type { FilterConfig } from './types'
import { cloneFilterConfig } from './utils'

export const FILTER_PRESET_VALUES = [
  'warm',
  'cool',
  'vintage',
  'bw',
  'vivid',
  'faded',
  'dramatic',
  'sepia',
] as const

export type FilterPresetValue = (typeof FILTER_PRESET_VALUES)[number]

export const FILTER_PRESET_CONFIG_MAP: Record<FilterPresetValue, FilterConfig> = {
  warm: { brightness: 1.1, contrast: 1.05, saturation: 1.1, hue: 15 },
  cool: { brightness: 0.95, contrast: 1.05, saturation: 0.9, hue: -15 },
  vintage: { brightness: 0.9, contrast: 1.15, saturation: 0.7, hue: 10 },
  bw: { brightness: 1, contrast: 1.1, saturation: 0, hue: 0 },
  vivid: { brightness: 1.05, contrast: 1.2, saturation: 1.5, hue: 0 },
  faded: { brightness: 1.1, contrast: 0.85, saturation: 0.6, hue: 0 },
  dramatic: { brightness: 0.9, contrast: 1.4, saturation: 1.1, hue: 0 },
  sepia: { brightness: 0.95, contrast: 1.05, saturation: 0.4, hue: 30 },
}

export function isFilterPresetValue(value: string): value is FilterPresetValue {
  return FILTER_PRESET_VALUES.includes(value as FilterPresetValue)
}

export function getFilterPresetConfig(value?: string | null): FilterConfig | null {
  if (!value || !isFilterPresetValue(value))
    return null

  return cloneFilterConfig(FILTER_PRESET_CONFIG_MAP[value])
}
