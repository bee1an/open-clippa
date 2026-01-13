<script setup lang="ts">
import type { PerformerConfig } from '@/store/usePerformerStore'
import { storeToRefs } from 'pinia'
import { nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { useEditorStore } from '@/store'
import { usePerformerStore } from '@/store/usePerformerStore'
import SelectionGroup from './SelectionGroup.vue'

const editorStore = useEditorStore()
const performerStore = usePerformerStore()
const { currentTime, duration } = storeToRefs(editorStore)
const { clippa } = editorStore
clippa.stage.init({ width: 996, height: 996 / 16 * 9 })

// 异步加载视频并获取真实时长
async function loadVideoWithDuration(src: string): Promise<number> {
  return new Promise((resolve) => {
    const video = document.createElement('video')
    video.src = src
    video.preload = 'metadata'

    video.onloadedmetadata = () => {
      // 视频时长以毫秒为单位
      const duration = video.duration * 1000
      resolve(duration)
    }

    video.onerror = () => {
      // 如果无法获取时长，使用默认值
      resolve(5000)
    }
  })
}

const sliderValue = ref(0)

// Canvas 缩放率
const canvasScaleRatio = ref(1)

// 获取 Canvas 元素并计算缩放率
function calculateCanvasScaleRatio() {
  // TODO: 后面采用内部的值
  const canvasElement = document.querySelector('#canvas canvas') as HTMLCanvasElement
  if (!canvasElement)
    return

  // Canvas 内在尺寸 (初始化时设置的尺寸)
  const internalWidth = 996
  const _internalHeight = 561

  // Canvas 实际显示尺寸 (CSS尺寸)
  const displayWidth = canvasElement.clientWidth

  // 计算缩放率 (由于宽高比固定，只需计算一个值)
  const ratio = displayWidth / internalWidth
  canvasScaleRatio.value = ratio
}

watch(currentTime, () => {
  sliderValue.value = currentTime.value / duration.value
})

// 创建 performer 的辅助函数
async function createVideoPerformer(config: Omit<PerformerConfig, 'duration'>): Promise<void> {
  const videoDuration = await loadVideoWithDuration(config.src as string)

  const performerConfig: PerformerConfig = {
    ...config,
    duration: videoDuration,
  }

  const performer = performerStore.addPerformer(performerConfig)

  // 将 performer 添加到 clippa
  clippa.hire(performer)
}

onMounted(async () => {
  await clippa.ready
  clippa.stage.mount('canvas')

  // 计算初始缩放率
  nextTick(() => {
    calculateCanvasScaleRatio()
  })

  // 监听 window 大小变化
  window.addEventListener('resize', calculateCanvasScaleRatio)

  // 使用 performer store 创建视频对象
  await createVideoPerformer({
    id: 'video1',
    src: 'https://pixijs.com/assets/video.mp4',
    start: 0,
    x: 0,
    y: 0,
    width: 996,
    height: 561,
    zIndex: 0,
  })

  // await createVideoPerformer({
  //   id: 'video2',
  //   src: '/bunny.mp4',
  //   start: 0,
  //   x: 0,
  //   y: 0,
  //   width: 996,
  //   height: 561,
  //   zIndex: 0,
  // })
})

onUnmounted(() => {
  window.removeEventListener('resize', calculateCanvasScaleRatio)
})
</script>

<template>
  <div h-full flex="~ col" items-center justify-center bg-zinc-950>
    <div
      id="canvas"
      class="aspect-ratio-16/9 h-60% shadow-2xl rounded-lg overflow-hidden border border-zinc-800/50"
      relative mb-5
    >
      <!-- Selection Group 组件 -->
      <SelectionGroup :scale-ratio="canvasScaleRatio" />
    </div>
    <!-- <div w-130 mb-2>
      <yy-slider v-model="sliderValue" :max="1" @change="seekBySlider" />
    </div> -->
  </div>
</template>

<style>
#canvas canvas {
  position: absolute;
  width: 100%;
  height: 100%;
}

/* 全屏样式 */
#canvas:fullscreen {
  background: #000;
  display: flex;
  align-items: center;
  justify-content: center;
}

#canvas:fullscreen canvas {
  max-width: 100vw;
  max-height: 100vh;
  object-fit: contain;
}
</style>
