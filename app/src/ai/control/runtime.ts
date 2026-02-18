import type { FilterPresetValue } from '@clippc/filter'
import type { Train } from 'clippc'
import type {
  ActionResult,
  CreateTextElementInput,
  EditorControlRuntime,
  ExportCancelInput,
  ExportStartInput,
  ExportStatusSnapshot,
  FilterCreateLayerInput,
  FilterLayerSnapshot,
  MediaAddAssetToTimelineInput,
  MediaAssetSnapshot,
  MediaImportRandomImageInput,
  MediaImportRandomVideoInput,
  MediaImportVideoFromUrlInput,
  MediaPickRandomAssetInput,
  PerformerClearAnimationInput,
  PerformerRemoveInput,
  PerformerSelectInput,
  PerformerSetAnimationInput,
  PerformerSnapshot,
  PerformerUpdateTextContentInput,
  PerformerUpdateTextStyleInput,
  PerformerUpdateTransformInput,
  ProjectStateSnapshot,
  QueryMediaAssetsInput,
  QueryPerformersInput,
  QueryTimelineItemsInput,
  TimelineItemSnapshot,
  TimelineSeekInput,
  TimelineSelectTrainInput,
  TimelineSplitAtTimeInput,
  TransitionCandidateSnapshot,
  TransitionRemoveInput,
  TransitionSnapshot,
  TransitionUpdateInput,
  TransitionUpsertByPairInput,
} from './types'
import type {
  FilterConfig,
  FilterLayer,
} from '@/store/useFilterStore'
import type { PerformerConfig } from '@/store/usePerformerStore'
import { getFilterPresetConfig } from '@clippc/filter'
import {
  type CropInsets,
  Image,
  Text,
  Video,
} from '@clippc/performer'
import {
  buildTransitionCandidates,
  buildTransitionPairKey,
  computeTransitionMaxMs,
  DEFAULT_GL_TRANSITION_TYPE,
  DEFAULT_TRANSITION_DURATION,
  getGlTransitionDefaultParams,
  TRANSITION_FEATURE_AVAILABLE,
} from '@clippc/transition'
import { getPxByMs } from '@clippc/utils'
import { VideoTrain } from 'clippc'
import { getFilterPresetLabel } from '@/lib/filterPresets'
import { useEditorStore } from '@/store/useEditorStore'
import { useExportTaskStore } from '@/store/useExportTaskStore'
import {
  cloneFilterConfig,
  useFilterStore,
} from '@/store/useFilterStore'
import { MediaStoreError, useMediaStore } from '@/store/useMediaStore'
import { usePerformerStore } from '@/store/usePerformerStore'
import { useTransitionStore } from '@/store/useTransitionStore'
import { loadVideoMetadata } from '@/utils/media'
import { asOptionalString, failure, success } from './validators'

const DEFAULT_IMAGE_DURATION_MS = 3000
const DEFAULT_VIDEO_DURATION_MS = 5000
const DEFAULT_CREATED_TEXT_DURATION_MS = 5000
const DEFAULT_CREATED_TEXT_CONTENT = '双击编辑文本'
const RANDOM_MEDIA_ORIENTATION_VALUES = ['landscape', 'portrait', 'square'] as const
const RANDOM_MEDIA_ORIENTATION_SET = new Set<string>(RANDOM_MEDIA_ORIENTATION_VALUES)

interface EditorControlRuntimeDependencies {
  editorStore?: ReturnType<typeof useEditorStore>
  performerStore?: ReturnType<typeof usePerformerStore>
  mediaStore?: ReturnType<typeof useMediaStore>
  filterStore?: ReturnType<typeof useFilterStore>
  transitionStore?: ReturnType<typeof useTransitionStore>
  exportTaskStore?: ReturnType<typeof useExportTaskStore>
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function ensureNonNegativeNumber(value: number): number {
  return Math.max(0, value)
}

function resolveSafeStartMs(value: number | undefined, fallback: number): number {
  const candidate = isFiniteNumber(value) ? value : fallback
  return Math.max(0, candidate)
}

function resolveSafeDurationMs(value: number | undefined): number {
  if (!isFiniteNumber(value) || value <= 0)
    return DEFAULT_CREATED_TEXT_DURATION_MS
  return value
}

function resolveCoordinate(value: number | undefined): number | null {
  if (!isFiniteNumber(value))
    return null
  return value
}

function resolveTextContent(value: string | undefined): string {
  if (typeof value !== 'string')
    return DEFAULT_CREATED_TEXT_CONTENT

  const normalized = value.trim()
  if (normalized.length === 0)
    return DEFAULT_CREATED_TEXT_CONTENT
  return normalized
}

function resolveStageSize(editorStore: ReturnType<typeof useEditorStore>): { width: number, height: number } | null {
  const renderer = editorStore.clippa.stage.app?.renderer
  const canvas = editorStore.clippa.stage.app?.canvas

  const width = isFiniteNumber(renderer?.width)
    ? renderer.width
    : isFiniteNumber(canvas?.width)
      ? canvas.width
      : 0
  const height = isFiniteNumber(renderer?.height)
    ? renderer.height
    : isFiniteNumber(canvas?.height)
      ? canvas.height
      : 0

  if (width <= 0 || height <= 0)
    return null

  return {
    width,
    height,
  }
}

function generateId(prefix: string): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function')
    return `${prefix}-${crypto.randomUUID()}`

  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

function findTrainById(trains: Train[], id: string): Train | null {
  return trains.find(train => train.id === id) ?? null
}

function mapFilterConfigPatch(patch: Partial<FilterConfig>): ActionResult<Partial<FilterConfig>> {
  const keys = Object.keys(patch)
  if (keys.length === 0)
    return failure('INVALID_ARGUMENT', 'patch cannot be empty')

  const nextPatch: Partial<FilterConfig> = {}
  for (const key of keys) {
    if (!Object.prototype.hasOwnProperty.call(patch, key))
      continue

    const value = patch[key as keyof FilterConfig]
    if (!isFiniteNumber(value)) {
      return failure('INVALID_ARGUMENT', `patch.${key} must be a finite number`)
    }
    ;(nextPatch as Record<string, unknown>)[key] = value
  }

  if (Object.keys(nextPatch).length === 0)
    return failure('INVALID_ARGUMENT', 'patch cannot be empty')

  return success(nextPatch)
}

function clampTransitionDuration(
  inputDuration: number,
  limit: ReturnType<typeof computeTransitionMaxMs> | null,
): number {
  const base = Math.max(0, Math.round(inputDuration))
  if (!limit)
    return base

  return Math.min(limit.uiMax, Math.min(base, limit.maxMs))
}

function isMediaRandomOrientation(value: unknown): value is typeof RANDOM_MEDIA_ORIENTATION_VALUES[number] {
  return typeof value === 'string' && RANDOM_MEDIA_ORIENTATION_SET.has(value)
}

function mapMediaImportFailure(error: unknown, fallbackMessage: string): ActionResult<never> {
  if (error instanceof MediaStoreError) {
    if (error.code === 'INVALID_ARGUMENT')
      return failure('INVALID_ARGUMENT', error.message)
    return failure('NOT_READY', error.message)
  }

  if (error instanceof Error && error.message.trim().length > 0)
    return failure('NOT_READY', error.message.trim())

  return failure('NOT_READY', fallbackMessage)
}

export function createEditorControlRuntime(
  dependencies: EditorControlRuntimeDependencies = {},
): EditorControlRuntime {
  const editorStore = dependencies.editorStore ?? useEditorStore()
  const performerStore = dependencies.performerStore ?? usePerformerStore()
  const mediaStore = dependencies.mediaStore ?? useMediaStore()
  const filterStore = dependencies.filterStore ?? useFilterStore()
  const transitionStore = dependencies.transitionStore ?? useTransitionStore()
  const exportTaskStore = dependencies.exportTaskStore ?? useExportTaskStore()

  const listAllTrains = (): Train[] => {
    const rails = editorStore.clippa.timeline.rails?.rails ?? []
    return rails.flatMap(rail => rail.trains)
  }

  const mapPerformerType = (performer: ReturnType<typeof performerStore.getPerformerById>): PerformerSnapshot['type'] => {
    if (!performer)
      return 'unknown'

    if (performer instanceof Video)
      return 'video'
    if (performer instanceof Image)
      return 'image'
    if (performer instanceof Text)
      return 'text'

    return 'unknown'
  }

  const mapPerformerSnapshot = (performerId: string): PerformerSnapshot | null => {
    const performer = performerStore.getPerformerById(performerId)
    if (!performer)
      return null

    const bounds = performer.getBaseBounds()
    const source = (performer as { src?: string }).src
    const sourceStart = (performer as { sourceStart?: number }).sourceStart
    const sourceDuration = (performer as { sourceDuration?: number }).sourceDuration
    const selectedIds = new Set(performerStore.selectedPerformers.map(item => item.id))

    const snapshot: PerformerSnapshot = {
      id: performer.id,
      type: mapPerformerType(performer),
      startMs: performer.start,
      durationMs: performer.duration,
      zIndex: performer.zIndex,
      bounds,
      alpha: performer.sprite?.alpha ?? 1,
      animation: performerStore.getAnimation(performer.id),
      selected: selectedIds.has(performer.id),
    }

    if (typeof source === 'string')
      snapshot.source = source
    if (isFiniteNumber(sourceStart))
      snapshot.sourceStartMs = sourceStart
    if (isFiniteNumber(sourceDuration))
      snapshot.sourceDurationMs = sourceDuration

    if (performer instanceof Text) {
      snapshot.text = performer.getText()
      snapshot.textStyle = performer.getStyle()
    }

    return snapshot
  }

  const mapFilterLayerSnapshot = (layer: FilterLayer): FilterLayerSnapshot => {
    return {
      id: layer.id,
      name: layer.name,
      startMs: layer.start,
      durationMs: layer.duration,
      zIndex: layer.zIndex,
      config: cloneFilterConfig(layer.config),
      trainId: layer.train.id,
      version: layer.version,
      active: filterStore.activeLayerId === layer.id,
    }
  }

  const mapVideoAssetSnapshot = (file: (typeof mediaStore.videoFiles)[number]): MediaAssetSnapshot => {
    return {
      id: file.id,
      type: 'video',
      name: file.name,
      url: file.url,
      durationMs: file.duration,
      size: file.size,
      createdAt: file.createdAt?.getTime(),
    }
  }

  const mapImageAssetSnapshot = (file: (typeof mediaStore.imageFiles)[number]): MediaAssetSnapshot => {
    return {
      id: file.id,
      type: 'image',
      name: file.name,
      url: file.url,
      size: file.size,
      createdAt: file.createdAt?.getTime(),
    }
  }

  const collectMediaAssetSnapshots = (type: QueryMediaAssetsInput['type']): MediaAssetSnapshot[] => {
    const normalizedType = type ?? 'all'
    const assets: MediaAssetSnapshot[] = []

    if (normalizedType === 'all' || normalizedType === 'video')
      assets.push(...mediaStore.videoFiles.map(mapVideoAssetSnapshot))

    if (normalizedType === 'all' || normalizedType === 'image')
      assets.push(...mediaStore.imageFiles.map(mapImageAssetSnapshot))

    return assets
  }

  const resolveTransitionClip = (performerId: string) => {
    const performer = performerStore.getPerformerById(performerId)
    if (!performer)
      return null

    if (performer instanceof Video) {
      return {
        id: performer.id,
        start: performer.start,
        duration: performer.duration,
        type: 'video' as const,
        sourceStart: performer.sourceStart,
        sourceDuration: performer.sourceDuration,
      }
    }

    if (performer instanceof Image) {
      return {
        id: performer.id,
        start: performer.start,
        duration: performer.duration,
        type: 'image' as const,
      }
    }

    return null
  }

  const buildTransitionSnapshot = (transitionId: string): TransitionSnapshot | null => {
    const target = transitionStore.transitions.find(item => item.id === transitionId)
    if (!target)
      return null

    return {
      id: target.id,
      fromId: target.fromId,
      toId: target.toId,
      durationMs: target.durationMs,
      type: target.type,
      params: { ...target.params },
      active: transitionStore.activeTransitionId === target.id,
    }
  }

  const ensurePerformer = (
    performerId: string,
  ): ActionResult<NonNullable<ReturnType<typeof performerStore.getPerformerById>>> => {
    const performer = performerStore.getPerformerById(performerId)
    if (!performer)
      return failure('NOT_FOUND', `Performer not found: ${performerId}`)

    return success(performer)
  }

  const resolveTargetPerformerId = (explicitId?: string): ActionResult<string> => {
    if (explicitId && explicitId.trim().length > 0)
      return success(explicitId.trim())

    const selectedId = performerStore.selectedPerformers[0]?.id
    if (!selectedId)
      return failure('NOT_FOUND', 'No selected performer is available')

    return success(selectedId)
  }

  const removeEmptyRailsAndSyncDuration = (): void => {
    const rails = editorStore.clippa.timeline.rails
    if (!rails)
      return

    const emptyRails = rails.rails.filter(rail => rail.trains.length === 0)
    emptyRails.forEach(rail => rails.removeRail(rail))

    const nextDuration = rails.rails.reduce((maxValue, rail) => {
      return rail.trains.reduce((railMaxValue, train) => {
        return Math.max(railMaxValue, train.start + train.duration)
      }, maxValue)
    }, 0)

    if (nextDuration !== editorStore.clippa.timeline.duration)
      editorStore.clippa.timeline.updateDuration(nextDuration)
  }

  const moveTrainToRailByZIndex = (train: Train, zIndex: number): void => {
    const rails = editorStore.clippa.timeline.rails
    if (!rails)
      return

    const sourceRail = train.parent

    let targetRail = rails.getRailByZIndex(zIndex)
    if (!targetRail || !targetRail.canAcceptTrain(train))
      targetRail = rails.createRailByZIndex(zIndex, train.railStyle)

    sourceRail?.removeTrain(train)
    targetRail.insertTrain(train)

    if (sourceRail && sourceRail.trains.length === 0)
      rails.removeRail(sourceRail)
  }

  const resolveTransitionLimit = (fromId: string, toId: string) => {
    const fromClip = resolveTransitionClip(fromId)
    const toClip = resolveTransitionClip(toId)
    if (!fromClip || !toClip)
      return null

    return computeTransitionMaxMs(fromClip, toClip, DEFAULT_TRANSITION_DURATION)
  }

  const runtime: EditorControlRuntime = {
    queryProjectState() {
      const snapshot: ProjectStateSnapshot = {
        currentTimeMs: editorStore.currentTime,
        durationMs: editorStore.duration,
        isPlaying: editorStore.isPlaying,
        activeTrainId: editorStore.clippa.timeline.state.activeTrain?.id ?? null,
        selectedPerformerIds: performerStore.selectedPerformers.map(item => item.id),
        activeFilterLayerId: filterStore.activeLayerId,
        activeTransitionId: transitionStore.activeTransitionId,
        activeTransitionPairKey: transitionStore.activePairKey,
      }

      return success(snapshot)
    },

    queryMediaAssets(input: QueryMediaAssetsInput) {
      const type = input.type ?? 'all'
      const limit = Math.max(1, Math.min(300, Math.floor(input.limit ?? 300)))
      const assets = collectMediaAssetSnapshots(type)

      return success({
        assets: assets.slice(0, limit),
      })
    },

    queryPerformers(input: QueryPerformersInput) {
      const limit = Math.max(1, Math.min(300, Math.floor(input.limit ?? 300)))
      const onlySelected = input.onlySelected === true
      const includeOffscreen = input.includeOffscreen !== false
      const selectedIds = new Set(performerStore.selectedPerformers.map(item => item.id))

      const performers = performerStore
        .getAllPerformers()
        .filter((performer) => {
          if (onlySelected && !selectedIds.has(performer.id))
            return false

          if (includeOffscreen)
            return true

          return performer.start <= editorStore.currentTime
            && editorStore.currentTime < performer.start + performer.duration
        })
        .slice(0, limit)
        .map((performer) => {
          return mapPerformerSnapshot(performer.id)
        })
        .filter((item): item is PerformerSnapshot => item !== null)

      return success({ performers })
    },

    queryTimelineItems(input: QueryTimelineItemsInput) {
      const limit = Math.max(1, Math.min(500, Math.floor(input.limit ?? 500)))
      const activeTrain = editorStore.clippa.timeline.state.activeTrain
      const rails = editorStore.clippa.timeline.rails?.rails ?? []

      const items: TimelineItemSnapshot[] = rails
        .flatMap((rail) => {
          return rail.trains.map((train) => {
            return {
              id: train.id,
              railZIndex: rail.zIndex,
              startMs: train.start,
              durationMs: train.duration,
              trainType: train.constructor.name,
              label: (train as { label?: string }).label,
              active: activeTrain === train,
            }
          })
        })
        .sort((a, b) => {
          if (a.railZIndex !== b.railZIndex)
            return b.railZIndex - a.railZIndex
          return a.startMs - b.startMs
        })
        .slice(0, limit)

      return success({ items })
    },

    queryFilterLayers() {
      return success({
        layers: filterStore.layers.map(mapFilterLayerSnapshot),
      })
    },

    queryTransitionCandidates() {
      if (!TRANSITION_FEATURE_AVAILABLE)
        return failure('UNSUPPORTED', 'Transition feature is unavailable')

      const candidates = buildTransitionCandidates(editorStore.clippa.timeline)
        .map((candidate): TransitionCandidateSnapshot => {
          const pairKey = buildTransitionPairKey(candidate.fromId, candidate.toId)
          const existing = transitionStore.getTransitionByPair(candidate.fromId, candidate.toId)
          const limit = resolveTransitionLimit(candidate.fromId, candidate.toId)

          return {
            id: candidate.id,
            pairKey,
            railZIndex: candidate.railZIndex,
            fromId: candidate.fromId,
            toId: candidate.toId,
            cutTimeMs: candidate.cutTime,
            existingTransitionId: existing?.id ?? null,
            limit,
          }
        })

      return success({ candidates })
    },

    queryTransitions() {
      const transitions = transitionStore.transitions.map((transition) => {
        return {
          id: transition.id,
          fromId: transition.fromId,
          toId: transition.toId,
          durationMs: transition.durationMs,
          type: transition.type,
          params: { ...transition.params },
          active: transitionStore.activeTransitionId === transition.id,
        }
      })

      return success({ transitions })
    },

    async timelinePlay() {
      await editorStore.clippa.ready
      editorStore.clippa.play()
      return success({ isPlaying: true })
    },

    async timelinePause() {
      await editorStore.clippa.ready
      editorStore.clippa.pause()
      return success({ isPlaying: false })
    },

    async timelineSeek(input: TimelineSeekInput) {
      if (!isFiniteNumber(input.timeMs))
        return failure('INVALID_ARGUMENT', 'timeMs must be a finite number')

      await editorStore.clippa.ready
      const boundedTime = Math.max(0, Math.min(editorStore.duration, input.timeMs))
      editorStore.clippa.seek(boundedTime)

      if (!editorStore.isPlaying)
        await editorStore.clippa.director.seek(boundedTime)

      return success({ currentTimeMs: boundedTime })
    },

    async timelineSplitAtTime(input: TimelineSplitAtTimeInput) {
      await editorStore.clippa.ready

      const splitTime = isFiniteNumber(input.timeMs)
        ? input.timeMs
        : editorStore.currentTime
      const candidates = listAllTrains().filter((train) => {
        return splitTime > train.start && splitTime < train.start + train.duration
      })

      if (candidates.length === 0)
        return failure('NOT_FOUND', 'No splittable timeline item at current time')

      const affectedIds: string[] = []
      for (const train of candidates) {
        const performer = performerStore.getPerformerById(train.id)
        if (performer) {
          const leftDuration = splitTime - train.start
          const rightDuration = train.duration - leftDuration
          const bounds = performer.getBaseBounds()
          const crop = 'getCropInsets' in performer && typeof performer.getCropInsets === 'function'
            ? performer.getCropInsets() as CropInsets
            : undefined

          const rightConfig: PerformerConfig = performer instanceof Video
            ? {
                id: `${train.id}-split`,
                start: splitTime,
                duration: rightDuration,
                x: bounds.x,
                y: bounds.y,
                width: bounds.width,
                height: bounds.height,
                zIndex: performer.zIndex,
                src: performer.src,
                sourceStart: performer.sourceStart + leftDuration,
                sourceDuration: performer.sourceDuration,
                crop,
              }
            : performer instanceof Text
              ? {
                  id: `${train.id}-split`,
                  type: 'text',
                  start: splitTime,
                  duration: rightDuration,
                  x: bounds.x,
                  y: bounds.y,
                  width: bounds.width,
                  height: bounds.height,
                  zIndex: performer.zIndex,
                  content: performer.getText(),
                  style: performer.getStyle(),
                }
              : {
                  id: `${train.id}-split`,
                  type: 'image',
                  start: splitTime,
                  duration: rightDuration,
                  x: bounds.x,
                  y: bounds.y,
                  width: bounds.width,
                  height: bounds.height,
                  zIndex: performer.zIndex,
                  src: (performer as Image).src,
                  crop,
                }

          train.duration = leftDuration
          train.updateWidth(getPxByMs(leftDuration, editorStore.clippa.timeline.state.pxPerMs))
          performer.duration = leftDuration
          if (train instanceof VideoTrain) {
            train.refreshThumbnails().catch((error) => {
              console.warn('[ai-control] refresh thumbnails failed after split', error)
            })
          }

          const rightPerformer = performerStore.addPerformer(rightConfig)
          await editorStore.clippa.hire(rightPerformer)
          affectedIds.push(train.id)
          continue
        }

        const layer = filterStore.layers.find(item => item.train.id === train.id)
        if (!layer)
          continue

        const splitResult = filterStore.splitLayerByTrainId(train.id, splitTime)
        if (splitResult)
          affectedIds.push(train.id)
      }

      if (affectedIds.length === 0)
        return failure('NOT_FOUND', 'No supported timeline item is split at current time')

      if (!editorStore.isPlaying)
        await editorStore.clippa.director.seek(splitTime)

      return success({
        splitTimeMs: splitTime,
        affectedIds,
      })
    },

    async timelineDeleteActiveItem() {
      await editorStore.clippa.ready

      const activeTrain = editorStore.clippa.timeline.state.activeTrain
      if (!activeTrain)
        return failure('NOT_FOUND', 'No active timeline item to delete')

      const performer = performerStore.getPerformerById(activeTrain.id)
      if (performer) {
        performerStore.removePerformer(activeTrain.id)
        removeEmptyRailsAndSyncDuration()

        if (!editorStore.isPlaying)
          await editorStore.clippa.director.seek(editorStore.currentTime)

        return success({ deletedId: activeTrain.id })
      }

      const layer = filterStore.layers.find(item => item.train.id === activeTrain.id)
      if (!layer)
        return failure('NOT_FOUND', `Active timeline item not found: ${activeTrain.id}`)

      filterStore.removeLayer(layer.id)
      removeEmptyRailsAndSyncDuration()

      if (!editorStore.isPlaying)
        await editorStore.clippa.director.seek(editorStore.currentTime)

      return success({ deletedId: activeTrain.id })
    },

    async timelineSelectTrain(input: TimelineSelectTrainInput) {
      const trainId = input.trainId?.trim()
      if (!trainId)
        return failure('INVALID_ARGUMENT', 'trainId is required')

      await editorStore.clippa.ready
      const train = findTrainById(listAllTrains(), trainId)
      if (!train)
        return failure('NOT_FOUND', `Timeline train not found: ${trainId}`)

      train.updateActive(true)

      if (editorStore.currentTime < train.start || editorStore.currentTime > train.start + train.duration)
        editorStore.clippa.timeline.updateCurrentTime(Math.min(train.start, editorStore.duration))

      return success({ trainId })
    },

    async timelineClearSelection() {
      await editorStore.clippa.ready
      editorStore.clippa.timeline.state.activeTrain?.updateActive(false)
      return success({ cleared: true as const })
    },

    async mediaAddAssetToTimeline(input: MediaAddAssetToTimelineInput) {
      const assetId = input.assetId?.trim()
      if (!assetId)
        return failure('INVALID_ARGUMENT', 'assetId is required')

      await editorStore.clippa.ready

      const videoAsset = mediaStore.videoFiles.find(file => file.id === assetId)
      const imageAsset = mediaStore.imageFiles.find(file => file.id === assetId)
      if (!videoAsset && !imageAsset)
        return failure('NOT_FOUND', `Media asset not found: ${assetId}`)

      const startMs = isFiniteNumber(input.startMs)
        ? ensureNonNegativeNumber(input.startMs)
        : editorStore.currentTime
      const x = isFiniteNumber(input.x) ? input.x : 0
      const y = isFiniteNumber(input.y) ? input.y : 0
      const nextZIndex = isFiniteNumber(input.zIndex)
        ? Math.max(1, Math.floor(input.zIndex))
        : Math.max(1, (editorStore.clippa.timeline.rails?.maxZIndex ?? 0) + 1)

      if (videoAsset) {
        const metadata = await loadVideoMetadata(videoAsset.url)
        const stageWidth = editorStore.clippa.stage.app?.renderer.width ?? 0
        const stageHeight = editorStore.clippa.stage.app?.renderer.height ?? 0

        const performer = performerStore.addPerformer({
          id: generateId('video'),
          type: 'video',
          src: videoAsset.source,
          start: startMs,
          duration: isFiniteNumber(input.durationMs) && input.durationMs > 0
            ? input.durationMs
            : videoAsset.duration || metadata.duration || DEFAULT_VIDEO_DURATION_MS,
          sourceDuration: videoAsset.duration || metadata.duration || DEFAULT_VIDEO_DURATION_MS,
          width: metadata.width || stageWidth,
          height: metadata.height || stageHeight,
          x,
          y,
          zIndex: nextZIndex,
        })

        await editorStore.clippa.hire(performer)
        if (!editorStore.clippa.stage.performers.has(performer))
          editorStore.clippa.show(performer)

        performerStore.selectPerformer(performer.id)

        return success({
          performerId: performer.id,
          type: 'video' as const,
        })
      }

      const performer = performerStore.addPerformer({
        id: generateId('image'),
        type: 'image',
        src: imageAsset!.source,
        start: startMs,
        duration: isFiniteNumber(input.durationMs) && input.durationMs > 0
          ? input.durationMs
          : DEFAULT_IMAGE_DURATION_MS,
        x,
        y,
        zIndex: nextZIndex,
      })

      await editorStore.clippa.hire(performer)
      if (!editorStore.clippa.stage.performers.has(performer))
        editorStore.clippa.show(performer)

      performerStore.selectPerformer(performer.id)

      return success({
        performerId: performer.id,
        type: 'image' as const,
      })
    },

    mediaImportVideoFromUrl(input: MediaImportVideoFromUrlInput) {
      const url = input.url?.trim()
      if (!url)
        return failure('INVALID_ARGUMENT', 'url is required')

      try {
        const imported = mediaStore.addVideoFromUrl(url, asOptionalString(input.name))
        return success({
          asset: mapVideoAssetSnapshot(imported),
        })
      }
      catch (error) {
        const message = error instanceof Error && error.message.trim().length > 0
          ? error.message.trim()
          : '视频 URL 导入失败'
        return failure('INVALID_ARGUMENT', message)
      }
    },

    async mediaImportRandomImage(input: MediaImportRandomImageInput) {
      if (input.orientation !== undefined && !isMediaRandomOrientation(input.orientation)) {
        return failure(
          'INVALID_ARGUMENT',
          `orientation must be one of: ${RANDOM_MEDIA_ORIENTATION_VALUES.join(', ')}`,
        )
      }

      try {
        const imported = await mediaStore.importRandomImageFromPexels({
          query: asOptionalString(input.query),
          orientation: input.orientation,
          name: asOptionalString(input.name),
        })

        return success({
          asset: mapImageAssetSnapshot(imported),
        })
      }
      catch (error) {
        return mapMediaImportFailure(error, '随机图片导入失败')
      }
    },

    async mediaImportRandomVideo(input: MediaImportRandomVideoInput) {
      if (input.orientation !== undefined && !isMediaRandomOrientation(input.orientation)) {
        return failure(
          'INVALID_ARGUMENT',
          `orientation must be one of: ${RANDOM_MEDIA_ORIENTATION_VALUES.join(', ')}`,
        )
      }

      if (input.minDurationSec !== undefined) {
        if (!isFiniteNumber(input.minDurationSec))
          return failure('INVALID_ARGUMENT', 'minDurationSec must be a finite number')
        if (input.minDurationSec < 0)
          return failure('INVALID_ARGUMENT', 'minDurationSec must be >= 0')
      }

      if (input.maxDurationSec !== undefined) {
        if (!isFiniteNumber(input.maxDurationSec))
          return failure('INVALID_ARGUMENT', 'maxDurationSec must be a finite number')
        if (input.maxDurationSec < 0)
          return failure('INVALID_ARGUMENT', 'maxDurationSec must be >= 0')
      }

      if (
        input.minDurationSec !== undefined
        && input.maxDurationSec !== undefined
        && input.maxDurationSec < input.minDurationSec
      ) {
        return failure('INVALID_ARGUMENT', 'maxDurationSec must be >= minDurationSec')
      }

      try {
        const imported = await mediaStore.importRandomVideoFromPexels({
          query: asOptionalString(input.query),
          orientation: input.orientation,
          minDurationSec: input.minDurationSec,
          maxDurationSec: input.maxDurationSec,
          name: asOptionalString(input.name),
        })

        return success({
          asset: mapVideoAssetSnapshot(imported),
        })
      }
      catch (error) {
        return mapMediaImportFailure(error, '随机视频导入失败')
      }
    },

    mediaPickRandomAsset(input: MediaPickRandomAssetInput) {
      const requestedType = input.type ?? 'all'
      if (requestedType !== 'all' && requestedType !== 'video' && requestedType !== 'image')
        return failure('INVALID_ARGUMENT', 'type must be one of: all, video, image')

      const candidates = collectMediaAssetSnapshots(requestedType)
      if (candidates.length === 0)
        return failure('NOT_FOUND', 'No media assets available in library')

      const randomIndex = Math.floor(Math.random() * candidates.length)
      const pickedAsset = candidates[randomIndex]
      if (!pickedAsset)
        return failure('NOT_FOUND', 'No media assets available in library')

      return success({
        asset: pickedAsset,
      })
    },

    mediaRemoveAsset(input) {
      const assetId = input.assetId?.trim()
      if (!assetId)
        return failure('INVALID_ARGUMENT', 'assetId is required')

      const videoAsset = mediaStore.videoFiles.find(file => file.id === assetId)
      if (videoAsset) {
        mediaStore.removeVideoFile(assetId)
        return success({ assetId })
      }

      const imageAsset = mediaStore.imageFiles.find(file => file.id === assetId)
      if (imageAsset) {
        mediaStore.removeImageFile(assetId)
        return success({ assetId })
      }

      return failure('NOT_FOUND', `Media asset not found: ${assetId}`)
    },

    mediaClearLibrary(input) {
      const type = input.type ?? 'all'

      if (type === 'all' || type === 'video')
        mediaStore.clearVideoFiles()

      if (type === 'all' || type === 'image')
        mediaStore.clearImageFiles()

      return success({ type })
    },

    async createTextElement(input: CreateTextElementInput) {
      await editorStore.clippa.ready

      const stageSize = resolveStageSize(editorStore)
      if (!stageSize)
        return failure('NOT_READY', 'Canvas stage size is unavailable')

      const start = resolveSafeStartMs(input.startMs, editorStore.currentTime)
      const duration = resolveSafeDurationMs(input.durationMs)
      const content = resolveTextContent(input.content)
      const zIndex = Math.max(1, (editorStore.clippa.timeline.rails?.maxZIndex ?? 0) + 1)

      const xFromInput = resolveCoordinate(input.x)
      const yFromInput = resolveCoordinate(input.y)

      const nextPerformer = performerStore.addPerformer({
        id: generateId('text'),
        type: 'text',
        content,
        start,
        duration,
        x: xFromInput ?? 0,
        y: yFromInput ?? 0,
        zIndex,
        style: input.style,
      })
      if (!(nextPerformer instanceof Text))
        return failure('NOT_READY', 'Created performer has invalid shape')

      await nextPerformer.load?.()

      const currentBounds = nextPerformer.getBaseBounds()
      const nextX = xFromInput ?? Math.round((stageSize.width - currentBounds.width) / 2)
      const nextY = yFromInput ?? Math.round((stageSize.height - currentBounds.height) / 2)
      nextPerformer.setPosition(nextX, nextY)
      nextPerformer.update?.(editorStore.currentTime - nextPerformer.start)

      await editorStore.clippa.hire(nextPerformer)
      if (!editorStore.clippa.stage.performers.has(nextPerformer))
        editorStore.clippa.show(nextPerformer)

      performerStore.selectPerformer(nextPerformer.id)

      const snapshot = mapPerformerSnapshot(nextPerformer.id)
      if (!snapshot)
        return failure('NOT_FOUND', `Performer not found after create: ${nextPerformer.id}`)

      return success({
        created: true as const,
        selected: performerStore.selectedPerformers.some(item => item.id === nextPerformer.id),
        performer: snapshot,
      })
    },

    performerUpdateTransform(input: PerformerUpdateTransformInput) {
      const performerId = input.performerId?.trim()
      if (!performerId)
        return failure('INVALID_ARGUMENT', 'performerId is required')

      const performerResult = ensurePerformer(performerId)
      if (!performerResult.ok)
        return performerResult

      const updates: Record<string, unknown> = {}
      if (input.x !== undefined) {
        if (!isFiniteNumber(input.x))
          return failure('INVALID_ARGUMENT', 'x must be a finite number')
        updates.x = input.x
      }
      if (input.y !== undefined) {
        if (!isFiniteNumber(input.y))
          return failure('INVALID_ARGUMENT', 'y must be a finite number')
        updates.y = input.y
      }
      if (input.width !== undefined) {
        if (!isFiniteNumber(input.width) || input.width <= 0)
          return failure('INVALID_ARGUMENT', 'width must be a positive finite number')
        updates.width = input.width
      }
      if (input.height !== undefined) {
        if (!isFiniteNumber(input.height) || input.height <= 0)
          return failure('INVALID_ARGUMENT', 'height must be a positive finite number')
        updates.height = input.height
      }
      if (input.rotation !== undefined) {
        if (!isFiniteNumber(input.rotation))
          return failure('INVALID_ARGUMENT', 'rotation must be a finite number')
        updates.rotation = input.rotation
      }
      if (input.alpha !== undefined) {
        if (!isFiniteNumber(input.alpha))
          return failure('INVALID_ARGUMENT', 'alpha must be a finite number')
        updates.alpha = Math.max(0, Math.min(1, input.alpha))
      }
      if (input.zIndex !== undefined) {
        if (!isFiniteNumber(input.zIndex))
          return failure('INVALID_ARGUMENT', 'zIndex must be a finite number')
        updates.zIndex = Math.max(1, Math.floor(input.zIndex))
      }

      if (Object.keys(updates).length === 0)
        return failure('INVALID_ARGUMENT', 'At least one transform field must be provided')

      performerStore.updatePerformer(performerId, updates as any)

      if (updates.zIndex !== undefined) {
        const train = findTrainById(listAllTrains(), performerId)
        if (train)
          moveTrainToRailByZIndex(train, updates.zIndex as number)
      }

      const snapshot = mapPerformerSnapshot(performerId)
      if (!snapshot)
        return failure('NOT_FOUND', `Performer not found after update: ${performerId}`)

      return success({ performer: snapshot })
    },

    performerSelect(input: PerformerSelectInput) {
      const performerId = input.performerId?.trim()
      if (!performerId)
        return failure('INVALID_ARGUMENT', 'performerId is required')

      const performerResult = ensurePerformer(performerId)
      if (!performerResult.ok)
        return performerResult

      performerStore.selectPerformer(performerId)
      const train = findTrainById(listAllTrains(), performerId)
      train?.updateActive(true)

      return success({ performerId })
    },

    performerClearSelection() {
      performerStore.clearSelection()
      editorStore.clippa.timeline.state.activeTrain?.updateActive(false)
      return success({ cleared: true as const })
    },

    performerRemove(input: PerformerRemoveInput) {
      const performerId = input.performerId?.trim()
      if (!performerId)
        return failure('INVALID_ARGUMENT', 'performerId is required')

      const performerResult = ensurePerformer(performerId)
      if (!performerResult.ok)
        return performerResult

      performerStore.removePerformer(performerId)
      removeEmptyRailsAndSyncDuration()

      return success({ performerId })
    },

    performerUpdateTextContent(input: PerformerUpdateTextContentInput) {
      const performerIdResult = resolveTargetPerformerId(input.performerId)
      if (!performerIdResult.ok)
        return performerIdResult

      const content = asOptionalString(input.content)
      if (!content)
        return failure('INVALID_ARGUMENT', 'content must be a non-empty string')

      const performerResult = ensurePerformer(performerIdResult.data)
      if (!performerResult.ok)
        return performerResult

      const performer = performerResult.data
      if (!(performer instanceof Text))
        return failure('UNSUPPORTED', `Performer is not text: ${performer.id}`)

      performer.setText(content)

      const train = findTrainById(listAllTrains(), performer.id)
      if (train && 'label' in train) {
        ;(train as any).label = content
        train.updateWidth(train.width)
      }

      const snapshot = mapPerformerSnapshot(performer.id)
      if (!snapshot)
        return failure('NOT_FOUND', `Performer not found after text update: ${performer.id}`)

      return success({ performer: snapshot })
    },

    performerUpdateTextStyle(input: PerformerUpdateTextStyleInput) {
      const performerIdResult = resolveTargetPerformerId(input.performerId)
      if (!performerIdResult.ok)
        return performerIdResult

      if (!input.style || typeof input.style !== 'object')
        return failure('INVALID_ARGUMENT', 'style must be a valid object')

      const performerResult = ensurePerformer(performerIdResult.data)
      if (!performerResult.ok)
        return performerResult

      const performer = performerResult.data
      if (!(performer instanceof Text))
        return failure('UNSUPPORTED', `Performer is not text: ${performer.id}`)

      performer.setStyle(input.style)

      const train = findTrainById(listAllTrains(), performer.id)
      if (train && 'textColor' in train && input.style.fill !== undefined) {
        ;(train as any).textColor = input.style.fill
        train.updateWidth(train.width)
      }

      const snapshot = mapPerformerSnapshot(performer.id)
      if (!snapshot)
        return failure('NOT_FOUND', `Performer not found after style update: ${performer.id}`)

      return success({ performer: snapshot })
    },

    performerSetAnimation(input: PerformerSetAnimationInput) {
      const performerIdResult = resolveTargetPerformerId(input.performerId)
      if (!performerIdResult.ok)
        return performerIdResult

      const performerResult = ensurePerformer(performerIdResult.data)
      if (!performerResult.ok)
        return performerResult

      if (!input.animation || typeof input.animation !== 'object')
        return failure('INVALID_ARGUMENT', 'animation must be a valid object')

      performerStore.setAnimation(performerIdResult.data, input.animation)

      const snapshot = mapPerformerSnapshot(performerIdResult.data)
      if (!snapshot)
        return failure('NOT_FOUND', `Performer not found after animation update: ${performerIdResult.data}`)

      return success({ performer: snapshot })
    },

    performerClearAnimation(input: PerformerClearAnimationInput) {
      const performerIdResult = resolveTargetPerformerId(input.performerId)
      if (!performerIdResult.ok)
        return performerIdResult

      const performerResult = ensurePerformer(performerIdResult.data)
      if (!performerResult.ok)
        return performerResult

      performerStore.clearAnimation(performerIdResult.data)

      const snapshot = mapPerformerSnapshot(performerIdResult.data)
      if (!snapshot)
        return failure('NOT_FOUND', `Performer not found after animation clear: ${performerIdResult.data}`)

      return success({ performer: snapshot })
    },

    async filterCreateLayer(input: FilterCreateLayerInput) {
      await editorStore.clippa.ready
      filterStore.bindTimeline(editorStore.clippa.timeline)

      const preset = input.preset?.trim()
      if (!preset)
        return failure('INVALID_ARGUMENT', 'preset is required')

      const presetConfig = getFilterPresetConfig(preset)
      if (!presetConfig) {
        return failure('INVALID_ARGUMENT', `Unsupported filter preset: ${preset}`)
      }

      const layerName = asOptionalString(input.name) ?? getFilterPresetLabel(preset as FilterPresetValue)

      const start = isFiniteNumber(input.startMs)
        ? ensureNonNegativeNumber(input.startMs)
        : editorStore.currentTime
      const duration = isFiniteNumber(input.durationMs) && input.durationMs > 0
        ? input.durationMs
        : undefined

      const zIndex = isFiniteNumber(input.zIndex)
        ? Math.max(1, Math.floor(input.zIndex))
        : (() => {
            const overlapping = filterStore.layers.filter(
              layer => layer.start <= start && start < layer.start + layer.duration,
            )

            if (overlapping.length > 0)
              return Math.max(...overlapping.map(layer => layer.zIndex)) + 1

            const maxPerformerZ = editorStore.clippa.theater.performers
              .reduce((maxZ, performer) => Math.max(maxZ, performer.zIndex), 0)
            return maxPerformerZ + 1
          })()

      const layer = filterStore.createLayer({
        name: layerName,
        start,
        duration,
        zIndex,
        preset,
      })

      if (!layer)
        return failure('NOT_READY', 'Filter layer creation is unavailable before timeline binding')

      return success({
        layer: mapFilterLayerSnapshot(layer),
      })
    },

    filterSelectLayer(input) {
      const layerId = input.layerId?.trim()
      if (!layerId)
        return failure('INVALID_ARGUMENT', 'layerId is required')

      const exists = filterStore.layers.some(layer => layer.id === layerId)
      if (!exists)
        return failure('NOT_FOUND', `Filter layer not found: ${layerId}`)

      filterStore.selectLayer(layerId)
      return success({ layerId })
    },

    filterUpdateConfig(input) {
      const layerId = input.layerId?.trim()
      if (!layerId)
        return failure('INVALID_ARGUMENT', 'layerId is required')

      const layer = filterStore.layers.find(item => item.id === layerId)
      if (!layer)
        return failure('NOT_FOUND', `Filter layer not found: ${layerId}`)

      const patchResult = mapFilterConfigPatch(input.patch ?? {})
      if (!patchResult.ok)
        return patchResult

      filterStore.updateLayerConfig(layerId, patchResult.data)

      const nextLayer = filterStore.layers.find(item => item.id === layerId)
      if (!nextLayer)
        return failure('NOT_FOUND', `Filter layer not found after update: ${layerId}`)

      return success({
        layer: mapFilterLayerSnapshot(nextLayer),
      })
    },

    filterResetConfig(input) {
      const layerId = input.layerId?.trim()
      if (!layerId)
        return failure('INVALID_ARGUMENT', 'layerId is required')

      const layer = filterStore.layers.find(item => item.id === layerId)
      if (!layer)
        return failure('NOT_FOUND', `Filter layer not found: ${layerId}`)

      filterStore.resetLayerConfig(layerId)

      const nextLayer = filterStore.layers.find(item => item.id === layerId)
      if (!nextLayer)
        return failure('NOT_FOUND', `Filter layer not found after reset: ${layerId}`)

      return success({
        layer: mapFilterLayerSnapshot(nextLayer),
      })
    },

    filterUpdateZIndex(input) {
      const layerId = input.layerId?.trim()
      if (!layerId)
        return failure('INVALID_ARGUMENT', 'layerId is required')

      if (!isFiniteNumber(input.zIndex))
        return failure('INVALID_ARGUMENT', 'zIndex must be a finite number')

      const layer = filterStore.layers.find(item => item.id === layerId)
      if (!layer)
        return failure('NOT_FOUND', `Filter layer not found: ${layerId}`)

      filterStore.updateLayerZIndex(layerId, Math.max(1, Math.floor(input.zIndex)))
      const nextLayer = filterStore.layers.find(item => item.id === layerId)
      if (!nextLayer)
        return failure('NOT_FOUND', `Filter layer not found after zIndex update: ${layerId}`)

      return success({
        layer: mapFilterLayerSnapshot(nextLayer),
      })
    },

    filterRemoveLayer(input) {
      const layerId = input.layerId?.trim()
      if (!layerId)
        return failure('INVALID_ARGUMENT', 'layerId is required')

      const layer = filterStore.layers.find(item => item.id === layerId)
      if (!layer)
        return failure('NOT_FOUND', `Filter layer not found: ${layerId}`)

      filterStore.removeLayer(layerId)
      return success({ layerId })
    },

    transitionSelectPair(input) {
      if (!TRANSITION_FEATURE_AVAILABLE)
        return failure('UNSUPPORTED', 'Transition feature is unavailable')

      const fromId = input.fromId?.trim()
      const toId = input.toId?.trim()
      if (!fromId || !toId)
        return failure('INVALID_ARGUMENT', 'fromId and toId are required')

      const candidate = buildTransitionCandidates(editorStore.clippa.timeline)
        .find(item => item.fromId === fromId && item.toId === toId)
      if (!candidate)
        return failure('NOT_FOUND', `Transition candidate not found: ${fromId} -> ${toId}`)

      transitionStore.selectPair(fromId, toId, input.toggle === true)
      return success({
        pairKey: buildTransitionPairKey(fromId, toId),
      })
    },

    transitionUpsertByPair(input: TransitionUpsertByPairInput) {
      if (!TRANSITION_FEATURE_AVAILABLE)
        return failure('UNSUPPORTED', 'Transition feature is unavailable')

      const fromId = input.fromId?.trim()
      const toId = input.toId?.trim()
      if (!fromId || !toId)
        return failure('INVALID_ARGUMENT', 'fromId and toId are required')

      const candidate = buildTransitionCandidates(editorStore.clippa.timeline)
        .find(item => item.fromId === fromId && item.toId === toId)
      if (!candidate)
        return failure('NOT_FOUND', `Transition candidate not found: ${fromId} -> ${toId}`)

      const limit = resolveTransitionLimit(fromId, toId)
      const nextType = input.type?.trim() || DEFAULT_GL_TRANSITION_TYPE
      const nextDuration = clampTransitionDuration(
        isFiniteNumber(input.durationMs) ? input.durationMs : DEFAULT_TRANSITION_DURATION,
        limit,
      )

      const existing = transitionStore.getTransitionByPair(fromId, toId)
      if (existing) {
        transitionStore.updateTransition(existing.id, {
          type: nextType,
          durationMs: nextDuration,
          params: input.params ?? getGlTransitionDefaultParams(nextType),
        })

        transitionStore.selectTransition(existing.id)
        const snapshot = buildTransitionSnapshot(existing.id)
        if (!snapshot)
          return failure('NOT_FOUND', `Transition not found after update: ${existing.id}`)

        return success({ transition: snapshot })
      }

      const created = transitionStore.createTransition({
        fromId,
        toId,
        type: nextType,
        durationMs: nextDuration,
        params: input.params ?? getGlTransitionDefaultParams(nextType),
      })

      const snapshot = buildTransitionSnapshot(created.id)
      if (!snapshot)
        return failure('NOT_FOUND', `Transition not found after create: ${created.id}`)

      return success({ transition: snapshot })
    },

    transitionUpdate(input: TransitionUpdateInput) {
      if (!TRANSITION_FEATURE_AVAILABLE)
        return failure('UNSUPPORTED', 'Transition feature is unavailable')

      const transitionId = input.transitionId?.trim()
      if (!transitionId)
        return failure('INVALID_ARGUMENT', 'transitionId is required')

      const current = transitionStore.transitions.find(item => item.id === transitionId)
      if (!current)
        return failure('NOT_FOUND', `Transition not found: ${transitionId}`)

      const patch = input.patch ?? {}
      const nextPatch: Partial<Omit<TransitionSnapshot, 'id' | 'active'>> = {}

      const nextFromId = patch.fromId?.trim() || current.fromId
      const nextToId = patch.toId?.trim() || current.toId

      if (patch.fromId !== undefined || patch.toId !== undefined) {
        const candidate = buildTransitionCandidates(editorStore.clippa.timeline)
          .find(item => item.fromId === nextFromId && item.toId === nextToId)
        if (!candidate)
          return failure('NOT_FOUND', `Transition candidate not found: ${nextFromId} -> ${nextToId}`)
      }

      if (patch.fromId !== undefined)
        nextPatch.fromId = nextFromId
      if (patch.toId !== undefined)
        nextPatch.toId = nextToId

      if (patch.type !== undefined) {
        const nextType = patch.type.trim()
        if (!nextType)
          return failure('INVALID_ARGUMENT', 'patch.type must be a non-empty string')

        nextPatch.type = nextType
      }

      if (patch.durationMs !== undefined) {
        if (!isFiniteNumber(patch.durationMs))
          return failure('INVALID_ARGUMENT', 'patch.durationMs must be a finite number')

        const limit = resolveTransitionLimit(nextFromId, nextToId)
        nextPatch.durationMs = clampTransitionDuration(patch.durationMs, limit)
      }

      if (patch.params !== undefined) {
        if (!patch.params || typeof patch.params !== 'object')
          return failure('INVALID_ARGUMENT', 'patch.params must be an object')

        nextPatch.params = patch.params
      }
      else if (nextPatch.type && nextPatch.type !== current.type) {
        nextPatch.params = getGlTransitionDefaultParams(nextPatch.type)
      }

      transitionStore.updateTransition(transitionId, nextPatch)
      const snapshot = buildTransitionSnapshot(transitionId)
      if (!snapshot)
        return failure('NOT_FOUND', `Transition not found after update: ${transitionId}`)

      return success({ transition: snapshot })
    },

    transitionRemove(input: TransitionRemoveInput) {
      if (!TRANSITION_FEATURE_AVAILABLE)
        return failure('UNSUPPORTED', 'Transition feature is unavailable')

      const transitionId = input.transitionId?.trim()
      if (!transitionId)
        return failure('INVALID_ARGUMENT', 'transitionId is required')

      const existing = transitionStore.transitions.find(item => item.id === transitionId)
      if (!existing)
        return failure('NOT_FOUND', `Transition not found: ${transitionId}`)

      transitionStore.removeTransition(transitionId)
      return success({ transitionId })
    },

    transitionClearSelection() {
      if (!TRANSITION_FEATURE_AVAILABLE)
        return failure('UNSUPPORTED', 'Transition feature is unavailable')

      transitionStore.clearActiveSelection()
      return success({ cleared: true as const })
    },

    async exportStart(input: ExportStartInput) {
      if (exportTaskStore.status === 'exporting')
        return failure('CONFLICT', 'Export task is already running')

      try {
        const jobId = await exportTaskStore.startExport({
          frameRate: input.frameRate,
          filename: input.filename,
        })

        return success({ jobId })
      }
      catch (error) {
        const message = error instanceof Error
          ? error.message
          : 'Failed to start export task'
        return failure('NOT_READY', message)
      }
    },

    async exportCancel(input: ExportCancelInput) {
      try {
        await exportTaskStore.cancelExport(input.jobId)
        return success({ canceled: true as const })
      }
      catch (error) {
        const message = error instanceof Error
          ? error.message
          : 'Failed to cancel export task'
        return failure('NOT_READY', message)
      }
    },

    exportGetStatus() {
      return success(exportTaskStore.getStatus() as ExportStatusSnapshot)
    },
  }

  return runtime
}
