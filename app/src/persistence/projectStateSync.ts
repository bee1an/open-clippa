import type { PersistedMediaAsset, PersistedProjectState } from '@/persistence/types'

export interface ProjectStateSyncSectionResult {
  key: 'meta' | 'canvasPresetId' | 'editorContentSnapshot' | 'videoAssets' | 'audioAssets' | 'imageAssets'
  synced: boolean
}

export interface ProjectStateSyncResult {
  synced: boolean
  persistedSavedAt: number
  sections: ProjectStateSyncSectionResult[]
  currentPayload: string
  persistedPayload: string
}

type ComparablePersistedProjectState = {
  meta: {
    projectId: string
    schemaVersion: number
  }
  canvasPresetId: string
  editorContentSnapshot: unknown
  videoAssets: unknown[]
  audioAssets: unknown[]
  imageAssets: unknown[]
}

function normalizePersistedMediaAsset(asset: PersistedMediaAsset): Record<string, unknown> {
  const base = {
    id: asset.id,
    kind: asset.kind,
    name: asset.name,
    sourceType: asset.sourceType,
    size: asset.size ?? null,
    createdAt: asset.createdAt ?? null,
  }

  if (asset.sourceType === 'url') {
    return {
      ...base,
      url: asset.url,
    }
  }

  return {
    ...base,
    handle: {
      kind: asset.handle?.kind ?? 'unknown',
      name: asset.handle?.name ?? null,
    },
  }
}

function sortKeysDeep(value: unknown): unknown {
  if (Array.isArray(value))
    return value.map(sortKeysDeep)

  if (!value || typeof value !== 'object')
    return value

  const entries = Object.entries(value as Record<string, unknown>)
    .sort(([left], [right]) => left.localeCompare(right))

  return Object.fromEntries(
    entries.map(([key, nestedValue]) => [key, sortKeysDeep(nestedValue)]),
  )
}

function toComparablePersistedProjectState(
  state: PersistedProjectState,
): ComparablePersistedProjectState {
  return {
    meta: {
      projectId: state.projectId,
      schemaVersion: state.schemaVersion,
    },
    canvasPresetId: state.canvasPresetId,
    editorContentSnapshot: sortKeysDeep(state.editorContentSnapshot),
    videoAssets: state.videoAssets.map(normalizePersistedMediaAsset),
    audioAssets: state.audioAssets.map(normalizePersistedMediaAsset),
    imageAssets: state.imageAssets.map(normalizePersistedMediaAsset),
  }
}

function stableStringify(value: unknown): string {
  return JSON.stringify(sortKeysDeep(value), null, 2)
}

export function stringifyPersistedProjectStateForDebug(state: PersistedProjectState): string {
  return stableStringify(toComparablePersistedProjectState(state))
}

export function comparePersistedProjectStateSync(
  currentState: PersistedProjectState,
  persistedState: PersistedProjectState,
): ProjectStateSyncResult {
  const comparableCurrent = toComparablePersistedProjectState(currentState)
  const comparablePersisted = toComparablePersistedProjectState(persistedState)

  const sections: ProjectStateSyncSectionResult[] = [
    {
      key: 'meta',
      synced: stableStringify(comparableCurrent.meta) === stableStringify(comparablePersisted.meta),
    },
    {
      key: 'canvasPresetId',
      synced: stableStringify(comparableCurrent.canvasPresetId) === stableStringify(comparablePersisted.canvasPresetId),
    },
    {
      key: 'editorContentSnapshot',
      synced: stableStringify(comparableCurrent.editorContentSnapshot) === stableStringify(comparablePersisted.editorContentSnapshot),
    },
    {
      key: 'videoAssets',
      synced: stableStringify(comparableCurrent.videoAssets) === stableStringify(comparablePersisted.videoAssets),
    },
    {
      key: 'audioAssets',
      synced: stableStringify(comparableCurrent.audioAssets) === stableStringify(comparablePersisted.audioAssets),
    },
    {
      key: 'imageAssets',
      synced: stableStringify(comparableCurrent.imageAssets) === stableStringify(comparablePersisted.imageAssets),
    },
  ]

  return {
    synced: sections.every(section => section.synced),
    persistedSavedAt: persistedState.savedAt,
    sections,
    currentPayload: stringifyPersistedProjectStateForDebug(currentState),
    persistedPayload: stringifyPersistedProjectStateForDebug(persistedState),
  }
}
