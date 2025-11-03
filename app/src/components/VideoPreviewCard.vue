<script setup lang="ts">
import type { VideoFile } from '@/store/useMediaStore'
import { Video } from 'open-clippa'
import { useEditorStore } from '@/store'
import { useMediaStore } from '@/store/useMediaStore'

interface Props {
  videoFile: VideoFile
}

const props = defineProps<Props>()

// 预览视频
const emit = defineEmits<{
  preview: [videoFile: VideoFile]
}>()
const mediaStore = useMediaStore()
const editorStore = useEditorStore()
const { clippa } = editorStore

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
function removeVideo() {
  mediaStore.removeVideoFile(props.videoFile.id)
}

function previewVideo() {
  emit('preview', props.videoFile)
}
</script>

<template>
  <div
    cursor-pointer
    min-w="180px"
    max-w="220px"
    bg="#13131b"
    rounded-lg
    p-3
    border="#2a2a3a"
    hover="border-blue-500 bg-[#1a1a2e]"
    transition="all duration-200"
    @click="previewVideo"
  >
    <!-- 缩略图区域 -->
    <div
      relative
      mb-3
      rounded
      overflow-hidden
      bg="#0a0a0f"
      :style="{
        background: `linear-gradient(45deg, #0a0a0f 25%, transparent 25%), linear-gradient(-45deg, #0a0a0f 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #0a0a0f 75%), linear-gradient(-45deg, transparent 75%, #0a0a0f 75%)`,
        backgroundSize: '20px 20px',
        backgroundPosition: '0 0, 0 10px, 10px -10px, -10px 0px',
      }"
    >
      <div aspect-video w-full>
        <img
          v-if="videoFile.thumbnail"
          :src="videoFile.thumbnail"
          :alt="videoFile.name"
          w-full
          h-full
          object-cover
        >
        <div
          v-else
          flex
          items-center
          justify-center
          text-gray-500
          w-full
          h-full
          :style="{
            background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
          }"
        >
          <div i-carbon-video text-2xl />
        </div>
      </div>

      <!-- 时长显示 -->
      <div
        v-if="videoFile.duration > 0"
        absolute
        bottom-2
        right-2
        px-2
        py-1
        rounded
        text-xs
        font-mono
        text-white
        bg="black/70"
        :style="{
          backdropFilter: 'blur(4px)',
          fontVariantNumeric: 'tabular-nums',
        }"
      >
        {{ mediaStore.formatDuration(videoFile.duration) }}
      </div>

      <!-- 操作按钮 -->
      <div
        absolute
        top-2
        right-2
        opacity-0
        group-hover:opacity-100
        flex
        gap-1
        transition-opacity
        duration-200
      >
        <button
          class="bg-black/60 hover:bg-blue-600/80"
          flex items-center justify-center text-white text-xs rounded transition-all duration-200
          w-6
          h-6
          :style="{
            backdropFilter: 'blur(4px)',
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.3)',
          }"
          title="添加到时间轴"
          @click.stop="addToTimeline"
        >
          <div i-carbon-add />
        </button>

        <button
          class="bg-black/60 hover:bg-red-600/80"
          flex items-center justify-center text-white text-xs rounded transition-all duration-200
          w-6
          h-6
          :style="{
            backdropFilter: 'blur(4px)',
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.3)',
          }"
          title="删除视频"
          @click.stop="removeVideo"
        >
          <div i-carbon-trash-can />
        </button>
      </div>
    </div>

    <!-- 视频信息 -->
    <div>
      <h3
        text-sm
        font-medium
        text-gray-200
        mb-1
        truncate
        leading-tight
        :title="videoFile.name"
      >
        {{ videoFile.name }}
      </h3>

      <div flex items-center justify-between text-xs text-gray-400>
        <span>{{ mediaStore.formatFileSize(videoFile.size) }}</span>
        <span v-if="videoFile.duration > 0">
          {{ mediaStore.formatDuration(videoFile.duration) }}
        </span>
      </div>
    </div>
  </div>
</template>
