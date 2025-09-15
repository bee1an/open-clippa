<script setup lang="ts">
import { FrameExtractor } from 'open-clippa'
import testVideo from '../../../app/public/bunny.mp4'

const frameExtractor = new FrameExtractor(testVideo)

const canvas = useTemplateRef('canvas')
const ctx = computed(() => canvas.value!.getContext('2d')!)

onMounted(async () => {
  await frameExtractor.load()

  let { video } = await frameExtractor.getFrameByTime(9 * 1e6)
  video = video!

  ctx.value.drawImage(
    video,
    0,
    0,
    video.codedWidth,
    video.codedHeight,
    0,
    0,
    ctx.value.canvas.width,
    ctx.value.canvas.height,
  )
  video.close()
})
</script>

<template>
  <canvas ref="canvas" />
</template>

<style scoped></style>
