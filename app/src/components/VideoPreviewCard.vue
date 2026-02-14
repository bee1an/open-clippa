<script setup lang="ts">
import type { VideoFile } from '@/store'
import { ms2TimeStr } from 'clippc'
import { useEditorStore } from '@/store'
import { useMediaStore } from '@/store/useMediaStore'
import { usePerformerStore } from '@/store/usePerformerStore'
import { loadVideoMetadata } from '@/utils/media'

interface Props {
  videoFile: VideoFile
}

const props = defineProps<Props>()

const editorStore = useEditorStore()
const mediaStore = useMediaStore()
const performerStore = usePerformerStore()
const { clippa } = editorStore

// 勾选状态
const isSelected = ref(false)
const cardRef = ref<HTMLElement | null>(null)
const showMenu = ref(false)

onClickOutside(cardRef, () => {
  showMenu.value = false
})

// 添加到时间轴
async function addToTimeline() {
  showMenu.value = false
  await clippa.ready

  const { duration, width, height } = await loadVideoMetadata(props.videoFile.url)
  const stageWidth = clippa.stage.app?.renderer.width ?? 0
  const stageHeight = clippa.stage.app?.renderer.height ?? 0

  const performer = performerStore.addPerformer({
    id: `video-${crypto.randomUUID()}`,
    type: 'video',
    src: props.videoFile.source,
    start: 0,
    duration: props.videoFile.duration || duration || 5000,
    sourceDuration: duration || props.videoFile.duration || 5000,
    width: width || stageWidth,
    height: height || stageHeight,
    x: 0,
    y: 0,
    zIndex: clippa.timeline.rails!.maxZIndex + 1,
  })

  clippa.hire(performer)
}

async function handleMenuAddToTimeline() {
  await addToTimeline()
}

function removeFromMediaLibrary() {
  mediaStore.removeVideoFile(props.videoFile.id)
  showMenu.value = false
}

function toggleMenu() {
  showMenu.value = !showMenu.value
}

function toggleSelect() {
  isSelected.value = !isSelected.value
}
</script>

<template>
  <div ref="cardRef" class="group hover:bg-secondary" rounded-md p-2 w-full transition-colors cursor-pointer>
    <!-- 视频预览区 -->
    <div class="bg-black/50 border-border/50 group-hover:border-border" aspect-video rounded-md relative flex items-center justify-center overflow-hidden border transition-colors>
      <!-- 缩略图或默认图标 -->
      <img
        v-if="videoFile.thumbnail"
        :src="videoFile.thumbnail"
        :alt="videoFile.name"
        w-full h-full object-cover
      >
      <div v-else flex items-center justify-center w-full h-full text-foreground-muted>
        <div i-ph-video-camera-slash-duotone text-3xl opacity-50 />
      </div>

      <!-- 时间码 -->
      <div
        v-if="videoFile.duration > 0"
        group-hover:opacity-0
        text="xs foreground-muted"
        font-mono
        absolute bottom-1 right-1
        class="bg-black/60 backdrop-blur-sm"
        px-1.5 py-0.5 rounded-sm
        transition-opacity
      >
        {{ ms2TimeStr(videoFile.duration) }}
      </div>

      <!-- 悬浮操作层 -->
      <div
        absolute inset-0 class="bg-black/40" opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2
      >
        <!-- 添加到时间轴 -->
        <button
          w-8 h-8 rounded-full bg-primary text-background flex items-center justify-center
          hover:scale-110 active:scale-95 transition-all shadow-lg
          title="添加到时间轴"
          @click.stop="addToTimeline"
        >
          <div i-ph-plus-bold text-lg />
        </button>
      </div>

      <!-- 右上角菜单按钮 -->
      <button
        opacity-0 group-hover:opacity-100
        absolute top-1 right-1
        w-6 h-6 rounded flex items-center justify-center
        class="bg-black/50 hover:bg-black/70" text-white
        transition-all
        @click.stop="toggleMenu"
      >
        <div i-ph-dots-three-vertical-bold text-sm />
      </button>

      <div
        v-if="showMenu"
        absolute top-8 right-1 z-10
        min-w-34 rounded-md border border-border
        class="bg-background-elevated shadow-xl"
        p-1
      >
        <button
          w-full text-left text-xs px-2 py-1.5 rounded
          class="hover:bg-secondary text-foreground"
          @click.stop="handleMenuAddToTimeline"
        >
          添加到时间轴
        </button>
        <button
          w-full text-left text-xs px-2 py-1.5 rounded
          class="hover:bg-secondary text-red-400"
          @click.stop="removeFromMediaLibrary"
        >
          从媒体库移除
        </button>
      </div>
    </div>

    <!-- 文件信息栏 -->
    <div flex items-center justify-between mt-2 gap-2>
      <span
        text="xs foreground"
        font-medium
        truncate
        flex-1
        :title="videoFile.name"
      >
        {{ videoFile.name }}
      </span>

      <!-- 勾选框 - 简化为圆点 -->
      <button
        w-4 h-4 rounded-full class="border-border/50" border flex items-center justify-center
        hover:border-primary transition-colors
        :class="{ 'bg-primary border-primary': isSelected, 'bg-transparent': !isSelected }"
        @click.stop="toggleSelect"
      >
        <div v-if="isSelected" i-ph-check-bold text="xs background" />
      </button>
    </div>
  </div>
</template>
