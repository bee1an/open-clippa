<script setup lang="ts">
import type { VideoFile } from '@/store/useMediaStore'

interface Props {
  videoFile: VideoFile | null
  show: boolean
}

interface Emits {
  (e: 'close'): void
  (e: 'addToTimeline', videoFile: VideoFile): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const videoRef = ref<HTMLVideoElement>()

// 关闭模态框
function closeModal() {
  if (videoRef.value) {
    videoRef.value.pause()
  }
  emit('close')
}

// 添加到时间轴
function addToTimeline() {
  if (props.videoFile) {
    emit('addToTimeline', props.videoFile)
    closeModal()
  }
}

// 键盘事件处理
useEventListener('keydown', (e) => {
  if (props.show && e.code === 'Escape') {
    closeModal()
  }
})

// 监听显示状态变化
watch(() => props.show, (show) => {
  if (show && videoRef.value) {
    // 模态框打开时，重置视频
    videoRef.value.currentTime = 0
  }
})
</script>

<template>
  <Teleport to="body">
    <div
      v-if="show && videoFile"
      class="modal-overlay fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"
      @click="closeModal"
    >
      <div
        class="modal-content bg-#1a1a2e rounded-lg shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden"
        @click.stop
      >
        <!-- 模态框头部 -->
        <div class="modal-header flex items-center justify-between p-4 border-b border-#2a2a3a">
          <div class="video-info">
            <h2 class="text-lg font-medium text-gray-200 truncate" :title="videoFile.name">
              {{ videoFile.name }}
            </h2>
            <div class="text-sm text-gray-400 mt-1">
              {{ Math.round(videoFile.size / 1024 / 1024 * 100) / 100 }} MB
              <span v-if="videoFile.duration > 0" class="ml-2">
                {{ Math.floor(videoFile.duration / 1000 / 60) }}:{{ String(Math.floor(videoFile.duration / 1000) % 60).padStart(2, '0') }}
              </span>
            </div>
          </div>

          <button
            class="close-btn w-8 h-8 rounded-full hover:bg-#2a2a3a flex items-center justify-center text-gray-400 hover:text-white transition-colors"
            @click="closeModal"
          >
            <div class="i-carbon-close text-lg" />
          </button>
        </div>

        <!-- 视频播放区域 -->
        <div class="video-container bg-black flex items-center justify-center" style="aspect-ratio: 16/9;">
          <video
            ref="videoRef"
            :src="videoFile.url"
            class="max-w-full max-h-full"
            controls
            preload="metadata"
          >
            您的浏览器不支持视频播放
          </video>
        </div>

        <!-- 模态框底部操作 -->
        <div class="modal-footer flex items-center justify-between p-4 border-t border-#2a2a3a">
          <div class="file-details text-sm text-gray-400">
            <span>文件类型: {{ videoFile.file.type || '未知' }}</span>
            <span class="ml-4">创建时间: {{ videoFile.createdAt.toLocaleString() }}</span>
          </div>

          <div class="actions flex gap-2">
            <button
              class="cancel-btn px-4 py-2 text-gray-400 hover:text-white border border-gray-600 hover:border-gray-500 rounded transition-colors"
              @click="closeModal"
            >
              关闭
            </button>
            <button
              class="add-btn px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors"
              @click="addToTimeline"
            >
              添加到时间轴
            </button>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.modal-overlay {
  backdrop-filter: blur(4px);
}

.modal-content {
  animation: modalFadeIn 0.2s ease-out;
}

@keyframes modalFadeIn {
  from {
    opacity: 0;
    transform: scale(0.95);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}

.video-container {
  min-height: 300px;
}

video {
  outline: none;
}
</style>
