import { Clippa } from 'open-clippa'
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

  return { clippa, currentTime, duration }
})
