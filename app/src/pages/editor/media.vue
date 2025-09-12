<script setup lang="ts">
import { Video } from 'open-clippa'
import { useDragDrop } from '@/composables/useDragDrop'
import { useVideoFiles } from '@/composables/useVideoFiles'
import { useEditorStore } from '@/store'

const editorStore = useEditorStore()
const { clippa } = editorStore
const { filterVideoFiles, handleDroppedFiles } = useVideoFiles()
const { isDragging, onDragEnter, onDragLeave, onDragOver, onDrop } = useDragDrop()

function fileSelected([file]: FileList) {
  const video = new Video({ src: file, start: 0, duration: 5000, zIndex: 0 })
  clippa.hire(video)
}

async function handleFiles(files: FileList) {
  // 过滤出视频文件
  const videoFiles = filterVideoFiles(files)

  // 批量处理视频文件
  videoFiles.forEach((file) => {
    const video = new Video({ src: file, start: 0, duration: 5000, zIndex: 0 })
    clippa.hire(video)
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
    p-t-2xl hfull
    relative
    :class="{
      'border-2 border-dashed border-blue-500 bg-blue-500/10 transition-all duration-200': isDragging,
    }"
    @drop="onDragDrop"
    @dragover="onDragOver"
    @dragenter="onDragEnter"
    @dragleave="onDragLeave"
  >
    <div flex justify-center>
      <yy-upload style="width: 80%;" @change="fileSelected">
        <yy-button
          style="width: 100%;"
          type="primary"
          :class="{
            'bg-blue-600 border-blue-600 shadow-lg shadow-blue-500/20': isDragging,
          }"
        >
          <div flex items-center gap-2>
            <div i-material-symbols-upload-file></div>
            <span>导入媒体</span>
          </div>
        </yy-button>
      </yy-upload>
    </div>

    <!-- 拖拽遮罩层 -->
    <div
      v-if="isDragging"
      class="bg-#13131b/80 pt-2xl z-20"
      absolute inset-0 backdrop-blur-sm flex items-center justify-center
      @dragenter="onDragEnter"
      @dragover="onDragOver"
      @dragleave="onDragLeave"
      @drop="onDragDrop"
    >
      <div
        class="bg-#13131b/90"
        text-base font-normal text-blue-400 px-6 py-3 border-rd-xl shadow-xl
        flex items-center gap-3 max-w-fit
        border="1px solid #ffffff0d"
        transform-gpu
        transition-all
        duration-200
      >
        <span>拖入视频文件或文件夹</span>
      </div>
    </div>
  </div>
</template>
