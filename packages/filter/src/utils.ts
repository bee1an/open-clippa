import type { ColorMatrixFilter } from 'pixi.js'
import type { FilterConfig } from './types'

export const DEFAULT_FILTER_CONFIG: FilterConfig = {
  brightness: 1,
  contrast: 1,
  saturation: 1,
  hue: 0,
}

export const DEFAULT_FILTER_DURATION = 3000

export function cloneFilterConfig(config: FilterConfig = DEFAULT_FILTER_CONFIG): FilterConfig {
  return {
    brightness: config.brightness,
    contrast: config.contrast,
    saturation: config.saturation,
    hue: config.hue,
  }
}

export function isDefaultFilterConfig(config: FilterConfig): boolean {
  return config.brightness === DEFAULT_FILTER_CONFIG.brightness
    && config.contrast === DEFAULT_FILTER_CONFIG.contrast
    && config.saturation === DEFAULT_FILTER_CONFIG.saturation
    && config.hue === DEFAULT_FILTER_CONFIG.hue
}

export function applyFilterConfig(filter: ColorMatrixFilter, config: FilterConfig): void {
  filter.reset()
  filter.brightness(config.brightness, true)
  filter.contrast(config.contrast, true)
  filter.saturate(config.saturation, true)
  filter.hue(config.hue, true)
}
