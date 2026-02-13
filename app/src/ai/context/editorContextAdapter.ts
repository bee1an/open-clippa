import type {
  EditorContextAdapter,
  EditorContextCanvasScreenshot,
  EditorContextCanvasScreenshotOptions,
  EditorContextPerformerSummary,
  EditorContextTransitionSummary,
} from '@clippc/ai'
import type { SelectedPerformer } from '@/store/usePerformerStore'
import type { TransitionSpec } from '@/store/useTransitionStore'
import { useEditorStore } from '@/store/useEditorStore'
import { usePerformerStore } from '@/store/usePerformerStore'
import { useTransitionStore } from '@/store/useTransitionStore'

interface PerformerLike {
  id: string
  start: number
  duration: number
  src?: string
  sourceStart?: number
  sourceDuration?: number
  sprite?: {
    alpha?: number
  }
  getText?: () => string
  getBaseBounds: () => {
    x: number
    y: number
    width: number
    height: number
    rotation?: number
  }
}

interface EditorStoreLike {
  currentTime: number
  duration: number
  clippa?: {
    stage?: {
      app?: {
        canvas?: CanvasFrameLike
        stage?: unknown
        renderer?: RendererLike
      }
    }
  }
}

interface PerformerStoreLike {
  getAllPerformers: () => PerformerLike[]
  getPerformerById: (id: string) => PerformerLike | undefined
  selectedPerformers: SelectedPerformer[]
  getAnimation: (id: string) => unknown
}

interface TransitionStoreLike {
  activeTransition: TransitionSpec | null
}

interface CanvasFrameLike {
  width: number
  height: number
  toDataURL?: (type?: string, quality?: number) => string
}

interface RendererLike {
  extract: {
    canvas: (...args: any[]) => CanvasFrameLike
  }
}

export interface EditorContextAdapterDependencies {
  editorStore?: EditorStoreLike
  performerStore?: PerformerStoreLike
  transitionStore?: TransitionStoreLike
}

const DEFAULT_SCREENSHOT_MIME_TYPE = 'image/jpeg'
const DEFAULT_SCREENSHOT_MAX_EDGE = 320
const DEFAULT_SCREENSHOT_QUALITY = 0.65

function isVideoPerformer(performer: PerformerLike): boolean {
  return typeof performer.sourceDuration === 'number' || typeof performer.sourceStart === 'number'
}

function clampScreenshotQuality(quality: number): number {
  if (!Number.isFinite(quality))
    return DEFAULT_SCREENSHOT_QUALITY
  return Math.min(1, Math.max(0.1, quality))
}

function resolveTargetEdge(edge: number | undefined): number {
  if (typeof edge !== 'number' || !Number.isFinite(edge))
    return DEFAULT_SCREENSHOT_MAX_EDGE

  return Math.max(64, Math.round(edge))
}

function hasToDataUrl(
  canvas: CanvasFrameLike,
): canvas is CanvasFrameLike & { toDataURL: (type?: string, quality?: number) => string } {
  return typeof canvas.toDataURL === 'function'
}

function resolveAppCanvas(
  editorStore: EditorStoreLike,
): (CanvasFrameLike & { toDataURL: (type?: string, quality?: number) => string }) | null {
  const candidate = editorStore.clippa?.stage?.app?.canvas
  if (!candidate)
    return null

  if (typeof candidate.width !== 'number' || typeof candidate.height !== 'number')
    return null

  if (!hasToDataUrl(candidate))
    return null

  return candidate
}

function resolveExtractRenderer(editorStore: EditorStoreLike): RendererLike | null {
  const candidate = editorStore.clippa?.stage?.app?.renderer
  if (!candidate)
    return null

  if (!candidate.extract || typeof candidate.extract.canvas !== 'function')
    return null

  return candidate
}

function resolveExtractTarget(editorStore: EditorStoreLike): unknown | null {
  return editorStore.clippa?.stage?.app?.stage ?? null
}

function resolveScreenshotSize(
  sourceWidth: number,
  sourceHeight: number,
  maxEdge: number,
): {
  resolution: number
  targetWidth: number
  targetHeight: number
} {
  const scale = Math.min(1, maxEdge / Math.max(sourceWidth, sourceHeight))
  return {
    resolution: Math.max(0.01, scale),
    targetWidth: Math.max(1, Math.round(sourceWidth * scale)),
    targetHeight: Math.max(1, Math.round(sourceHeight * scale)),
  }
}

function captureCanvasScreenshot(
  editorStore: EditorStoreLike,
  options: EditorContextCanvasScreenshotOptions = {},
): EditorContextCanvasScreenshot | null {
  const canvas = resolveAppCanvas(editorStore)
  if (!canvas)
    return null

  const sourceWidth = Math.max(0, Math.round(canvas.width))
  const sourceHeight = Math.max(0, Math.round(canvas.height))
  if (!sourceWidth || !sourceHeight)
    return null

  const maxEdge = resolveTargetEdge(options.maxEdge)
  const quality = clampScreenshotQuality(options.quality ?? DEFAULT_SCREENSHOT_QUALITY)
  const screenshotSize = resolveScreenshotSize(sourceWidth, sourceHeight, maxEdge)

  try {
    let dataUrl: string | null = null
    let width = screenshotSize.targetWidth
    let height = screenshotSize.targetHeight

    const renderer = resolveExtractRenderer(editorStore)
    const extractTarget = resolveExtractTarget(editorStore)

    if (renderer && extractTarget) {
      const extractedCanvas = renderer.extract.canvas({
        target: extractTarget,
        resolution: screenshotSize.resolution,
      })

      if (extractedCanvas && hasToDataUrl(extractedCanvas)) {
        dataUrl = extractedCanvas.toDataURL(DEFAULT_SCREENSHOT_MIME_TYPE, quality)
        const extractedWidth = Math.round(extractedCanvas.width)
        const extractedHeight = Math.round(extractedCanvas.height)
        if (extractedWidth > 0 && extractedHeight > 0) {
          width = extractedWidth
          height = extractedHeight
        }
      }
    }

    if (!dataUrl)
      dataUrl = canvas.toDataURL(DEFAULT_SCREENSHOT_MIME_TYPE, quality)

    if (!dataUrl.startsWith('data:'))
      return null

    return {
      mimeType: DEFAULT_SCREENSHOT_MIME_TYPE,
      dataUrl,
      width,
      height,
    }
  }
  catch {
    return null
  }
}

function resolvePerformerType(performer: PerformerLike): EditorContextPerformerSummary['type'] {
  if (typeof performer.getText === 'function')
    return 'text'
  if (typeof performer.src === 'string')
    return isVideoPerformer(performer) ? 'video' : 'image'
  return 'unknown'
}

function toPerformerSummary(
  performer: PerformerLike,
  animation: unknown,
): EditorContextPerformerSummary {
  const bounds = performer.getBaseBounds()
  const type = resolvePerformerType(performer)

  const summary: EditorContextPerformerSummary = {
    id: performer.id,
    type,
    startMs: performer.start,
    durationMs: performer.duration,
    bounds: {
      x: bounds.x,
      y: bounds.y,
      width: bounds.width,
      height: bounds.height,
      rotation: bounds.rotation ?? 0,
    },
  }

  if (typeof performer.sprite?.alpha === 'number')
    summary.alpha = performer.sprite.alpha

  if (type === 'text' && typeof performer.getText === 'function')
    summary.text = performer.getText()

  if (typeof performer.src === 'string')
    summary.source = performer.src

  if (typeof performer.sourceStart === 'number')
    summary.sourceStartMs = performer.sourceStart

  if (typeof performer.sourceDuration === 'number')
    summary.sourceDurationMs = performer.sourceDuration

  if (animation !== null && animation !== undefined)
    summary.animation = animation

  return summary
}

function resolveTransitionSummary(transition: TransitionSpec | null): EditorContextTransitionSummary | null {
  if (!transition)
    return null

  return {
    id: transition.id,
    fromId: transition.fromId,
    toId: transition.toId,
    durationMs: transition.durationMs,
    type: transition.type,
    params: transition.params,
  }
}

function dedupeById(performers: EditorContextPerformerSummary[]): EditorContextPerformerSummary[] {
  const byId = new Map<string, EditorContextPerformerSummary>()
  performers.forEach((performer) => {
    if (!byId.has(performer.id))
      byId.set(performer.id, performer)
  })
  return Array.from(byId.values())
}

export function createEditorContextAdapter(
  dependencies: EditorContextAdapterDependencies = {},
): EditorContextAdapter {
  const editorStore = dependencies.editorStore ?? useEditorStore()
  const performerStore = dependencies.performerStore ?? usePerformerStore()
  const transitionStore = dependencies.transitionStore ?? useTransitionStore()

  const mapPerformer = (performer: PerformerLike): EditorContextPerformerSummary => {
    return toPerformerSummary(performer, performerStore.getAnimation(performer.id))
  }

  const getCurrentTimeMs = (): number => editorStore.currentTime
  const getDurationMs = (): number => editorStore.duration

  const listVisiblePerformers = (timeMs: number): EditorContextPerformerSummary[] => {
    const performers = performerStore
      .getAllPerformers()
      .filter(performer => performer.start <= timeMs && timeMs < performer.start + performer.duration)
      .map(mapPerformer)

    return dedupeById(performers)
  }

  const listSelectedPerformers = (): EditorContextPerformerSummary[] => {
    const selected = performerStore.selectedPerformers
      .map(item => performerStore.getPerformerById(item.id))
      .filter((performer): performer is PerformerLike => performer !== undefined)
      .map(mapPerformer)

    return dedupeById(selected)
  }

  const getActiveTransition = (): EditorContextTransitionSummary | null => {
    return resolveTransitionSummary(transitionStore.activeTransition)
  }

  const getPerformerDetail = (id: string): EditorContextPerformerSummary | null => {
    const performer = performerStore.getPerformerById(id)
    if (!performer)
      return null

    return mapPerformer(performer)
  }

  const getCanvasScreenshot = (options?: EditorContextCanvasScreenshotOptions): EditorContextCanvasScreenshot | null => {
    return captureCanvasScreenshot(editorStore, options)
  }

  return {
    getCurrentTimeMs,
    getDurationMs,
    listVisiblePerformers,
    listSelectedPerformers,
    getActiveTransition,
    getPerformerDetail,
    getCanvasScreenshot,
  }
}
