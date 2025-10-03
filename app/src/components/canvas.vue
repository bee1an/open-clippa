<script setup lang="ts">
import type { PerformerConfig } from '@/store/usePerformerStore'
import { storeToRefs } from 'pinia'
import { useEditorStore } from '@/store'
import { usePerformerStore } from '@/store/usePerformerStore'
import SelectionGroup from './SelectionGroup.vue'

const editorStore = useEditorStore()
const performerStore = usePerformerStore()
const { currentTime, duration } = storeToRefs(editorStore)
const { clippa } = editorStore
clippa.stage.init({ width: 995, height: 995 / 16 * 9 })

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

  // 使用 performer store 创建视频对象
  await createVideoPerformer({
    id: 'video1',
    src: 'https://pixijs.com/assets/video.mp4',
    start: 4000,
    x: 100,
    y: 50,
    zIndex: 1,
  })

  await createVideoPerformer({
    id: 'video2',
    src: '/bunny.mp4',
    start: 0,
    x: 0,
    y: 0,
    width: 995,
    height: 560,
    zIndex: 0,
  })
})
</script>

<template>
  <div hfull flex="~ col" items-center justify-center>
    <div id="canvas" class="aspect-ratio-16/9 h-60%" relative mb-5>
      <!-- Selection Group 组件 -->
      <SelectionGroup :container-bounds="{ x: 0, y: 0, width: 995, height: 560 }" />
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
