<script setup lang="ts">
import { Director, Theater, Video } from 'open-clippa'

const theater = new Theater('wrapper')

const director = new Director({ theater })

function fileSelected([file]: FileList) {
  const video = new Video({ src: file, start: 0, duration: 5000 })
  theater.hire(video)

  video.load().then(() => {
    director.action()
  })
}
</script>

<template>
  <yy-config-provider theme="dark">
    <div h-screen flex items-center justify-center>
      <div text-center>
        <p text-blue text-4xl mb-5>
          Open Clippa
        </p>

        <yy-upload mb-5 @change="fileSelected">
          <yy-button>上传文件</yy-button>
        </yy-upload>

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
