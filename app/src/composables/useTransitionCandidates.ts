import type {
  TransitionCandidate,
  TransitionCandidateSnapshot,
  TransitionClip,
} from '@clippc/transition'
import type { ComputedRef } from 'vue'
import {
  buildTransitionPairKey,
  DEFAULT_GL_TRANSITION_TYPE,
  getGlTransitionDefaultParams,
  TRANSITION_FEATURE_AVAILABLE,
  TransitionCandidateTracker,
} from '@clippc/transition'
import { Image, Video } from 'clippc'
import { storeToRefs } from 'pinia'
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useEditorStore } from '@/store'
import { usePerformerStore } from '@/store/usePerformerStore'
import { useTransitionStore } from '@/store/useTransitionStore'

export interface DisplayTransitionCandidate extends TransitionCandidate {
  pairKey: string
  transitionId: string | null
}

interface UseTransitionCandidatesResult {
  candidates: ComputedRef<DisplayTransitionCandidate[]>
  activeCandidate: ComputedRef<DisplayTransitionCandidate | null>
  getTransitionClip: (performerId: string) => TransitionClip | null
  applyTransitionType: (candidate: DisplayTransitionCandidate, transitionType: string) => void
}

export function useTransitionCandidates(): UseTransitionCandidatesResult {
  const editorStore = useEditorStore()
  const performerStore = usePerformerStore()
  const transitionStore = useTransitionStore()
  const { clippa } = editorStore
  const { transitions, activeTransition, activePairKey } = storeToRefs(transitionStore)

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

  const tracker = new TransitionCandidateTracker({
    timeline: clippa.timeline,
    resolveClip: getTransitionClip,
    getActivePairKey: () => activePairKey.value,
    clearActiveSelection: () => transitionStore.clearActiveSelection(),
  })

  const trackerSnapshot = ref<TransitionCandidateSnapshot>(tracker.getSnapshot())
  const unsubscribe = tracker.subscribe((snapshot) => {
    trackerSnapshot.value = snapshot
  })

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

    return trackerSnapshot.value.candidates.map((candidate) => {
      return {
        ...candidate,
        transitionId: transitionsByPair.value.get(candidate.pairKey) ?? null,
      }
    })
  })

  const activeCandidate = computed<DisplayTransitionCandidate | null>(() => {
    if (!TRANSITION_FEATURE_AVAILABLE)
      return null

    if (activePairKey.value)
      return candidates.value.find(candidate => candidate.pairKey === activePairKey.value) ?? null

    if (!activeTransition.value)
      return null

    const pairKey = buildTransitionPairKey(activeTransition.value.fromId, activeTransition.value.toId)
    return candidates.value.find(candidate => candidate.pairKey === pairKey) ?? null
  })

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

  let disposed = false
  onMounted(async () => {
    await clippa.ready
    if (disposed)
      return

    if (!TRANSITION_FEATURE_AVAILABLE)
      return

    tracker.start()
  })

  onUnmounted(() => {
    disposed = true
    unsubscribe()
    tracker.stop()
  })

  return {
    candidates,
    activeCandidate,
    getTransitionClip,
    applyTransitionType,
  }
}
