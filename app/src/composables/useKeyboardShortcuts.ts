import type { Image } from '@clippc/performer'
import type { Rail, Train } from 'clippc'
import type { PerformerConfig } from '@/store/usePerformerStore'
import { Text, Video } from '@clippc/performer'
import { getPxByMs } from '@clippc/utils'
import { VideoTrain } from 'clippc'
import { storeToRefs } from 'pinia'
import { useEditorStore } from '@/store'
import { useFilterStore } from '@/store/useFilterStore'
import { usePerformerStore } from '@/store/usePerformerStore'

export function useKeyboardShortcuts() {
  const editorStore = useEditorStore()
  const filterStore = useFilterStore()
  const performerStore = usePerformerStore()
  const { currentTime, duration } = storeToRefs(editorStore)
  const { clippa } = editorStore

  // 播放状态
  const isPlaying = ref(false)

  // 全屏状态
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

  // 监听 clippa 的播放状态变化
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

  // 播放控制函数
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
      const newTime = Math.max(0, currentTime.value - 10000) // 快退10秒
      await clippa.seek(newTime)
    }
    catch (error) {
      console.error('快退错误:', error)
    }
  }

  async function handleFastForward() {
    try {
      const newTime = Math.min(duration.value, currentTime.value + 10000) // 快进10秒
      await clippa.seek(newTime)
    }
    catch (error) {
      console.error('快进错误:', error)
    }
  }

  // 全屏控制函数
  function toggleFullscreen() {
    const canvas = document.getElementById('canvas')
    if (!canvas)
      return

    if (!isFullscreen.value) {
      if (canvas.requestFullscreen) {
        canvas.requestFullscreen()
      }
    }
    else {
      if (document.exitFullscreen) {
        document.exitFullscreen()
      }
    }
  }

  // 监听全屏状态变化
  useEventListener(document, 'fullscreenchange', () => {
    isFullscreen.value = !!document.fullscreenElement
  })

  async function splitPerformerTrain(train: Train, splitTime: number): Promise<boolean> {
    const performer = performerStore.getPerformerById(train.id)
    if (!performer)
      return false

    const leftDuration = splitTime - train.start
    const rightDuration = train.duration - leftDuration
    const bounds = performer.getBaseBounds()
    const zIndex = performer.zIndex

    // build right-half config based on performer type
    let rightConfig: PerformerConfig
    if (performer instanceof Video) {
      rightConfig = {
        id: `${train.id}-split`,
        start: splitTime,
        duration: rightDuration,
        x: bounds.x,
        y: bounds.y,
        width: bounds.width,
        height: bounds.height,
        zIndex,
        src: performer.src,
        sourceStart: performer.sourceStart + leftDuration,
        sourceDuration: performer.sourceDuration,
      }
    }
    else if (performer instanceof Text) {
      rightConfig = {
        id: `${train.id}-split`,
        type: 'text',
        start: splitTime,
        duration: rightDuration,
        x: bounds.x,
        y: bounds.y,
        width: bounds.width,
        height: bounds.height,
        zIndex,
        content: performer.getText(),
        style: performer.getStyle(),
      }
    }
    else {
      rightConfig = {
        id: `${train.id}-split`,
        type: 'image',
        start: splitTime,
        duration: rightDuration,
        x: bounds.x,
        y: bounds.y,
        width: bounds.width,
        height: bounds.height,
        zIndex,
        src: (performer as Image).src,
      }
    }

    // shrink left half (original train + performer)
    train.duration = leftDuration
    train.updateWidth(getPxByMs(leftDuration, clippa.timeline.state.pxPerMs))
    performer.duration = leftDuration
    if (train instanceof VideoTrain) {
      train.refreshThumbnails().catch((error) => {
        console.warn('[split] refresh video train thumbnails failed', error)
      })
    }

    const rightPerformer = performerStore.addPerformer(rightConfig)
    await clippa.hire(rightPerformer)
    return true
  }

  function splitFilterTrain(train: Train, splitTime: number): boolean {
    return Boolean(filterStore.splitLayerByTrainId(train.id, splitTime))
  }

  async function splitActiveTrain() {
    const splitTime = currentTime.value
    const candidates = listSplittableTrains(splitTime)
    if (candidates.length === 0)
      return

    let changed = false
    for (const train of candidates) {
      try {
        const performer = performerStore.getPerformerById(train.id)
        if (performer) {
          changed = await splitPerformerTrain(train, splitTime) || changed
          continue
        }

        changed = splitFilterTrain(train, splitTime) || changed
      }
      catch (error) {
        console.warn('[split] split train failed', train.id, error)
      }
    }

    if (!changed)
      return

    bumpSplitRevision()
    if (!isPlaying.value)
      await clippa.director.seek(splitTime)
  }

  function deleteActiveTrain() {
    const activeTrain = clippa.timeline.state.activeTrain
    if (!activeTrain)
      return

    const performer = performerStore.getPerformerById(activeTrain.id)
    if (performer) {
      performerStore.removePerformer(activeTrain.id)
    }
    else {
      const layer = filterStore.layers.find(item => item.train.id === activeTrain.id)
      if (!layer)
        return

      filterStore.removeLayer(layer.id)
    }

    // clean up empty rails
    const rails = clippa.timeline.rails
    if (rails) {
      const emptyRails = rails.rails.filter(rail => rail.trains.length === 0)
      emptyRails.forEach(rail => rails.removeRail(rail))

      // recalc duration
      const maxEnd = rails.rails.reduce((acc, rail) => {
        return rail.trains.reduce(
          (inner, train) => Math.max(inner, train.start + train.duration),
          acc,
        )
      }, 0)

      if (maxEnd !== clippa.timeline.duration) {
        clippa.timeline.updateDuration(maxEnd)
      }
    }

    bumpSplitRevision()

    if (!isPlaying.value) {
      void clippa.director.seek(currentTime.value)
    }
  }

  // 键盘事件处理
  useEventListener('keydown', async (e: KeyboardEvent) => {
    // 如果焦点在输入框中，不处理快捷键
    const target = e.target as HTMLElement
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
      return
    }

    switch (e.code) {
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

        deleteActiveTrain()
        break
      case 'Escape':
        if (isFullscreen.value) {
          e.preventDefault()
          toggleFullscreen()
        }
        break
    }
  })

  // 设置和清理函数
  function setupShortcuts() {
    // 键盘快捷键已在全局监听器中处理
  }

  function cleanupShortcuts() {
    // 清理工作在全局监听器中处理
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
