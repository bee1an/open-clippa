<script setup lang="ts">
import { Video } from 'open-clippa'
import { storeToRefs } from 'pinia'
import { useEditorStore } from '@/store'

const editorStore = useEditorStore()
const { currentTime, duration } = storeToRefs(editorStore)
const { theater, director } = editorStore

// function fileSelected([file]: FileList) {
//   const video = new Video({ src: file, start: 0, duration: 5000 })
//   theater.hire(video)
// }

const video = new Video({ src: 'https://pixijs.com/assets/video.mp4', start: 0, duration: 5000 })
theater.hire(video)

const video1 = new Video({ src: '/bunny.mp4', start: 4000, duration: 9000, width: 300, height: 200, x: 100, y: 100 })
theater.hire(video1)

const sliderValue = ref(0)
watch(currentTime, () => {
  sliderValue.value = currentTime.value / duration.value
})

// function seekBySlider(value: number) {
//   director.seek(value * duration.value)
// }
</script>

<template>
  <div hfull flex="~ col" items-center justify-center>
    <div id="canvas" mb-5 />
    <!-- <div w-130 mb-2>
      <yy-slider v-model="sliderValue" :max="1" @change="seekBySlider" />
    </div> -->
    <div text-center>
      <div mb-2 flex="~" justify-center gap-2>
        <yy-button @click="() => director.action()">
          开始
        </yy-button>
        <yy-button @click="() => director.stop()">
          暂停
        </yy-button>
        <!-- <yy-upload @change="fileSelected">
          <yy-button>上传文件</yy-button>
        </yy-upload> -->
      </div>
    </div>
    <p>
      {{ currentTime }} / {{ duration }}
    </p>
  </div>
</template>
