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
  <div w-full h-12 bg="#1e1e29" flex items-center justify-center gap-2>
    <!-- 快退按钮 -->
    <button
      flex items-center justify-center w-6 h-6 rounded hover:bg="#13131b" transition-all duration-200 border-none
      outline-none cursor-pointer group title="快退 10 秒 (←)" @click="handleRewind"
    >
      <div class="i-carbon-skip-back" text-xs text="#838398" group-hover:text-white transition-colors />
    </button>

    <!-- 播放/暂停按钮 -->
    <button
      flex items-center justify-center w-10 h-10 rounded-full bg="#13131b" hover:bg="#505067" hover:scale-110
      active:scale-95 transition-all duration-200 border-none outline-none cursor-pointer group relative overflow-hidden
      mx-2 :title="isPlaying ? '暂停 (空格)' : '播放 (空格)'" @click="togglePlayPause"
    >
      <div relative w-4 h-4>
        <div
          class="i-carbon-play" text-base text="#838398" group-hover:text-white absolute inset-0 transition-all
          duration-300 ease-in-out
          :class="isPlaying ? 'opacity-0 scale-75 rotate-90' : 'opacity-100 scale-100 rotate-0'"
        />
        <div
          class="i-carbon-pause" text-base text="#838398" group-hover:text-white absolute inset-0 transition-all
          duration-300 ease-in-out
          :class="!isPlaying ? 'opacity-0 scale-75 rotate-90' : 'opacity-100 scale-100 rotate-0'"
        />
      </div>
    </button>

    <!-- 快进按钮 -->
    <button
      flex items-center justify-center w-6 h-6 rounded hover:bg="#13131b" transition-all duration-200 border-none
      outline-none cursor-pointer group title="快进 10 秒 (→)" @click="handleFastForward"
    >
      <div class="i-carbon-skip-forward" text-xs text="#838398" group-hover:text-white transition-colors />
    </button>

    <div text-xs text="#838398" font-mono ml-2>
      {{ formattedCurrentTime }} / {{ formattedDuration }}
    </div>

    <!-- 全屏按钮 -->
    <button
      flex items-center justify-center w-6 h-6 rounded hover:bg="#13131b" transition-all duration-200 border-none
      outline-none cursor-pointer group ml-2 :title="isFullscreen ? '退出全屏 (Esc)' : '全屏播放 (F)'"
      @click="toggleFullscreen"
    >
      <div
        :class="isFullscreen ? 'i-carbon-minimize' : 'i-carbon-maximize'" text-xs text="#838398"
        group-hover:text-white transition-colors
      />
    </button>
  </div>
</template>
