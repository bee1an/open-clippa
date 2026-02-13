import type { Timeline, Train } from 'clippc'
import { Container, Sprite, Texture } from 'pixi.js'
import { describe, expect, it, vi } from 'vitest'
import { TransitionRuntime } from '../index'

type Listener = (...args: any[]) => void

class MockEmitter {
  private readonly listeners = new Map<string, Set<Listener>>()

  on(event: string, handler: Listener): void {
    if (!this.listeners.has(event))
      this.listeners.set(event, new Set())

    this.listeners.get(event)!.add(handler)
  }

  off(event: string, handler: Listener): void {
    this.listeners.get(event)?.delete(handler)
  }

  emit(event: string, ...args: any[]): void {
    this.listeners.get(event)?.forEach((handler) => {
      handler(...args)
    })
  }
}

class MockTrain extends MockEmitter {
  constructor(
    public id: string,
    public start: number,
    public duration: number,
  ) {
    super()
  }
}

class MockRail extends MockEmitter {
  trains: Train[] = []

  constructor(public zIndex: number) {
    super()
  }
}

class MockTimeline extends MockEmitter {
  rails: { rails: MockRail[] }

  constructor(rails: MockRail[]) {
    super()
    this.rails = { rails }
  }
}

class MockPerformer extends MockEmitter {
  sprite = new Sprite(Texture.WHITE)
  sourceStart = 0
  sourceDuration = 200
  renderFrameAtSourceTime = vi.fn(async () => {})

  constructor(
    public id: string,
    public start: number,
    public duration: number,
  ) {
    super()
  }
}

function createHarness() {
  const fromTrain = new MockTrain('from', 0, 100)
  const toTrain = new MockTrain('to', 100, 120)
  const rail = new MockRail(1)
  rail.trains = [fromTrain as unknown as Train, toTrain as unknown as Train]

  const timeline = new MockTimeline([rail])
  const theater = new MockEmitter()

  const from = new MockPerformer('from', 0, 100)
  const to = new MockPerformer('to', 100, 120)

  const stage = new Container()
  const renderer = {
    width: 640,
    height: 360,
    resolution: 1,
    render: vi.fn(),
  }

  const transitions = [
    {
      id: 'transition-1',
      fromId: 'from',
      toId: 'to',
      durationMs: 80,
      type: 'fade',
      params: {},
    },
  ]

  const app = {
    stage,
    renderer,
  }

  const adapter = {
    ready: Promise.resolve(),
    timeline: timeline as unknown as Timeline,
    getCurrentTime: () => 100,
    isPlaying: () => false,
    getTransitions: () => transitions,
    getPerformerById: (performerId: string) => {
      if (performerId === 'from')
        return from
      if (performerId === 'to')
        return to
      return null
    },
    getPerformers: () => [from, to],
    getApp: () => app as any,
    onTimelineDurationChanged: (handler: () => void) => {
      timeline.on('durationChanged', handler)
      return () => timeline.off('durationChanged', handler)
    },
    onPerformerHire: (handler: (performer: unknown) => void) => {
      theater.on('hire', handler)
      return () => theater.off('hire', handler)
    },
  }

  return {
    adapter,
    renderer,
    transitions,
    from,
    to,
  }
}

describe('transitionRuntime', () => {
  it('falls back when filter creation fails', async () => {
    const { adapter } = createHarness()

    const runtime = new TransitionRuntime(adapter, {
      createFilter: () => {
        throw new Error('filter init failed')
      },
    })

    await runtime.start()
    await runtime.syncFrame()

    expect(runtime.getDebugState().filterCacheSize).toBe(0)
    runtime.stop()
  })

  it('resizes snapshot textures and destroys them on stop', async () => {
    const { adapter, renderer } = createHarness()

    const createdTextures: Array<{
      width: number
      height: number
      source: { resolution: number }
      resize: ReturnType<typeof vi.fn>
      destroy: ReturnType<typeof vi.fn>
    }> = []

    const runtime = new TransitionRuntime(adapter, {
      createFilter: () => {
        return {
          resources: {
            uProgress: { uniforms: { uProgress: 0 } },
            uRatio: { uniforms: { uRatio: 1 } },
          },
          destroy: vi.fn(),
        } as any
      },
      createRenderTexture: ({ width, height, resolution }) => {
        const texture = {
          destroyed: false,
          width,
          height,
          source: { resolution, destroyed: false, alphaMode: 'premultiply-alpha-on-upload' },
          resize: vi.fn((nextWidth: number, nextHeight: number, nextResolution: number) => {
            texture.width = nextWidth
            texture.height = nextHeight
            texture.source.resolution = nextResolution
          }),
          destroy: vi.fn(),
        }
        createdTextures.push(texture)
        return texture as any
      },
    })

    await runtime.start()
    await runtime.syncFrame()

    expect(createdTextures).toHaveLength(2)

    renderer.width = 800
    renderer.height = 450
    renderer.resolution = 2

    runtime.requestRender()
    await runtime.syncFrame()

    expect(createdTextures[0]?.resize).toHaveBeenCalled()
    expect(createdTextures[1]?.resize).toHaveBeenCalled()

    runtime.stop()

    expect(createdTextures[0]?.destroy).toHaveBeenCalledWith(true)
    expect(createdTextures[1]?.destroy).toHaveBeenCalledWith(true)
  })

  it('keeps syncFrame awaitable when no active transition exists', async () => {
    const { adapter, transitions } = createHarness()
    transitions.splice(0, transitions.length)

    const runtime = new TransitionRuntime(adapter)
    await runtime.start()

    await runtime.syncFrame()

    expect(runtime.getDebugState().pending).toBe(false)
    expect(runtime.getDebugState().rendering).toBe(false)

    runtime.stop()
  })
})
