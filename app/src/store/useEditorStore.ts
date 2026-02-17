import type { CanvasSize } from 'clippc'
import {
  CANVAS_PRESETS,
  Clippa,
  DEFAULT_CANVAS_PRESET_ID,
  resolveCanvasSizeByPresetId,
} from 'clippc'
import { defineStore } from 'pinia'

type TransitionFrameSyncer = () => Promise<void> | void

export const useEditorStore = defineStore('editor', () => {
  const clippa = markRaw(new Clippa())
  const canvasPresets = CANVAS_PRESETS
  const canvasPresetId = ref(DEFAULT_CANVAS_PRESET_ID)
  const canvasSize = ref<CanvasSize>(resolveCanvasSizeByPresetId(canvasPresetId.value))

  const currentTime = ref(0)
  clippa.director.on('updateCurrentTime', (time) => {
    currentTime.value = time
  })

  const duration = ref(0)
  clippa.timeline.on('durationChanged', (time) => {
    duration.value = time
  })

  // 播放状态
  const isPlaying = ref(false)
  clippa.timeline.on('play', () => {
    isPlaying.value = true
  })
  clippa.timeline.on('pause', () => {
    isPlaying.value = false
  })

  // 选中视频
  const selectedVideo = ref<any>(null)

  let transitionFrameSyncer: TransitionFrameSyncer | null = null

  function registerTransitionFrameSyncer(syncer: TransitionFrameSyncer | null): void {
    transitionFrameSyncer = syncer
  }

  async function syncTransitionFrame(): Promise<void> {
    if (!transitionFrameSyncer)
      return

    await transitionFrameSyncer()
  }

  function setCanvasPreset(presetId: string): void {
    const nextSize = resolveCanvasSizeByPresetId(presetId)
    const normalizedPresetId = canvasPresets.find(item => item.id === presetId)?.id ?? DEFAULT_CANVAS_PRESET_ID
    canvasPresetId.value = normalizedPresetId
    canvasSize.value = nextSize
  }

  return {
    clippa,
    canvasPresets,
    canvasPresetId,
    canvasSize,
    currentTime,
    duration,
    isPlaying,
    selectedVideo,
    registerTransitionFrameSyncer,
    syncTransitionFrame,
    setCanvasPreset,
  }
})
