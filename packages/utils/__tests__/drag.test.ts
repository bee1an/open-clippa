import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { drag } from '../src/drag'

type Listener = (event: PointerEvent) => void

function createDocumentMock() {
  const listeners = new Map<string, Set<Listener>>()

  const addEventListener = vi.fn((event: string, callback: Listener) => {
    if (!listeners.has(event))
      listeners.set(event, new Set())
    listeners.get(event)!.add(callback)
  })

  const removeEventListener = vi.fn((event: string, callback: Listener) => {
    listeners.get(event)?.delete(callback)
  })

  const getListener = (event: string): Listener | undefined => {
    return [...(listeners.get(event) ?? [])][0]
  }

  return {
    addEventListener,
    removeEventListener,
    getListener,
    listeners,
  }
}

describe('drag', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('emits down/move/up with accumulated pointer delta', () => {
    const documentMock = createDocumentMock()
    vi.stubGlobal('document', documentMock)

    let pointerDownHandler: ((event: PointerEvent) => void) | undefined
    const target = {
      on: vi.fn((_event: 'pointerdown', callback: (event: PointerEvent) => void) => {
        pointerDownHandler = callback
      }),
    }

    const down = vi.fn()
    const move = vi.fn()
    const up = vi.fn()

    drag(target, { down, move, up })

    pointerDownHandler?.({ x: 10, y: 20 } as PointerEvent)

    const moveListener = documentMock.getListener('pointermove')
    const upListener = documentMock.getListener('pointerup')
    expect(moveListener).toBeTypeOf('function')
    expect(upListener).toBeTypeOf('function')

    moveListener?.({ x: 14, y: 25 } as PointerEvent)
    moveListener?.({ x: 20, y: 30 } as PointerEvent)

    expect(down).toHaveBeenCalledTimes(1)
    expect(move).toHaveBeenNthCalledWith(1, { x: 14, y: 25 }, { dx: 4, dy: 5 })
    expect(move).toHaveBeenNthCalledWith(2, { x: 20, y: 30 }, { dx: 6, dy: 5 })

    upListener?.({ x: 20, y: 30 } as PointerEvent)

    expect(up).toHaveBeenCalledTimes(1)
    expect(documentMock.removeEventListener).toHaveBeenCalledTimes(2)
    expect(documentMock.listeners.get('pointermove')?.size ?? 0).toBe(0)
    expect(documentMock.listeners.get('pointerup')?.size ?? 0).toBe(0)
  })
})
