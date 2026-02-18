import type { AiToolDefinition } from '../../tooling/types'

export type EditorControlErrorCode
  = | 'INVALID_ARGUMENT'
    | 'NOT_FOUND'
    | 'NOT_READY'
    | 'UNSUPPORTED'
    | 'CONFLICT'

export interface EditorControlActionError {
  code: EditorControlErrorCode
  message: string
  details?: unknown
}

export type EditorControlActionResult<T = unknown>
  = | { ok: true, data: T }
    | { ok: false, error: EditorControlActionError }

export interface TransitionPatchInput {
  fromId?: string
  toId?: string
  durationMs?: number
  type?: string
  params?: Record<string, unknown>
}

export interface QueryMediaAssetsInput {
  type?: 'all' | 'video' | 'image'
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

export interface TimelineSeekInput {
  timeMs: number
}

export interface TimelineSplitAtTimeInput {
  timeMs?: number
}

export interface TimelineSelectTrainInput {
  trainId: string
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
  type?: 'all' | 'video' | 'image'
}

export interface MediaRemoveAssetInput {
  assetId: string
}

export interface MediaClearLibraryInput {
  type?: 'all' | 'video' | 'image'
}

export interface PerformerSelectInput {
  performerId: string
}

export interface PerformerRemoveInput {
  performerId: string
}

export interface EditorControlCreateTextStyle {
  fontFamily?: string | string[]
  fontSize?: number
  fontWeight?: 'normal' | 'bold' | 'bolder' | 'lighter' | number
  fontStyle?: 'normal' | 'italic' | 'oblique'
  fill?: string | number
  stroke?: {
    color?: string | number
    width?: number
  }
  align?: 'left' | 'center' | 'right'
  wordWrap?: boolean
  wordWrapWidth?: number
  lineHeight?: number
  letterSpacing?: number
  dropShadow?: {
    alpha?: number
    angle?: number
    blur?: number
    color?: string | number
    distance?: number
  }
}

export interface EditorControlCreateTextInput {
  content?: string
  startMs?: number
  durationMs?: number
  x?: number
  y?: number
  style?: EditorControlCreateTextStyle
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
  crop?: {
    left?: number
    top?: number
    right?: number
    bottom?: number
  }
  clearCrop?: boolean
}

export interface PerformerUpdateTextContentInput {
  performerId?: string
  content: string
}

export interface PerformerUpdateTextStyleInput {
  performerId?: string
  style: Record<string, unknown>
}

export interface PerformerSetAnimationInput {
  performerId?: string
  animation: Record<string, unknown>
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
  patch: Record<string, unknown>
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
  patch: TransitionPatchInput
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

export interface EditorControlAdapter {
  queryProjectState: () => EditorControlActionResult | Promise<EditorControlActionResult>
  queryMediaAssets: (input: QueryMediaAssetsInput) => EditorControlActionResult | Promise<EditorControlActionResult>
  queryPerformers: (input: QueryPerformersInput) => EditorControlActionResult | Promise<EditorControlActionResult>
  queryTimelineItems: (input: QueryTimelineItemsInput) => EditorControlActionResult | Promise<EditorControlActionResult>
  queryFilterLayers: () => EditorControlActionResult | Promise<EditorControlActionResult>
  queryTransitionCandidates: () => EditorControlActionResult | Promise<EditorControlActionResult>
  queryTransitions: () => EditorControlActionResult | Promise<EditorControlActionResult>

  timelinePlay: () => EditorControlActionResult | Promise<EditorControlActionResult>
  timelinePause: () => EditorControlActionResult | Promise<EditorControlActionResult>
  timelineSeek: (input: TimelineSeekInput) => EditorControlActionResult | Promise<EditorControlActionResult>
  timelineSplitAtTime: (input: TimelineSplitAtTimeInput) => EditorControlActionResult | Promise<EditorControlActionResult>
  timelineDeleteActiveItem: () => EditorControlActionResult | Promise<EditorControlActionResult>
  timelineSelectTrain: (input: TimelineSelectTrainInput) => EditorControlActionResult | Promise<EditorControlActionResult>
  timelineClearSelection: () => EditorControlActionResult | Promise<EditorControlActionResult>

  mediaAddAssetToTimeline: (input: MediaAddAssetToTimelineInput) => EditorControlActionResult | Promise<EditorControlActionResult>
  mediaImportVideoFromUrl: (input: MediaImportVideoFromUrlInput) => EditorControlActionResult | Promise<EditorControlActionResult>
  mediaImportRandomImage: (input: MediaImportRandomImageInput) => EditorControlActionResult | Promise<EditorControlActionResult>
  mediaImportRandomVideo: (input: MediaImportRandomVideoInput) => EditorControlActionResult | Promise<EditorControlActionResult>
  mediaPickRandomAsset: (input: MediaPickRandomAssetInput) => EditorControlActionResult | Promise<EditorControlActionResult>
  mediaRemoveAsset: (input: MediaRemoveAssetInput) => EditorControlActionResult | Promise<EditorControlActionResult>
  mediaClearLibrary: (input: MediaClearLibraryInput) => EditorControlActionResult | Promise<EditorControlActionResult>

  createTextElement: (input: EditorControlCreateTextInput) => EditorControlActionResult | Promise<EditorControlActionResult>
  performerUpdateTransform: (input: PerformerUpdateTransformInput) => EditorControlActionResult | Promise<EditorControlActionResult>
  performerSelect: (input: PerformerSelectInput) => EditorControlActionResult | Promise<EditorControlActionResult>
  performerClearSelection: () => EditorControlActionResult | Promise<EditorControlActionResult>
  performerRemove: (input: PerformerRemoveInput) => EditorControlActionResult | Promise<EditorControlActionResult>
  performerUpdateTextContent: (input: PerformerUpdateTextContentInput) => EditorControlActionResult | Promise<EditorControlActionResult>
  performerUpdateTextStyle: (input: PerformerUpdateTextStyleInput) => EditorControlActionResult | Promise<EditorControlActionResult>
  performerSetAnimation: (input: PerformerSetAnimationInput) => EditorControlActionResult | Promise<EditorControlActionResult>
  performerClearAnimation: (input: PerformerClearAnimationInput) => EditorControlActionResult | Promise<EditorControlActionResult>

  filterCreateLayer: (input: FilterCreateLayerInput) => EditorControlActionResult | Promise<EditorControlActionResult>
  filterSelectLayer: (input: FilterSelectLayerInput) => EditorControlActionResult | Promise<EditorControlActionResult>
  filterUpdateConfig: (input: FilterUpdateConfigInput) => EditorControlActionResult | Promise<EditorControlActionResult>
  filterResetConfig: (input: FilterResetConfigInput) => EditorControlActionResult | Promise<EditorControlActionResult>
  filterUpdateZIndex: (input: FilterUpdateZIndexInput) => EditorControlActionResult | Promise<EditorControlActionResult>
  filterRemoveLayer: (input: FilterRemoveLayerInput) => EditorControlActionResult | Promise<EditorControlActionResult>

  transitionSelectPair: (input: TransitionSelectPairInput) => EditorControlActionResult | Promise<EditorControlActionResult>
  transitionUpsertByPair: (input: TransitionUpsertByPairInput) => EditorControlActionResult | Promise<EditorControlActionResult>
  transitionUpdate: (input: TransitionUpdateInput) => EditorControlActionResult | Promise<EditorControlActionResult>
  transitionRemove: (input: TransitionRemoveInput) => EditorControlActionResult | Promise<EditorControlActionResult>
  transitionClearSelection: () => EditorControlActionResult | Promise<EditorControlActionResult>

  exportStart: (input: ExportStartInput) => EditorControlActionResult | Promise<EditorControlActionResult>
  exportCancel: (input: ExportCancelInput) => EditorControlActionResult | Promise<EditorControlActionResult>
  exportGetStatus: () => EditorControlActionResult | Promise<EditorControlActionResult>
}

export type EditorControlToolFactory = (adapter: EditorControlAdapter) => AiToolDefinition[]
