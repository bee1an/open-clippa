import type { AiToolDefinition } from '../tooling/types'

const DEFAULT_MAX_VISIBLE_PERFORMERS = 100
const DEFAULT_MAX_TEXT_LENGTH = 120
const DEFAULT_MAX_SOURCE_LENGTH = 200
const DEFAULT_SCREENSHOT_MAX_EDGE = 320
const DEFAULT_SCREENSHOT_QUALITY = 0.65

export type EditorContextDetailLevel = 'brief' | 'full'
export type EditorContextPerformerType = 'video' | 'image' | 'text' | 'unknown'

export interface EditorContextPerformerBounds {
  x: number
  y: number
  width: number
  height: number
  rotation?: number
}

export interface EditorContextPerformerCrop {
  left: number
  top: number
  right: number
  bottom: number
}

export interface EditorContextPerformerSummary {
  id: string
  type: EditorContextPerformerType
  startMs: number
  durationMs: number
  bounds: EditorContextPerformerBounds
  crop?: EditorContextPerformerCrop
  alpha?: number
  text?: string
  source?: string
  sourceStartMs?: number
  sourceDurationMs?: number
  animation?: unknown
}

export interface EditorContextTransitionSummary {
  id: string
  fromId: string
  toId: string
  durationMs: number
  type: string
  params?: Record<string, unknown>
}

export interface EditorContextCanvasScreenshot {
  mimeType: string
  dataUrl: string
  width: number
  height: number
}

export interface EditorContextCanvasScreenshotOptions {
  maxEdge?: number
  quality?: number
}

export interface EditorContextAdapter {
  getCurrentTimeMs: () => number
  getDurationMs: () => number
  listVisiblePerformers: (timeMs: number) => EditorContextPerformerSummary[]
  listSelectedPerformers: () => EditorContextPerformerSummary[]
  getActiveTransition: () => EditorContextTransitionSummary | null
  getPerformerDetail?: (id: string) => EditorContextPerformerSummary | null
  getCanvasScreenshot?: (options?: EditorContextCanvasScreenshotOptions) => EditorContextCanvasScreenshot | null
}

interface EditorContextToolOptions {
  maxVisiblePerformers?: number
  maxTextLength?: number
  maxSourceLength?: number
  screenshotMaxEdge?: number
  screenshotQuality?: number
}

interface SceneToolInput {
  detailLevel?: EditorContextDetailLevel
  includeSelection?: boolean
  includeCanvasScreenshot?: boolean
}

interface PerformerDetailToolInput {
  id?: string
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function normalizeNumber(value: unknown, fallback: number): number {
  if (!isFiniteNumber(value))
    return fallback
  return value
}

function normalizeString(value: unknown): string | undefined {
  if (typeof value !== 'string')
    return undefined

  const normalized = value.trim()
  return normalized.length > 0 ? normalized : undefined
}

function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength)
    return text
  return `${text.slice(0, maxLength)}...`
}

function isLikelyLocalAbsolutePath(value: string): boolean {
  if (/^file:\/\//i.test(value))
    return true
  if (/^[a-z]:\\/i.test(value))
    return true
  return /^\/(?:Users|home|var|tmp|private|mnt)\//.test(value)
}

function sanitizeSource(value: string, maxLength: number): string {
  const trimmed = value.trim()
  if (/^data:/i.test(trimmed))
    return '[redacted-data-url]'
  if (isLikelyLocalAbsolutePath(trimmed))
    return '[redacted-local-path]'
  return truncateText(trimmed, maxLength)
}

function toPerformerPayload(
  performer: EditorContextPerformerSummary,
  detailLevel: EditorContextDetailLevel,
  maxTextLength: number,
  maxSourceLength: number,
): Record<string, unknown> {
  const basePayload: Record<string, unknown> = {
    id: performer.id,
    type: performer.type,
    startMs: normalizeNumber(performer.startMs, 0),
    durationMs: normalizeNumber(performer.durationMs, 0),
    bounds: {
      x: normalizeNumber(performer.bounds.x, 0),
      y: normalizeNumber(performer.bounds.y, 0),
      width: normalizeNumber(performer.bounds.width, 0),
      height: normalizeNumber(performer.bounds.height, 0),
      rotation: normalizeNumber(performer.bounds.rotation, 0),
    },
  }

  if (detailLevel === 'brief')
    return basePayload

  if (typeof performer.alpha === 'number')
    basePayload.alpha = performer.alpha

  const text = normalizeString(performer.text)
  if (text)
    basePayload.text = truncateText(text, maxTextLength)

  const source = normalizeString(performer.source)
  if (source)
    basePayload.source = sanitizeSource(source, maxSourceLength)

  if (typeof performer.sourceStartMs === 'number')
    basePayload.sourceStartMs = performer.sourceStartMs

  if (typeof performer.sourceDurationMs === 'number')
    basePayload.sourceDurationMs = performer.sourceDurationMs

  if (performer.crop) {
    basePayload.crop = {
      left: normalizeNumber(performer.crop.left, 0),
      top: normalizeNumber(performer.crop.top, 0),
      right: normalizeNumber(performer.crop.right, 0),
      bottom: normalizeNumber(performer.crop.bottom, 0),
    }
  }

  if (performer.animation !== undefined)
    basePayload.animation = performer.animation

  return basePayload
}

function resolveDetailLevel(args: SceneToolInput): EditorContextDetailLevel {
  return args.detailLevel === 'full' ? 'full' : 'brief'
}

function resolveSceneInput(value: unknown): SceneToolInput {
  if (!isRecord(value))
    return {}

  return {
    detailLevel: value.detailLevel === 'full' ? 'full' : 'brief',
    includeSelection: value.includeSelection !== false,
    includeCanvasScreenshot: value.includeCanvasScreenshot !== false,
  }
}

function resolvePerformerDetailInput(value: unknown): PerformerDetailToolInput {
  if (!isRecord(value))
    return {}

  return {
    id: normalizeString(value.id),
  }
}

function dedupePerformers(performers: EditorContextPerformerSummary[]): EditorContextPerformerSummary[] {
  const map = new Map<string, EditorContextPerformerSummary>()
  performers.forEach((performer) => {
    if (!map.has(performer.id))
      map.set(performer.id, performer)
  })
  return Array.from(map.values())
}

export function createEditorContextTools(
  adapter: EditorContextAdapter,
  options: EditorContextToolOptions = {},
): AiToolDefinition[] {
  const maxVisiblePerformers = options.maxVisiblePerformers ?? DEFAULT_MAX_VISIBLE_PERFORMERS
  const maxTextLength = options.maxTextLength ?? DEFAULT_MAX_TEXT_LENGTH
  const maxSourceLength = options.maxSourceLength ?? DEFAULT_MAX_SOURCE_LENGTH
  const screenshotMaxEdge = options.screenshotMaxEdge ?? DEFAULT_SCREENSHOT_MAX_EDGE
  const screenshotQuality = options.screenshotQuality ?? DEFAULT_SCREENSHOT_QUALITY

  const getCurrentSceneTool: AiToolDefinition = {
    name: 'get_current_scene',
    description: 'Read current scene context from the editor timeline.',
    jsonSchema: {
      type: 'object',
      properties: {
        detailLevel: {
          type: 'string',
          enum: ['brief', 'full'],
          description: 'How much detail to include in the response.',
        },
        includeSelection: {
          type: 'boolean',
          description: 'Whether to include selected performers.',
        },
        includeCanvasScreenshot: {
          type: 'boolean',
          description: 'Whether to include a current canvas screenshot as data URL.',
        },
      },
      required: [],
      additionalProperties: false,
    },
    handler: async (rawInput) => {
      const input = resolveSceneInput(rawInput)
      const detailLevel = resolveDetailLevel(input)
      const includeSelection = input.includeSelection !== false
      const includeCanvasScreenshot = input.includeCanvasScreenshot !== false
      const currentTimeMs = adapter.getCurrentTimeMs()
      const durationMs = adapter.getDurationMs()
      const visiblePerformers = dedupePerformers(adapter.listVisiblePerformers(currentTimeMs))
      const truncated = visiblePerformers.length > maxVisiblePerformers
      const clippedVisiblePerformers = truncated
        ? visiblePerformers.slice(0, maxVisiblePerformers)
        : visiblePerformers

      const selectedPerformers = includeSelection
        ? dedupePerformers(adapter.listSelectedPerformers())
        : []

      const activeTransition = adapter.getActiveTransition()
      const canvasScreenshot = includeCanvasScreenshot
        ? adapter.getCanvasScreenshot?.({
          maxEdge: screenshotMaxEdge,
          quality: screenshotQuality,
        }) ?? null
        : null

      return {
        currentTimeMs,
        durationMs,
        detailLevel,
        visibleCount: visiblePerformers.length,
        truncated,
        visiblePerformers: clippedVisiblePerformers.map(performer =>
          toPerformerPayload(performer, detailLevel, maxTextLength, maxSourceLength),
        ),
        selectedPerformers: selectedPerformers.map(performer =>
          toPerformerPayload(performer, detailLevel, maxTextLength, maxSourceLength),
        ),
        activeTransition,
        canvasScreenshot,
      }
    },
  }

  const getPerformerDetailTool: AiToolDefinition = {
    name: 'get_performer_detail',
    description: 'Read detailed information for a specific performer by id.',
    jsonSchema: {
      type: 'object',
      properties: {
        id: {
          type: 'string',
          description: 'Performer id.',
        },
      },
      required: ['id'],
      additionalProperties: false,
    },
    handler: async (rawInput) => {
      const input = resolvePerformerDetailInput(rawInput)
      if (!input.id)
        throw new Error('Missing required argument: id')

      const explicit = adapter.getPerformerDetail?.(input.id)
      const fallbackPool = dedupePerformers([
        ...adapter.listSelectedPerformers(),
        ...adapter.listVisiblePerformers(adapter.getCurrentTimeMs()),
      ])
      const fallback = fallbackPool.find(item => item.id === input.id) ?? null
      const performer = explicit ?? fallback

      if (!performer) {
        return {
          found: false,
          id: input.id,
        }
      }

      return {
        found: true,
        performer: toPerformerPayload(performer, 'full', maxTextLength, maxSourceLength),
      }
    },
  }

  return [getCurrentSceneTool, getPerformerDetailTool]
}
