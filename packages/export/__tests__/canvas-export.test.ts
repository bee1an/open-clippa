import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CanvasExport, ExportCanceledError } from '../src/canvasExport'

const mockState = vi.hoisted(() => {
  return {
    outputs: [] as any[],
    sources: [] as any[],
  }
})

vi.mock('mediabunny', () => {
  class BufferTarget {
    buffer: ArrayBuffer | null = null
  }

  class Mp4OutputFormat {
    constructor(_options: unknown) {}
  }

  class VideoSample {
    constructor(public frame: { close: () => void }) {}
    close = vi.fn()
  }

  class VideoSampleSource {
    add = vi.fn(async (_sample: VideoSample) => {})
    constructor(_options: unknown) {
      mockState.sources.push(this)
    }
  }

  class Output {
    target: BufferTarget
    start = vi.fn(async () => {})
    addVideoTrack = vi.fn((_track: VideoSampleSource) => {})
    finalize = vi.fn(async () => {
      if (!this.target.buffer)
        this.target.buffer = new Uint8Array([1, 2, 3]).buffer
    })

    cancel = vi.fn(async () => {})

    constructor(options: { target: BufferTarget }) {
      this.target = options.target
      mockState.outputs.push(this)
    }
  }

  return {
    BufferTarget,
    Mp4OutputFormat,
    Output,
    VideoSample,
    VideoSampleSource,
  }
})

class FakeVideoFrame {
  close = vi.fn()

  constructor(
    public canvas: HTMLCanvasElement,
    public options: { timestamp: number, duration: number },
  ) {}
}

function setupBrowserCodecSupport(): void {
  vi.stubGlobal('VideoFrame', FakeVideoFrame as unknown as typeof VideoFrame)
  vi.stubGlobal('MediaRecorder', class MediaRecorderMock {})
  vi.stubGlobal('VideoEncoder', {
    isConfigSupported: vi.fn(async () => ({ supported: true })),
  })
}

describe('canvasExport', () => {
  beforeEach(() => {
    mockState.outputs.length = 0
    mockState.sources.length = 0
    setupBrowserCodecSupport()
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('exports frames and reports progress for each frame', async () => {
    const canvas = {} as HTMLCanvasElement
    const nextFrame = vi.fn(async () => {})
    const onProgress = vi.fn()
    const exporter = new CanvasExport({
      canvas,
      nextFrame,
      duration: 1000,
      frameRate: 5,
      onProgress,
      quality: 'low',
      codec: 'avc',
    })

    const blob = await exporter.export()

    expect(blob).toBeInstanceOf(Blob)
    expect(blob.type).toBe('video/mp4')
    expect(nextFrame).toHaveBeenCalledTimes(5)
    expect(onProgress).toHaveBeenCalledTimes(5)

    expect(nextFrame).toHaveBeenNthCalledWith(1, {
      frameIndex: 0,
      totalFrames: 5,
      timestampMs: 0,
      timestampUs: 0,
      frameDurationUs: 200000,
    })
    expect(nextFrame).toHaveBeenNthCalledWith(5, {
      frameIndex: 4,
      totalFrames: 5,
      timestampMs: 800,
      timestampUs: 800000,
      frameDurationUs: 200000,
    })

    expect(onProgress).toHaveBeenLastCalledWith({
      currentFrame: 5,
      totalFrames: 5,
      progress: 1,
      timestamp: 1000,
    })

    expect(mockState.outputs).toHaveLength(1)
    expect(mockState.sources).toHaveLength(1)
    expect(mockState.outputs[0].start).toHaveBeenCalledTimes(1)
    expect(mockState.outputs[0].addVideoTrack).toHaveBeenCalledTimes(1)
    expect(mockState.outputs[0].finalize).toHaveBeenCalledTimes(1)
    expect(mockState.sources[0].add).toHaveBeenCalledTimes(5)
  })

  it('supports cancellation during export loop', async () => {
    const canvas = {} as HTMLCanvasElement
    let exporter: CanvasExport
    const nextFrame = vi.fn(async ({ frameIndex }: { frameIndex: number }) => {
      if (frameIndex === 0)
        await exporter.cancel()
    })
    exporter = new CanvasExport({
      canvas,
      nextFrame,
      duration: 1000,
      frameRate: 4,
    })

    await expect(exporter.export()).rejects.toBeInstanceOf(ExportCanceledError)

    expect(mockState.outputs).toHaveLength(1)
    expect(mockState.outputs[0].cancel).toHaveBeenCalled()
  })

  it('falls back to safe defaults for invalid duration/frameRate', () => {
    const exporter = new CanvasExport({
      canvas: {} as HTMLCanvasElement,
      nextFrame: () => {},
      duration: -1,
      frameRate: 0,
    })

    expect((exporter as any)._frameRate).toBe(30)
    expect((exporter as any)._totalFrames).toBe(1)
  })

  it('throws clear error when browser WebCodecs support is missing', async () => {
    vi.stubGlobal('VideoFrame', undefined)

    const exporter = new CanvasExport({
      canvas: {} as HTMLCanvasElement,
      nextFrame: () => {},
      duration: 1000,
      frameRate: 30,
    })

    await expect(exporter.export()).rejects.toThrow('当前浏览器不支持 WebCodecs API')
  })

  it('detects supported codecs with mapping and ignores unsupported failures', async () => {
    const isConfigSupported = vi.fn(async ({ codec }: { codec: string }) => {
      if (codec === 'avc1' || codec === 'av01')
        return { supported: true }
      if (codec === 'vp09')
        return { supported: false }
      throw new Error('codec unavailable')
    })
    vi.stubGlobal('VideoEncoder', { isConfigSupported })

    const codecs = await CanvasExport.getSupportedCodecs()

    expect(codecs).toEqual(['avc', 'av1'])
    expect(isConfigSupported).toHaveBeenCalledTimes(4)
  })

  it('download creates a link, triggers click and revokes object URL', async () => {
    vi.useFakeTimers()

    const exporter = new CanvasExport({
      canvas: {} as HTMLCanvasElement,
      nextFrame: () => {},
      duration: 1000,
      frameRate: 30,
    })
    vi.spyOn(exporter, 'export').mockResolvedValue(new Blob(['video'], { type: 'video/mp4' }))

    const createObjectURLSpy = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:download')
    const revokeObjectURLSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
    const clickSpy = vi.fn()
    const appendChildSpy = vi.fn()
    const removeChildSpy = vi.fn()
    vi.stubGlobal('document', {
      createElement: vi.fn(() => ({ click: clickSpy, href: '', download: '' })),
      body: {
        appendChild: appendChildSpy,
        removeChild: removeChildSpy,
      },
    })

    await exporter.download('result.mp4')

    expect(createObjectURLSpy).toHaveBeenCalledTimes(1)
    expect(clickSpy).toHaveBeenCalledTimes(1)
    expect(appendChildSpy).toHaveBeenCalledTimes(1)
    expect(removeChildSpy).toHaveBeenCalledTimes(1)

    vi.runAllTimers()
    expect(revokeObjectURLSpy).toHaveBeenCalledWith('blob:download')

    vi.useRealTimers()
  })
})
