<script setup lang="ts">
import { Director, Theater, Video } from 'open-clippa'

const theater = new Theater('wrapper')

const director = new Director({ theater })

const currentTime = ref(0)
director.on('updateCurrentTime', (t) => {
  currentTime.value = t
})
const duration = ref(0)
director.on('durationChange', (d) => {
  duration.value = d
})

function fileSelected([file]: FileList) {
  const video = new Video({ src: file, start: 0, duration: 5000 })
  theater.hire(video)
}
</script>

<template>
  <yy-config-provider theme="dark">
    <div h-screen flex items-center justify-center>
      <div text-center>
        <p text-blue text-4xl mb-5>
          Open Clippa
        </p>

        <div mb-2 flex="~" justify-center gap-2>
          <yy-upload @change="fileSelected">
            <yy-button>上传文件</yy-button>
          </yy-upload>
          <yy-button @click="() => director.action()">
            开始
          </yy-button>
          <yy-button @click="() => director.stop()">
            暂停
          </yy-button>
        </div>

        <p mb-2 text-center>
          {{ currentTime }} / {{ duration }}
        </p>

        <div id="wrapper" />
      </div>
    </div>
  </yy-config-provider>
</template>

<style>
  html {
  color-scheme: dark;
}
</style>
