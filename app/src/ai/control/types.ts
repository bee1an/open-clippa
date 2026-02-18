import type { CropInsets, PerformerAnimationSpec, PerformerBounds, TextStyleOption } from '@clippc/performer'
import type { FilterConfig } from '@/store/useFilterStore'
import type { TransitionSpec } from '@/store/useTransitionStore'

export type ActionErrorCode
  = | 'INVALID_ARGUMENT'
    | 'NOT_FOUND'
    | 'NOT_READY'
    | 'UNSUPPORTED'
    | 'CONFLICT'

export interface ActionError {
  code: ActionErrorCode
  message: string
  details?: unknown
}

export type ActionResult<T = Record<string, unknown>>
  = | { ok: true, data: T }
    | { ok: false, error: ActionError }

export interface ProjectStateSnapshot {
  currentTimeMs: number
  durationMs: number
  isPlaying: boolean
  activeTrainId: string | null
  selectedPerformerIds: string[]
  activeFilterLayerId: string | null
  activeTransitionId: string | null
  activeTransitionPairKey: string | null
}

export type MediaAssetType = 'video' | 'image'

export interface MediaAssetSnapshot {
  id: string
  type: MediaAssetType
  name: string
  url: string
  durationMs?: number
  size?: number
  createdAt?: number
}

export type PerformerSnapshotType = 'video' | 'image' | 'text' | 'unknown'

export interface PerformerSnapshot {
  id: string
  type: PerformerSnapshotType
  startMs: number
  durationMs: number
  zIndex: number
  bounds: PerformerBounds
  alpha: number
  source?: string
  sourceStartMs?: number
  sourceDurationMs?: number
  crop?: CropInsets
  text?: string
  textStyle?: TextStyleOption
  animation?: PerformerAnimationSpec | null
  selected: boolean
}

export interface TimelineItemSnapshot {
  id: string
  railZIndex: number
  startMs: number
  durationMs: number
  trainType: string
  label?: string
  active: boolean
}

export interface FilterLayerSnapshot {
  id: string
  name: string
  startMs: number
  durationMs: number
  zIndex: number
  config: FilterConfig
  trainId: string
  version: number
  active: boolean
}

export interface TransitionCandidateSnapshot {
  id: string
  pairKey: string
  railZIndex: number
  fromId: string
  toId: string
  cutTimeMs: number
  existingTransitionId: string | null
  limit: {
    maxMs: number
    uiMax: number
    fromTail: number
    toHead: number
  } | null
}

export interface TransitionSnapshot {
  id: string
  fromId: string
  toId: string
  durationMs: number
  type: string
  params: Record<string, unknown>
  active: boolean
}

export type ExportTaskStatus = 'idle' | 'exporting' | 'error' | 'canceled' | 'done'

export interface ExportStatusSnapshot {
  status: ExportTaskStatus
  jobId: string | null
  currentFrame: number
  totalFrames: number
  progress: number
  previewUrl: string
  errorMessage: string
  result: {
    filename: string
    durationMs: number
    frameRate: number
  } | null
}

export interface QueryMediaAssetsInput {
  type?: MediaAssetType | 'all'
  limit?: number
}

export interface QueryPerformersInput {
  onlySelected?: boolean
  includeOffscreen?: boolean
  limit?: number
}

export interface QueryTimelineItemsInput {
  limit?: number
}

export interface MediaAddAssetToTimelineInput {
  assetId: string
  startMs?: number
  durationMs?: number
  x?: number
  y?: number
  zIndex?: number
}

export interface MediaImportVideoFromUrlInput {
  url: string
  name?: string
}

export type MediaRandomOrientation = 'landscape' | 'portrait' | 'square'

export interface MediaImportRandomImageInput {
  query?: string
  orientation?: MediaRandomOrientation
  name?: string
}

export interface MediaImportRandomVideoInput {
  query?: string
  orientation?: MediaRandomOrientation
  minDurationSec?: number
  maxDurationSec?: number
  name?: string
}

export interface MediaPickRandomAssetInput {
  type?: MediaAssetType | 'all'
}

export interface CreateTextElementInput {
  content?: string
  startMs?: number
  durationMs?: number
  x?: number
  y?: number
  style?: TextStyleOption
}

export interface MediaRemoveAssetInput {
  assetId: string
}

export interface MediaClearLibraryInput {
  type?: MediaAssetType | 'all'
}

export interface TimelineSeekInput {
  timeMs: number
}

export interface TimelineSplitAtTimeInput {
  timeMs?: number
}

export interface TimelineSelectTrainInput {
  trainId: string
}

export interface PerformerSelectInput {
  performerId: string
}

export interface PerformerRemoveInput {
  performerId: string
}

export interface PerformerUpdateTransformInput {
  performerId: string
  x?: number
  y?: number
  width?: number
  height?: number
  rotation?: number
  alpha?: number
  zIndex?: number
  crop?: Partial<CropInsets>
  clearCrop?: boolean
}

export interface PerformerUpdateTextContentInput {
  performerId?: string
  content: string
}

export interface PerformerUpdateTextStyleInput {
  performerId?: string
  style: TextStyleOption
}

export interface PerformerSetAnimationInput {
  performerId?: string
  animation: PerformerAnimationSpec
}

export interface PerformerClearAnimationInput {
  performerId?: string
}

export interface FilterCreateLayerInput {
  name?: string
  startMs?: number
  durationMs?: number
  zIndex?: number
  preset: string
}

export interface FilterSelectLayerInput {
  layerId: string
}

export interface FilterUpdateConfigInput {
  layerId: string
  patch: Partial<FilterConfig>
}

export interface FilterResetConfigInput {
  layerId: string
}

export interface FilterUpdateZIndexInput {
  layerId: string
  zIndex: number
}

export interface FilterRemoveLayerInput {
  layerId: string
}

export interface TransitionSelectPairInput {
  fromId: string
  toId: string
  toggle?: boolean
}

export interface TransitionUpsertByPairInput {
  fromId: string
  toId: string
  type?: string
  durationMs?: number
  params?: Record<string, unknown>
}

export interface TransitionUpdateInput {
  transitionId: string
  patch: Partial<Omit<TransitionSpec, 'id'>>
}

export interface TransitionRemoveInput {
  transitionId: string
}

export interface ExportStartInput {
  frameRate?: number
  filename?: string
}

export interface ExportCancelInput {
  jobId?: string
}

export interface EditorControlRuntime {
  queryProjectState: () => Promise<ActionResult<ProjectStateSnapshot>> | ActionResult<ProjectStateSnapshot>
  queryMediaAssets: (input: QueryMediaAssetsInput) => Promise<ActionResult<{ assets: MediaAssetSnapshot[] }>> | ActionResult<{ assets: MediaAssetSnapshot[] }>
  queryPerformers: (input: QueryPerformersInput) => Promise<ActionResult<{ performers: PerformerSnapshot[] }>> | ActionResult<{ performers: PerformerSnapshot[] }>
  queryTimelineItems: (input: QueryTimelineItemsInput) => Promise<ActionResult<{ items: TimelineItemSnapshot[] }>> | ActionResult<{ items: TimelineItemSnapshot[] }>
  queryFilterLayers: () => Promise<ActionResult<{ layers: FilterLayerSnapshot[] }>> | ActionResult<{ layers: FilterLayerSnapshot[] }>
  queryTransitionCandidates: () => Promise<ActionResult<{ candidates: TransitionCandidateSnapshot[] }>> | ActionResult<{ candidates: TransitionCandidateSnapshot[] }>
  queryTransitions: () => Promise<ActionResult<{ transitions: TransitionSnapshot[] }>> | ActionResult<{ transitions: TransitionSnapshot[] }>

  timelinePlay: () => Promise<ActionResult<{ isPlaying: boolean }>> | ActionResult<{ isPlaying: boolean }>
  timelinePause: () => Promise<ActionResult<{ isPlaying: boolean }>> | ActionResult<{ isPlaying: boolean }>
  timelineSeek: (input: TimelineSeekInput) => Promise<ActionResult<{ currentTimeMs: number }>> | ActionResult<{ currentTimeMs: number }>
  timelineSplitAtTime: (input: TimelineSplitAtTimeInput) => Promise<ActionResult<{ splitTimeMs: number, affectedIds: string[] }>> | ActionResult<{ splitTimeMs: number, affectedIds: string[] }>
  timelineDeleteActiveItem: () => Promise<ActionResult<{ deletedId: string }>> | ActionResult<{ deletedId: string }>
  timelineSelectTrain: (input: TimelineSelectTrainInput) => Promise<ActionResult<{ trainId: string }>> | ActionResult<{ trainId: string }>
  timelineClearSelection: () => Promise<ActionResult<{ cleared: true }>> | ActionResult<{ cleared: true }>

  mediaAddAssetToTimeline: (input: MediaAddAssetToTimelineInput) => Promise<ActionResult<{ performerId: string, type: MediaAssetType }>> | ActionResult<{ performerId: string, type: MediaAssetType }>
  mediaImportVideoFromUrl: (input: MediaImportVideoFromUrlInput) => Promise<ActionResult<{ asset: MediaAssetSnapshot }>> | ActionResult<{ asset: MediaAssetSnapshot }>
  mediaImportRandomImage: (input: MediaImportRandomImageInput) => Promise<ActionResult<{ asset: MediaAssetSnapshot }>> | ActionResult<{ asset: MediaAssetSnapshot }>
  mediaImportRandomVideo: (input: MediaImportRandomVideoInput) => Promise<ActionResult<{ asset: MediaAssetSnapshot }>> | ActionResult<{ asset: MediaAssetSnapshot }>
  mediaPickRandomAsset: (input: MediaPickRandomAssetInput) => Promise<ActionResult<{ asset: MediaAssetSnapshot }>> | ActionResult<{ asset: MediaAssetSnapshot }>
  mediaRemoveAsset: (input: MediaRemoveAssetInput) => Promise<ActionResult<{ assetId: string }>> | ActionResult<{ assetId: string }>
  mediaClearLibrary: (input: MediaClearLibraryInput) => Promise<ActionResult<{ type: MediaAssetType | 'all' }>> | ActionResult<{ type: MediaAssetType | 'all' }>

  createTextElement: (input: CreateTextElementInput) => Promise<ActionResult<{ created: true, selected: boolean, performer: PerformerSnapshot }>> | ActionResult<{ created: true, selected: boolean, performer: PerformerSnapshot }>
  performerUpdateTransform: (input: PerformerUpdateTransformInput) => Promise<ActionResult<{ performer: PerformerSnapshot }>> | ActionResult<{ performer: PerformerSnapshot }>
  performerSelect: (input: PerformerSelectInput) => Promise<ActionResult<{ performerId: string }>> | ActionResult<{ performerId: string }>
  performerClearSelection: () => Promise<ActionResult<{ cleared: true }>> | ActionResult<{ cleared: true }>
  performerRemove: (input: PerformerRemoveInput) => Promise<ActionResult<{ performerId: string }>> | ActionResult<{ performerId: string }>
  performerUpdateTextContent: (input: PerformerUpdateTextContentInput) => Promise<ActionResult<{ performer: PerformerSnapshot }>> | ActionResult<{ performer: PerformerSnapshot }>
  performerUpdateTextStyle: (input: PerformerUpdateTextStyleInput) => Promise<ActionResult<{ performer: PerformerSnapshot }>> | ActionResult<{ performer: PerformerSnapshot }>
  performerSetAnimation: (input: PerformerSetAnimationInput) => Promise<ActionResult<{ performer: PerformerSnapshot }>> | ActionResult<{ performer: PerformerSnapshot }>
  performerClearAnimation: (input: PerformerClearAnimationInput) => Promise<ActionResult<{ performer: PerformerSnapshot }>> | ActionResult<{ performer: PerformerSnapshot }>

  filterCreateLayer: (input: FilterCreateLayerInput) => Promise<ActionResult<{ layer: FilterLayerSnapshot }>> | ActionResult<{ layer: FilterLayerSnapshot }>
  filterSelectLayer: (input: FilterSelectLayerInput) => Promise<ActionResult<{ layerId: string }>> | ActionResult<{ layerId: string }>
  filterUpdateConfig: (input: FilterUpdateConfigInput) => Promise<ActionResult<{ layer: FilterLayerSnapshot }>> | ActionResult<{ layer: FilterLayerSnapshot }>
  filterResetConfig: (input: FilterResetConfigInput) => Promise<ActionResult<{ layer: FilterLayerSnapshot }>> | ActionResult<{ layer: FilterLayerSnapshot }>
  filterUpdateZIndex: (input: FilterUpdateZIndexInput) => Promise<ActionResult<{ layer: FilterLayerSnapshot }>> | ActionResult<{ layer: FilterLayerSnapshot }>
  filterRemoveLayer: (input: FilterRemoveLayerInput) => Promise<ActionResult<{ layerId: string }>> | ActionResult<{ layerId: string }>

  transitionSelectPair: (input: TransitionSelectPairInput) => Promise<ActionResult<{ pairKey: string }>> | ActionResult<{ pairKey: string }>
  transitionUpsertByPair: (input: TransitionUpsertByPairInput) => Promise<ActionResult<{ transition: TransitionSnapshot }>> | ActionResult<{ transition: TransitionSnapshot }>
  transitionUpdate: (input: TransitionUpdateInput) => Promise<ActionResult<{ transition: TransitionSnapshot }>> | ActionResult<{ transition: TransitionSnapshot }>
  transitionRemove: (input: TransitionRemoveInput) => Promise<ActionResult<{ transitionId: string }>> | ActionResult<{ transitionId: string }>
  transitionClearSelection: () => Promise<ActionResult<{ cleared: true }>> | ActionResult<{ cleared: true }>

  exportStart: (input: ExportStartInput) => Promise<ActionResult<{ jobId: string }>> | ActionResult<{ jobId: string }>
  exportCancel: (input: ExportCancelInput) => Promise<ActionResult<{ canceled: true }>> | ActionResult<{ canceled: true }>
  exportGetStatus: () => Promise<ActionResult<ExportStatusSnapshot>> | ActionResult<ExportStatusSnapshot>
}
