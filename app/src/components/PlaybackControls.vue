<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { useKeyboardShortcuts } from '@/composables/useKeyboardShortcuts'
import { useEditorStore } from '@/store'

const editorStore = useEditorStore()
const { currentTime, duration } = storeToRefs(editorStore)

// 使用键盘快捷键 composable
const {
  isPlaying,
  isFullscreen,
  togglePlayPause,
  handleRewind,
  handleFastForward,
  toggleFullscreen,
} = useKeyboardShortcuts()

// 时间格式化函数
function formatTime(ms: number) {
  const totalSeconds = Math.floor(ms / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
}

const formattedCurrentTime = computed(() => formatTime(currentTime.value))
const formattedDuration = computed(() => formatTime(duration.value))
</script>

<template>
  <div w-full h-10 bg-background border-b border-border flex items-center justify-between px-4 select-none relative z-20>
    <!-- Left Section -->
    <div flex items-center gap-2 w="1/4">
      <button icon-btn-sm w-6 h-6 rounded hover:bg-secondary text-foreground-muted hover:text-foreground title="静音 (M)">
        <div i-ph-speaker-high-fill text-sm />
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
      <!-- Timecode -->
      <div font-mono text="[10px]" text-foreground-muted tracking-tight>
        <span text-foreground>{{ formattedCurrentTime }}</span>
        <span mx-1 opacity-30>/</span>
        <span>{{ formattedDuration }}</span>
      </div>

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
  </div>
</template>
