import { describe, expect, it } from 'vitest'
import {
  FILTER_PRESET_CONFIG_MAP,
  FILTER_PRESET_VALUES,
  getFilterPresetConfig,
  isFilterPresetValue,
} from '../src/presets'

describe('filter presets', () => {
  it('contains built-in presets including bw', () => {
    expect(FILTER_PRESET_VALUES).toContain('bw')
    expect(FILTER_PRESET_CONFIG_MAP.bw).toEqual({
      brightness: 1,
      contrast: 1.1,
      saturation: 0,
      hue: 0,
    })
  })

  it('returns cloned config for known preset and null for unknown', () => {
    const preset = getFilterPresetConfig('warm')
    expect(preset).toEqual(FILTER_PRESET_CONFIG_MAP.warm)
    expect(preset).not.toBe(FILTER_PRESET_CONFIG_MAP.warm)

    expect(getFilterPresetConfig('unknown')).toBeNull()
    expect(getFilterPresetConfig()).toBeNull()
  })

  it('checks preset value type guard', () => {
    expect(isFilterPresetValue('sepia')).toBe(true)
    expect(isFilterPresetValue('invalid')).toBe(false)
  })
})
