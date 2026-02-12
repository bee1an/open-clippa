import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { TimeController } from '../src/_internal/timeController'

type RafCallback = (time: number) => void

function createRafScheduler() {
  let id = 0
  const callbacks = new Map<number, RafCallback>()

  const requestAnimationFrame = vi.fn((callback: RafCallback) => {
    id += 1
    callbacks.set(id, callback)
    return id
  })

  const cancelAnimationFrame = vi.fn((requestId: number) => {
    callbacks.delete(requestId)
  })

  const runNext = (time: number): number | undefined => {
    const nextId = callbacks.keys().next().value as number | undefined
    if (nextId === undefined)
      return undefined

    const callback = callbacks.get(nextId)
    callbacks.delete(nextId)
    callback?.(time)
    return nextId
  }

  return {
    callbacks,
    requestAnimationFrame,
    cancelAnimationFrame,
    runNext,
  }
}

describe('timeController', () => {
  let now: number

  beforeEach(() => {
    now = 0
    vi.spyOn(Date, 'now').mockImplementation(() => now)
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('plays forward and clamps to duration when reaching the end', () => {
    const scheduler = createRafScheduler()
    vi.stubGlobal('requestAnimationFrame', scheduler.requestAnimationFrame)
    vi.stubGlobal('cancelAnimationFrame', scheduler.cancelAnimationFrame)

    const controller = new TimeController()
    controller.duration = 100

    const playingSpy = vi.fn()
    const updateSpy = vi.fn()
    controller.on('playing', playingSpy)
    controller.on('updateCurrentTime', updateSpy)

    controller.play()
    expect(playingSpy).toHaveBeenCalledTimes(1)

    now = 30
    scheduler.runNext(30)
    expect(controller.currentTime).toBe(30)

    now = 130
    scheduler.runNext(130)
    expect(controller.currentTime).toBe(100)
    expect((controller as any)._playing).toBe(false)
    expect(updateSpy).toHaveBeenLastCalledWith(100)
  })

  it('pause cancels pending animation frame and emits pause', () => {
    const scheduler = createRafScheduler()
    vi.stubGlobal('requestAnimationFrame', scheduler.requestAnimationFrame)
    vi.stubGlobal('cancelAnimationFrame', scheduler.cancelAnimationFrame)

    const controller = new TimeController()
    const pauseSpy = vi.fn()
    controller.on('pause', pauseSpy)

    controller.play()
    expect((controller as any)._playing).toBe(true)

    controller.pause()
    expect((controller as any)._playing).toBe(false)
    expect(pauseSpy).toHaveBeenCalledTimes(1)
    expect(scheduler.cancelAnimationFrame).toHaveBeenCalled()
  })

  it('seek pauses playback and updates current time immediately', async () => {
    const scheduler = createRafScheduler()
    vi.stubGlobal('requestAnimationFrame', scheduler.requestAnimationFrame)
    vi.stubGlobal('cancelAnimationFrame', scheduler.cancelAnimationFrame)

    const controller = new TimeController()
    controller.play()

    await controller.seek(42)

    expect(controller.currentTime).toBe(42)
    expect((controller as any)._playing).toBe(false)
    expect(scheduler.cancelAnimationFrame).toHaveBeenCalled()
  })
})
