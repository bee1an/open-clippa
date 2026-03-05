import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { usePerformerStore } from './usePerformerStore'

const { fireMock, editorStoreMock } = vi.hoisted(() => {
  const fireMock = vi.fn()
  const editorStoreMock = {
    clippa: {
      fire: fireMock,
      ready: Promise.resolve(),
      stage: {
        app: null,
      },
      timeline: {
        rails: {
          rails: [] as Array<{ trains: Array<{ id: string, updateActive: (active: boolean) => void }>, removeTrain: (train: { id: string, updateActive: (active: boolean) => void }) => void }>,
        },
        state: {
          activeTrain: null as { id: string } | null,
        },
      },
    },
  }

  return {
    fireMock,
    editorStoreMock,
  }
})

vi.mock('@/store/useEditorStore', () => {
  return {
    useEditorStore: () => editorStoreMock,
  }
})

vi.mock('@clippc/performer', () => {
  class MockPerformer {
    id: string
    start: number
    duration: number
    zIndex: number
    sprite = {
      scale: {
        x: 1,
        y: 1,
      },
    }

    valid = true
    error = false
    showState = 'unplayed'
    playState = 'paused'
    private listeners = new Map<string, Set<(...args: any[]) => void>>()
    private bounds: { x: number, y: number, width: number, height: number, rotation: number }
    private deferLoad: boolean
    private loadedWidth: number
    private loadedHeight: number
    private loadPromise: Promise<void> | null = null
    private resolvePendingLoad: (() => void) | null = null

    constructor(option: { id: string, start: number, duration: number, zIndex: number, x?: number, y?: number, width?: number, height?: number, deferLoad?: boolean, loadedWidth?: number, loadedHeight?: number }) {
      this.id = option.id
      this.start = option.start
      this.duration = option.duration
      this.zIndex = option.zIndex
      this.deferLoad = option.deferLoad ?? false
      this.loadedWidth = option.loadedWidth ?? option.width ?? 100
      this.loadedHeight = option.loadedHeight ?? option.height ?? 100
      this.bounds = {
        x: option.x ?? 0,
        y: option.y ?? 0,
        width: option.width ?? (this.deferLoad ? 0 : this.loadedWidth),
        height: option.height ?? (this.deferLoad ? 0 : this.loadedHeight),
        rotation: 0,
      }
    }

    on(event: string, handler: (...args: any[]) => void): void {
      if (!this.listeners.has(event))
        this.listeners.set(event, new Set())
      this.listeners.get(event)!.add(handler)
    }

    private emit(event: string, ...args: any[]): void {
      this.listeners.get(event)?.forEach(handler => handler(...args))
    }

    async load(): Promise<void> {
      if (this.loadPromise)
        return this.loadPromise

      if (!this.deferLoad) {
        this.bounds.width = this.loadedWidth
        this.bounds.height = this.loadedHeight
        this.loadPromise = Promise.resolve()
        return this.loadPromise
      }

      this.loadPromise = new Promise<void>((resolve) => {
        this.resolvePendingLoad = () => {
          this.bounds.width = this.loadedWidth
          this.bounds.height = this.loadedHeight
          this.deferLoad = false
          this.resolvePendingLoad = null
          resolve()
        }
      })
      return this.loadPromise
    }

    resolveLoad(): void {
      this.resolvePendingLoad?.()
    }

    containsPoint(): boolean {
      return false
    }

    getBounds() {
      return this.getBaseBounds()
    }

    getBaseBounds() {
      return { ...this.bounds }
    }

    setPosition(x: number, y: number): void {
      this.bounds.x = x
      this.bounds.y = y
      this.emit('positionUpdate', this.getBaseBounds())
    }

    setScale(scaleX: number, scaleY: number): void {
      const ratioX = this.sprite.scale.x ? scaleX / this.sprite.scale.x : 1
      const ratioY = this.sprite.scale.y ? scaleY / this.sprite.scale.y : 1
      this.sprite.scale.x = scaleX
      this.sprite.scale.y = scaleY
      this.bounds.width *= ratioX
      this.bounds.height *= ratioY
      this.emit('positionUpdate', this.getBaseBounds())
    }

    setRotation(angle: number): void {
      this.bounds.rotation = angle
      this.emit('positionUpdate', this.getBaseBounds())
    }

    setAlpha(): void {}

    setAnimation(): void {}

    play(): void {}

    update(): void {}

    pause(): void {}

    async seek(): Promise<void> {}

    destroy(): void {}
  }

  class Video extends MockPerformer {
    src: string
    sourceStart: number

    constructor(option: { src: string, sourceStart?: number, id: string, start: number, duration: number, zIndex: number, x?: number, y?: number, width?: number, height?: number, deferLoad?: boolean, loadedWidth?: number, loadedHeight?: number }) {
      super(option)
      this.src = option.src
      this.sourceStart = option.sourceStart ?? 0
    }
  }

  class Image extends MockPerformer {
    src: string

    constructor(option: { src: string, id: string, start: number, duration: number, zIndex: number, x?: number, y?: number, width?: number, height?: number, deferLoad?: boolean, loadedWidth?: number, loadedHeight?: number }) {
      super(option)
      this.src = option.src
    }
  }

  class Text extends MockPerformer {
    private content: string
    private style: { fill?: string | number }

    constructor(option: { content: string, style?: { fill?: string | number }, id: string, start: number, duration: number, zIndex: number, x?: number, y?: number, width?: number, height?: number, deferLoad?: boolean, loadedWidth?: number, loadedHeight?: number }) {
      super(option)
      this.content = option.content
      this.style = option.style ?? {}
    }

    getText(): string {
      return this.content
    }

    getStyle(): { fill?: string | number } {
      return { ...this.style }
    }
  }

  function normalizeAnimationSpec<T>(spec: T): T {
    return spec
  }

  function mergeAnimationSpec<T extends object>(current: T | null, patch: Partial<T>): T {
    return {
      ...(current ?? {} as T),
      ...patch,
    }
  }

  return {
    Video,
    Image,
    Text,
    normalizeAnimationSpec,
    mergeAnimationSpec,
  }
})

describe('usePerformerStore cleanup integration', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.stubGlobal('ref', ref)
    fireMock.mockReset()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  async function flushMicrotasks(): Promise<void> {
    await Promise.resolve()
    await Promise.resolve()
    await Promise.resolve()
    await Promise.resolve()
  }

  it('calls clippa.fire when removing one performer', () => {
    const store = usePerformerStore()
    const performer = store.addPerformer({
      id: 'video-1',
      type: 'video',
      src: 'https://example.com/video.mp4',
      start: 0,
      duration: 1000,
      x: 0,
      y: 0,
      width: 320,
      height: 180,
    })

    store.removePerformer(performer.id)

    expect(fireMock).toHaveBeenCalledTimes(1)
    expect(fireMock).toHaveBeenCalledWith(performer)
  })

  it('calls clippa.fire for every performer in clearAllPerformers', () => {
    const store = usePerformerStore()

    const first = store.addPerformer({
      id: 'video-1',
      type: 'video',
      src: 'https://example.com/video.mp4',
      start: 0,
      duration: 1000,
      x: 0,
      y: 0,
      width: 320,
      height: 180,
    })
    const second = store.addPerformer({
      id: 'image-1',
      type: 'image',
      src: 'https://example.com/image.png',
      start: 0,
      duration: 1000,
      x: 10,
      y: 10,
      width: 120,
      height: 120,
    })

    store.clearAllPerformers()

    expect(fireMock).toHaveBeenCalledTimes(2)
    expect(fireMock).toHaveBeenNthCalledWith(1, first)
    expect(fireMock).toHaveBeenNthCalledWith(2, second)
  })

  it('bumps content revision when performer emits position update', () => {
    const store = usePerformerStore()
    const performer = store.addPerformer({
      id: 'video-crop',
      type: 'video',
      src: 'https://example.com/video.mp4',
      start: 0,
      duration: 2000,
      x: 0,
      y: 0,
      width: 320,
      height: 180,
    })

    const before = store.contentRevision
    performer.setPosition(48, 36)

    expect(store.contentRevision).toBeGreaterThan(before)
  })

  it('bumps content revision when updating alpha without position events', () => {
    const store = usePerformerStore()
    const performer = store.addPerformer({
      id: 'video-alpha',
      type: 'video',
      src: 'https://example.com/video.mp4',
      start: 0,
      duration: 2000,
      x: 0,
      y: 0,
      width: 320,
      height: 180,
    })

    const before = store.contentRevision
    store.updatePerformer(performer.id, { alpha: 0.5 } as any)

    expect(store.contentRevision).toBeGreaterThan(before)
  })

  it('refreshes selected bounds after deferred media load resolves', async () => {
    const store = usePerformerStore()
    const performer = store.addPerformer({
      id: 'video-loading-selected',
      type: 'video',
      src: 'https://example.com/video.mp4',
      start: 0,
      duration: 2000,
      x: 0,
      y: 0,
      deferLoad: true,
      loadedWidth: 640,
      loadedHeight: 360,
    } as any)

    store.selectPerformer(performer.id)
    expect(store.selectedPerformers[0]?.bounds.width).toBe(0)
    expect(store.selectedPerformers[0]?.bounds.height).toBe(0)

    ;(performer as any).resolveLoad()
    await flushMicrotasks()

    expect(store.selectedPerformers[0]?.bounds.width).toBe(640)
    expect(store.selectedPerformers[0]?.bounds.height).toBe(360)
  })
})
