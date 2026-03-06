<script setup lang="ts">
import { useMediaStore } from '@/store/useMediaStore'

interface Props {
  kinds?: Array<'video' | 'audio' | 'image'>
}

const props = withDefaults(defineProps<Props>(), {
  kinds: () => ['video', 'audio', 'image'],
})

const mediaStore = useMediaStore()
const showVideos = computed(() => props.kinds.includes('video'))
const showAudios = computed(() => props.kinds.includes('audio'))
const showImages = computed(() => props.kinds.includes('image'))
const hasMediaFiles = computed(() => {
  return (showVideos.value && mediaStore.videoFiles.length > 0)
    || (showAudios.value && mediaStore.audioFiles.length > 0)
    || (showImages.value && mediaStore.imageFiles.length > 0)
})
</script>

<template>
  <div h-full min-h-0>
    <!-- 媒体列表 -->
    <div class="video-list" flex-1 overflow-y-auto h-full min-h-0 p-2>
      <div v-if="!hasMediaFiles" min-h-full flex items-center justify-center>
        <div class="text-center">
          <p text-sm text-gray-500>
            从设备拖放介质以导入
          </p>
        </div>
      </div>

      <div
        v-else
        grid gap="3 sm:4" p="3 sm:0"
        grid-cols="[repeat(auto-fill,minmax(150px,1fr))] sm:[repeat(auto-fill,minmax(180px,1fr))]"
      >
        <template v-if="showVideos">
          <VideoPreviewCard
            v-for="videoFile in mediaStore.videoFiles" :key="videoFile.id"
            :video-file="videoFile"
          />
        </template>
        <template v-if="showAudios">
          <AudioPreviewCard
            v-for="audioFile in mediaStore.audioFiles" :key="audioFile.id"
            :audio-file="audioFile"
          />
        </template>
        <template v-if="showImages">
          <ImagePreviewCard
            v-for="imageFile in mediaStore.imageFiles" :key="imageFile.id"
            :image-file="imageFile"
          />
        </template>
      </div>

      <!-- 加载状态 -->
      <div
        v-if="mediaStore.isGeneratingThumbnail"
        border-t border="[#2a2a3a]" flex items-center justify-center p-4
        text-sm text-gray-400
      >
        <div class="i-carbon-circle-dash animate-spin mr-2" />
        正在生成缩略图...
      </div>
    </div>
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

@keyframes spin {
  from {
    transform: rotate(0deg);
  }

  to {
    transform: rotate(360deg);
  }
}
</style>
