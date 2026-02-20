import type {
  BeginTransactionInput,
  CommandActionResult,
  CommandSource,
  EditorCommand,
  HistoryStatusSnapshot,
  UndoRedoOptions,
} from './types'
import { buildSnapshotHistoryEntry, isSnapshotEqual } from './historyMiddleware'
import { HistoryStore, MAX_HISTORY_ENTRIES } from './historyStore'

interface ActiveTransactionPayload {
  id: string
  label: string
  source: CommandSource
  startedAt: number
  commandCount: number
  mergeKey: string | null
  beforeSnapshot: unknown
  afterSnapshot: unknown
  hasChanges: boolean
}

function success<T>(data: T): CommandActionResult<T> {
  return {
    ok: true,
    data,
  }
}

function failure<T = unknown>(
  code: 'INVALID_ARGUMENT' | 'NOT_FOUND' | 'NOT_READY' | 'UNSUPPORTED' | 'CONFLICT',
  message: string,
): CommandActionResult<T> {
  return {
    ok: false,
    error: {
      code,
      message,
    },
  }
}

function toErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim().length > 0)
    return error.message.trim()
  return fallback
}

export class EditorCommandBus {
  private readonly historyStore: HistoryStore

  constructor(options: { maxEntries?: number } = {}) {
    this.historyStore = new HistoryStore(options.maxEntries ?? MAX_HISTORY_ENTRIES)
  }

  getStore(): HistoryStore {
    return this.historyStore
  }

  async dispatch<TData>(
    command: EditorCommand,
    execute: () => Promise<CommandActionResult<TData>> | CommandActionResult<TData>,
    options: {
      recordable?: boolean
      source?: CommandSource
      label?: string
      captureSnapshot?: () => Promise<unknown> | unknown
    } = {},
  ): Promise<CommandActionResult<TData>> {
    if (this.historyStore.state.isApplying)
      return failure('CONFLICT', 'Cannot execute command while applying history')

    const source = command.meta?.source ?? options.source ?? 'system'
    const label = command.meta?.label ?? options.label ?? command.type
    const shouldRecord = command.meta?.recordable ?? options.recordable ?? true
    const captureSnapshot = options.captureSnapshot

    let beforeSnapshot: unknown = null

    const activeTransaction = this.historyStore.state.activeTransaction as ActiveTransactionPayload | null
    if (shouldRecord && captureSnapshot) {
      if (activeTransaction) {
        if (activeTransaction.beforeSnapshot === null)
          activeTransaction.beforeSnapshot = await captureSnapshot()
      }
      else {
        beforeSnapshot = await captureSnapshot()
      }
    }

    const result = await execute()
    if (!result.ok)
      return result

    if (!shouldRecord || !captureSnapshot)
      return result

    const afterSnapshot = await captureSnapshot()

    if (activeTransaction) {
      activeTransaction.commandCount += 1
      if (activeTransaction.beforeSnapshot === null)
        activeTransaction.beforeSnapshot = beforeSnapshot ?? afterSnapshot

      activeTransaction.afterSnapshot = afterSnapshot

      if (!activeTransaction.hasChanges && activeTransaction.beforeSnapshot !== null) {
        activeTransaction.hasChanges = !isSnapshotEqual(
          activeTransaction.beforeSnapshot,
          afterSnapshot,
        )
      }

      return result
    }

    if (beforeSnapshot === null)
      return result

    if (isSnapshotEqual(beforeSnapshot, afterSnapshot))
      return result

    this.historyStore.clearFuture()
    this.historyStore.pushPastEntry(buildSnapshotHistoryEntry({
      commandType: command.type,
      label,
      source,
      transactionId: command.meta?.transactionId ?? null,
      beforeSnapshot,
      afterSnapshot,
    }))

    return result
  }

  beginTransaction(input: BeginTransactionInput = {}): CommandActionResult<{ transactionId: string, status: HistoryStatusSnapshot }> {
    if (this.historyStore.state.isApplying)
      return failure('CONFLICT', 'Cannot begin transaction while applying history')

    if (this.historyStore.state.activeTransaction)
      return failure('CONFLICT', 'Another history transaction is active')

    const startedAt = Date.now()
    const transactionId = `tx-${startedAt}-${Math.random().toString(36).slice(2, 10)}`
    const transaction: ActiveTransactionPayload = {
      id: transactionId,
      label: input.label?.trim() || 'History Transaction',
      source: input.source ?? 'system',
      startedAt,
      commandCount: 0,
      mergeKey: input.mergeKey?.trim() || null,
      beforeSnapshot: null,
      afterSnapshot: null,
      hasChanges: false,
    }

    this.historyStore.setActiveTransaction(transaction)

    return success({
      transactionId,
      status: this.historyStore.getStatus(),
    })
  }

  endTransaction(transactionId?: string): CommandActionResult<{ committed: boolean, status: HistoryStatusSnapshot }> {
    const transaction = this.historyStore.state.activeTransaction as ActiveTransactionPayload | null
    if (!transaction)
      return failure('CONFLICT', 'No active history transaction')

    if (transactionId && transaction.id !== transactionId)
      return failure('CONFLICT', 'Transaction id does not match active transaction')

    let committed = false
    if (
      transaction.hasChanges
      && transaction.beforeSnapshot !== null
      && transaction.afterSnapshot !== null
    ) {
      this.historyStore.clearFuture()
      this.historyStore.pushPastEntry(buildSnapshotHistoryEntry({
        commandType: 'history.transaction',
        label: transaction.label,
        source: transaction.source,
        transactionId: transaction.id,
        beforeSnapshot: transaction.beforeSnapshot,
        afterSnapshot: transaction.afterSnapshot,
      }))
      committed = true
    }

    this.historyStore.setActiveTransaction(null)

    return success({
      committed,
      status: this.historyStore.getStatus(),
    })
  }

  cancelTransaction(transactionId?: string): CommandActionResult<{ canceled: boolean, status: HistoryStatusSnapshot }> {
    const transaction = this.historyStore.state.activeTransaction
    if (!transaction)
      return failure('CONFLICT', 'No active history transaction')

    if (transactionId && transaction.id !== transactionId)
      return failure('CONFLICT', 'Transaction id does not match active transaction')

    this.historyStore.setActiveTransaction(null)

    return success({
      canceled: true,
      status: this.historyStore.getStatus(),
    })
  }

  async undo(options: UndoRedoOptions): Promise<CommandActionResult<{ entryId: string, status: HistoryStatusSnapshot }>> {
    if (this.historyStore.state.isApplying)
      return failure('CONFLICT', 'History is currently applying changes')

    if (this.historyStore.state.activeTransaction)
      return failure('CONFLICT', 'Cannot undo while a history transaction is active')

    const entry = this.historyStore.shiftPastEntry()
    if (!entry)
      return failure('NOT_FOUND', 'No undo entry available')

    this.historyStore.setApplying(true)
    try {
      const applied = await this.applyRecipe(entry.undoRecipe, options)
      if (!applied.ok) {
        this.historyStore.pushPastEntry(entry)
        return applied
      }

      this.historyStore.pushFutureEntry(entry)
      return success({
        entryId: entry.id,
        status: this.historyStore.getStatus(),
      })
    }
    catch (error) {
      this.historyStore.pushPastEntry(entry)
      return failure('NOT_READY', toErrorMessage(error, 'Undo failed'))
    }
    finally {
      this.historyStore.setApplying(false)
    }
  }

  async redo(options: UndoRedoOptions): Promise<CommandActionResult<{ entryId: string, status: HistoryStatusSnapshot }>> {
    if (this.historyStore.state.isApplying)
      return failure('CONFLICT', 'History is currently applying changes')

    if (this.historyStore.state.activeTransaction)
      return failure('CONFLICT', 'Cannot redo while a history transaction is active')

    const entry = this.historyStore.shiftFutureEntry()
    if (!entry)
      return failure('NOT_FOUND', 'No redo entry available')

    this.historyStore.setApplying(true)
    try {
      const applied = await this.applyRecipe(entry.redoRecipe, options)
      if (!applied.ok) {
        this.historyStore.pushFutureEntry(entry)
        return applied
      }

      this.historyStore.pushPastEntry(entry)
      return success({
        entryId: entry.id,
        status: this.historyStore.getStatus(),
      })
    }
    catch (error) {
      this.historyStore.pushFutureEntry(entry)
      return failure('NOT_READY', toErrorMessage(error, 'Redo failed'))
    }
    finally {
      this.historyStore.setApplying(false)
    }
  }

  getHistoryStatus(): HistoryStatusSnapshot {
    return this.historyStore.getStatus()
  }

  resetForTesting(): void {
    this.historyStore.resetState()
  }

  private async applyRecipe(
    recipe: { kind: 'snapshot', snapshot: unknown } | { kind: 'inverse', commands: EditorCommand[] },
    options: UndoRedoOptions,
  ): Promise<CommandActionResult<true>> {
    if (recipe.kind === 'snapshot') {
      await options.applySnapshot(recipe.snapshot)
      return success(true)
    }

    if (!options.executeCommands)
      return failure('UNSUPPORTED', 'Inverse history recipe requires command executor')

    await options.executeCommands(recipe.commands)
    return success(true)
  }
}
