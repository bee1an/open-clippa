<script setup lang="ts">
import { Button } from '@/components/ui/button'
import { useDragDrop } from '@/composables/useDragDrop'
import { useVideoFiles } from '@/composables/useVideoFiles'
import { useMediaStore } from '@/store/useMediaStore'

const mediaStore = useMediaStore()
const { filterVideoFiles, handleDroppedFiles } = useVideoFiles()
const { isDragging, onDragEnter, onDragLeave, onDragOver, onDrop } = useDragDrop()

function fileSelected(event: Event) {
  const input = event.target as HTMLInputElement
  const files = input.files
  if (files?.length) {
    Array.from(files).forEach((file) => {
      mediaStore.addVideoFile(file)
    })
  }
  input.value = ''
}

async function handleFiles(files: FileList) {
  // 过滤出视频文件
  const videoFiles = filterVideoFiles(files)

  // 批量添加到媒体库
  videoFiles.forEach((file) => {
    mediaStore.addVideoFile(file)
  })
}

async function handleDrop(event: DragEvent) {
  const items = event.dataTransfer?.items

  if (items) {
    // 处理文件夹和文件的混合拖拽
    const files = await handleDroppedFiles(items)

    if (files.length > 0) {
      await handleFiles(files as unknown as FileList)
    }
  }
  else if (event.dataTransfer?.files.length) {
    // 兼容直接拖拽文件的情况
    await handleFiles(event.dataTransfer.files)
  }
}

// 绑定拖拽事件处理函数
function onDragDrop(event: DragEvent) {
  onDrop(event, handleDrop)
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
    <div p-4 p-b-0 text-foreground>
      你的媒体
    </div>

    <!-- 上传区域 -->
    <div p-4 border-b border-border>
      <input
        id="media-upload"
        type="file"
        accept="video/*"
        multiple
        hidden
        @change="fileSelected"
      >
      <label for="media-upload" wfull block cursor-pointer>
        <Button
          variant="outline"
          class="w-full pointer-events-none bg-white text-black"
          :class="{
            'border-primary bg-primary/20': isDragging,
          }"
        >
          <div i-carbon-add text-lg mr-2 />
          <span>导入媒体</span>
        </Button>
      </label>
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
        <span>拖入视频文件或文件夹</span>
      </div>
    </div>
  </div>
</template>
