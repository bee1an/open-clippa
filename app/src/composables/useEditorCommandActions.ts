import type {
  CreateTextElementInput,
  FilterCreateLayerInput,
  FilterRemoveLayerInput,
  FilterResetConfigInput,
  FilterSelectLayerInput,
  FilterUpdateConfigInput,
  FilterUpdateZIndexInput,
  MediaAddAssetToTimelineInput,
  PerformerClearAnimationInput,
  PerformerRemoveInput,
  PerformerSelectInput,
  PerformerSetAnimationInput,
  PerformerUpdateTextContentInput,
  PerformerUpdateTextStyleInput,
  PerformerUpdateTransformInput,
  TimelineSeekInput,
  TimelineSelectTrainInput,
  TimelineSplitAtTimeInput,
  TransitionRemoveInput,
  TransitionSelectPairInput,
  TransitionUpdateInput,
  TransitionUpsertByPairInput,
} from '@/ai/control/types'
import { createEditorControlRuntime } from '@/ai/control/runtime'

let sharedRuntime: ReturnType<typeof createEditorControlRuntime> | null = null

function resolveRuntime() {
  if (!sharedRuntime)
    sharedRuntime = createEditorControlRuntime()

  return sharedRuntime
}

async function callRuntime<T>(executor: () => Promise<T> | T): Promise<T> {
  return await Promise.resolve(executor())
}

export function useEditorCommandActions() {
  const runtime = resolveRuntime()

  return {
    runtime,
    timelinePlay: () => callRuntime(() => runtime.timelinePlay()),
    timelinePause: () => callRuntime(() => runtime.timelinePause()),
    timelineSeek: (input: TimelineSeekInput) => callRuntime(() => runtime.timelineSeek(input)),
    timelineSplitAtTime: (input: TimelineSplitAtTimeInput) => callRuntime(() => runtime.timelineSplitAtTime(input)),
    timelineDeleteActiveItem: () => callRuntime(() => runtime.timelineDeleteActiveItem()),
    timelineSelectTrain: (input: TimelineSelectTrainInput) => callRuntime(() => runtime.timelineSelectTrain(input)),
    timelineClearSelection: () => callRuntime(() => runtime.timelineClearSelection()),

    mediaAddAssetToTimeline: (input: MediaAddAssetToTimelineInput) => callRuntime(() => runtime.mediaAddAssetToTimeline(input)),

    createTextElement: (input: CreateTextElementInput) => callRuntime(() => runtime.createTextElement(input)),
    performerUpdateTransform: (input: PerformerUpdateTransformInput) => callRuntime(() => runtime.performerUpdateTransform(input)),
    performerSelect: (input: PerformerSelectInput) => callRuntime(() => runtime.performerSelect(input)),
    performerClearSelection: () => callRuntime(() => runtime.performerClearSelection()),
    performerRemove: (input: PerformerRemoveInput) => callRuntime(() => runtime.performerRemove(input)),
    performerUpdateTextContent: (input: PerformerUpdateTextContentInput) => callRuntime(() => runtime.performerUpdateTextContent(input)),
    performerUpdateTextStyle: (input: PerformerUpdateTextStyleInput) => callRuntime(() => runtime.performerUpdateTextStyle(input)),
    performerSetAnimation: (input: PerformerSetAnimationInput) => callRuntime(() => runtime.performerSetAnimation(input)),
    performerClearAnimation: (input: PerformerClearAnimationInput) => callRuntime(() => runtime.performerClearAnimation(input)),

    filterCreateLayer: (input: FilterCreateLayerInput) => callRuntime(() => runtime.filterCreateLayer(input)),
    filterSelectLayer: (input: FilterSelectLayerInput) => callRuntime(() => runtime.filterSelectLayer(input)),
    filterUpdateConfig: (input: FilterUpdateConfigInput) => callRuntime(() => runtime.filterUpdateConfig(input)),
    filterResetConfig: (input: FilterResetConfigInput) => callRuntime(() => runtime.filterResetConfig(input)),
    filterUpdateZIndex: (input: FilterUpdateZIndexInput) => callRuntime(() => runtime.filterUpdateZIndex(input)),
    filterRemoveLayer: (input: FilterRemoveLayerInput) => callRuntime(() => runtime.filterRemoveLayer(input)),

    transitionSelectPair: (input: TransitionSelectPairInput) => callRuntime(() => runtime.transitionSelectPair(input)),
    transitionUpsertByPair: (input: TransitionUpsertByPairInput) => callRuntime(() => runtime.transitionUpsertByPair(input)),
    transitionUpdate: (input: TransitionUpdateInput) => callRuntime(() => runtime.transitionUpdate(input)),
    transitionRemove: (input: TransitionRemoveInput) => callRuntime(() => runtime.transitionRemove(input)),
    transitionClearSelection: () => callRuntime(() => runtime.transitionClearSelection()),

    historyGetStatus: () => runtime.historyGetStatus(),
    historyUndo: () => callRuntime(() => runtime.historyUndo()),
    historyRedo: () => callRuntime(() => runtime.historyRedo()),
    historyBeginTransaction: (input?: { label?: string, source?: 'ui' | 'ai' | 'shortcut' | 'system', mergeKey?: string }) => runtime.historyBeginTransaction(input),
    historyEndTransaction: (transactionId?: string) => runtime.historyEndTransaction(transactionId),
    historyCancelTransaction: (transactionId?: string) => runtime.historyCancelTransaction(transactionId),
    historyCheckpoint: (input?: { label?: string, source?: 'ui' | 'ai' | 'shortcut' | 'system' }) => {
      return callRuntime(() => runtime.historyCheckpoint(input))
    },
  }
}
