<script setup lang="ts">
import type { DisplayTransitionCandidate } from '@/composables/useTransitionCandidates'
import { storeToRefs } from 'pinia'
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useTransitionCandidates } from '@/composables/useTransitionCandidates'
import { useEditorStore } from '@/store'
import { usePerformerStore } from '@/store/usePerformerStore'
import { useTransitionStore } from '@/store/useTransitionStore'
import { TRANSITION_FEATURE_AVAILABLE } from '@clippc/transition'

interface TransitionHandleLayout {
  candidate: DisplayTransitionCandidate
  x: number
  y: number
}

const editorStore = useEditorStore()
const performerStore = usePerformerStore()
const transitionStore = useTransitionStore()
const router = useRouter()
const siderCollapsed = useStorage('siderCollapsed', false)
const { clippa } = editorStore
const { activePairKey } = storeToRefs(transitionStore)
const {
  candidates,
} = useTransitionCandidates()
const transitionFeatureAvailable = TRANSITION_FEATURE_AVAILABLE

const layoutVersion = ref(0)
const hoveredPairKey = ref<string | null>(null)

function bumpLayoutVersion(): void {
  layoutVersion.value += 1
}

const handles = computed<TransitionHandleLayout[]>(() => {
  if (!transitionFeatureAvailable)
    return []

  void layoutVersion.value
  const rails = clippa.timeline.rails?.rails ?? []
  const result: TransitionHandleLayout[] = []

  candidates.value.forEach((candidate) => {
    const rail = rails.find(item => item.zIndex === candidate.railZIndex)
    if (!rail)
      return

    const fromTrain = rail.trains.find(item => item.id === candidate.fromId)
    if (!fromTrain)
      return

    const bounds = fromTrain.container.getBounds()
    result.push({
      candidate,
      x: bounds.x + bounds.width,
      y: bounds.y + bounds.height / 2,
    })
  })

  return result
})

function setHoveredPair(pairKey: string | null): void {
  hoveredPairKey.value = pairKey
}

function isHandleVisible(handle: TransitionHandleLayout): boolean {
  return hoveredPairKey.value === handle.candidate.pairKey
    || activePairKey.value === handle.candidate.pairKey
}

function clearTimelineSelection(): void {
  performerStore.clearSelection()
  performerStore.clearPendingSelectionDrag()
  clippa.timeline.state.activeTrain?.updateActive(false)
}

async function handleIconClick(handle: TransitionHandleLayout): Promise<void> {
  if (!transitionFeatureAvailable)
    return

  clearTimelineSelection()

  const toggledOff = activePairKey.value === handle.candidate.pairKey
  if (toggledOff) {
    transitionStore.clearActiveSelection()
    hoveredPairKey.value = null
    return
  }

  transitionStore.selectPair(handle.candidate.fromId, handle.candidate.toId)

  siderCollapsed.value = false
  await router.push('/editor/transition')
}

function resolveHandleClass(handle: TransitionHandleLayout): string {
  if (activePairKey.value === handle.candidate.pairKey)
    return 'bg-primary text-background border-primary'

  return 'bg-background text-foreground border-border hover:border-primary/80'
}

const candidateSignature = computed(() => {
  return candidates.value
    .map(item => `${item.pairKey}:${item.transitionId ?? 'none'}`)
    .join('|')
})

watch(candidateSignature, () => {
  bumpLayoutVersion()
  if (!hoveredPairKey.value)
    return

  const stillExists = candidates.value.some(item => item.pairKey === hoveredPairKey.value)
  if (!stillExists)
    hoveredPairKey.value = null
})

const handleTimelineScroll = (): void => bumpLayoutVersion()
const handleDurationChanged = (): void => bumpLayoutVersion()
const handleHire = (): void => bumpLayoutVersion()
const handlePxPerMsUpdated = (): void => bumpLayoutVersion()
const handleWindowResize = (): void => bumpLayoutVersion()

let disposed = false
onMounted(async () => {
  if (!transitionFeatureAvailable)
    return

  await clippa.ready
  if (disposed)
    return

  clippa.timeline.rails?.on('scroll', handleTimelineScroll)
  clippa.timeline.on('durationChanged', handleDurationChanged)
  clippa.timeline.state.on('updatedPxPerMs', handlePxPerMsUpdated)
  clippa.theater.on('hire', handleHire)
  window.addEventListener('resize', handleWindowResize)

  bumpLayoutVersion()
})

onUnmounted(() => {
  if (!transitionFeatureAvailable)
    return

  disposed = true
  clippa.timeline.rails?.off('scroll', handleTimelineScroll)
  clippa.timeline.off('durationChanged', handleDurationChanged)
  clippa.timeline.state.off('updatedPxPerMs', handlePxPerMsUpdated)
  clippa.theater.off('hire', handleHire)
  window.removeEventListener('resize', handleWindowResize)
  hoveredPairKey.value = null
})
</script>

<template>
  <div
    v-if="transitionFeatureAvailable"
    absolute inset-0 z-20 overflow-hidden pointer-events-none
    data-preserve-canvas-selection="true"
  >
    <template
      v-for="handle in handles"
      :key="handle.candidate.id"
    >
      <div
        data-preserve-canvas-selection="true"
        class="absolute pointer-events-auto -translate-x-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-transparent"
        :style="{ left: `${handle.x}px`, top: `${handle.y}px` }"
        @pointerenter="setHoveredPair(handle.candidate.pairKey)"
        @pointerleave="setHoveredPair(null)"
      />

      <button
        v-if="isHandleVisible(handle)"
        type="button"
        data-preserve-canvas-selection="true"
        class="absolute pointer-events-auto -translate-x-1/2 -translate-y-1/2 w-6 h-6 rounded-full border transition-colors shadow-sm flex items-center justify-center"
        :class="resolveHandleClass(handle)"
        :style="{ left: `${handle.x}px`, top: `${handle.y}px` }"
        @pointerenter="setHoveredPair(handle.candidate.pairKey)"
        @pointerleave="setHoveredPair(null)"
        @pointerdown.stop
        @click.stop="handleIconClick(handle)"
      >
        <span text="[9px]" leading-none font-semibold uppercase>fx</span>
      </button>
    </template>
  </div>
</template>
