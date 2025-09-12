<script setup lang="ts">
import { useDragDrop } from '@/composables/useDragDrop'
import { useVideoFiles } from '@/composables/useVideoFiles'
import { useMediaStore } from '@/store/useMediaStore'

const mediaStore = useMediaStore()
const { filterVideoFiles, handleDroppedFiles } = useVideoFiles()
const { isDragging, onDragEnter, onDragLeave, onDragOver, onDrop } = useDragDrop()

function fileSelected([file]: FileList) {
  // 添加到媒体库
  mediaStore.addVideoFile(file)
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
    class="media-page"
    hfull flex="~ col" relative
    :class="{
      'border-2 border-dashed border-blue-500 bg-blue-500/10 transition-all duration-200': isDragging,
    }"
    @drop="onDragDrop"
    @dragover="onDragOver"
    @dragenter="onDragEnter"
    @dragleave="onDragLeave"
  >
    <div p-4 p-b-0>
      你的媒体
    </div>

    <!-- 上传区域 -->
    <div class="upload-section" p-4 border-b border="#2a2a3a">
      <yy-upload wfull @change="fileSelected">
        <!-- w-full 不生效, 因为使用了unset -->
        <yy-button
          type="primary"
          style="width: 100%;"
          :class="{
            'bg-blue-600 border-blue-600 shadow-lg shadow-blue-500/20': isDragging,
          }"
        >
          <div flex items-center gap-2>
            <span>导入媒体</span>
          </div>
        </yy-button>
      </yy-upload>
    </div>

    <!-- 视频预览列表 -->
    <div class="preview-section" flex-1 overflow-hidden>
      <VideoPreviewList />
    </div>

    <!-- 拖拽遮罩层 -->
    <div
      v-if="isDragging"
      class="drag-overlay bg-#13131b/80 z-20"
      absolute inset-0 backdrop-blur-sm flex items-center justify-center
      @dragenter="onDragEnter"
      @dragover="onDragOver"
      @dragleave="onDragLeave"
      @drop="onDragDrop"
    >
      <div
        class="drag-message bg-#13131b/90"
        text-base font-normal text-blue-400 px-6 py-3 border-rd-xl shadow-xl
        flex items-center gap-3 max-w-fit
        border="1px solid #ffffff0d"
        transform-gpu transition-all duration-200
      >
        <div class="i-carbon-cloud-upload text-xl" />
        <span>拖入视频文件或文件夹</span>
      </div>
    </div>
  </div>
</template>
