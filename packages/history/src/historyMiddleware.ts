import type {
  CommandSource,
  HistoryEntry,
  SnapshotHistoryRecipe,
} from './types'

function stableStringify(value: unknown): string {
  return JSON.stringify(value, (_key, currentValue) => {
    if (Array.isArray(currentValue))
      return currentValue

    if (currentValue && typeof currentValue === 'object') {
      const source = currentValue as Record<string, unknown>
      const sortedKeys = Object.keys(source).sort((left, right) => left.localeCompare(right))
      const sorted: Record<string, unknown> = {}
      sortedKeys.forEach((key) => {
        sorted[key] = source[key]
      })
      return sorted
    }

    return currentValue
  })
}

export function isSnapshotEqual<TSnapshot>(left: TSnapshot, right: TSnapshot): boolean {
  return stableStringify(left) === stableStringify(right)
}

export function buildSnapshotHistoryEntry<TSnapshot>(input: {
  commandType: string
  label: string
  source: CommandSource
  transactionId: string | null
  beforeSnapshot: TSnapshot
  afterSnapshot: TSnapshot
  timestamp?: number
}): HistoryEntry<TSnapshot> {
  const timestamp = input.timestamp ?? Date.now()

  const undoRecipe: SnapshotHistoryRecipe<TSnapshot> = {
    kind: 'snapshot',
    snapshot: input.beforeSnapshot,
  }

  const redoRecipe: SnapshotHistoryRecipe<TSnapshot> = {
    kind: 'snapshot',
    snapshot: input.afterSnapshot,
  }

  return {
    id: `history-${timestamp}-${Math.random().toString(36).slice(2, 10)}`,
    commandType: input.commandType,
    label: input.label,
    source: input.source,
    timestamp,
    transactionId: input.transactionId,
    undoRecipe,
    redoRecipe,
  }
}
