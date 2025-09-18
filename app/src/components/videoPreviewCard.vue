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
    class="video-card group"
    bg="#13131b" rounded-lg p-3 border="~ #2a2a3a"
    hover:border-blue-500 hover:bg="#1a1a2e"
    transition-all duration-200 cursor-pointer
    @click="previewVideo"
  >
    <!-- 缩略图区域 -->
    <div class="thumbnail-container" relative mb-3 rounded overflow-hidden bg="#0a0a0f">
      <div class="aspect-ratio-16/9" w-full>
        <img
          v-if="videoFile.thumbnail"
          :src="videoFile.thumbnail"
          :alt="videoFile.name"
          w-full h-full object-cover
        >
        <div
          v-else
          class="placeholder"
          w-full h-full flex items-center justify-center text-gray-500
        >
          <div class="i-carbon-video text-2xl" />
        </div>
      </div>

      <!-- 时长显示 -->
      <div
        v-if="videoFile.duration > 0"
        class="duration-badge bg-black/70"
        absolute bottom-2 right-2 px-2 py-1 rounded text-xs font-mono text-white
      >
        {{ mediaStore.formatDuration(videoFile.duration) }}
      </div>

      <!-- 操作按钮 -->
      <div
        class="action-buttons"
        absolute top-2 right-2 opacity-0 group-hover:opacity-100
        flex gap-1 transition-opacity duration-200
      >
        <button
          class="action-btn bg-black/60 hover:bg-blue-600/80"
          w-6
          h-6 rounded flex items-center justify-center text-white text-xs backdrop-blur-sm
          transition-all duration-200 title="添加到时间轴"
          @click.stop="addToTimeline"
        >
          <div class="i-carbon-add" />
        </button>

        <button
          class="action-btn bg-black/60 hover:bg-red-600/80"
          w-6
          h-6 rounded flex items-center justify-center text-white text-xs backdrop-blur-sm
          transition-all duration-200 title="删除视频"
          @click.stop="removeVideo"
        >
          <div class="i-carbon-trash-can" />
        </button>
      </div>
    </div>

    <!-- 视频信息 -->
    <div class="video-info">
      <h3
        class="video-title"
        text-sm font-medium text-gray-200 mb-1 truncate
        :title="videoFile.name"
      >
        {{ videoFile.name }}
      </h3>

      <div class="video-meta" flex items-center justify-between text-xs text-gray-400>
        <span>{{ mediaStore.formatFileSize(videoFile.size) }}</span>
        <span v-if="videoFile.duration > 0">
          {{ mediaStore.formatDuration(videoFile.duration) }}
        </span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.video-card {
  min-width: 180px;
  max-width: 220px;
}

.thumbnail-container {
  position: relative;
  background:
    linear-gradient(45deg, #0a0a0f 25%, transparent 25%), linear-gradient(-45deg, #0a0a0f 25%, transparent 25%),
    linear-gradient(45deg, transparent 75%, #0a0a0f 75%), linear-gradient(-45deg, transparent 75%, #0a0a0f 75%);
  background-size: 20px 20px;
  background-position:
    0 0,
    0 10px,
    10px -10px,
    -10px 0px;
}

.placeholder {
  background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
}

.action-btn {
  backdrop-filter: blur(4px);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
}

.video-title {
  line-height: 1.3;
}

.duration-badge {
  backdrop-filter: blur(4px);
  font-variant-numeric: tabular-nums;
}
</style>
