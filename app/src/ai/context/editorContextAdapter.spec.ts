import { createEditorContextTools } from '@clippc/ai'
import { describe, expect, it, vi } from 'vitest'
import { createEditorContextAdapter } from './editorContextAdapter'

vi.mock('@/store/useEditorStore', () => ({
  useEditorStore: vi.fn(),
}))

vi.mock('@/store/usePerformerStore', () => ({
  usePerformerStore: vi.fn(),
}))

vi.mock('@/store/useTransitionStore', () => ({
  useTransitionStore: vi.fn(),
}))

interface MockPerformerInput {
  id: string
  start: number
  duration: number
  x?: number
  y?: number
  width?: number
  height?: number
  rotation?: number
  src?: string
  sourceStart?: number
  sourceDuration?: number
  text?: string
  crop?: {
    left?: number
    top?: number
    right?: number
    bottom?: number
  }
}

function createMockPerformer(input: MockPerformerInput) {
  let x = input.x ?? 0
  let y = input.y ?? 0
  const width = input.width ?? 100
  const height = input.height ?? 100

  return {
    id: input.id,
    start: input.start,
    duration: input.duration,
    src: input.src,
    sourceStart: input.sourceStart,
    sourceDuration: input.sourceDuration,
    getCropInsets: input.crop
      ? () => ({
          left: input.crop?.left ?? 0,
          top: input.crop?.top ?? 0,
          right: input.crop?.right ?? 0,
          bottom: input.crop?.bottom ?? 0,
        })
      : undefined,
    getText: input.text ? () => input.text as string : undefined,
    load: vi.fn(async () => {}),
    update: vi.fn(),
    setPosition: vi.fn((nextX: number, nextY: number) => {
      x = nextX
      y = nextY
    }),
    getBaseBounds: () => ({
      x,
      y,
      width,
      height,
      rotation: input.rotation ?? 0,
    }),
    sprite: {
      alpha: 1,
    },
  }
}

describe('createEditorContextAdapter', () => {
  it('filters visible performers by current time', () => {
    const p1 = createMockPerformer({ id: 'p1', start: 0, duration: 1000, src: 'https://example.com/1.mp4' })
    const p2 = createMockPerformer({ id: 'p2', start: 1000, duration: 1000, src: 'https://example.com/2.mp4' })
    const p3 = createMockPerformer({ id: 'p3', start: 0, duration: 500, text: 'hello' })

    const adapter = createEditorContextAdapter({
      editorStore: {
        currentTime: 400,
        duration: 3000,
      },
      performerStore: {
        getAllPerformers: () => [p1, p2, p3],
        getPerformerById: id => [p1, p2, p3].find(item => item.id === id),
        selectedPerformers: [],
        getAnimation: () => null,
      },
      transitionStore: {
        activeTransition: null,
      },
    })

    const visible = adapter.listVisiblePerformers(400)
    expect(visible.map(item => item.id)).toEqual(['p1', 'p3'])
  })

  it('maps selected performers and transition snapshot', () => {
    const p1 = createMockPerformer({
      id: 'p1',
      start: 0,
      duration: 1000,
      src: 'https://example.com/1.mp4',
      crop: {
        left: 8,
        right: 12,
      },
    })
    const p2 = createMockPerformer({ id: 'p2', start: 1000, duration: 1000, text: 'selected text' })

    const adapter = createEditorContextAdapter({
      editorStore: {
        currentTime: 1200,
        duration: 5000,
      },
      performerStore: {
        getAllPerformers: () => [p1, p2],
        getPerformerById: id => [p1, p2].find(item => item.id === id),
        selectedPerformers: [{ id: 'p2', bounds: { x: 0, y: 0, width: 100, height: 100 }, timestamp: Date.now() }],
        getAnimation: id => id === 'p2' ? { enter: { preset: 'fade', durationMs: 200 } } : null,
      },
      transitionStore: {
        activeTransition: {
          id: 't1',
          fromId: 'p1',
          toId: 'p2',
          durationMs: 500,
          type: 'crossfade',
          params: { strength: 0.5 },
        },
      },
    })

    const selected = adapter.listSelectedPerformers()
    expect(selected).toHaveLength(1)
    expect(selected[0].id).toBe('p2')
    expect(selected[0].text).toBe('selected text')
    expect(selected[0].animation).toEqual({ enter: { preset: 'fade', durationMs: 200 } })

    const visible = adapter.listVisiblePerformers(200)
    expect(visible[0].crop).toEqual({
      left: 8,
      top: 0,
      right: 12,
      bottom: 0,
    })

    const transition = adapter.getActiveTransition()
    expect(transition).toEqual({
      id: 't1',
      fromId: 'p1',
      toId: 'p2',
      durationMs: 500,
      type: 'crossfade',
      params: { strength: 0.5 },
    })
  })

  it('exposes only read-only editor context tools', () => {
    const performer = createMockPerformer({ id: 'p1', start: 0, duration: 1000, text: 'hello' })
    const adapter = createEditorContextAdapter({
      editorStore: {
        currentTime: 0,
        duration: 1000,
      },
      performerStore: {
        getAllPerformers: () => [performer],
        getPerformerById: id => id === performer.id ? performer : undefined,
        selectedPerformers: [],
        getAnimation: () => null,
      },
      transitionStore: {
        activeTransition: null,
      },
    })

    const names = createEditorContextTools(adapter).map(tool => tool.name)
    expect(names).toEqual(['get_current_scene', 'get_performer_detail'])
  })

  it('applies truncation and sanitization in get_current_scene tool', async () => {
    const fallbackCanvasToDataUrlMock = vi.fn(() => 'data:image/jpeg;base64,fallback')
    const extractedCanvasToDataUrlMock = vi.fn(() => 'data:image/jpeg;base64,abc')
    const extractCanvasMock = vi.fn(() => ({
      width: 320,
      height: 180,
      toDataURL: extractedCanvasToDataUrlMock,
    }))
    const pixiStage = {}
    const performers = Array.from({ length: 120 }, (_unused, index) => {
      const source = index === 0
        ? 'data:image/png;base64,aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
        : `https://example.com/video-${index}.mp4`

      return createMockPerformer({
        id: `p-${index}`,
        start: 0,
        duration: 1000,
        src: source,
      })
    })

    const adapter = createEditorContextAdapter({
      editorStore: {
        currentTime: 200,
        duration: 5000,
        clippa: {
          stage: {
            app: {
              canvas: {
                width: 640,
                height: 360,
                toDataURL: fallbackCanvasToDataUrlMock,
              },
              stage: pixiStage,
              renderer: {
                extract: {
                  canvas: extractCanvasMock,
                },
              },
            },
          },
        },
      },
      performerStore: {
        getAllPerformers: () => performers,
        getPerformerById: id => performers.find(item => item.id === id),
        selectedPerformers: [],
        getAnimation: () => null,
      },
      transitionStore: {
        activeTransition: null,
      },
    })

    const tools = createEditorContextTools(adapter, {
      maxVisiblePerformers: 100,
      maxSourceLength: 80,
    })
    const sceneTool = tools.find(tool => tool.name === 'get_current_scene')
    expect(sceneTool).toBeDefined()

    const payload = await sceneTool!.handler(
      { detailLevel: 'full' },
      { round: 1, toolCallId: 'call-1' },
    ) as {
      truncated: boolean
      visiblePerformers: Array<{ source?: string }>
      canvasScreenshot: {
        mimeType: string
        dataUrl: string
        width: number
        height: number
      } | null
    }
    expect(payload.truncated).toBe(true)
    expect(payload.visiblePerformers).toHaveLength(100)
    expect(payload.visiblePerformers[0].source).toBe('[redacted-data-url]')
    expect(payload.canvasScreenshot).toEqual({
      mimeType: 'image/jpeg',
      dataUrl: 'data:image/jpeg;base64,abc',
      width: 320,
      height: 180,
    })
    expect(extractCanvasMock).toHaveBeenCalledOnce()
    expect(extractCanvasMock).toHaveBeenCalledWith({
      target: pixiStage,
      resolution: 0.5,
    })
    expect(extractedCanvasToDataUrlMock).toHaveBeenCalledOnce()
    expect(fallbackCanvasToDataUrlMock).not.toHaveBeenCalled()
  })

  it('falls back to app canvas snapshot when renderer extract is unavailable', async () => {
    const fallbackCanvasToDataUrlMock = vi.fn(() => 'data:image/jpeg;base64,fallback')
    const performer = createMockPerformer({
      id: 'p1',
      start: 0,
      duration: 1000,
      src: 'https://example.com/video.mp4',
    })

    const adapter = createEditorContextAdapter({
      editorStore: {
        currentTime: 200,
        duration: 5000,
        clippa: {
          stage: {
            app: {
              canvas: {
                width: 640,
                height: 360,
                toDataURL: fallbackCanvasToDataUrlMock,
              },
            },
          },
        },
      },
      performerStore: {
        getAllPerformers: () => [performer],
        getPerformerById: id => id === performer.id ? performer : undefined,
        selectedPerformers: [],
        getAnimation: () => null,
      },
      transitionStore: {
        activeTransition: null,
      },
    })

    const tools = createEditorContextTools(adapter)
    const sceneTool = tools.find(tool => tool.name === 'get_current_scene')
    expect(sceneTool).toBeDefined()

    const payload = await sceneTool!.handler(
      { detailLevel: 'full' },
      { round: 1, toolCallId: 'call-2' },
    ) as {
      canvasScreenshot: {
        mimeType: string
        dataUrl: string
        width: number
        height: number
      } | null
    }

    expect(payload.canvasScreenshot).toEqual({
      mimeType: 'image/jpeg',
      dataUrl: 'data:image/jpeg;base64,fallback',
      width: 320,
      height: 180,
    })
    expect(fallbackCanvasToDataUrlMock).toHaveBeenCalledOnce()
  })
})
