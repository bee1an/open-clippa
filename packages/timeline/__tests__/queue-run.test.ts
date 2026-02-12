import { afterEach, describe, expect, it, vi } from 'vitest'
import { QueueRun } from '../src/utils/queueRun'

type RafCallback = (time: number) => void

function createScheduler() {
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

  const runById = (requestId: number, time: number = 0): void => {
    const callback = callbacks.get(requestId)
    callbacks.delete(requestId)
    callback?.(time)
  }

  return {
    requestAnimationFrame,
    cancelAnimationFrame,
    callbacks,
    runById,
  }
}

describe('queueRun', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('cancels previous queued frame and keeps only latest schedule', () => {
    const scheduler = createScheduler()
    vi.stubGlobal('requestAnimationFrame', scheduler.requestAnimationFrame)
    vi.stubGlobal('cancelAnimationFrame', scheduler.cancelAnimationFrame)

    const callback = vi.fn()
    const queue = new QueueRun(callback)

    queue.queueRun()
    queue.queueRun()

    expect(scheduler.requestAnimationFrame).toHaveBeenCalledTimes(2)
    expect(scheduler.cancelAnimationFrame).toHaveBeenCalledTimes(1)

    const latestId = scheduler.requestAnimationFrame.mock.results[1]?.value as number
    scheduler.runById(latestId)

    expect(callback).toHaveBeenCalledTimes(1)
  })

  it('run executes async callback', async () => {
    const callback = vi.fn(async () => {
      await Promise.resolve()
    })
    const queue = new QueueRun(callback)

    await queue.run()
    expect(callback).toHaveBeenCalledTimes(1)
  })
})
