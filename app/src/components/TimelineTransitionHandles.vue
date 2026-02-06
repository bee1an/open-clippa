<script setup lang="ts">
import type { DisplayTransitionCandidate } from '@/composables/useTransitionCandidates'
import type { TransitionSpec } from '@/store/useTransitionStore'
import { storeToRefs } from 'pinia'
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useTransitionCandidates } from '@/composables/useTransitionCandidates'
import { useEditorStore } from '@/store'
import { useTransitionStore } from '@/store/useTransitionStore'
import {
  DEFAULT_GL_TRANSITION_TYPE,
  GL_TRANSITION_PRESETS,
} from '@/utils/glTransitions'
import { buildTransitionPairKey, TRANSITION_FEATURE_AVAILABLE } from '@/utils/transition'

interface TransitionHandleLayout {
  candidate: DisplayTransitionCandidate
  x: number
  y: number
}

const editorStore = useEditorStore()
const transitionStore = useTransitionStore()
const { clippa } = editorStore
const { transitions } = storeToRefs(transitionStore)
const {
  candidates,
  applyTransitionType,
} = useTransitionCandidates()
const transitionFeatureAvailable = TRANSITION_FEATURE_AVAILABLE

const transitionTypeOptions = GL_TRANSITION_PRESETS.map(preset => ({
  value: preset.type,
  label: preset.name,
}))

const layoutVersion = ref(0)
const menuRef = ref<HTMLElement | null>(null)
const menuState = ref<{ pairKey: string, x: number, y: number } | null>(null)

function bumpLayoutVersion(): void {
  layoutVersion.value += 1
}

const transitionsByPair = computed(() => {
  const map = new Map<string, TransitionSpec>()
  transitions.value.forEach((transition) => {
    map.set(buildTransitionPairKey(transition.fromId, transition.toId), transition)
  })
  return map
})

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

const activeMenuCandidate = computed<DisplayTransitionCandidate | null>(() => {
  if (!transitionFeatureAvailable)
    return null

  if (!menuState.value)
    return null

  return candidates.value.find(item => item.pairKey === menuState.value!.pairKey) ?? null
})

const activeMenuTransition = computed<TransitionSpec | null>(() => {
  if (!activeMenuCandidate.value)
    return null

  return transitionsByPair.value.get(activeMenuCandidate.value.pairKey) ?? null
})

const activeMenuTransitionType = computed(() => {
  return activeMenuTransition.value?.type ?? DEFAULT_GL_TRANSITION_TYPE
})

const activeMenuStyle = computed(() => {
  if (!menuState.value)
    return {}

  const appWidth = clippa.timeline.app?.screen.width ?? 0
  const menuWidth = 220
  const left = appWidth
    ? Math.max(8, Math.min(menuState.value.x - menuWidth / 2, appWidth - menuWidth - 8))
    : menuState.value.x - menuWidth / 2

  return {
    left: `${left}px`,
    top: `${menuState.value.y + 22}px`,
    width: `${menuWidth}px`,
  }
})

function closeMenu(): void {
  menuState.value = null
}

function openMenu(handle: TransitionHandleLayout): void {
  if (!transitionFeatureAvailable)
    return

  menuState.value = {
    pairKey: handle.candidate.pairKey,
    x: handle.x,
    y: handle.y,
  }
}

function handleOptionClick(type: string): void {
  if (!activeMenuCandidate.value)
    return

  applyTransitionType(activeMenuCandidate.value, type)
  closeMenu()
}

function resolveTransitionForCandidate(candidate: DisplayTransitionCandidate): TransitionSpec | null {
  return transitionsByPair.value.get(candidate.pairKey) ?? null
}

function handleDocumentPointerDown(event: PointerEvent): void {
  if (!menuState.value)
    return

  const target = event.target as Node | null
  if (!target)
    return

  if (menuRef.value?.contains(target))
    return

  closeMenu()
}

const candidateSignature = computed(() => {
  return candidates.value
    .map(item => `${item.pairKey}:${item.transitionId ?? 'none'}`)
    .join('|')
})

watch(candidateSignature, () => {
  bumpLayoutVersion()
  if (!menuState.value)
    return

  const stillExists = candidates.value.some(item => item.pairKey === menuState.value?.pairKey)
  if (!stillExists)
    closeMenu()
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

  document.addEventListener('pointerdown', handleDocumentPointerDown, true)

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
  document.removeEventListener('pointerdown', handleDocumentPointerDown, true)
  clippa.timeline.rails?.off('scroll', handleTimelineScroll)
  clippa.timeline.off('durationChanged', handleDurationChanged)
  clippa.timeline.state.off('updatedPxPerMs', handlePxPerMsUpdated)
  clippa.theater.off('hire', handleHire)
  window.removeEventListener('resize', handleWindowResize)
  closeMenu()
})
</script>

<template>
  <div
    v-if="transitionFeatureAvailable"
    absolute inset-0 z-20 overflow-hidden pointer-events-none
    data-preserve-canvas-selection="true"
  >
    <button
      v-for="handle in handles"
      :key="handle.candidate.id"
      type="button"
      data-preserve-canvas-selection="true"
      class="absolute pointer-events-auto -translate-x-1/2 -translate-y-1/2 w-6 h-6 rounded-full border transition-colors shadow-sm flex items-center justify-center"
      :class="resolveTransitionForCandidate(handle.candidate)
        ? 'bg-primary text-background border-primary'
        : 'bg-background text-foreground border-border hover:border-primary/80'"
      :style="{ left: `${handle.x}px`, top: `${handle.y}px` }"
      @pointerdown.stop
      @click.stop="openMenu(handle)"
    >
      <span text="[9px]" leading-none font-semibold uppercase>fx</span>
    </button>

    <div
      v-if="menuState && activeMenuCandidate"
      ref="menuRef"
      data-preserve-canvas-selection="true"
      class="absolute pointer-events-auto rounded-md border border-border bg-background/95 backdrop-blur-sm p-2 shadow-lg space-y-1"
      :style="activeMenuStyle"
      @pointerdown.stop
      @click.stop
    >
      <div class="px-1 pb-1 border-b border-border/70">
        <div class="text-[11px] text-foreground-muted">
          {{ activeMenuCandidate.fromId }} → {{ activeMenuCandidate.toId }}
        </div>
        <div class="text-[10px] text-foreground-muted/80 mt-0.5">
          Choose transition algorithm
        </div>
      </div>

      <button
        v-for="option in transitionTypeOptions"
        :key="option.value"
        type="button"
        class="w-full text-left px-2 py-1.5 rounded text-xs transition-colors"
        :class="option.value === activeMenuTransitionType
          ? 'bg-primary/20 text-foreground'
          : 'hover:bg-secondary text-foreground-muted hover:text-foreground'"
        @click="handleOptionClick(option.value)"
      >
        {{ option.label }}
      </button>
    </div>
  </div>
</template>
