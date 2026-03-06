export interface PanelPosition {
  x: number
  y: number
}

export interface PanelSize {
  width: number
  height: number
}

export function clampDebugPanelPosition(
  position: PanelPosition,
  viewport: PanelSize,
  panel: PanelSize,
): PanelPosition {
  const maxX = Math.max(0, viewport.width - panel.width)
  const maxY = Math.max(0, viewport.height - panel.height)

  return {
    x: Math.min(Math.max(0, position.x), maxX),
    y: Math.min(Math.max(0, position.y), maxY),
  }
}
