import type { SelectionItem } from '@clippc/selection'
import { describe, expect, it } from 'vitest'
import { buildSnapBoxFromSelectionItem, useCanvasSnap } from './useCanvasSnap'

function createItem(overrides: Partial<SelectionItem> = {}): SelectionItem {
  return {
    id: 'current',
    x: 95,
    y: 100,
    width: 80,
    height: 60,
    rotation: 0,
    zIndex: 1,
    ...overrides,
  }
}

describe('useCanvasSnap', () => {
  it('snaps drag movement to canvas center line', () => {
    const snap = useCanvasSnap()
    snap.startDrag()

    const result = snap.apply({
      item: createItem({ x: 118 }),
      context: {
        canvasWidth: 400,
        canvasHeight: 300,
        peers: [],
      },
      bypass: false,
    })

    expect(result.item.x).toBe(120)
    expect(result.guides).toContainEqual({ axis: 'x', value: 200 })
  })

  it('bypasses snapping when modifier key is active', () => {
    const snap = useCanvasSnap()
    snap.startDrag()

    const result = snap.apply({
      item: createItem({ x: 98 }),
      context: {
        canvasWidth: 400,
        canvasHeight: 300,
        peers: [],
      },
      bypass: true,
    })

    expect(result.item.x).toBe(98)
    expect(result.guides).toEqual([])
  })

  it('releases drag snap without jump when pointer leaves threshold', () => {
    const snap = useCanvasSnap()
    snap.startDrag()

    const context = {
      canvasWidth: 400,
      canvasHeight: 300,
      peers: [],
    }

    const enter = snap.apply({
      item: createItem({ x: 158 }),
      context,
      bypass: false,
    })
    expect(enter.item.x).toBe(160)

    const keep = snap.apply({
      item: createItem({ x: 171 }),
      context,
      bypass: false,
    })
    expect(keep.item.x).toBe(160)

    const release = snap.apply({
      item: createItem({ x: 173 }),
      context,
      bypass: false,
    })
    expect(release.item.x).toBe(173)
  })

  it('snaps side resize for unrotated item', () => {
    const snap = useCanvasSnap()
    snap.startResize('right')

    const result = snap.apply({
      item: createItem({ x: 90, width: 108 }),
      context: {
        canvasWidth: 400,
        canvasHeight: 300,
        peers: [],
      },
      bypass: false,
    })

    expect(result.item.width).toBe(110)
    expect(result.guides).toContainEqual({ axis: 'x', value: 200 })
  })

  it('does not snap resize when item is rotated', () => {
    const snap = useCanvasSnap()
    snap.startResize('right')

    const result = snap.apply({
      item: createItem({ rotation: 20, x: 90, width: 108 }),
      context: {
        canvasWidth: 400,
        canvasHeight: 300,
        peers: [],
      },
      bypass: false,
    })

    expect(result.item.width).toBe(108)
    expect(result.guides).toEqual([])
  })

  it('builds AABB snap box for rotated item', () => {
    const source = createItem({
      id: 'rotated',
      x: 100,
      y: 100,
      width: 100,
      height: 40,
      rotation: 45,
    })
    const box = buildSnapBoxFromSelectionItem(source)
    const boxWidth = box.right - box.left
    const boxHeight = box.bottom - box.top

    expect(box.id).toBe('rotated')
    expect(Math.abs(boxWidth - source.width)).toBeGreaterThan(0.5)
    expect(boxHeight).toBeGreaterThan(source.height)
    expect(box.centerX).toBeCloseTo(source.x + source.width / 2, 6)
    expect(box.centerY).toBeCloseTo(source.y + source.height / 2, 6)
  })
})
