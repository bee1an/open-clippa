<script setup lang="ts">
import type { VideoFile } from '@/store/useMediaStore'
import { Video } from 'open-clippa'
import { useEditorStore } from '@/store'
import { useMediaStore } from '@/store/useMediaStore'

const mediaStore = useMediaStore()
const editorStore = useEditorStore()
const { clippa } = editorStore

// 模态框状态
const showPreviewModal = ref(false)
const selectedVideoFile = ref<VideoFile | null>(null)

// 预览视频
function handlePreview(videoFile: VideoFile) {
  selectedVideoFile.value = videoFile
  showPreviewModal.value = true
}

// 关闭预览
function closePreview() {
  showPreviewModal.value = false
  selectedVideoFile.value = null
}

// 从模态框添加到时间轴
function handleAddToTimeline(videoFile: VideoFile) {
  const video = new Video({
    id: `video-${Date.now()}`,
    src: videoFile.file,
    start: 0,
    duration: videoFile.duration,
    zIndex: 0,
  })
  clippa.hire(video)
}
</script>

<template>
  <div class="video-list-container" h-full>
    <!-- 视频列表 -->
    <div class="video-list" flex-1 overflow-y-auto hfull p-x-4>
      <div v-if="mediaStore.videoFiles.length === 0" class="empty-state flex items-center justify-center">
        <div class="empty-content text-center">
          <p text-sm text-gray-500>
            从设备拖放介质以导入
          </p>
        </div>
      </div>

      <div
        v-else class="video-grid" p-4 grid gap-4 grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4
        xl:grid-cols-5
      >
        <VideoPreviewCard
          v-for="videoFile in mediaStore.videoFiles" :key="videoFile.id"
          :video-file="videoFile as VideoFile" @preview="handlePreview"
        />
      </div>

      <!-- 加载状态 -->
      <div
        v-if="mediaStore.isGeneratingThumbnail" class="loading-indicator" flex items-center justify-center p-4
        text-sm text-gray-400
      >
        <div class="i-carbon-circle-dash animate-spin mr-2" />
        正在生成缩略图...
      </div>
    </div>

    <!-- 视频预览模态框 -->
    <VideoPreviewModal
      :show="showPreviewModal" :video-file="selectedVideoFile" @close="closePreview"
      @add-to-timeline="handleAddToTimeline"
    />
  </div>
</template>

<style scoped>
.video-list {
  scrollbar-width: thin;
  scrollbar-color: #4a5568 #2d3748;
}

.video-list::-webkit-scrollbar {
  width: 6px;
}

.video-list::-webkit-scrollbar-track {
  background: #2d3748;
}

.video-list::-webkit-scrollbar-thumb {
  background: #4a5568;
  border-radius: 3px;
}

.video-list::-webkit-scrollbar-thumb:hover {
  background: #718096;
}

.video-grid {
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
}

@media (max-width: 640px) {
  .video-grid {
    grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
    gap: 12px;
    padding: 12px;
  }
}

.empty-state {
  min-height: 100%;
}

.loading-indicator {
  border-top: 1px solid #2a2a3a;
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }

  to {
    transform: rotate(360deg);
  }
}

.animate-spin {
  animation: spin 1s linear infinite;
}
</style>
