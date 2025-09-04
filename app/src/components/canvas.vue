<script setup lang="ts">
import { Video } from 'open-clippa'
import { storeToRefs } from 'pinia'
import { useEditorStore } from '@/store'

const editorStore = useEditorStore()
const { currentTime, duration } = storeToRefs(editorStore)
const { clippa } = editorStore
clippa.stage.init({ width: 995, height: 995 / 16 * 9 })

const video = new Video({
  src:
    'https://pixijs.com/assets/video.mp4',
  start: 0,
  duration: 5000,
  zIndex: 0,
})
const video1 = new Video(
  {
    src: '/bunny.mp4',
    start: 4000,
    duration: 9000,
    width: 300,
    height: 200,
    x: 100,
    y: 100,
    zIndex: 1,
  },
)

const sliderValue = ref(0)
watch(currentTime, () => {
  sliderValue.value = currentTime.value / duration.value
})

onMounted(async () => {
  await clippa.ready

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
    <div text-center>
      <div mb-2 flex="~" justify-center gap-2>
        <yy-button @click="() => clippa.play()">
          开始
        </yy-button>
        <yy-button @click="() => clippa.pause()">
          暂停
        </yy-button>
      </div>
    </div>
    <p>
      {{ currentTime }} / {{ duration }}
    </p>
  </div>
</template>

<style>
#canvas canvas {
  position: absolute;
  width: 100%;
  height: 100%;
}
</style>
