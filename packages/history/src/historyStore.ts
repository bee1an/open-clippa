import type {
  ActiveHistoryTransaction,
  HistoryEntry,
  HistoryStatusSnapshot,
} from './types'

export const MAX_HISTORY_ENTRIES = 100

export interface HistoryState<TSnapshot = unknown> {
  past: HistoryEntry<TSnapshot>[]
  future: HistoryEntry<TSnapshot>[]
  activeTransaction: ActiveHistoryTransaction<TSnapshot> | null
  isApplying: boolean
  maxEntries: number
}

export type HistoryStoreListener = () => void

export class HistoryStore<TSnapshot = unknown> {
  readonly state: HistoryState<TSnapshot>
  private readonly listeners = new Set<HistoryStoreListener>()

  constructor(maxEntries: number = MAX_HISTORY_ENTRIES) {
    this.state = {
      past: [],
      future: [],
      activeTransaction: null,
      isApplying: false,
      maxEntries,
    }
  }

  private trimPastToMaxEntries(): void {
    const overflowCount = Math.max(0, this.state.past.length - this.state.maxEntries)
    if (overflowCount > 0)
      this.state.past.splice(0, overflowCount)
  }

  pushPastEntry(entry: HistoryEntry<TSnapshot>): void {
    this.state.past.push(entry)
    this.trimPastToMaxEntries()
    this.notify()
  }

  shiftPastEntry(): HistoryEntry<TSnapshot> | null {
    const next = this.state.past.pop()
    if (next)
      this.notify()
    return next ?? null
  }

  pushFutureEntry(entry: HistoryEntry<TSnapshot>): void {
    this.state.future.push(entry)
    this.notify()
  }

  shiftFutureEntry(): HistoryEntry<TSnapshot> | null {
    const next = this.state.future.pop()
    if (next)
      this.notify()
    return next ?? null
  }

  clearFuture(): void {
    if (this.state.future.length === 0)
      return

    this.state.future.splice(0, this.state.future.length)
    this.notify()
  }

  setActiveTransaction(transaction: ActiveHistoryTransaction<TSnapshot> | null): void {
    this.state.activeTransaction = transaction
    this.notify()
  }

  setApplying(value: boolean): void {
    this.state.isApplying = value
    this.notify()
  }

  getStatus(): HistoryStatusSnapshot {
    return {
      canUndo: this.state.past.length > 0,
      canRedo: this.state.future.length > 0,
      pastCount: this.state.past.length,
      futureCount: this.state.future.length,
      activeTransaction: this.state.activeTransaction
        ? {
            id: this.state.activeTransaction.id,
            label: this.state.activeTransaction.label,
            source: this.state.activeTransaction.source,
            startedAt: this.state.activeTransaction.startedAt,
            commandCount: this.state.activeTransaction.commandCount,
          }
        : null,
    }
  }

  resetState(): void {
    this.state.past.splice(0, this.state.past.length)
    this.state.future.splice(0, this.state.future.length)
    this.state.activeTransaction = null
    this.state.isApplying = false
    this.notify()
  }

  subscribe(listener: HistoryStoreListener): () => void {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  private notify(): void {
    this.listeners.forEach(listener => listener())
  }
}
