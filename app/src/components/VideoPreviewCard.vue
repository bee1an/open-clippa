<script setup lang="ts">
import type { VideoFile } from '@/store'
import { ms2TimeStr, Video } from 'open-clippa'
import { useEditorStore, useMediaStore } from '@/store'

interface Props {
  videoFile: VideoFile
}

const props = defineProps<Props>()

const mediaStore = useMediaStore()
const editorStore = useEditorStore()
const { clippa } = editorStore

// 勾选状态
const isSelected = ref(false)

// 添加到时间轴
function addToTimeline() {
  const video = new Video({
    id: props.videoFile.id,
    src: props.videoFile.file,
    start: 0,
    duration: props.videoFile.duration,
    zIndex: clippa.timeline.rails!.maxZIndex + 1,
  })
  clippa.hire(video)
}

// 删除视频文件
function _removeVideo() {
  mediaStore.removeVideoFile(props.videoFile.id)
}

// 显示菜单
function _showMenu() {
  console.warn('Show menu for', props.videoFile.name)
}

// 切换勾选状态
function _toggleSelect() {
  isSelected.value = !isSelected.value
}
</script>

<template>
  <div class="group hover:bg-secondary" rounded-md p-2 w-full transition-colors cursor-pointer>
    <!-- 视频预览区 -->
    <div class="bg-black/50 border-border/50 group-hover:border-border" aspect-video rounded-md relative flex items-center justify-center overflow-hidden border transition-colors>
      <!-- 缩略图或默认图标 -->
      <img
        v-if="videoFile.thumbnail"
        :src="videoFile.thumbnail"
        :alt="videoFile.name"
        w-full h-full object-cover
      >
      <div v-else flex items-center justify-center w-full h-full text-foreground-muted>
        <div i-ph-video-camera-slash-duotone text-3xl opacity-50 />
      </div>

      <!-- 时间码 -->
      <div
        v-if="videoFile.duration > 0"
        group-hover:opacity-0
        text="xs foreground-muted"
        font-mono
        absolute bottom-1 right-1
        class="bg-black/60 backdrop-blur-sm"
        px-1.5 py-0.5 rounded-sm
        transition-opacity
      >
        {{ ms2TimeStr(videoFile.duration) }}
      </div>

      <!-- 悬浮操作层 -->
      <div
        absolute inset-0 class="bg-black/40" opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2
      >
        <!-- 添加到时间轴 -->
        <button
          w-8 h-8 rounded-full bg-primary text-background flex items-center justify-center
          hover:scale-110 active:scale-95 transition-all shadow-lg
          title="Add to timeline"
          @click.stop="addToTimeline"
        >
          <div i-ph-plus-bold text-lg />
        </button>
      </div>

      <!-- 右上角菜单按钮 -->
      <button
        opacity-0 group-hover:opacity-100
        absolute top-1 right-1
        w-6 h-6 rounded flex items-center justify-center
        class="bg-black/50 hover:bg-black/70" text-white
        transition-all
        @click.stop="_showMenu"
      >
        <div i-ph-dots-three-vert-bold text-sm />
      </button>
    </div>

    <!-- 文件信息栏 -->
    <div flex items-center justify-between mt-2 gap-2>
      <span
        text="xs foreground"
        font-medium
        truncate
        flex-1
        :title="videoFile.name"
      >
        {{ videoFile.name }}
      </span>

      <!-- 勾选框 - 简化为圆点 -->
      <button
        w-4 h-4 rounded-full class="border-border/50" border flex items-center justify-center
        hover:border-primary transition-colors
        :class="{ 'bg-primary border-primary': isSelected, 'bg-transparent': !isSelected }"
        @click.stop="_toggleSelect"
      >
        <div v-if="isSelected" i-ph-check-bold text="xs background" />
      </button>
    </div>
  </div>
</template>
