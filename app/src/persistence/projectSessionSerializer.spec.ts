import type { EditorContentSnapshot } from '@/history/editorContentSnapshot'
import { describe, expect, it } from 'vitest'
import { reactive } from 'vue'
import { capturePersistedProjectState, restoreSnapshotFromPersistedSources } from './projectSessionSerializer'

function createSnapshot(src: string, clipShapeId?: string): EditorContentSnapshot {
  return {
    performers: [
      {
        id: 'video-1',
        kind: 'video',
        startMs: 0,
        durationMs: 1000,
        zIndex: 1,
        timelineLane: 1,
        x: 0,
        y: 0,
        width: 320,
        height: 180,
        rotation: 0,
        alpha: 1,
        src,
        clipShapeId,
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
  }
}

describe('projectSessionSerializer', () => {
  it('unwraps proxied file handles for persisted handle assets', () => {
    const rawHandle = {
      kind: 'file',
      name: 'clip.mp4',
    } as unknown as FileSystemFileHandle
    const proxiedHandle = reactive({ value: rawHandle }).value as unknown as FileSystemFileHandle

    expect(() => structuredClone(proxiedHandle)).toThrow()

    const persisted = capturePersistedProjectState({
      projectId: 'project-1',
      canvasPresetId: 'landscape',
      snapshot: createSnapshot('blob:video-1'),
      videoAssets: [
        {
          id: 'video-1',
          name: 'clip.mp4',
          source: 'blob:video-1',
          sourceType: 'handle',
          fileHandle: proxiedHandle,
          url: 'blob:video-1',
          duration: 0,
          size: 123,
          createdAt: new Date('2026-03-04T00:00:00.000Z'),
          metadata: {
            resolution: { width: 0, height: 0 },
            frameRate: 0,
            codec: 'unknown',
            bitrate: 0,
            aspectRatio: '16:9',
            audioTracks: [],
            waveform: { sampleCount: 0, peaks: [] },
          },
          thumbnails: {
            primary: '',
            frames: [],
            generating: false,
          },
          processingStatus: {
            metadataExtracted: false,
            thumbnailsGenerated: false,
          },
        },
      ],
      audioAssets: [],
      imageAssets: [],
    })

    expect(persisted.videoAssets).toHaveLength(1)
    const [videoAsset] = persisted.videoAssets
    expect(videoAsset?.sourceType).toBe('handle')
    if (!videoAsset || videoAsset.sourceType !== 'handle')
      throw new Error('invalid test state')

    expect(videoAsset.handle).toBe(rawHandle)
    expect(() => structuredClone(videoAsset.handle)).not.toThrow()
    expect(() => structuredClone(persisted)).not.toThrow()
  })

  it('tokenizes local blob src for handle assets and restores by asset id', () => {
    const handle = {
      kind: 'file',
      name: 'clip.mp4',
    } as unknown as FileSystemFileHandle

    const persisted = capturePersistedProjectState({
      projectId: 'project-1',
      canvasPresetId: 'landscape',
      snapshot: createSnapshot('blob:video-1'),
      videoAssets: [
        {
          id: 'video-1',
          name: 'clip.mp4',
          source: 'blob:video-1',
          sourceType: 'handle',
          fileHandle: handle,
          url: 'blob:video-1',
          duration: 0,
          size: 123,
          createdAt: new Date('2026-03-04T00:00:00.000Z'),
          metadata: {
            resolution: { width: 0, height: 0 },
            frameRate: 0,
            codec: 'unknown',
            bitrate: 0,
            aspectRatio: '16:9',
            audioTracks: [],
            waveform: { sampleCount: 0, peaks: [] },
          },
          thumbnails: {
            primary: '',
            frames: [],
            generating: false,
          },
          processingStatus: {
            metadataExtracted: false,
            thumbnailsGenerated: false,
          },
        },
      ],
      audioAssets: [],
      imageAssets: [],
    })

    expect(persisted.editorContentSnapshot.performers[0]?.src).toBe('asset://video-1')

    const restored = restoreSnapshotFromPersistedSources(
      persisted.editorContentSnapshot,
      assetId => assetId === 'video-1' ? 'blob:restored-video-1' : null,
    )

    expect(restored.performers[0]?.src).toBe('blob:restored-video-1')
  })

  it('preserves clip shape ids through persistence round trips', () => {
    const persisted = capturePersistedProjectState({
      projectId: 'project-1',
      canvasPresetId: 'landscape',
      snapshot: createSnapshot('https://cdn.example.com/clip.mp4', 'hexagon'),
      videoAssets: [],
      audioAssets: [],
      imageAssets: [],
    })

    expect(persisted.editorContentSnapshot.performers[0]?.clipShapeId).toBe('hexagon')

    const restored = restoreSnapshotFromPersistedSources(
      persisted.editorContentSnapshot,
      () => null,
    )

    expect(restored.performers[0]?.clipShapeId).toBe('hexagon')
  })
})
