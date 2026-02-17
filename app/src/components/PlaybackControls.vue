<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { Slider } from '@/components/ui/slider'
import { useKeyboardShortcuts } from '@/composables/useKeyboardShortcuts'
import { useEditorStore } from '@/store'
import { useLayoutStore } from '@/store/useLayoutStore'

interface Props {
  compact?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  compact: false,
})

const editorStore = useEditorStore()
const layoutStore = useLayoutStore()
const { clippa } = editorStore
const { currentTime, duration } = storeToRefs(editorStore)
const { timelineHidden } = storeToRefs(layoutStore)

// 使用键盘快捷键 composable
const {
  isPlaying,
  isFullscreen,
  togglePlayPause,
  handleRewind,
  handleFastForward,
  toggleFullscreen,
  splitActiveTrain,
  canSplitAtCurrentTime,
  deleteActiveTrain,
} = useKeyboardShortcuts()

// track active train state for delete button visibility
const hasActiveTrain = ref(clippa.timeline.state.activeTrain !== null)
function handleActiveTrainChanged(train: unknown): void {
  hasActiveTrain.value = train !== null
}

onMounted(() => {
  clippa.timeline.state.on('activeTrainChanged', handleActiveTrainChanged)
})

onUnmounted(() => {
  clippa.timeline.state.off('activeTrainChanged', handleActiveTrainChanged)
})

// 时间格式化函数
function formatTime(ms: number) {
  const totalSeconds = Math.floor(ms / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
}

const formattedCurrentTime = computed(() => formatTime(currentTime.value))
const formattedDuration = computed(() => formatTime(duration.value))
const playbackProgress = computed(() => {
  if (duration.value <= 0)
    return 0

  return Math.min(100, Math.max(0, (currentTime.value / duration.value) * 100))
})

async function handleProgressInput(value: number): Promise<void> {
  if (duration.value <= 0)
    return

  const clampedValue = Math.min(100, Math.max(0, value))
  const nextTime = Math.round((clampedValue / 100) * duration.value)
  await clippa.seek(nextTime)
}

function toggleTimelineHidden(): void {
  layoutStore.toggleTimelineHidden()
}

// --- Zoom slider (logarithmic mapping) ---
const MIN_PX_PER_MS = 0.001
const MAX_PX_PER_MS = 1.0
const LOG_MIN = Math.log(MIN_PX_PER_MS)
const LOG_MAX = Math.log(MAX_PX_PER_MS)

function pxPerMsToSlider(pxPerMs: number): number {
  return (Math.log(pxPerMs) - LOG_MIN) / (LOG_MAX - LOG_MIN) * 100
}

function sliderToPxPerMs(value: number): number {
  return Math.exp(LOG_MIN + (value / 100) * (LOG_MAX - LOG_MIN))
}

const zoomSliderValue = ref(pxPerMsToSlider(clippa.timeline.state.pxPerMs))

// Sync from external zoom changes (e.g. Ctrl+wheel)
clippa.timeline.state.on('updatedPxPerMs', (pxPerMs: number) => {
  zoomSliderValue.value = pxPerMsToSlider(pxPerMs)
})

function handleZoomInput(value: number): void {
  const newPxPerMs = sliderToPxPerMs(value)
  clippa.timeline.state.updatePxPerMs(newPxPerMs)
  clippa.timeline.cursor?.updatePosition(clippa.timeline.currentTime)
}

const ZOOM_STEP = 5
function handleZoomStep(direction: 1 | -1): void {
  const next = Math.min(100, Math.max(0, zoomSliderValue.value + direction * ZOOM_STEP))
  handleZoomInput(next)
}

function handleZoomFit(): void {
  const viewportWidth = clippa.timeline.rails?.scrollBox.viewportWidth ?? 0
  const totalDuration = clippa.timeline.duration
  if (!viewportWidth || !totalDuration)
    return

  const fitPxPerMs = Math.min(MAX_PX_PER_MS, Math.max(MIN_PX_PER_MS, viewportWidth / totalDuration))
  clippa.timeline.state.updatePxPerMs(fitPxPerMs)
  clippa.timeline.rails?.scrollBox.scrollToX(0)
  clippa.timeline.cursor?.updatePosition(clippa.timeline.currentTime)
}
</script>

<template>
  <div
    w-full h-10 bg-background border-b border-border flex items-center justify-between px-4 select-none relative z-20
    data-preserve-canvas-selection="true"
  >
    <template v-if="props.compact">
      <div flex items-center gap-3 w-full>
        <button
          flex items-center justify-center w-7 h-7 rounded text-foreground hover:scale-110 transition-transform shrink-0
          :title="isPlaying ? '暂停 (空格)' : '播放 (空格)'"
          @click="togglePlayPause"
        >
          <div v-if="isPlaying" i-ph-pause-fill text-lg />
          <div v-else i-ph-play-fill text-lg ml-0.5 />
        </button>

        <Slider
          :model-value="playbackProgress"
          :min="0"
          :max="100"
          :step="0.1"
          :disabled="duration <= 0"
          size="sm"
          class="flex-1"
          @input="handleProgressInput"
        />

        <div font-mono text="[10px]" text-foreground-muted tracking-tight shrink-0>
          <span text-foreground>{{ formattedCurrentTime }}</span>
          <span mx-1 opacity-30>/</span>
          <span>{{ formattedDuration }}</span>
        </div>

        <button
          icon-btn-sm w-6 h-6 rounded hover:bg-secondary text-foreground-muted hover:text-foreground shrink-0
          :title="timelineHidden ? '显示时间轴' : '隐藏时间轴'"
          @click="toggleTimelineHidden"
        >
          <div
            :class="timelineHidden ? 'i-ph-caret-line-up-bold' : 'i-ph-caret-line-down-bold'"
            text-sm
          />
        </button>
      </div>
    </template>

    <template v-else>
      <!-- Left Section -->
      <div flex items-center gap-2 w="1/4">
        <button icon-btn-sm w-6 h-6 rounded hover:bg-secondary text-foreground-muted hover:text-foreground title="静音 (M)">
          <div i-ph-speaker-high-fill text-sm />
        </button>

        <button
          :disabled="!canSplitAtCurrentTime"
          flex items-center justify-center w-6 h-6 rounded hover:bg-secondary text-foreground-muted hover:text-foreground transition-colors
          disabled:opacity-30 disabled:pointer-events-none
          title="分割游尺位置的所有片段"
          @click="splitActiveTrain"
        >
          <div i-ph-scissors-bold text-sm />
        </button>

        <button
          :disabled="!hasActiveTrain"
          flex items-center justify-center w-6 h-6 rounded hover:bg-secondary text-foreground-muted hover:text-foreground transition-colors
          disabled:opacity-30 disabled:pointer-events-none
          title="删除选中片段 (Delete)"
          @click="deleteActiveTrain"
        >
          <div i-ph-trash-bold text-sm />
        </button>
      </div>

      <!-- Center Section: Transport Controls -->
      <div flex items-center justify-center gap-2 flex-1>
        <!-- Rewind -->
        <button
          flex items-center justify-center w-7 h-7 rounded hover:bg-secondary text-foreground-muted hover:text-foreground transition-colors
          title="快退 10 秒 (←)"
          @click="handleRewind"
        >
          <div i-ph-rewind-fill text-sm />
        </button>

        <!-- Play/Pause -->
        <button
          flex items-center justify-center w-6 h-6 rounded text-foreground hover:scale-110 transition-transform
          :title="isPlaying ? '暂停 (空格)' : '播放 (空格)'"
          @click="togglePlayPause"
        >
          <div v-if="isPlaying" i-ph-pause-fill text-lg />
          <div v-else i-ph-play-fill text-lg ml-0.5 />
        </button>

        <!-- Fast Forward -->
        <button
          flex items-center justify-center w-7 h-7 rounded hover:bg-secondary text-foreground-muted hover:text-foreground transition-colors
          title="快进 10 秒 (→)"
          @click="handleFastForward"
        >
          <div i-ph-fast-forward-fill text-sm />
        </button>
      </div>

      <!-- Right Section -->
      <div flex items-center justify-end gap-3 w="1/4">
        <!-- Zoom Slider -->
        <div flex items-center gap-1.5>
          <button
            flex items-center justify-center w-4 h-4 rounded text-foreground-muted hover:text-foreground transition-colors
            title="缩小"
            @click="handleZoomStep(-1)"
          >
            <div i-ph-minus-bold text="[10px]" />
          </button>
          <Slider
            :model-value="zoomSliderValue"
            :min="0"
            :max="100"
            :step="0.5"
            size="sm"
            tone="subtle"
            class="w-16"
            @input="handleZoomInput"
          />
          <button
            flex items-center justify-center w-4 h-4 rounded text-foreground-muted hover:text-foreground transition-colors
            title="放大"
            @click="handleZoomStep(1)"
          >
            <div i-ph-plus-bold text="[10px]" />
          </button>
          <button
            flex items-center justify-center w-4 h-4 rounded text-foreground-muted hover:text-foreground transition-colors
            title="适应全部"
            @click="handleZoomFit"
          >
            <div i-ph-arrows-horizontal-bold text="[10px]" />
          </button>
        </div>

        <!-- Timecode -->
        <div font-mono text="[10px]" text-foreground-muted tracking-tight>
          <span text-foreground>{{ formattedCurrentTime }}</span>
          <span mx-1 opacity-30>/</span>
          <span>{{ formattedDuration }}</span>
        </div>

        <!-- Hide Timeline -->
        <button
          icon-btn-sm w-6 h-6 rounded hover:bg-secondary text-foreground-muted hover:text-foreground
          :title="timelineHidden ? '显示时间轴' : '隐藏时间轴'"
          @click="toggleTimelineHidden"
        >
          <div
            :class="timelineHidden ? 'i-ph-caret-line-up-bold' : 'i-ph-caret-line-down-bold'"
            text-sm
          />
        </button>

        <!-- Fullscreen -->
        <button
          icon-btn-sm w-6 h-6 rounded hover:bg-secondary text-foreground-muted hover:text-foreground
          :title="isFullscreen ? '退出全屏 (Esc)' : '全屏播放 (F)'"
          @click="toggleFullscreen"
        >
          <div
            :class="isFullscreen ? 'i-ph-corners-in-bold' : 'i-ph-corners-out-bold'"
            text-sm
          />
        </button>
      </div>
    </template>
  </div>
</template>
