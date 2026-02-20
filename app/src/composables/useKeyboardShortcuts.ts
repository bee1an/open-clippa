import type { Rail, Train } from 'clippc'
import { storeToRefs } from 'pinia'
import { useEditorCommandActions } from '@/composables/useEditorCommandActions'
import { useEditorStore } from '@/store'
import { useFilterStore } from '@/store/useFilterStore'

export function useKeyboardShortcuts() {
  const editorStore = useEditorStore()
  const filterStore = useFilterStore()
  const editorCommandActions = useEditorCommandActions()
  const { currentTime, duration } = storeToRefs(editorStore)
  const { clippa } = editorStore

  const isPlaying = ref(false)
  const isFullscreen = ref(false)
  const splitRevision = ref(0)
  const railDisposers = new Map<Rail, () => void>()

  function bumpSplitRevision(): void {
    splitRevision.value += 1
  }

  function listSplittableTrains(splitTime: number): Train[] {
    const rails = clippa.timeline.rails?.rails ?? []
    const result: Train[] = []

    rails.forEach((rail) => {
      rail.trains.forEach((train) => {
        if (splitTime > train.start && splitTime < train.start + train.duration)
          result.push(train)
      })
    })

    return result
  }

  function bindRail(rail: Rail): void {
    if (railDisposers.has(rail))
      return

    const handleTrainChanged = () => {
      bumpSplitRevision()
    }

    rail.on('insertTrain', handleTrainChanged)
    rail.on('trainMoveEnd', handleTrainChanged)
    rail.on('trainRightResizeEnd', handleTrainChanged)
    rail.on('trainsPosUpdated', handleTrainChanged)

    railDisposers.set(rail, () => {
      rail.off('insertTrain', handleTrainChanged)
      rail.off('trainMoveEnd', handleTrainChanged)
      rail.off('trainRightResizeEnd', handleTrainChanged)
      rail.off('trainsPosUpdated', handleTrainChanged)
    })
  }

  function bindRails(): void {
    const rails = clippa.timeline.rails?.rails ?? []
    rails.forEach(bindRail)
  }

  const canSplitAtCurrentTime = computed(() => {
    return splitRevision.value >= 0 && listSplittableTrains(currentTime.value).length > 0
  })

  const handleDurationChanged = () => {
    bindRails()
    bumpSplitRevision()
  }

  const handlePlay = () => {
    isPlaying.value = true
  }

  const handlePause = () => {
    isPlaying.value = false
  }

  const handleHire = () => {
    bindRails()
    bumpSplitRevision()
  }

  watch(
    () => filterStore.layers.length,
    () => {
      bindRails()
      bumpSplitRevision()
    },
  )

  onMounted(() => {
    clippa.timeline.on('play', handlePlay)
    clippa.timeline.on('pause', handlePause)
    bindRails()
    clippa.timeline.on('durationChanged', handleDurationChanged)
    clippa.theater.on('hire', handleHire)
  })

  onUnmounted(() => {
    clippa.timeline.off('play', handlePlay)
    clippa.timeline.off('pause', handlePause)
    clippa.timeline.off('durationChanged', handleDurationChanged)
    clippa.theater.off('hire', handleHire)

    railDisposers.forEach(dispose => dispose())
    railDisposers.clear()
  })

  function togglePlayPause() {
    try {
      if (isPlaying.value) {
        clippa.pause()
        isPlaying.value = false
      }
      else {
        clippa.play()
        isPlaying.value = true
      }
    }
    catch (error) {
      console.error('播放控制错误:', error)
    }
  }

  async function handleRewind() {
    try {
      const newTime = Math.max(0, currentTime.value - 10000)
      await clippa.seek(newTime)
    }
    catch (error) {
      console.error('快退错误:', error)
    }
  }

  async function handleFastForward() {
    try {
      const newTime = Math.min(duration.value, currentTime.value + 10000)
      await clippa.seek(newTime)
    }
    catch (error) {
      console.error('快进错误:', error)
    }
  }

  function toggleFullscreen() {
    const canvas = document.getElementById('canvas')
    if (!canvas)
      return

    if (!isFullscreen.value) {
      if (canvas.requestFullscreen)
        canvas.requestFullscreen()
    }
    else if (document.exitFullscreen) {
      document.exitFullscreen()
    }
  }

  useEventListener(document, 'fullscreenchange', () => {
    isFullscreen.value = !!document.fullscreenElement
  })

  async function splitActiveTrain() {
    const splitTime = currentTime.value
    const result = await editorCommandActions.timelineSplitAtTime({ timeMs: splitTime })
    if (result.ok)
      bumpSplitRevision()
  }

  async function deleteActiveTrain() {
    const result = await editorCommandActions.timelineDeleteActiveItem()
    if (result.ok)
      bumpSplitRevision()
  }

  function handleUndo(): void {
    void editorCommandActions.historyUndo()
  }

  function handleRedo(): void {
    void editorCommandActions.historyRedo()
  }

  useEventListener('keydown', async (e: KeyboardEvent) => {
    const target = e.target as HTMLElement
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)
      return

    const isMetaOrCtrl = e.metaKey || e.ctrlKey

    switch (e.code) {
      case 'KeyZ':
        if (!isMetaOrCtrl)
          break

        e.preventDefault()
        if (e.shiftKey)
          handleRedo()
        else
          handleUndo()
        break
      case 'KeyY':
        if (!e.ctrlKey || e.metaKey)
          break

        e.preventDefault()
        handleRedo()
        break
      case 'Space':
        e.preventDefault()
        togglePlayPause()
        break
      case 'ArrowLeft':
        e.preventDefault()
        await handleRewind()
        break
      case 'ArrowRight':
        e.preventDefault()
        await handleFastForward()
        break
      case 'KeyF':
        e.preventDefault()
        toggleFullscreen()
        break
      case 'Delete':
      case 'Backspace':
        e.preventDefault()
        if (clippa.timeline.rails?.deleteActiveGap())
          break

        void deleteActiveTrain()
        break
      case 'Escape':
        if (isFullscreen.value) {
          e.preventDefault()
          toggleFullscreen()
        }
        break
    }
  })

  function setupShortcuts() {
  }

  function cleanupShortcuts() {
  }

  return {
    isPlaying,
    isFullscreen,
    togglePlayPause,
    handleRewind,
    handleFastForward,
    toggleFullscreen,
    splitActiveTrain,
    canSplitAtCurrentTime,
    deleteActiveTrain,
    setupShortcuts,
    cleanupShortcuts,
  }
}
