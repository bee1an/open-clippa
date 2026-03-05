import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, ref } from 'vue'
import { useExportTaskStore } from './useExportTaskStore'

interface Deferred<T> {
  promise: Promise<T>
  resolve: (value: T | PromiseLike<T>) => void
  reject: (reason?: unknown) => void
}

function createDeferred<T>(): Deferred<T> {
  let resolve!: (value: T | PromiseLike<T>) => void
  let reject!: (reason?: unknown) => void

  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })

  return {
    promise,
    resolve,
    reject,
  }
}

const {
  editorStoreMock,
  exportStoreMock,
  setReadyPending,
  setReadyResolved,
  resolveReady,
  setExportPending,
  getExportPromise,
} = vi.hoisted(() => {
  const exportStoreMock = {
    setExportResult: vi.fn(),
  }

  const editorStoreMock = {
    duration: 2_000,
    isPlaying: false,
    canvasSize: {
      width: 1280,
      height: 720,
    },
    syncTransitionFrame: vi.fn(async () => {}),
    clippa: {
      ready: Promise.resolve(),
      pause: vi.fn(),
      director: {
        seek: vi.fn(async () => {}),
      },
      stage: {
        app: {
          canvas: {
            width: 1280,
            height: 720,
            toDataURL: vi.fn(() => ''),
          },
          stage: {},
          renderer: {
            render: vi.fn(),
          },
        },
      },
    },
  }

  let readyDeferred = createDeferred<void>()
  let exportDeferred = createDeferred<Blob>()

  function setReadyPending(): void {
    readyDeferred = createDeferred<void>()
    editorStoreMock.clippa.ready = readyDeferred.promise
  }

  function setReadyResolved(): void {
    editorStoreMock.clippa.ready = Promise.resolve()
  }

  function resolveReady(): void {
    readyDeferred.resolve()
  }

  function setExportPending(): void {
    exportDeferred = createDeferred<Blob>()
  }

  function getExportPromise(): Promise<Blob> {
    return exportDeferred.promise
  }

  return {
    editorStoreMock,
    exportStoreMock,
    setReadyPending,
    setReadyResolved,
    resolveReady,
    setExportPending,
    getExportPromise,
  }
})

vi.mock('clippc', () => {
  class MockCanvasExport {
    async export(): Promise<Blob> {
      return getExportPromise()
    }

    async cancel(): Promise<void> {}
  }

  class ExportCanceledError extends Error {}

  return {
    CanvasExport: MockCanvasExport,
    ExportCanceledError,
  }
})

vi.mock('./useEditorStore', () => {
  return {
    useEditorStore: () => editorStoreMock,
  }
})

vi.mock('./useExportStore', () => {
  return {
    useExportStore: () => exportStoreMock,
  }
})

describe('useExportTaskStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.stubGlobal('ref', ref)
    vi.stubGlobal('computed', computed)
    editorStoreMock.duration = 2_000
    editorStoreMock.isPlaying = false
    editorStoreMock.syncTransitionFrame.mockClear()
    editorStoreMock.clippa.pause.mockClear()
    editorStoreMock.clippa.director.seek.mockClear()
    editorStoreMock.clippa.stage.app.canvas.toDataURL.mockClear()
    editorStoreMock.clippa.stage.app.renderer.render.mockClear()
    exportStoreMock.setExportResult.mockClear()
    setExportPending()
    setReadyResolved()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('blocks concurrent starts while export is preparing', async () => {
    setReadyPending()
    const store = useExportTaskStore()

    const firstStartPromise = store.startExport({ frameRate: 60 })
    await Promise.resolve()

    expect(store.isStarting).toBe(true)
    await expect(store.startExport({ frameRate: 60 })).rejects.toThrow('Export task is already running')

    resolveReady()
    await firstStartPromise

    expect(store.isStarting).toBe(false)
    expect(store.status).toBe('exporting')
  })

  it('blocks repeated starts while exporting', async () => {
    const store = useExportTaskStore()

    await store.startExport({ frameRate: 60 })

    expect(store.status).toBe('exporting')
    await expect(store.startExport({ frameRate: 60 })).rejects.toThrow('Export task is already running')
  })
})
