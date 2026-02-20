<script setup lang="ts">
import type { TimelineTransitionHandle } from 'clippc'
import { TRANSITION_FEATURE_AVAILABLE } from '@clippc/transition'
import { storeToRefs } from 'pinia'
import { computed, onMounted, onUnmounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useEditorCommandActions } from '@/composables/useEditorCommandActions'
import { useTransitionCandidates } from '@/composables/useTransitionCandidates'
import { useEditorStore } from '@/store'
import { useLayoutStore } from '@/store/useLayoutStore'
import { usePerformerStore } from '@/store/usePerformerStore'
import { useTransitionStore } from '@/store/useTransitionStore'

const editorStore = useEditorStore()
const performerStore = usePerformerStore()
const transitionStore = useTransitionStore()
const editorCommandActions = useEditorCommandActions()
const layoutStore = useLayoutStore()
const router = useRouter()
const { clippa } = editorStore
const { activePairKey } = storeToRefs(transitionStore)
const {
  candidates,
} = useTransitionCandidates()

const transitionFeatureAvailable = TRANSITION_FEATURE_AVAILABLE

const timelineHandles = computed<TimelineTransitionHandle[]>(() => {
  if (!transitionFeatureAvailable)
    return []

  return candidates.value.map(candidate => ({
    id: candidate.id,
    pairKey: candidate.pairKey,
    fromId: candidate.fromId,
    toId: candidate.toId,
    railZIndex: candidate.railZIndex,
  }))
})

function clearTimelineSelection(): void {
  void editorCommandActions.performerClearSelection()
  performerStore.clearPendingSelectionDrag()
  clippa.timeline.state.activeTrain?.updateActive(false)
}

async function openTransitionPanel(handle: TimelineTransitionHandle): Promise<void> {
  clearTimelineSelection()

  const toggledOff = activePairKey.value === handle.pairKey
  if (toggledOff) {
    void editorCommandActions.transitionClearSelection()
    return
  }

  await editorCommandActions.transitionSelectPair({
    fromId: handle.fromId,
    toId: handle.toId,
  })

  layoutStore.setSiderCollapsed(false)
  await router.push('/editor/transition')
}

function handleTimelineTransitionClick(handle: TimelineTransitionHandle): void {
  void openTransitionPanel(handle)
}

watch(
  timelineHandles,
  (handles) => {
    clippa.timeline.setTransitionHandles(handles)
  },
  {
    immediate: true,
  },
)

watch(
  activePairKey,
  (pairKey) => {
    clippa.timeline.setActiveTransitionPairKey(pairKey)
  },
  {
    immediate: true,
  },
)

let disposed = false
onMounted(async () => {
  await clippa.ready
  if (disposed)
    return

  if (!transitionFeatureAvailable)
    return

  clippa.timeline.on('transitionHandleClick', handleTimelineTransitionClick)
})

onUnmounted(() => {
  disposed = true
  if (transitionFeatureAvailable)
    clippa.timeline.off('transitionHandleClick', handleTimelineTransitionClick)

  clippa.timeline.setTransitionHandles([])
  clippa.timeline.setActiveTransitionPairKey(null)
})
</script>

<template>
  <div v-if="false" />
</template>
