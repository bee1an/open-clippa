import {
  TRANSITION_FEATURE_AVAILABLE,
  TransitionRuntime,
} from '@clippc/transition'
import { storeToRefs } from 'pinia'
import { onMounted, onUnmounted, watch } from 'vue'
import { useEditorStore } from '@/store'
import { usePerformerStore } from '@/store/usePerformerStore'
import { useTransitionStore } from '@/store/useTransitionStore'

interface TransitionEngineOptions {
  fragmentShader?: string
}

export function useTransitionEngine(options: TransitionEngineOptions = {}): void {
  if (!TRANSITION_FEATURE_AVAILABLE)
    return

  const editorStore = useEditorStore()
  const performerStore = usePerformerStore()
  const transitionStore = useTransitionStore()
  const { clippa } = editorStore
  const { currentTime, isPlaying } = storeToRefs(editorStore)
  const { transitions, transitionsSignature } = storeToRefs(transitionStore)

  const runtime = new TransitionRuntime({
    ready: clippa.ready,
    timeline: clippa.timeline,
    getCurrentTime: () => currentTime.value,
    isPlaying: () => isPlaying.value,
    getTransitions: () => transitions.value,
    getPerformerById: performerId => performerStore.getPerformerById(performerId),
    getPerformers: () => clippa.theater.performers,
    getApp: () => clippa.stage.app,
    onTimelineDurationChanged: (handler) => {
      clippa.timeline.on('durationChanged', handler)
      return () => clippa.timeline.off('durationChanged', handler)
    },
    onPerformerHire: (handler) => {
      clippa.theater.on('hire', handler)
      return () => clippa.theater.off('hire', handler)
    },
  }, {
    fragmentShader: options.fragmentShader,
  })

  let disposed = false
  onMounted(async () => {
    await runtime.start()
    if (disposed)
      return

    editorStore.registerTransitionFrameSyncer(() => runtime.syncFrame())
  })

  onUnmounted(() => {
    disposed = true
    editorStore.registerTransitionFrameSyncer(null)
    runtime.stop()
  })

  watch(
    () => [currentTime.value, transitionsSignature.value, transitions.value.length],
    () => {
      runtime.requestRender()
    },
    { immediate: true },
  )
}
