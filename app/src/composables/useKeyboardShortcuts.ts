import { storeToRefs } from 'pinia'
import { useEditorStore } from '@/store'

export function useKeyboardShortcuts() {
  const editorStore = useEditorStore()
  const { currentTime, duration } = storeToRefs(editorStore)
  const { clippa } = editorStore

  // 播放状态
  const isPlaying = ref(false)

  // 全屏状态
  const isFullscreen = ref(false)

  // 监听 clippa 的播放状态变化
  onMounted(() => {
    clippa.timeline.on('play', () => {
      isPlaying.value = true
    })
    clippa.timeline.on('pause', () => {
      isPlaying.value = false
    })
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

  function handleRewind() {
    try {
      const newTime = Math.max(0, currentTime.value - 10000) // 快退10秒
      clippa.seek(newTime)
    }
    catch (error) {
      console.error('快退错误:', error)
    }
  }

  function handleFastForward() {
    try {
      const newTime = Math.min(duration.value, currentTime.value + 10000) // 快进10秒
      clippa.seek(newTime)
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

  // 键盘事件处理
  useEventListener('keydown', (e: KeyboardEvent) => {
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
        handleRewind()
        break
      case 'ArrowRight':
        e.preventDefault()
        handleFastForward()
        break
      case 'KeyF':
        e.preventDefault()
        toggleFullscreen()
        break
      case 'Escape':
        if (isFullscreen.value) {
          e.preventDefault()
          toggleFullscreen()
        }
        break
    }
  })

  return {
    isPlaying,
    isFullscreen,
    togglePlayPause,
    handleRewind,
    handleFastForward,
    toggleFullscreen,
  }
}
