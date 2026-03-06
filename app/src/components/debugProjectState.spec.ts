import type { PersistedProjectState } from '@/persistence/types'
import { describe, expect, it } from 'vitest'
import { comparePersistedProjectStateSync, stringifyPersistedProjectStateForDebug } from './debugProjectState'

function createSnapshot() {
  return {
    performers: [
      {
        id: 'performer-1',
        kind: 'image' as const,
        startMs: 0,
        durationMs: 1000,
        zIndex: 1,
        timelineLane: 1,
        x: 10,
        y: 20,
        width: 200,
        height: 100,
        rotation: 0,
        alpha: 1,
        src: 'asset://image-1',
      },
    ],
    selectedPerformerIds: ['performer-1'],
    activeTrainId: 'performer-1',
    currentTimeMs: 0,
    filters: [],
    activeFilterLayerId: null,
    transitions: [],
    activeTransitionId: null,
    activeTransitionPairKey: null,
  }
}

function createPersistedState(overrides: Partial<PersistedProjectState> = {}): PersistedProjectState {
  return {
    projectId: 'project-1',
    schemaVersion: 2,
    savedAt: 100,
    canvasPresetId: '16:9',
    editorContentSnapshot: createSnapshot(),
    videoAssets: [],
    audioAssets: [],
    imageAssets: [
      {
        id: 'image-1',
        kind: 'image',
        name: 'cover.png',
        sourceType: 'handle',
        handle: {
          kind: 'file',
          name: 'cover.png',
        } as FileSystemFileHandle,
        size: 1200,
        createdAt: 10,
      },
    ],
    ...overrides,
  }
}

describe('comparePersistedProjectStateSync', () => {
  it('ignores savedAt and normalizes file handles', () => {
    const currentState = createPersistedState({
      savedAt: 200,
      imageAssets: [
        {
          id: 'image-1',
          kind: 'image',
          name: 'cover.png',
          sourceType: 'handle',
          handle: {
            kind: 'file',
            name: 'cover.png',
          } as FileSystemFileHandle,
          size: 1200,
          createdAt: 10,
        },
      ],
    })
    const persistedState = createPersistedState({
      savedAt: 300,
      imageAssets: [
        {
          id: 'image-1',
          kind: 'image',
          name: 'cover.png',
          sourceType: 'handle',
          handle: {
            kind: 'file',
            name: 'cover.png',
          } as FileSystemFileHandle,
          size: 1200,
          createdAt: 10,
        },
      ],
    })

    const result = comparePersistedProjectStateSync(currentState, persistedState)

    expect(result.synced).toBe(true)
    expect(result.sections.every(section => section.synced)).toBe(true)
  })

  it('reports mismatched sections when persisted state differs', () => {
    const currentState = createPersistedState()
    const persistedState = createPersistedState({
      canvasPresetId: '9:16',
      editorContentSnapshot: {
        ...createSnapshot(),
        performers: [],
        selectedPerformerIds: [],
        activeTrainId: null,
      },
    })

    const result = comparePersistedProjectStateSync(currentState, persistedState)

    expect(result.synced).toBe(false)
    expect(result.sections.find(section => section.key === 'canvasPresetId')?.synced).toBe(false)
    expect(result.sections.find(section => section.key === 'editorContentSnapshot')?.synced).toBe(false)
    expect(result.sections.find(section => section.key === 'imageAssets')?.synced).toBe(true)
  })

  it('serializes comparable payload without savedAt noise', () => {
    const payload = stringifyPersistedProjectStateForDebug(createPersistedState({
      savedAt: 999,
    }))

    expect(payload).not.toContain('"savedAt"')
    expect(payload).toContain('"projectId": "project-1"')
    expect(payload).toContain('"sourceType": "handle"')
  })
})
