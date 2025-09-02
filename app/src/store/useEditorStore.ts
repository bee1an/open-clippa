import { Director, Stage, Theater } from 'open-clippa'
import { defineStore } from 'pinia'

export const useEditorStore = defineStore('editor', () => {
  const theater = markRaw(new Theater())
  const stage = markRaw(new Stage({ id: 'canvas', width: 995, height: 995 / 16 * 9 }))
  const director = markRaw(new Director({ theater, stage }))

  const currentTime = ref(0)
  director.on('updateCurrentTime', (t) => {
    currentTime.value = t
  })
  const duration = ref(0)
  director.on('durationChange', (d) => {
    duration.value = d
  })

  return { theater, director, currentTime, duration }
})
