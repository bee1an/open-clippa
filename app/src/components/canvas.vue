<script setup lang="ts">
import { Video } from 'open-clippa'
import { storeToRefs } from 'pinia'
import { useEditorStore } from '@/store'

const editorStore = useEditorStore()
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

let video: Video
let video1: Video

const sliderValue = ref(0)

watch(currentTime, () => {
  sliderValue.value = currentTime.value / duration.value
})

onMounted(async () => {
  await clippa.ready
  
  // 获取真实时长并创建视频对象
  const videoDuration = await loadVideoWithDuration('https://pixijs.com/assets/video.mp4')
  const video1Duration = await loadVideoWithDuration('/bunny.mp4')
  
  video = new Video({
    src: 'https://pixijs.com/assets/video.mp4',
    start: 0,
    duration: videoDuration,
    zIndex: 0,
  })
  
  video1 = new Video({
    src: '/bunny.mp4',
    start: 4000,
    duration: video1Duration,
    width: 300,
    height: 200,
    x: 100,
    y: 100,
    zIndex: 1,
  })
  
  clippa.hire(video)
  clippa.hire(video1)

  clippa.stage.mount('canvas')
})
</script>

<template>
  <div hfull flex="~ col" items-center justify-center>
    <div id="canvas" class="aspect-ratio-16/9 h-60%" relative mb-5 />
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
