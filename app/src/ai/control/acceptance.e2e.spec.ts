import type {
  AiToolDefinition,
} from '@clippc/ai'
import { createEditorControlTools } from '@clippc/ai'
import { getFilterPresetConfig } from '@clippc/filter'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { createEditorControlRuntime } from './runtime'

const {
  MockImage,
  MockText,
  MockVideo,
  loadVideoMetadataMock,
} = vi.hoisted(() => {
  class MockBasePerformer {
    id: string
    start: number
    duration: number
    zIndex: number
    sprite: { alpha: number }
    protected bounds: {
      x: number
      y: number
      width: number
      height: number
      rotation: number
    }

    constructor(option: any) {
      this.id = option.id
      this.start = option.start
      this.duration = option.duration
      this.zIndex = option.zIndex ?? 1
      this.sprite = { alpha: 1 }
      this.bounds = {
        x: option.x ?? 0,
        y: option.y ?? 0,
        width: option.width ?? 320,
        height: option.height ?? 180,
        rotation: option.rotation ?? 0,
      }
    }

    getBaseBounds() {
      return { ...this.bounds }
    }

    setPosition(x: number, y: number) {
      this.bounds.x = x
      this.bounds.y = y
    }

    setRotation(rotation: number) {
      this.bounds.rotation = rotation
    }

    setAlpha(alpha: number) {
      this.sprite.alpha = alpha
    }

    setAnimation() {}
  }

  class LocalMockVideo extends MockBasePerformer {
    src: string
    sourceStart: number
    sourceDuration: number

    constructor(option: any) {
      super(option)
      this.src = typeof option.src === 'string' ? option.src : `blob:${option.id}`
      this.sourceStart = option.sourceStart ?? 0
      this.sourceDuration = option.sourceDuration ?? option.duration
    }
  }

  class LocalMockImage extends MockBasePerformer {
    src: string

    constructor(option: any) {
      super(option)
      this.src = typeof option.src === 'string' ? option.src : `blob:${option.id}`
    }
  }

  class LocalMockText extends MockBasePerformer {
    private content: string
    private style: Record<string, unknown>

    constructor(option: any) {
      super(option)
      this.content = option.content ?? ''
      this.style = { ...(option.style ?? {}) }
    }

    setText(content: string) {
      this.content = content
    }

    getText() {
      return this.content
    }

    setStyle(style: Record<string, unknown>) {
      this.style = {
        ...this.style,
        ...style,
      }
    }

    getStyle() {
      return { ...this.style }
    }
  }

  return {
    MockVideo: LocalMockVideo,
    MockImage: LocalMockImage,
    MockText: LocalMockText,
    loadVideoMetadataMock: vi.fn(async () => ({
      duration: 12000,
      width: 1920,
      height: 1080,
    })),
  }
})

vi.mock('@clippc/performer', () => {
  return {
    Video: MockVideo,
    Image: MockImage,
    Text: MockText,
  }
})

vi.mock('@clippc/transition', () => {
  const DEFAULT_TRANSITION_DURATION = 500
  const DEFAULT_GL_TRANSITION_TYPE = 'fade'

  return {
    DEFAULT_TRANSITION_DURATION,
    DEFAULT_GL_TRANSITION_TYPE,
    TRANSITION_FEATURE_AVAILABLE: true,
    buildTransitionPairKey: (fromId: string, toId: string) => `${fromId}->${toId}`,
    buildTransitionCandidates: (timeline: any) => {
      const rails = timeline?.rails?.rails ?? []
      const candidates: any[] = []

      rails.forEach((rail: any) => {
        const trains = [...(rail.trains ?? [])].sort((a, b) => a.start - b.start)
        for (let index = 0; index < trains.length - 1; index += 1) {
          const from = trains[index]
          const to = trains[index + 1]
          const cutTime = from.start + from.duration
          if (Math.abs(to.start - cutTime) > 1)
            continue

          candidates.push({
            id: `${rail.zIndex}:${from.id}->${to.id}`,
            railZIndex: rail.zIndex,
            fromId: from.id,
            toId: to.id,
            cutTime,
          })
        }
      })

      return candidates
    },
    computeTransitionMaxMs: () => ({
      maxMs: 2000,
      uiMax: 2000,
      fromTail: 1000,
      toHead: 1000,
    }),
    getGlTransitionDefaultParams: (type: string) => ({ type }),
  }
})

vi.mock('clippc', () => {
  class MockEventBus {
    on() {}
    off() {}
    emit() {}
  }

  class MockFrameExtractor {
    static async create() {
      return new MockFrameExtractor()
    }

    async extractFrames() {
      return []
    }

    destroy() {}
  }

  class MockVideoTrain {
    refreshThumbnails() {
      return Promise.resolve()
    }
  }

  return {
    EventBus: MockEventBus,
    FrameExtractor: MockFrameExtractor,
    VideoTrain: MockVideoTrain,
  }
})

vi.mock('@/utils/media', () => {
  return {
    loadVideoMetadata: loadVideoMetadataMock,
  }
})

interface TestHarness {
  runTool: (name: string, args?: unknown) => Promise<any>
  state: {
    performers: Map<string, any>
    mediaStore: any
    filterStore: any
    transitionStore: any
    exportTaskStore: any
  }
}

function createTrain(option: {
  id: string
  start: number
  duration: number
  trainType?: string
}) {
  const train: any = {
    id: option.id,
    start: option.start,
    duration: option.duration,
    parent: null,
    railStyle: 'default',
    updateActive: vi.fn(),
    updateWidth: vi.fn(),
  }

  Object.defineProperty(train, 'constructor', {
    value: {
      name: option.trainType ?? 'Train',
    },
  })

  return train
}

function createHarness(options: {
  currentTime?: number
  duration?: number
  mediaAssets?: {
    videos?: Array<{ id: string, name: string, duration: number, size: number, url?: string }>
    images?: Array<{ id: string, name: string, size: number, url?: string }>
  }
  performers?: any[]
  selectedPerformerId?: string | null
  exportSequence?: Array<'exporting' | 'done' | 'error' | 'canceled'>
} = {}): TestHarness {
  const performers = new Map<string, any>()

  const railsState: any = {
    rails: [] as any[],
    get maxZIndex() {
      if (this.rails.length === 0)
        return 0

      return this.rails.reduce((maxValue: number, rail: any) => {
        return Math.max(maxValue, rail.zIndex)
      }, 0)
    },
    getRailByZIndex(zIndex: number) {
      return this.rails.find((rail: any) => rail.zIndex === zIndex) ?? null
    },
    createRailByZIndex(zIndex: number) {
      const rail: any = {
        zIndex,
        trains: [] as any[],
        canAcceptTrain: () => true,
        insertTrain: (train: any) => {
          train.parent = rail
          rail.trains.push(train)
          rail.trains.sort((a: any, b: any) => a.start - b.start)
        },
        removeTrain: (train: any) => {
          rail.trains = rail.trains.filter((item: any) => item !== train)
          if (train.parent === rail)
            train.parent = null
        },
      }

      this.rails.push(rail)
      this.rails.sort((a: any, b: any) => b.zIndex - a.zIndex)
      return rail
    },
    removeRail(rail: any) {
      this.rails = this.rails.filter((item: any) => item !== rail)
    },
  }

  const editorStore: any = {
    currentTime: options.currentTime ?? 0,
    duration: options.duration ?? 20000,
    isPlaying: false,
    clippa: {
      ready: Promise.resolve(),
      play: vi.fn(() => {
        editorStore.isPlaying = true
      }),
      pause: vi.fn(() => {
        editorStore.isPlaying = false
      }),
      seek: vi.fn((time: number) => {
        const boundedTime = Math.max(0, Math.min(editorStore.duration, time))
        editorStore.currentTime = boundedTime
        editorStore.clippa.timeline.currentTime = boundedTime
      }),
      director: {
        seek: vi.fn(async (time: number) => {
          const boundedTime = Math.max(0, Math.min(editorStore.duration, time))
          editorStore.currentTime = boundedTime
          editorStore.clippa.timeline.currentTime = boundedTime
        }),
      },
      timeline: {
        currentTime: options.currentTime ?? 0,
        duration: options.duration ?? 20000,
        state: {
          activeTrain: null,
        },
        rails: railsState,
        updateDuration: vi.fn((nextDuration: number) => {
          editorStore.duration = nextDuration
          editorStore.clippa.timeline.duration = nextDuration
        }),
        updateCurrentTime: vi.fn((time: number) => {
          const boundedTime = Math.max(0, Math.min(editorStore.duration, time))
          editorStore.currentTime = boundedTime
          editorStore.clippa.timeline.currentTime = boundedTime
        }),
      },
      stage: {
        performers: new Set<any>(),
        app: {
          renderer: {
            width: 1920,
            height: 1080,
          },
        },
      },
      theater: {
        performers: [] as any[],
      },
      hire: vi.fn(async (performer: any) => {
        if (!editorStore.clippa.theater.performers.includes(performer))
          editorStore.clippa.theater.performers.push(performer)

        editorStore.clippa.stage.performers.add(performer)

        let rail = railsState.getRailByZIndex(performer.zIndex)
        if (!rail)
          rail = railsState.createRailByZIndex(performer.zIndex)

        rail.insertTrain(createTrain({
          id: performer.id,
          start: performer.start,
          duration: performer.duration,
          trainType: 'VideoTrain',
        }))
      }),
      show: vi.fn((performer: any) => {
        editorStore.clippa.stage.performers.add(performer)
      }),
    },
  }

  const selectedPerformers: Array<{ id: string, bounds: any, timestamp: number }> = []

  const animationMap = new Map<string, any>()

  const addPerformer = (config: any) => {
    const nextPerformer = config.type === 'text'
      ? new MockText(config)
      : config.type === 'image'
        ? new MockImage(config)
        : new MockVideo(config)

    performers.set(nextPerformer.id, nextPerformer)
    return nextPerformer
  }

  const performerStore: any = {
    selectedPerformers,
    getAllPerformers: () => Array.from(performers.values()),
    getPerformerById: (id: string) => performers.get(id),
    addPerformer: vi.fn((config: any) => addPerformer(config)),
    removePerformer: vi.fn((id: string) => {
      const target = performers.get(id)
      if (!target)
        return

      performers.delete(id)
      editorStore.clippa.theater.performers = editorStore.clippa.theater.performers.filter((item: any) => item !== target)
      editorStore.clippa.stage.performers.delete(target)

      const allRails = railsState.rails as any[]
      allRails.forEach((rail) => {
        rail.trains = rail.trains.filter((train: any) => train.id !== id)
      })

      selectedPerformers.splice(0, selectedPerformers.length, ...selectedPerformers.filter(item => item.id !== id))
    }),
    updatePerformer: vi.fn((id: string, updates: any) => {
      const target = performers.get(id)
      if (!target)
        return

      if (typeof updates.x === 'number' || typeof updates.y === 'number') {
        const currentBounds = target.getBaseBounds()
        target.setPosition(
          typeof updates.x === 'number' ? updates.x : currentBounds.x,
          typeof updates.y === 'number' ? updates.y : currentBounds.y,
        )
      }

      if (typeof updates.rotation === 'number')
        target.setRotation(updates.rotation)

      if (typeof updates.alpha === 'number')
        target.setAlpha(updates.alpha)

      if (typeof updates.zIndex === 'number')
        target.zIndex = updates.zIndex

      if (typeof updates.width === 'number' || typeof updates.height === 'number') {
        const bounds = target.getBaseBounds()
        target.bounds = {
          ...bounds,
          width: typeof updates.width === 'number' ? updates.width : bounds.width,
          height: typeof updates.height === 'number' ? updates.height : bounds.height,
        }
      }
    }),
    selectPerformer: vi.fn((id: string) => {
      const target = performers.get(id)
      if (!target)
        return

      selectedPerformers.splice(0, selectedPerformers.length, {
        id,
        bounds: target.getBaseBounds(),
        timestamp: Date.now(),
      })
    }),
    clearSelection: vi.fn(() => {
      selectedPerformers.splice(0, selectedPerformers.length)
    }),
    getAnimation: vi.fn((id: string) => animationMap.get(id) ?? null),
    setAnimation: vi.fn((id: string, spec: any) => {
      if (!spec) {
        animationMap.delete(id)
        return
      }

      animationMap.set(id, spec)
    }),
    clearAnimation: vi.fn((id: string) => {
      animationMap.delete(id)
    }),
  }

  const mediaStore: any = {
    videoFiles: (options.mediaAssets?.videos ?? []).map(file => ({
      id: file.id,
      name: file.name,
      file: new Blob([file.name], { type: 'video/mp4' }),
      source: new Blob([file.name], { type: 'video/mp4' }),
      sourceType: 'file',
      url: file.url ?? `blob:video-${file.id}`,
      duration: file.duration,
      size: file.size,
      createdAt: new Date(),
    })),
    imageFiles: (options.mediaAssets?.images ?? []).map(file => ({
      id: file.id,
      name: file.name,
      file: new Blob([file.name], { type: 'image/png' }),
      source: new Blob([file.name], { type: 'image/png' }),
      sourceType: 'file',
      url: file.url ?? `blob:image-${file.id}`,
      size: file.size,
      createdAt: new Date(),
    })),
    removeVideoFile(id: string) {
      this.videoFiles = this.videoFiles.filter((item: any) => item.id !== id)
    },
    removeImageFile(id: string) {
      this.imageFiles = this.imageFiles.filter((item: any) => item.id !== id)
    },
    clearVideoFiles() {
      this.videoFiles = []
    },
    clearImageFiles() {
      this.imageFiles = []
    },
    addVideoFromUrl(url: string, name?: string) {
      const parsedUrl = new URL(url)
      const inferredName = parsedUrl.pathname.split('/').pop() || 'remote-video.mp4'
      const asset = {
        id: `video-url-${this.videoFiles.length + 1}`,
        name: name?.trim().length ? name.trim() : inferredName,
        source: parsedUrl.toString(),
        sourceType: 'url',
        url: parsedUrl.toString(),
        duration: 0,
        size: 0,
        createdAt: new Date(),
        metadata: {
          resolution: { width: 0, height: 0 },
          frameRate: 0,
          codec: 'unknown',
          bitrate: 0,
          aspectRatio: '16:9',
          audioTracks: [],
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
      }
      this.videoFiles.push(asset)
      return asset
    },
    addImageFromUrl(url: string, name?: string) {
      const parsedUrl = new URL(url)
      const inferredName = parsedUrl.pathname.split('/').pop() || 'remote-image.jpg'
      const asset = {
        id: `image-url-${this.imageFiles.length + 1}`,
        name: name?.trim().length ? name.trim() : inferredName,
        source: parsedUrl.toString(),
        sourceType: 'url',
        url: parsedUrl.toString(),
        size: 0,
        createdAt: new Date(),
      }
      this.imageFiles.push(asset)
      return asset
    },
    async importRandomImageFromPexels(options: any = {}) {
      const querySuffix = typeof options.query === 'string' && options.query.trim().length > 0
        ? options.query.trim().replace(/\s+/g, '-')
        : 'curated'
      const assetName = typeof options.name === 'string' && options.name.trim().length > 0
        ? options.name.trim()
        : `random-image-${this.imageFiles.length + 1}.jpg`
      return this.addImageFromUrl(
        `https://images.pexels.com/photos/${1000 + this.imageFiles.length}/pexels-photo-${querySuffix}.jpeg`,
        assetName,
      )
    },
    async importRandomVideoFromPexels(options: any = {}) {
      const querySuffix = typeof options.query === 'string' && options.query.trim().length > 0
        ? options.query.trim().replace(/\s+/g, '-')
        : 'popular'
      const assetName = typeof options.name === 'string' && options.name.trim().length > 0
        ? options.name.trim()
        : `random-video-${this.videoFiles.length + 1}.mp4`
      const asset = this.addVideoFromUrl(
        `https://player.vimeo.com/external/${500000 + this.videoFiles.length}.hd.mp4?q=${querySuffix}`,
        assetName,
      )
      asset.duration = 8000
      return asset
    },
  }

  const filterStore: any = {
    layers: [] as any[],
    activeLayerId: null as string | null,
    bindTimeline: vi.fn(),
    createLayer: vi.fn((input: any) => {
      const id = `filter-${filterStore.layers.length + 1}`
      const presetConfig = typeof input.preset === 'string' ? getFilterPresetConfig(input.preset) : null
      const layer = {
        id,
        name: input.name ?? `Filter ${filterStore.layers.length + 1}`,
        start: input.start ?? 0,
        duration: input.duration ?? 5000,
        zIndex: input.zIndex ?? 1,
        config: {
          brightness: 1,
          contrast: 1,
          saturation: 1,
          hue: 0,
          ...(presetConfig ?? {}),
          ...(input.config ?? {}),
        },
        train: createTrain({
          id: `filter-train-${id}`,
          start: input.start ?? 0,
          duration: input.duration ?? 5000,
          trainType: 'TextTrain',
        }),
        version: 0,
        createdAt: Date.now(),
      }

      filterStore.layers.push(layer)
      filterStore.activeLayerId = id
      return layer
    }),
    selectLayer: vi.fn((id: string | null) => {
      filterStore.activeLayerId = id
    }),
    updateLayerConfig: vi.fn((id: string, patch: any) => {
      const target = filterStore.layers.find((item: any) => item.id === id)
      if (!target)
        return

      Object.assign(target.config, patch)
      target.version += 1
    }),
    resetLayerConfig: vi.fn((id: string) => {
      const target = filterStore.layers.find((item: any) => item.id === id)
      if (!target)
        return

      target.config = {
        brightness: 1,
        contrast: 1,
        saturation: 1,
        hue: 0,
      }
      target.version += 1
    }),
    updateLayerZIndex: vi.fn((id: string, zIndex: number) => {
      const target = filterStore.layers.find((item: any) => item.id === id)
      if (!target)
        return

      target.zIndex = zIndex
      target.version += 1
    }),
    removeLayer: vi.fn((id: string) => {
      filterStore.layers = filterStore.layers.filter((item: any) => item.id !== id)
      if (filterStore.activeLayerId === id)
        filterStore.activeLayerId = null
    }),
  }

  const transitionStore: any = {
    transitions: [] as any[],
    activeTransitionId: null as string | null,
    activePairKey: null as string | null,
    getTransitionByPair: vi.fn((fromId: string, toId: string) => {
      return transitionStore.transitions.find((item: any) => item.fromId === fromId && item.toId === toId) ?? null
    }),
    selectPair: vi.fn((fromId: string, toId: string, toggle = false) => {
      const pairKey = `${fromId}->${toId}`
      if (toggle && transitionStore.activePairKey === pairKey) {
        transitionStore.activePairKey = null
        transitionStore.activeTransitionId = null
        return
      }

      transitionStore.activePairKey = pairKey
      const existing = transitionStore.transitions.find((item: any) => item.fromId === fromId && item.toId === toId)
      transitionStore.activeTransitionId = existing?.id ?? null
    }),
    createTransition: vi.fn((input: any) => {
      const next = {
        id: `transition-${transitionStore.transitions.length + 1}`,
        fromId: input.fromId,
        toId: input.toId,
        durationMs: input.durationMs,
        type: input.type,
        params: input.params,
      }

      transitionStore.transitions.push(next)
      transitionStore.activePairKey = `${next.fromId}->${next.toId}`
      transitionStore.activeTransitionId = next.id
      return next
    }),
    updateTransition: vi.fn((id: string, patch: any) => {
      const index = transitionStore.transitions.findIndex((item: any) => item.id === id)
      if (index < 0)
        return

      transitionStore.transitions[index] = {
        ...transitionStore.transitions[index],
        ...patch,
      }
    }),
    selectTransition: vi.fn((id: string | null) => {
      if (!id) {
        transitionStore.activeTransitionId = null
        return
      }

      const target = transitionStore.transitions.find((item: any) => item.id === id)
      transitionStore.activeTransitionId = target?.id ?? null
      transitionStore.activePairKey = target ? `${target.fromId}->${target.toId}` : null
    }),
    removeTransition: vi.fn((id: string) => {
      transitionStore.transitions = transitionStore.transitions.filter((item: any) => item.id !== id)
      if (transitionStore.activeTransitionId === id)
        transitionStore.activeTransitionId = null
    }),
    clearActiveSelection: vi.fn(() => {
      transitionStore.activeTransitionId = null
      transitionStore.activePairKey = null
    }),
  }

  const exportSequence = options.exportSequence ?? ['exporting', 'done']
  let exportPollIndex = 0

  const exportTaskStore: any = {
    status: 'idle',
    jobId: null,
    startExport: vi.fn(async () => {
      exportTaskStore.status = 'exporting'
      exportTaskStore.jobId = 'job-1'
      exportPollIndex = 0
      return 'job-1'
    }),
    cancelExport: vi.fn(async () => {
      exportTaskStore.status = 'canceled'
    }),
    getStatus: vi.fn(() => {
      const phase = exportSequence[Math.min(exportPollIndex, exportSequence.length - 1)]
      exportPollIndex += 1
      exportTaskStore.status = phase

      return {
        status: phase,
        jobId: exportTaskStore.jobId,
        currentFrame: phase === 'done' ? 60 : Math.min(59, exportPollIndex * 20),
        totalFrames: 60,
        progress: phase === 'done' ? 1 : Math.min(0.99, exportPollIndex / 3),
        previewUrl: '',
        errorMessage: phase === 'error' ? 'export failed' : '',
        result: phase === 'done'
          ? {
              filename: 'video.mp4',
              durationMs: 1000,
              frameRate: 60,
            }
          : null,
      }
    }),
  }

  const initialPerformers = options.performers ?? []
  initialPerformers.forEach((performer) => {
    performers.set(performer.id, performer)
    editorStore.clippa.theater.performers.push(performer)
    editorStore.clippa.stage.performers.add(performer)

    let rail = railsState.getRailByZIndex(performer.zIndex)
    if (!rail)
      rail = railsState.createRailByZIndex(performer.zIndex)

    rail.insertTrain(createTrain({
      id: performer.id,
      start: performer.start,
      duration: performer.duration,
      trainType: 'VideoTrain',
    }))
  })

  if (options.selectedPerformerId) {
    const selected = performers.get(options.selectedPerformerId)
    if (selected) {
      selectedPerformers.push({
        id: selected.id,
        bounds: selected.getBaseBounds(),
        timestamp: Date.now(),
      })
    }
  }

  const runtime = createEditorControlRuntime({
    editorStore,
    performerStore,
    mediaStore,
    filterStore,
    transitionStore,
    exportTaskStore,
  } as any)

  const tools = createEditorControlTools(runtime)
  const toolMap = new Map<string, AiToolDefinition>(tools.map(tool => [tool.name, tool]))

  const runTool = async (name: string, args: unknown = {}) => {
    const tool = toolMap.get(name)
    if (!tool)
      throw new Error(`Tool not found: ${name}`)

    return await tool.handler(args, {
      round: 1,
      toolCallId: `${name}-call`,
    })
  }

  return {
    runTool,
    state: {
      performers,
      mediaStore,
      filterStore,
      transitionStore,
      exportTaskStore,
    },
  }
}

describe('aI control acceptance e2e', () => {
  beforeEach(() => {
    loadVideoMetadataMock.mockClear()
    loadVideoMetadataMock.mockResolvedValue({
      duration: 12000,
      width: 1920,
      height: 1080,
    })
  })

  it('scenario 1: query media then add video asset at 3s for 8s', async () => {
    const harness = createHarness({
      mediaAssets: {
        videos: [
          {
            id: 'video-x',
            name: 'X.mp4',
            duration: 15000,
            size: 1024,
          },
        ],
      },
    })

    const mediaResult = await harness.runTool('query_media_assets', {
      type: 'video',
    })
    expect(mediaResult.ok).toBe(true)
    expect(mediaResult.data.assets).toHaveLength(1)

    const addResult = await harness.runTool('media_add_asset_to_timeline', {
      assetId: mediaResult.data.assets[0].id,
      startMs: 3000,
      durationMs: 8000,
    })

    expect(addResult.ok).toBe(true)
    expect(addResult.data.type).toBe('video')

    const created = harness.state.performers.get(addResult.data.performerId)
    expect(created).toBeDefined()
    expect(created.start).toBe(3000)
    expect(created.duration).toBe(8000)
  })

  it('scenario 1b: import video by url then add it to timeline', async () => {
    const harness = createHarness()

    const importResult = await harness.runTool('media_import_video_from_url', {
      url: 'https://cdn.example.com/video/trailer.mp4',
    })

    expect(importResult.ok).toBe(true)
    expect(importResult.data.asset.type).toBe('video')
    expect(importResult.data.asset.name).toBe('trailer.mp4')

    const addResult = await harness.runTool('media_add_asset_to_timeline', {
      assetId: importResult.data.asset.id,
      startMs: 1000,
      durationMs: 4000,
    })

    expect(addResult.ok).toBe(true)
    expect(addResult.data.type).toBe('video')
  })

  it('scenario 1d: import random assets and randomly pick from media library', async () => {
    const harness = createHarness({
      currentTime: 2000,
    })

    const randomImageResult = await harness.runTool('media_import_random_image', {
      query: 'city skyline',
    })
    expect(randomImageResult.ok).toBe(true)
    expect(randomImageResult.data.asset.type).toBe('image')

    const randomVideoResult = await harness.runTool('media_import_random_video', {
      query: 'drone',
      minDurationSec: 5,
      maxDurationSec: 12,
    })
    expect(randomVideoResult.ok).toBe(true)
    expect(randomVideoResult.data.asset.type).toBe('video')

    const pickImageResult = await harness.runTool('media_pick_random_asset', {
      type: 'image',
    })
    expect(pickImageResult.ok).toBe(true)
    expect(pickImageResult.data.asset.type).toBe('image')

    const addResult = await harness.runTool('media_add_asset_to_timeline', {
      assetId: pickImageResult.data.asset.id,
      startMs: 2000,
      durationMs: 3000,
    })

    expect(addResult.ok).toBe(true)
    expect(addResult.data.type).toBe('image')
  })

  it('scenario 1c: create text element with default and explicit arguments', async () => {
    const harness = createHarness({
      currentTime: 1337,
    })

    const defaultResult = await harness.runTool('create_text_element')
    expect(defaultResult.ok).toBe(true)
    expect(defaultResult.data.created).toBe(true)
    expect(defaultResult.data.selected).toBe(true)
    expect(defaultResult.data.performer.id).toMatch(/^text-/)
    expect(defaultResult.data.performer.startMs).toBe(1337)
    expect(defaultResult.data.performer.durationMs).toBe(5000)
    expect(defaultResult.data.performer.text).toBe('双击编辑文本')
    expect(defaultResult.data.performer.bounds).toEqual({
      x: 800,
      y: 450,
      width: 320,
      height: 180,
      rotation: 0,
    })

    const explicitResult = await harness.runTool('create_text_element', {
      content: '字幕',
      startMs: 2000,
      durationMs: 8000,
      x: 120,
      y: 80,
      style: {
        fontSize: 40,
        fill: '#ffffff',
      },
    })

    expect(explicitResult.ok).toBe(true)
    expect(explicitResult.data.performer.startMs).toBe(2000)
    expect(explicitResult.data.performer.durationMs).toBe(8000)
    expect(explicitResult.data.performer.bounds).toEqual({
      x: 120,
      y: 80,
      width: 320,
      height: 180,
      rotation: 0,
    })
    expect(explicitResult.data.performer.text).toBe('字幕')
    expect(explicitResult.data.performer.textStyle).toEqual(expect.objectContaining({
      fontSize: 40,
      fill: '#ffffff',
    }))
  })

  it('scenario 2: update selected text content and style', async () => {
    const textPerformer = new MockText({
      id: 'text-1',
      type: 'text',
      content: 'old',
      start: 0,
      duration: 5000,
      zIndex: 2,
      x: 0,
      y: 0,
      style: {
        fontSize: 20,
      },
    })

    const harness = createHarness({
      performers: [textPerformer],
      selectedPerformerId: 'text-1',
    })

    const contentResult = await harness.runTool('performer_update_text_content', {
      content: '片头',
    })
    expect(contentResult.ok).toBe(true)

    const styleResult = await harness.runTool('performer_update_text_style', {
      style: {
        fontSize: 56,
        fill: '#ffffff',
        fontWeight: 'bold',
        align: 'center',
      },
    })

    expect(styleResult.ok).toBe(true)
    expect(textPerformer.getText()).toBe('片头')
    expect(textPerformer.getStyle()).toEqual(expect.objectContaining({
      fontSize: 56,
      fill: '#ffffff',
      fontWeight: 'bold',
      align: 'center',
    }))
  })

  it('scenario 3: query candidate then upsert crosswarp transition with 700ms', async () => {
    const from = new MockVideo({
      id: 'from-v',
      start: 0,
      duration: 2000,
      zIndex: 1,
      src: 'blob:from',
      sourceStart: 0,
      sourceDuration: 5000,
    })
    const to = new MockVideo({
      id: 'to-v',
      start: 2000,
      duration: 2000,
      zIndex: 1,
      src: 'blob:to',
      sourceStart: 1000,
      sourceDuration: 5000,
    })

    const harness = createHarness({
      performers: [from, to],
      duration: 6000,
    })

    const candidateResult = await harness.runTool('query_transition_candidates')
    expect(candidateResult.ok).toBe(true)

    const pair = candidateResult.data.candidates.find((item: any) => item.fromId === 'from-v' && item.toId === 'to-v')
    expect(pair).toBeDefined()

    const upsertResult = await harness.runTool('transition_upsert_by_pair', {
      fromId: pair.fromId,
      toId: pair.toId,
      type: 'crosswarp',
      durationMs: 700,
    })

    expect(upsertResult.ok).toBe(true)
    expect(upsertResult.data.transition.type).toBe('crosswarp')
    expect(upsertResult.data.transition.durationMs).toBe(700)
  })

  it('scenario 4: create warm filter then raise contrast to 1.25', async () => {
    const harness = createHarness()

    const createResult = await harness.runTool('filter_create_layer', {
      preset: 'warm',
    })

    expect(createResult.ok).toBe(true)
    expect(createResult.data.layer.name).toBe('暖调')
    expect(createResult.data.layer.config).toEqual(expect.objectContaining({
      brightness: 1.1,
      contrast: 1.05,
      saturation: 1.1,
      hue: 15,
    }))

    const updateResult = await harness.runTool('filter_update_config', {
      layerId: createResult.data.layer.id,
      patch: {
        contrast: 1.25,
      },
    })

    expect(updateResult.ok).toBe(true)
    expect(updateResult.data.layer.config.contrast).toBe(1.25)
  })

  it('scenario 4b: reject non-preset filter creation', async () => {
    const harness = createHarness()

    const createResult = await harness.runTool('filter_create_layer', {
      preset: 'custom',
    })

    expect(createResult.ok).toBe(false)
    expect(createResult.error.code).toBe('INVALID_ARGUMENT')
    expect(createResult.error.message).toContain('Unsupported filter preset')
  })

  it('scenario 5: start export and poll status until done', async () => {
    const harness = createHarness({
      exportSequence: ['exporting', 'exporting', 'done'],
    })

    const startResult = await harness.runTool('export_start')
    expect(startResult.ok).toBe(true)
    expect(startResult.data.jobId).toBe('job-1')

    const statuses: string[] = []
    for (let index = 0; index < 3; index += 1) {
      const statusResult = await harness.runTool('export_get_status')
      expect(statusResult.ok).toBe(true)
      statuses.push(statusResult.data.status)
    }

    expect(statuses).toEqual(['exporting', 'exporting', 'done'])
  })
})
