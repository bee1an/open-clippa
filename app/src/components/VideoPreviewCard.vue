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
  <div class="group" hover:bg="#2a2a2a" rounded-sm p-1.5 wfull>
    <!-- 视频预览区 -->
    <div bg-black rounded-sm relative flex items-center justify-center overflow-hidden>
      <!-- 缩略图或默认图标 -->
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
        w-full
        h-full
        bg-black
      >
        <div i-carbon-video text-4xl text-gray-600 />
      </div>

      <!-- 时间码 -->
      <div
        v-if="videoFile.duration > 0"
        group-hover:opacity-0
        text-white
        text-xs
        font-sans
        absolute
        bottom-1
        left-1
        bg="#2d3427"
        p-x-1
        rounded-1
        transition-opacity
      >
        {{ ms2TimeStr(videoFile.duration) }}
      </div>

      <!-- 右上角菜单按钮 -->
      <button
        group-hover:opacity-100
        opacity-0
        absolute
        top-1
        right-1
        bg="#333333"
        w-8
        h-8
        rounded-md
        flex
        items-center
        justify-center
        text-white
        hover:bg="#444444"
        transition-colors
        transition-opacity
        @click.stop="_showMenu"
      >
        <div i-carbon-overflow-menu-horizontal text-lg />
      </button>

      <!-- 右下角加号按钮 -->
      <button
        group-hover:opacity-100
        opacity-0
        absolute
        bottom-1
        right-1
        bg="#10b981"
        w-8
        h-8
        rounded-md
        flex
        items-center
        justify-center
        text="white 2xl"
        font-bold
        hover:bg="#059669"
        transition-colors
        transition-opacity
        @click.stop="addToTimeline"
      >
        +
      </button>
    </div>

    <!-- 文件信息栏 -->
    <div flex items-center justify-between mt-1>
      <span
        text="xs white"
        font-sans
        truncate
        flex-1
        :title="videoFile.name"
      >
        {{ videoFile.name }}
      </span>

      <!-- 勾选框 -->
      <div
        w-3
        h-3
        border="~ white"
        rounded-full
        flex
        items-center
        justify-center
        cursor-pointer
        transition-all
        hover:scale-110
        :class="{ 'bg-white': isSelected }"
        @click.stop="_toggleSelect"
      >
        <div
          v-if="isSelected"
          text="black xs"
          font-bold
        >
          ✓
        </div>
      </div>
    </div>
  </div>
</template>
