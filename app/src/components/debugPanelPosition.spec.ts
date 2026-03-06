import { describe, expect, it } from 'vitest'
import { clampDebugPanelPosition } from './debugPanelPosition'

describe('clampDebugPanelPosition', () => {
  it('keeps position inside the viewport', () => {
    expect(clampDebugPanelPosition(
      { x: 1200, y: 900 },
      { width: 1000, height: 700 },
      { width: 320, height: 240 },
    )).toEqual({ x: 680, y: 460 })
  })

  it('clamps negative position to zero', () => {
    expect(clampDebugPanelPosition(
      { x: -20, y: -10 },
      { width: 1000, height: 700 },
      { width: 320, height: 240 },
    )).toEqual({ x: 0, y: 0 })
  })

  it('pins panel to origin when panel is larger than viewport', () => {
    expect(clampDebugPanelPosition(
      { x: 40, y: 80 },
      { width: 200, height: 120 },
      { width: 320, height: 240 },
    )).toEqual({ x: 0, y: 0 })
  })
})
