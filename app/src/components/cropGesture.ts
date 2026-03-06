export function rotateCropDelta(x: number, y: number, angle: number): { x: number, y: number } {
  if (!angle)
    return { x, y }

  const radians = angle * Math.PI / 180
  const cos = Math.cos(radians)
  const sin = Math.sin(radians)
  return {
    x: x * cos - y * sin,
    y: x * sin + y * cos,
  }
}
