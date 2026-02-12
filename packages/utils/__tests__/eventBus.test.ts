import { describe, expect, it, vi } from 'vitest'
import { EventBus } from '../src/eventBus'

type TestEvents = {
  message: [text: string]
  done: []
}

class TestBus extends EventBus<TestEvents> {}

describe('eventBus', () => {
  it('deduplicates repeated listeners for the same event', () => {
    const bus = new TestBus()
    const listener = vi.fn()

    bus.on('message', listener)
    bus.on('message', listener)
    bus.emit('message', 'hello')

    expect(listener).toHaveBeenCalledTimes(1)
    expect(listener).toHaveBeenCalledWith('hello')
  })

  it('supports once listener and removes it after first emit', () => {
    const bus = new TestBus()
    const listener = vi.fn()

    bus.once('done', listener)
    bus.emit('done')
    bus.emit('done')

    expect(listener).toHaveBeenCalledTimes(1)
  })

  it('supports off without affecting other listeners', () => {
    const bus = new TestBus()
    const active = vi.fn()
    const removed = vi.fn()

    bus.on('message', active)
    bus.on('message', removed)
    bus.off('message', removed)
    bus.emit('message', 'value')

    expect(active).toHaveBeenCalledTimes(1)
    expect(removed).not.toHaveBeenCalled()
  })
})
