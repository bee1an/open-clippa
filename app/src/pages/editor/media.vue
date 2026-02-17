<script setup lang="ts">
import { ref } from 'vue'
import { Button } from '@/components/ui/button'
import { useDragDrop } from '@/composables/useDragDrop'
import { useVideoFiles } from '@/composables/useVideoFiles'
import { useMediaStore } from '@/store/useMediaStore'

const mediaStore = useMediaStore()
const { isVideoFile, isImageFile, filterMediaFiles, handleDroppedFiles } = useVideoFiles()
const { isDragging, onDragEnter, onDragLeave, onDragOver, onDrop } = useDragDrop()
const mediaUrl = ref('')
const mediaUrlError = ref('')
const isImportingByUrl = ref(false)
const showUrlInput = ref(false)

function fileSelected(event: Event) {
  const input = event.target as HTMLInputElement
  const files = input.files
  if (files?.length)
    addMediaFiles(files)
  input.value = ''
}

function addMediaFile(file: File) {
  if (isVideoFile(file)) {
    mediaStore.addVideoFile(file)
    return
  }

  if (isImageFile(file))
    mediaStore.addImageFile(file)
}

function addMediaFiles(files: FileList | File[]) {
  const mediaFiles = filterMediaFiles(files)
  mediaFiles.forEach(addMediaFile)
}

async function handleDrop(event: DragEvent) {
  const items = event.dataTransfer?.items

  if (items) {
    // 处理文件夹和文件的混合拖拽
    const files = await handleDroppedFiles(items)

    if (files.length > 0)
      addMediaFiles(files)
  }
  else if (event.dataTransfer?.files.length) {
    // 兼容直接拖拽文件的情况
    addMediaFiles(event.dataTransfer.files)
  }
}

// 绑定拖拽事件处理函数
function onDragDrop(event: DragEvent) {
  onDrop(event, handleDrop)
}

function importVideoFromUrl() {
  mediaUrlError.value = ''
  const url = mediaUrl.value.trim()
  if (!url) {
    mediaUrlError.value = '请输入视频 URL'
    return
  }

  isImportingByUrl.value = true
  try {
    mediaStore.addVideoFromUrl(url)
    mediaUrl.value = ''
  }
  catch (error) {
    mediaUrlError.value = error instanceof Error ? error.message : 'URL 导入失败'
  }
  finally {
    isImportingByUrl.value = false
  }
}
</script>

<template>
  <div
    hfull flex="~ col" relative
    :class="{
      'border-2 border-dashed border-primary bg-primary/10 transition-all duration-200': isDragging,
    }"
    @drop="onDragDrop"
    @dragover="onDragOver"
    @dragenter="onDragEnter"
    @dragleave="onDragLeave"
  >
    <!-- Header & Upload -->
    <div class="p-3 border-b border-border/70 space-y-3">
      <div class="flex items-center justify-between">
        <span class="text-sm font-medium text-foreground">你的媒体</span>
      </div>

      <input
        id="media-upload"
        type="file"
        accept="video/*,image/*"
        multiple
        hidden
        @change="fileSelected"
      >
      <div flex w-full isolate>
        <label for="media-upload" class="flex-1 cursor-pointer relative z-0 hover:z-10">
          <div
            class="flex items-center justify-center w-full h-8 px-3 gap-1.5 whitespace-nowrap text-xs font-medium transition-all duration-150 ease-out border border-border rounded-l-md rounded-r-none bg-background text-foreground hover:bg-accent hover:text-accent-foreground select-none"
            :class="isDragging ? 'border-primary bg-primary/20' : ''"
          >
            <div i-carbon-add text-base />
            <span>导入媒体</span>
          </div>
        </label>

        <Button
          variant="outline"
          class="shrink-0 h-8 px-2.5 rounded-l-none -ml-px relative z-0 hover:z-10 bg-background"
          :class="{ '!bg-secondary !border-primary/50 text-primary z-20': showUrlInput }"
          title="通过 URL 导入"
          @click="showUrlInput = !showUrlInput"
        >
          <div i-carbon-link text-base />
        </Button>
      </div>

      <div v-if="showUrlInput" mt-3 class="animate-in slide-in-from-top-2 fade-in duration-200">
        <div flex items-center gap-2>
          <div
            class="group flex-1 flex items-center gap-2 px-3 py-1.5 bg-background border border-border rounded-md focus-within:ring-2 focus-within:ring-primary/20 focus-within:border-primary transition-all min-w-0"
          >
            <input
              v-model="mediaUrl"
              type="text"
              placeholder="粘贴视频链接..."
              class="flex-1 bg-transparent border-none text-sm text-foreground outline-none placeholder:text-muted min-w-0"
              @keydown.enter.prevent="importVideoFromUrl"
            >
            <Button
              v-if="mediaUrl"
              variant="ghost"
              size="icon-xs"
              class="opacity-0 group-hover:opacity-100 transition-opacity text-muted hover:text-foreground shrink-0"
              @click="mediaUrl = ''"
            >
              <div i-carbon-close />
            </Button>
          </div>

          <Button
            variant="secondary"
            size="icon"
            class="shrink-0"
            :disabled="!mediaUrl || isImportingByUrl"
            @click="importVideoFromUrl"
          >
            <div v-if="isImportingByUrl" i-carbon-circle-dash animate-spin />
            <div v-else i-carbon-arrow-right />
          </Button>
        </div>

        <div v-if="mediaUrlError" class="mt-2 text-xs text-red-500 flex items-center gap-1 animate-fade-in break-all">
          <div i-carbon-warning-filled class="shrink-0" />
          <span>{{ mediaUrlError }}</span>
        </div>
      </div>

    </div>

    <!-- 视频预览列表 -->
    <div flex-1 overflow-hidden>
      <VideoPreviewList />
    </div>

    <!-- 拖拽遮罩层 -->
    <div
      v-if="isDragging"
      class="z-20"
      absolute inset-0 backdrop-blur-sm flex items-center justify-center
      bg="background/80"
      @dragenter="onDragEnter"
      @dragover="onDragOver"
      @dragleave="onDragLeave"
      @drop="onDragDrop"
    >
      <div
        text-base font-normal text-primary px-6 py-3 rounded-xl shadow-xl
        flex items-center gap-3 max-w-fit
        bg="background/90"
        border="1 border"
        transform-gpu transition-all duration-200
      >
        <div class="i-carbon-cloud-upload text-xl" />
        <span>拖入视频或图片文件（支持文件夹）</span>
      </div>
    </div>
  </div>
</template>
