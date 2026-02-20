import type {
  ActiveHistoryTransaction,
  HistoryEntry,
  HistoryStatusSnapshot,
} from '@clippc/history'
import { MAX_HISTORY_ENTRIES } from '@clippc/history'
import { computed, ref } from 'vue'
import { getEditorCommandBus } from '@/command/commandBus'

const commandBus = getEditorCommandBus()
const baseStore = commandBus.getStore()
const revision = ref(0)
baseStore.subscribe(() => {
  revision.value += 1
})

const state = computed(() => {
  revision.value
  return baseStore.state
})

const status = computed(() => {
  revision.value
  return baseStore.getStatus()
})

function pushPastEntry(entry: HistoryEntry): void {
  baseStore.pushPastEntry(entry)
}

function shiftPastEntry(): HistoryEntry | null {
  return baseStore.shiftPastEntry()
}

function pushFutureEntry(entry: HistoryEntry): void {
  baseStore.pushFutureEntry(entry)
}

function shiftFutureEntry(): HistoryEntry | null {
  return baseStore.shiftFutureEntry()
}

function clearFuture(): void {
  baseStore.clearFuture()
}

function setActiveTransaction(transaction: ActiveHistoryTransaction | null): void {
  baseStore.setActiveTransaction(transaction)
}

function setApplying(value: boolean): void {
  baseStore.setApplying(value)
}

function getStatus(): HistoryStatusSnapshot {
  return baseStore.getStatus()
}

function resetState(): void {
  baseStore.resetState()
}

export function useHistoryStore() {
  return {
    state,
    status,
    pushPastEntry,
    shiftPastEntry,
    pushFutureEntry,
    shiftFutureEntry,
    clearFuture,
    setActiveTransaction,
    setApplying,
    getStatus,
    resetState,
  }
}

export { MAX_HISTORY_ENTRIES }
