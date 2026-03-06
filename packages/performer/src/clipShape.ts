import type { Graphics } from 'pixi.js'
import type { PerformerClipShape } from './performer'

const SHAPE_EPSILON = 1e-6

export function cloneClipShape(shape?: PerformerClipShape | null): PerformerClipShape | null {
  if (!shape)
    return null

  return {
    id: shape.id,
    points: shape.points.map(point => ({
      x: point.x,
      y: point.y,
    })),
  }
}

export function hasClipShape(shape?: PerformerClipShape | null): boolean {
  return Boolean(shape && shape.points.length >= 3)
}

export function drawClipShapePath(
  graphics: Graphics,
  shape: PerformerClipShape,
  originX: number,
  originY: number,
  width: number,
  height: number,
): void {
  if (!hasClipShape(shape))
    return

  shape.points.forEach((point, index) => {
    const x = originX + point.x * width
    const y = originY + point.y * height
    if (index === 0)
      graphics.moveTo(x, y)
    else
      graphics.lineTo(x, y)
  })
  graphics.closePath()
}

export function isPointInsideClipShape(
  localX: number,
  localY: number,
  shape: PerformerClipShape,
  width: number,
  height: number,
): boolean {
  if (!hasClipShape(shape) || width <= SHAPE_EPSILON || height <= SHAPE_EPSILON)
    return false

  const normalizedX = localX / width
  const normalizedY = localY / height
  let inside = false

  for (let index = 0, previous = shape.points.length - 1; index < shape.points.length; previous = index, index += 1) {
    const currentPoint = shape.points[index]
    const previousPoint = shape.points[previous]

    const intersects = ((currentPoint.y > normalizedY) !== (previousPoint.y > normalizedY))
      && (
        normalizedX
        < ((previousPoint.x - currentPoint.x) * (normalizedY - currentPoint.y))
        / ((previousPoint.y - currentPoint.y) || SHAPE_EPSILON)
        + currentPoint.x
      )

    if (intersects)
      inside = !inside
  }

  return inside
}
