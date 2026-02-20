import { beforeEach, describe, expect, it } from 'vitest'
import { getEditorCommandBus, resetEditorCommandBusForTesting } from '@/command/commandBus'

interface CounterSnapshot {
  value: number
}

function createSuccessResult<T>(data: T) {
  return {
    ok: true as const,
    data,
  }
}

describe('history command bus', () => {
  beforeEach(() => {
    resetEditorCommandBusForTesting()
  })

  it('records mutations and clears redo stack on new command', async () => {
    const bus = getEditorCommandBus()
    let counter = 0

    const capture = (): CounterSnapshot => ({ value: counter })

    await bus.dispatch(
      { type: 'counter.increment', payload: {} },
      async () => {
        counter += 1
        return createSuccessResult({ value: counter })
      },
      {
        captureSnapshot: capture,
      },
    )

    const undoResult = await bus.undo({
      applySnapshot: async (snapshot: unknown) => {
        counter = (snapshot as CounterSnapshot).value
      },
    })
    expect(undoResult.ok).toBe(true)
    expect(counter).toBe(0)

    await bus.dispatch(
      { type: 'counter.set', payload: { value: 9 } },
      async () => {
        counter = 9
        return createSuccessResult({ value: counter })
      },
      {
        captureSnapshot: capture,
      },
    )

    const statusResult = bus.getHistoryStatus()
    expect(statusResult.canRedo).toBe(false)
    expect(statusResult.pastCount).toBe(1)
    expect(counter).toBe(9)
  })

  it('skips history entry for no-op commands', async () => {
    const bus = getEditorCommandBus()
    let counter = 3

    const result = await bus.dispatch(
      { type: 'counter.noop', payload: {} },
      async () => createSuccessResult({ value: counter }),
      {
        captureSnapshot: () => ({ value: counter }),
      },
    )

    expect(result.ok).toBe(true)
    expect(bus.getHistoryStatus().pastCount).toBe(0)
  })

  it('limits history to 100 entries', async () => {
    const bus = getEditorCommandBus()
    let counter = 0

    for (let index = 0; index < 130; index += 1) {
      await bus.dispatch(
        {
          type: 'counter.increment',
          payload: { index },
        },
        async () => {
          counter += 1
          return createSuccessResult({ value: counter })
        },
        {
          captureSnapshot: () => ({ value: counter }),
        },
      )
    }

    const status = bus.getHistoryStatus()
    expect(status.pastCount).toBe(100)
    expect(status.canUndo).toBe(true)
  })

  it('merges commands in an active transaction into one entry', async () => {
    const bus = getEditorCommandBus()
    let counter = 0

    const begin = bus.beginTransaction({ source: 'ui', label: 'Batch Update' })
    expect(begin.ok).toBe(true)
    if (!begin.ok)
      return

    await bus.dispatch(
      { type: 'counter.increment', payload: {} },
      async () => {
        counter += 1
        return createSuccessResult({ value: counter })
      },
      {
        captureSnapshot: () => ({ value: counter }),
      },
    )

    await bus.dispatch(
      { type: 'counter.increment', payload: {} },
      async () => {
        counter += 1
        return createSuccessResult({ value: counter })
      },
      {
        captureSnapshot: () => ({ value: counter }),
      },
    )

    const end = bus.endTransaction(begin.data.transactionId)
    expect(end.ok).toBe(true)
    expect(bus.getHistoryStatus().pastCount).toBe(1)
  })

  it('blocks undo while transaction is active', async () => {
    const bus = getEditorCommandBus()
    const begin = bus.beginTransaction({ source: 'ui', label: 'Locked Tx' })
    expect(begin.ok).toBe(true)

    const result = await bus.undo({
      applySnapshot: async () => {},
    })

    expect(result.ok).toBe(false)
    if (!result.ok)
      expect(result.error.code).toBe('CONFLICT')
  })
})
