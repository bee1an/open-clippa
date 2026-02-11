import type { Rail, Train } from 'clippc'
import type { ComputedRef } from 'vue'
import type { TransitionCandidate, TransitionClip } from '@/utils/transition'
import { Image, Video } from 'clippc'
import { storeToRefs } from 'pinia'
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useEditorStore } from '@/store'
import { usePerformerStore } from '@/store/usePerformerStore'
import { useTransitionStore } from '@/store/useTransitionStore'
import {
  DEFAULT_GL_TRANSITION_TYPE,
  getGlTransitionDefaultParams,
} from '@/utils/glTransitions'
import {
  buildTransitionCandidates,
  buildTransitionPairKey,
  TRANSITION_FEATURE_AVAILABLE,
} from '@/utils/transition'

export interface DisplayTransitionCandidate extends TransitionCandidate {
  pairKey: string
  transitionId: string | null
}

interface UseTransitionCandidatesResult {
  candidates: ComputedRef<DisplayTransitionCandidate[]>
  activeCandidate: ComputedRef<DisplayTransitionCandidate | null>
  getTransitionClip: (performerId: string) => TransitionClip | null
  selectOrCreateTransition: (candidate: DisplayTransitionCandidate) => void
  applyTransitionType: (candidate: DisplayTransitionCandidate, transitionType: string) => void
}

export function useTransitionCandidates(): UseTransitionCandidatesResult {
  const editorStore = useEditorStore()
  const performerStore = usePerformerStore()
  const transitionStore = useTransitionStore()
  const { clippa } = editorStore
  const { transitions, activeTransition } = storeToRefs(transitionStore)

  const timelineVersion = ref(0)
  const railDisposers = new Map<Rail, () => void>()
  const trainDisposers = new Map<Train, () => void>()

  function bumpTimelineVersion(): void {
    timelineVersion.value += 1
  }

  function getTransitionClip(performerId: string): TransitionClip | null {
    const performer = performerStore.getPerformerById(performerId)
    if (!performer)
      return null

    if (performer instanceof Video) {
      return {
        id: performer.id,
        start: performer.start,
        duration: performer.duration,
        type: 'video',
        sourceStart: performer.sourceStart,
        sourceDuration: performer.sourceDuration,
      }
    }

    if (performer instanceof Image) {
      return {
        id: performer.id,
        start: performer.start,
        duration: performer.duration,
        type: 'image',
      }
    }

    return null
  }

  function bindTrain(train: Train): void {
    if (trainDisposers.has(train))
      return

    const handleAfterMove = (): void => bumpTimelineVersion()
    const handleMoveEnd = (): void => bumpTimelineVersion()
    const handleBeforeLeftResize = (): void => bumpTimelineVersion()
    const handleBeforeRightResize = (): void => bumpTimelineVersion()
    const handleRightResizeEnd = (): void => bumpTimelineVersion()

    train.on('afterMove', handleAfterMove)
    train.on('moveEnd', handleMoveEnd)
    train.on('beforeLeftResize', handleBeforeLeftResize)
    train.on('beforeRightResize', handleBeforeRightResize)
    train.on('rightResizeEnd', handleRightResizeEnd)

    trainDisposers.set(train, () => {
      train.off('afterMove', handleAfterMove)
      train.off('moveEnd', handleMoveEnd)
      train.off('beforeLeftResize', handleBeforeLeftResize)
      train.off('beforeRightResize', handleBeforeRightResize)
      train.off('rightResizeEnd', handleRightResizeEnd)
    })
  }

  function bindRail(rail: Rail): void {
    if (railDisposers.has(rail))
      return

    const handleInsertTrain = (train: Train): void => {
      bindTrain(train)
      bumpTimelineVersion()
    }

    rail.on('insertTrain', handleInsertTrain)
    rail.trains.forEach(bindTrain)

    railDisposers.set(rail, () => {
      rail.off('insertTrain', handleInsertTrain)
    })
  }

  function bindTimelineRails(): void {
    const rails = clippa.timeline.rails?.rails ?? []
    rails.forEach(bindRail)
    bumpTimelineVersion()
  }

  const transitionsByPair = computed(() => {
    const map = new Map<string, string>()
    transitions.value.forEach((transition) => {
      map.set(buildTransitionPairKey(transition.fromId, transition.toId), transition.id)
    })
    return map
  })

  const candidates = computed<DisplayTransitionCandidate[]>(() => {
    if (!TRANSITION_FEATURE_AVAILABLE)
      return []

    void timelineVersion.value
    const rawCandidates = buildTransitionCandidates(clippa.timeline)
    const result: DisplayTransitionCandidate[] = []

    rawCandidates.forEach((candidate) => {
      const from = getTransitionClip(candidate.fromId)
      const to = getTransitionClip(candidate.toId)
      if (!from || !to)
        return

      const pairKey = buildTransitionPairKey(candidate.fromId, candidate.toId)
      result.push({
        ...candidate,
        pairKey,
        transitionId: transitionsByPair.value.get(pairKey) ?? null,
      })
    })

    return result
  })

  const activeCandidate = computed<DisplayTransitionCandidate | null>(() => {
    if (!TRANSITION_FEATURE_AVAILABLE)
      return null

    if (!activeTransition.value)
      return null

    const pairKey = buildTransitionPairKey(activeTransition.value.fromId, activeTransition.value.toId)
    return candidates.value.find(candidate => candidate.pairKey === pairKey) ?? null
  })

  function selectOrCreateTransition(candidate: DisplayTransitionCandidate): void {
    if (!TRANSITION_FEATURE_AVAILABLE)
      return

    const existing = transitionStore.getTransitionByPair(candidate.fromId, candidate.toId)
    if (existing) {
      transitionStore.selectTransition(existing.id)
      return
    }

    transitionStore.createTransition({
      fromId: candidate.fromId,
      toId: candidate.toId,
      type: DEFAULT_GL_TRANSITION_TYPE,
      params: getGlTransitionDefaultParams(DEFAULT_GL_TRANSITION_TYPE),
    })
  }

  function applyTransitionType(candidate: DisplayTransitionCandidate, transitionType: string): void {
    if (!TRANSITION_FEATURE_AVAILABLE)
      return

    const nextType = transitionType || DEFAULT_GL_TRANSITION_TYPE
    const existing = transitionStore.getTransitionByPair(candidate.fromId, candidate.toId)
    if (existing) {
      transitionStore.updateTransition(existing.id, {
        type: nextType,
        params: getGlTransitionDefaultParams(nextType),
      })
      transitionStore.selectTransition(existing.id)
      return
    }

    transitionStore.createTransition({
      fromId: candidate.fromId,
      toId: candidate.toId,
      type: nextType,
      params: getGlTransitionDefaultParams(nextType),
    })
  }

  const handleDurationChanged = (): void => bindTimelineRails()
  const handleHire = (): void => bindTimelineRails()

  let disposed = false
  onMounted(async () => {
    await clippa.ready
    if (disposed)
      return
    if (!TRANSITION_FEATURE_AVAILABLE)
      return

    bindTimelineRails()
    clippa.timeline.on('durationChanged', handleDurationChanged)
    clippa.theater.on('hire', handleHire)
  })

  onUnmounted(() => {
    disposed = true
    clippa.timeline.off('durationChanged', handleDurationChanged)
    clippa.theater.off('hire', handleHire)

    railDisposers.forEach(dispose => dispose())
    railDisposers.clear()

    trainDisposers.forEach(dispose => dispose())
    trainDisposers.clear()
  })

  return {
    candidates,
    activeCandidate,
    getTransitionClip,
    selectOrCreateTransition,
    applyTransitionType,
  }
}
