import { Sprite, Texture } from 'pixi.js'
import { describe, expect, it, vi } from 'vitest'
import { PlayState, ShowState } from '../src/performer'
import { Video } from '../src/video'

type VideoHarness = Video & Record<string, any>
type TrackLocalSize = {
  displayWidth: number
  displayHeight: number
  codedWidth: number
  codedHeight: number
}
type CropInsets = {
  left: number
  top: number
  right: number
  bottom: number
}

const DEFAULT_TRACK_LOCAL_SIZE: TrackLocalSize = {
  displayWidth: 1920,
  displayHeight: 1080,
  codedWidth: 1920,
  codedHeight: 1080,
}
const DEFAULT_CROP: CropInsets = {
  left: 500,
  top: 0,
  right: 400,
  bottom: 0,
}

function createVideoHarness(): VideoHarness {
  const video = Object.create(Video.prototype) as VideoHarness
  video.sourceStart = 0
  video.sourceDuration = 1000
  video.duration = 1000
  video.currentTime = 0
  video.valid = true
  video.error = true
  video.showState = ShowState.PLAYING
  video.playState = PlayState.PLAYING
  video._frameIntervalMs = 40
  video._lastRenderedTime = -1
  video._renderIdleWaiters = new Set()
  return video
}

function hydratePendingCroppedSprite(video: VideoHarness, targetWidth: number = 276, targetHeight: number = 155): void {
  video._videoTrack = { ...DEFAULT_TRACK_LOCAL_SIZE }
  video._cropInsets = { ...DEFAULT_CROP }
  video._sprite = new Sprite()
  ;(video._sprite as any).addChild = vi.fn()
  ;(video._sprite as any).removeChild = vi.fn()
  video._sprite.width = targetWidth
  video._sprite.height = targetHeight

  video._syncCropState()
  const bounds = video.getBounds()
  if (bounds.width > 0)
    video._sprite.scale.x *= targetWidth / bounds.width
  if (bounds.height > 0)
    video._sprite.scale.y *= targetHeight / bounds.height
  video._syncCropState()
}

describe('video core behavior', () => {
  it('clamps source time with epsilon near duration end', () => {
    const video = createVideoHarness()

    expect(video._clampSourceTime(-10)).toBe(0)
    expect(video._clampSourceTime(250)).toBe(250)
    expect(video._clampSourceTime(1000)).toBe(999)
    expect(video._clampSourceTime(1500)).toBe(999)
  })

  it('normalizes render time by frame interval and cache key', () => {
    const video = createVideoHarness()
    video._frameIntervalMs = 33.3333

    expect(video._normalizeRenderTime(10)).toBeCloseTo(0)
    expect(video._normalizeRenderTime(17)).toBeCloseTo(33.3333)
    expect(video._resolveFrameCacheKey(66.6666)).toBe(2)
  })

  it('uses fallback sample window when exact frame is unavailable', async () => {
    const video = createVideoHarness()
    const fallbackSample = { tag: 'fallback' }
    const getSample = vi.fn()
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(fallbackSample)
    video._videoSink = { getSample }
    video._frameIntervalMs = 40

    const sample = await video._getVideoSampleAtTime(100)

    expect(sample).toBe(fallbackSample)
    expect(getSample).toHaveBeenNthCalledWith(1, 0.1)
    expect(getSample).toHaveBeenNthCalledWith(2, 0.06)
    expect(getSample).toHaveBeenNthCalledWith(3, 0.02)
  })

  it('returns null when sample retrieval throws', async () => {
    const video = createVideoHarness()
    video._videoSink = {
      getSample: vi.fn().mockRejectedValue(new Error('decoder failed')),
    }
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const sample = await video._getVideoSampleAtTime(200)

    expect(sample).toBeNull()
    expect(errorSpy).toHaveBeenCalled()
  })

  it('checks containsPoint for axis-aligned and rotated bounds', () => {
    const video = createVideoHarness()

    video.getBounds = () => ({
      x: 10,
      y: 20,
      width: 100,
      height: 60,
      rotation: 0,
    })
    expect(video.containsPoint(30, 40)).toBe(true)
    expect(video.containsPoint(200, 40)).toBe(false)

    video.getBounds = () => ({
      x: 100,
      y: 100,
      width: 80,
      height: 40,
      rotation: 90,
    })
    expect(video.containsPoint(90, 120)).toBe(true)
    expect(video.containsPoint(90, 200)).toBe(false)
  })

  it('stores pending filters before sprite is ready and applies directly afterwards', () => {
    const video = createVideoHarness()
    const filters = [{ name: 'f1' }] as any

    video._sprite = undefined
    video.setFilters(filters)
    expect(video._pendingFilters).toBe(filters)

    video._sprite = {
      filters: null,
    }
    video.setFilters(null)
    expect(video._sprite.filters).toBeNull()
  })

  it('returns zero bounds when sprite is missing', () => {
    const video = createVideoHarness()
    video._sprite = undefined

    expect(video.getBounds()).toEqual({
      x: 0,
      y: 0,
      width: 0,
      height: 0,
      rotation: 0,
    })
    expect(video.getBaseBounds()).toEqual({
      x: 0,
      y: 0,
      width: 0,
      height: 0,
      rotation: 0,
    })
  })

  it('updates sprite position/rotation/scale and emits position updates', () => {
    const video = createVideoHarness()
    const notifySpy = vi.fn()
    video.notifyPositionUpdate = notifySpy
    video._sprite = {
      x: 0,
      y: 0,
      width: 100,
      height: 50,
      angle: 0,
      alpha: 1,
      scale: { x: 1, y: 1 },
    }

    video.setPosition(40, 60)
    video.setRotation(15)
    video.setScale(1.5, 0.75)

    expect(video._sprite.x).toBe(40)
    expect(video._sprite.y).toBe(60)
    expect(video._sprite.angle).toBe(15)
    expect(video._sprite.scale).toEqual({ x: 1.5, y: 0.75 })
    expect(notifySpy).toHaveBeenCalledTimes(3)
  })

  it('computes base bounds from animation base transform and render scale', () => {
    const video = createVideoHarness()
    video._sprite = {
      x: 200,
      y: 100,
      width: 200,
      height: 100,
      angle: 0,
      alpha: 1,
      scale: { x: 2, y: 4 },
    }
    video._animationController = {
      baseTransform: {
        x: 10,
        y: 20,
        scaleX: 3,
        scaleY: 2,
        rotation: 8,
        alpha: 1,
      },
    }

    expect(video.getBaseBounds()).toEqual({
      x: 10,
      y: 20,
      width: 300,
      height: 50,
      rotation: 8,
    })
  })

  it('preserves crop insets before first frame with empty texture', () => {
    const video = createVideoHarness()

    hydratePendingCroppedSprite(video)

    expect(video._cropInsets).toEqual(DEFAULT_CROP)
  })

  it('keeps cropped bounds when first decoded texture is applied', async () => {
    const video = createVideoHarness()
    const frameClose = vi.fn()
    const sampleClose = vi.fn()
    const textureFromSpy = vi.spyOn(Texture, 'from').mockReturnValue({
      dynamic: false,
      orig: { width: 1920, height: 1080 },
      width: 1920,
      height: 1080,
      destroy: vi.fn(),
    } as any)

    hydratePendingCroppedSprite(video)

    const before = video.getBounds()
    video._getVideoSampleAtTime = vi.fn().mockResolvedValue({
      toVideoFrame: () => ({ close: frameClose }),
      close: sampleClose,
    })

    await video._renderFrameAtTime(120)
    textureFromSpy.mockRestore()

    const after = video.getBounds()
    expect(after.width).toBeCloseTo(before.width, 3)
    expect(after.height).toBeCloseTo(before.height, 3)
    expect(video._cropInsets).toEqual(DEFAULT_CROP)
    expect(sampleClose).toHaveBeenCalledTimes(1)
    expect(frameClose).not.toHaveBeenCalled()
  })

  it('destroys runtime resources and resets playback state', () => {
    const video = createVideoHarness()
    const disposeSpy = vi.fn()
    const animationDestroySpy = vi.fn()
    const textureDestroySpy = vi.fn()
    const frameCloseSpy = vi.fn()
    const listenerCleanupSpy = vi.fn()
    const spriteDestroySpy = vi.fn()
    const waiterSpy = vi.fn()

    const sharedTexture = {
      destroy: textureDestroySpy,
    }

    video._animationController = {
      destroy: animationDestroySpy,
    }
    video._input = {
      [Symbol.dispose]: disposeSpy,
    }
    video._videoTrack = { track: 'mock' }
    video._videoSink = { sink: 'mock' }
    video._cachedFrame = {
      key: 1,
      texture: sharedTexture,
      frame: { close: frameCloseSpy },
    }
    video._sprite = {
      texture: sharedTexture,
      removeAllListeners: listenerCleanupSpy,
      destroy: spriteDestroySpy,
      scale: { x: 1, y: 1 },
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      angle: 0,
      alpha: 1,
    }
    video._renderIdleWaiters = new Set([waiterSpy])

    video.destroy()

    expect(animationDestroySpy).toHaveBeenCalledTimes(1)
    expect(disposeSpy).toHaveBeenCalledTimes(1)
    expect(textureDestroySpy).toHaveBeenCalledTimes(1)
    expect(frameCloseSpy).toHaveBeenCalledTimes(1)
    expect(listenerCleanupSpy).toHaveBeenCalledTimes(1)
    expect(spriteDestroySpy).toHaveBeenCalledTimes(1)
    expect(waiterSpy).toHaveBeenCalledTimes(1)
    expect(video._cachedFrame).toBeNull()
    expect(video._videoTrack).toBeNull()
    expect(video._videoSink).toBeUndefined()
    expect(video.valid).toBe(false)
    expect(video.error).toBe(false)
    expect(video.showState).toBe(ShowState.UNPLAYED)
    expect(video.playState).toBe(PlayState.PAUSED)
  })

  it('keeps resized sprite size when async frame render completes', async () => {
    const video = createVideoHarness()
    const frameClose = vi.fn()
    const sampleClose = vi.fn()
    const oldFrameClose = vi.fn()
    const oldTexture = {
      dynamic: false,
      orig: { width: 320, height: 180 },
      width: 320,
      height: 180,
      destroy: vi.fn(),
    }
    const nextTexture = {
      dynamic: false,
      orig: { width: 640, height: 360 },
      width: 640,
      height: 360,
      destroy: vi.fn(),
    }
    const textureFromSpy = vi.spyOn(Texture, 'from').mockReturnValue(nextTexture as any)

    let resolveSample!: (sample: any) => void
    const pendingSample = new Promise<any>((resolve) => {
      resolveSample = resolve
    })

    video._sprite = new Sprite(oldTexture as any)
    video._sprite.width = 300
    video._sprite.height = 180
    video._cachedFrame = {
      key: -1,
      texture: oldTexture as any,
      frame: { close: oldFrameClose },
    }
    video._getVideoSampleAtTime = vi.fn().mockReturnValue(pendingSample)

    const renderPromise = video._renderFrameAtTime(120)

    video._sprite.width = 180
    video._sprite.height = 320

    resolveSample({
      toVideoFrame: () => ({ close: frameClose }),
      close: sampleClose,
    })

    await renderPromise

    const bounds = video.getBounds()
    expect(bounds.width).toBeCloseTo(180, 3)
    expect(bounds.height).toBeCloseTo(320, 3)
    expect(sampleClose).toHaveBeenCalledTimes(1)
    expect(frameClose).not.toHaveBeenCalled()
    expect(oldFrameClose).toHaveBeenCalledTimes(1)
    expect(oldTexture.destroy).toHaveBeenCalledTimes(1)
    textureFromSpy.mockRestore()
  })
})
