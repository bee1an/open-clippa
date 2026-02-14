import type { FilterConfig, FilterPresetValue } from '@clippc/filter'
import { FILTER_PRESET_CONFIG_MAP, FILTER_PRESET_VALUES } from '@clippc/filter'

export interface AppFilterPresetOption {
  label: string
  value: FilterPresetValue
  icon: string
  config: FilterConfig
}

const FILTER_PRESET_META_MAP: Record<FilterPresetValue, { label: string, icon: string }> = {
  warm: { label: '暖调', icon: 'i-ph-sun-bold' },
  cool: { label: '冷调', icon: 'i-ph-snowflake-bold' },
  vintage: { label: '复古', icon: 'i-ph-film-strip-bold' },
  bw: { label: '黑白', icon: 'i-ph-circle-half-bold' },
  vivid: { label: '鲜艳', icon: 'i-ph-palette-bold' },
  faded: { label: '褪色', icon: 'i-ph-drop-bold' },
  dramatic: { label: '戏剧化', icon: 'i-ph-lightning-bold' },
  sepia: { label: '棕褐', icon: 'i-ph-coffee-bold' },
}

export const APP_FILTER_PRESETS: AppFilterPresetOption[] = FILTER_PRESET_VALUES.map((value) => {
  const meta = FILTER_PRESET_META_MAP[value]
  return {
    label: meta.label,
    value,
    icon: meta.icon,
    config: FILTER_PRESET_CONFIG_MAP[value],
  }
})

export function getFilterPresetLabel(value: FilterPresetValue): string {
  return FILTER_PRESET_META_MAP[value].label
}
