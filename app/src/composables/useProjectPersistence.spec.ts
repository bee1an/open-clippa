import type { PersistedProjectState } from '@/persistence/types'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  applyEditorContentSnapshotMock,
  captureEditorContentSnapshotMock,
  capturePersistedProjectStateMock,
  restoreSnapshotFromPersistedSourcesMock,
  projectStoreState,
  editorStoreState,
  performerStoreState,
  filterStoreState,
  transitionStoreState,
  mediaStoreState,
  historyStoreState,
} = vi.hoisted(() => {
  return {
    applyEditorContentSnapshotMock: vi.fn(async () => {}),
    captureEditorContentSnapshotMock: vi.fn(() => ({
      performers: [],
      selectedPerformerIds: [],
      activeTrainId: null,
      currentTimeMs: 0,
      filters: [],
      activeFilterLayerId: null,
      transitions: [],
      activeTransitionId: null,
      activeTransitionPairKey: null,
    })),
    capturePersistedProjectStateMock: vi.fn(),
    restoreSnapshotFromPersistedSourcesMock: vi.fn((snapshot: unknown) => snapshot),
    projectStoreState: {} as Record<string, unknown>,
    editorStoreState: {} as Record<string, unknown>,
    performerStoreState: {} as Record<string, unknown>,
    filterStoreState: {} as Record<string, unknown>,
    transitionStoreState: {} as Record<string, unknown>,
    mediaStoreState: {} as Record<string, unknown>,
    historyStoreState: {} as Record<string, unknown>,
  }
})

vi.mock('vue', async () => {
  const actual = await vi.importActual<typeof import('vue')>('vue')
  return {
    ...actual,
    onUnmounted: vi.fn(),
  }
})

vi.mock('@/history/editorContentSnapshot', () => {
  return {
    applyEditorContentSnapshot: applyEditorContentSnapshotMock,
    captureEditorContentSnapshot: captureEditorContentSnapshotMock,
  }
})

vi.mock('@/persistence/projectSessionSerializer', () => {
  return {
    capturePersistedProjectState: capturePersistedProjectStateMock,
    restoreSnapshotFromPersistedSources: restoreSnapshotFromPersistedSourcesMock,
  }
})

vi.mock('@/store/useProjectStore', () => ({
  useProjectStore: () => projectStoreState,
}))

vi.mock('@/store/useEditorStore', () => ({
  useEditorStore: () => editorStoreState,
}))

vi.mock('@/store/usePerformerStore', () => ({
  usePerformerStore: () => performerStoreState,
}))

vi.mock('@/store/useFilterStore', () => ({
  useFilterStore: () => filterStoreState,
}))

vi.mock('@/store/useTransitionStore', () => ({
  useTransitionStore: () => transitionStoreState,
}))

vi.mock('@/store/useMediaStore', () => ({
  useMediaStore: () => mediaStoreState,
}))

vi.mock('@/store/useHistoryStore', () => ({
  useHistoryStore: () => historyStoreState,
}))

import { useProjectPersistence } from './useProjectPersistence'

function createPersistedState(timelineLane: number): PersistedProjectState {
  return {
    projectId: 'project-1',
    schemaVersion: 2,
    savedAt: 100,
    canvasPresetId: '16:9',
    editorContentSnapshot: {
      performers: [
        {
          id: 'video-1',
          kind: 'video',
          startMs: 0,
          durationMs: 5000,
          zIndex: 1,
          timelineLane,
          x: 0,
          y: 0,
          width: 640,
          height: 360,
          rotation: 0,
          alpha: 1,
          src: 'asset://video-1',
          sourceStartMs: 0,
          sourceDurationMs: 5000,
          crop: {
            left: 0,
            top: 0,
            right: 0,
            bottom: 0,
          },
          clipShapeId: null,
          animation: null,
          linkGroupId: null,
        },
      ],
      selectedPerformerIds: [],
      activeTrainId: null,
      currentTimeMs: 0,
      filters: [],
      activeFilterLayerId: null,
      transitions: [],
      activeTransitionId: null,
      activeTransitionPairKey: null,
    },
    videoAssets: [],
    audioAssets: [],
    imageAssets: [],
  }
}

describe('useProjectPersistence', () => {
  beforeEach(() => {
    applyEditorContentSnapshotMock.mockClear()
    captureEditorContentSnapshotMock.mockClear()
    capturePersistedProjectStateMock.mockReset()
    restoreSnapshotFromPersistedSourcesMock.mockClear()

    Object.assign(projectStoreState, {
      activeProjectId: 'project-1',
      loadActiveProjectState: vi.fn(),
      saveActiveProjectState: vi.fn(async () => {}),
    })

    Object.assign(editorStoreState, {
      canvasPresetId: '16:9',
      clippa: {
        ready: Promise.resolve(),
      },
      setCanvasPreset: vi.fn(),
    })

    Object.assign(performerStoreState, {})
    Object.assign(filterStoreState, {})
    Object.assign(transitionStoreState, {})
    Object.assign(mediaStoreState, {
      videoFiles: [],
      audioFiles: [],
      imageFiles: [],
      clearAllMedia: vi.fn(),
      addVideoFromUrl: vi.fn(),
      addAudioFromUrl: vi.fn(),
      addImageFromUrl: vi.fn(),
      addVideoFromFileHandle: vi.fn(async () => {}),
      addAudioFromFileHandle: vi.fn(async () => {}),
      addImageFromFileHandle: vi.fn(async () => {}),
    })
    Object.assign(historyStoreState, {
      status: {
        value: {
          pastCount: 0,
          futureCount: 0,
          activeTransaction: null,
        },
      },
    })
  })

  it('persists normalized state after restore when current snapshot no longer matches stored payload', async () => {
    const persistedState = createPersistedState(1)
    const normalizedState = createPersistedState(2)
    normalizedState.savedAt = 200

    vi.mocked(projectStoreState.loadActiveProjectState as any).mockResolvedValue(persistedState)
    capturePersistedProjectStateMock.mockReturnValue(normalizedState)

    const persistence = useProjectPersistence()
    await persistence.restoreActiveProject()

    expect(projectStoreState.saveActiveProjectState).toHaveBeenCalledTimes(1)
    expect(projectStoreState.saveActiveProjectState).toHaveBeenCalledWith(normalizedState)
  })

  it('does not rewrite persisted state when restore result already matches storage', async () => {
    const persistedState = createPersistedState(2)

    vi.mocked(projectStoreState.loadActiveProjectState as any).mockResolvedValue(persistedState)
    capturePersistedProjectStateMock.mockReturnValue({
      ...persistedState,
      savedAt: 300,
    })

    const persistence = useProjectPersistence()
    await persistence.restoreActiveProject()

    expect(projectStoreState.saveActiveProjectState).not.toHaveBeenCalled()
  })

  it('does not persist a degraded restore result when media assets could not be read', async () => {
    const persistedState = createPersistedState(1)
    persistedState.videoAssets = [{
      id: 'video-1',
      kind: 'video',
      name: 'clip.mp4',
      sourceType: 'handle',
      handle: {
        kind: 'file',
        name: 'clip.mp4',
      } as FileSystemFileHandle,
    }]

    vi.mocked(projectStoreState.loadActiveProjectState as any).mockResolvedValue(persistedState)
    vi.mocked(mediaStoreState.addVideoFromFileHandle as any).mockRejectedValue(new Error('unreadable'))
    capturePersistedProjectStateMock.mockReturnValue({
      ...persistedState,
      savedAt: 300,
    })

    const persistence = useProjectPersistence()
    await persistence.restoreActiveProject()

    expect(projectStoreState.saveActiveProjectState).not.toHaveBeenCalled()
  })
})
