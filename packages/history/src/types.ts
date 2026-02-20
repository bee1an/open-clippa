export type CommandSource = 'ui' | 'ai' | 'shortcut' | 'system'

export interface CommandMeta {
  source?: CommandSource
  label?: string
  recordable?: boolean
  transactionId?: string
  mergeKey?: string
}

export interface EditorCommand<TPayload = Record<string, unknown>> {
  type: string
  payload: TPayload
  meta?: CommandMeta
}

export interface CommandActionError {
  code: 'INVALID_ARGUMENT' | 'NOT_FOUND' | 'NOT_READY' | 'UNSUPPORTED' | 'CONFLICT'
  message: string
  details?: unknown
}

export type CommandActionResult<T = unknown>
  = | { ok: true, data: T }
    | { ok: false, error: CommandActionError }

export interface SnapshotHistoryRecipe<TSnapshot = unknown> {
  kind: 'snapshot'
  snapshot: TSnapshot
}

export interface InverseHistoryRecipe {
  kind: 'inverse'
  commands: EditorCommand[]
}

export type HistoryRecipe<TSnapshot = unknown>
  = SnapshotHistoryRecipe<TSnapshot>
    | InverseHistoryRecipe

export interface HistoryEntry<TSnapshot = unknown> {
  id: string
  commandType: string
  label: string
  source: CommandSource
  timestamp: number
  transactionId: string | null
  undoRecipe: HistoryRecipe<TSnapshot>
  redoRecipe: HistoryRecipe<TSnapshot>
}

export interface ActiveHistoryTransaction<TSnapshot = unknown> {
  id: string
  label: string
  source: CommandSource
  startedAt: number
  commandCount: number
  mergeKey: string | null
  beforeSnapshot: TSnapshot | null
  afterSnapshot: TSnapshot | null
  hasChanges: boolean
}

export interface HistoryStatusSnapshot {
  canUndo: boolean
  canRedo: boolean
  pastCount: number
  futureCount: number
  activeTransaction: {
    id: string
    label: string
    source: CommandSource
    startedAt: number
    commandCount: number
  } | null
}

export interface BeginTransactionInput {
  source?: CommandSource
  label?: string
  mergeKey?: string
}

export interface UndoRedoOptions<TSnapshot = unknown> {
  applySnapshot: (snapshot: TSnapshot) => Promise<void> | void
  executeCommands?: (commands: EditorCommand[]) => Promise<void>
}
