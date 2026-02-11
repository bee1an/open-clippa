import { Clippa } from 'clippc'
import { defineStore } from 'pinia'

export const useEditorStore = defineStore('editor', () => {
  const clippa = markRaw(new Clippa())

  const currentTime = ref(0)
  clippa.director.on('updateCurrentTime', (time) => {
    currentTime.value = time
  })

  const duration = ref(0)
  clippa.timeline.on('durationChanged', (time) => {
    duration.value = time
  })

  // 播放状态
  const isPlaying = ref(false)
  clippa.timeline.on('play', () => {
    isPlaying.value = true
  })
  clippa.timeline.on('pause', () => {
    isPlaying.value = false
  })

  // 选中视频
  const selectedVideo = ref<any>(null)

  return {
    clippa,
    currentTime,
    duration,
    isPlaying,
    selectedVideo,
  }
})
