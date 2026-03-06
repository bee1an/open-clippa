import { beforeEach, describe, expect, it, vi } from 'vitest'

const { MockVideo, MockAudio } = vi.hoisted(() => {
  class LocalMockVideo {
    id: string
    start: number
    duration: number
    zIndex: number
    timelineLane: number
    src: string
    sourceStart: number
    sourceDuration: number
    linkGroupId: string | null
    sprite = { alpha: 1 }

    constructor(option: any) {
      this.id = option.id
      this.start = option.start
      this.duration = option.duration
      this.zIndex = option.zIndex ?? 1
      this.timelineLane = option.timelineLane ?? this.zIndex
      this.src = option.src ?? `blob:${option.id}`
      this.sourceStart = option.sourceStart ?? 0
      this.sourceDuration = option.sourceDuration ?? option.duration
      this.linkGroupId = option.linkGroupId ?? null
    }

    getBaseBounds() {
      return {
        x: 0,
        y: 0,
        width: 640,
        height: 360,
        rotation: 0,
      }
    }

    getCropInsets() {
      return {
        left: 0,
        top: 0,
        right: 0,
        bottom: 0,
      }
    }

    getClipShape() {
      return null
    }
  }

  class LocalMockAudio {
    id: string
    start: number
    duration: number
    zIndex: number
    timelineLane: number
    src: string
    sourceStart: number
    sourceDuration: number
    waveformPeaks: number[]
    volume: number
    muted: boolean
    linkGroupId: string | null

    constructor(option: any) {
      this.id = option.id
      this.start = option.start
      this.duration = option.duration
      this.zIndex = option.zIndex ?? 0
      this.timelineLane = option.timelineLane ?? this.zIndex
      this.src = option.src ?? `blob:${option.id}`
      this.sourceStart = option.sourceStart ?? 0
      this.sourceDuration = option.sourceDuration ?? option.duration
      this.waveformPeaks = [...(option.waveformPeaks ?? [])]
      this.volume = option.volume ?? 1
      this.muted = option.muted ?? false
      this.linkGroupId = option.linkGroupId ?? null
    }

    getBaseBounds() {
      return {
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        rotation: 0,
      }
    }
  }

  return {
    MockVideo: LocalMockVideo,
    MockAudio: LocalMockAudio,
  }
})

vi.mock('@clippc/performer', () => {
  class MockImage {}
  class MockText {}

  return {
    Audio: MockAudio,
    Video: MockVideo,
    Image: MockImage,
    Text: MockText,
  }
})

import { captureEditorContentSnapshot } from './editorContentSnapshot'

describe('editorContentSnapshot', () => {
  beforeEach(() => {
    vi.useRealTimers()
  })

  it('captures the actual timeline rail zIndex instead of stale performer.timelineLane', () => {
    const video = new MockVideo({
      id: 'video-1',
      start: 0,
      duration: 5000,
      zIndex: 1,
      timelineLane: 1,
      linkGroupId: 'link-1',
    })
    const linkedAudio = new MockAudio({
      id: 'audio-1',
      start: 0,
      duration: 5000,
      zIndex: 0,
      timelineLane: 0,
      linkGroupId: 'link-1',
      waveformPeaks: [0.1, 0.2],
    })

    const snapshot = captureEditorContentSnapshot({
      editorStore: {
        currentTime: 1200,
        clippa: {
          timeline: {
            state: {
              activeTrain: null,
            },
            rails: {
              rails: [
                {
                  zIndex: 3,
                  trains: [{ id: 'video-1' }],
                },
              ],
            },
          },
        },
      } as any,
      performerStore: {
        getAllPerformers: () => [video, linkedAudio],
        getAnimation: () => null,
        selectedPerformers: [],
      } as any,
      filterStore: {
        layers: [],
        activeLayerId: null,
      } as any,
      transitionStore: {
        transitions: [],
        activeTransitionId: null,
        activePairKey: null,
      } as any,
    })

    expect(snapshot.performers).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'video-1',
        timelineLane: 3,
      }),
      expect.objectContaining({
        id: 'audio-1',
        timelineLane: 0,
      }),
    ]))
  })
})
