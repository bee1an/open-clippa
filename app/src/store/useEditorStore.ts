import type { ExportProgress } from 'open-clippa'
import { Clippa } from 'open-clippa'
import { defineStore } from 'pinia'
import { computed, markRaw, ref } from 'vue'

export interface ExportState {
  isExporting: boolean
  exportProgress: number
  exportOptions: any
  exportHistory: Array<{
    filename: string
    timestamp: Date
    options: any
  }>
}

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

  // 导出状态
  const exportState = ref<ExportState>({
    isExporting: false,
    exportProgress: 0,
    exportOptions: null,
    exportHistory: [],
  })

  // 选中视频
  const selectedVideo = ref<any>(null)

  // 导出事件监听
  clippa.on('exportStart', (options) => {
    exportState.value.isExporting = true
    exportState.value.exportProgress = 0
    exportState.value.exportOptions = options
  })

  clippa.on('exportProgress', (progress: ExportProgress) => {
    exportState.value.exportProgress = progress.progress
  })

  clippa.on('exportComplete', (blob) => {
    exportState.value.isExporting = false
    exportState.value.exportProgress = 100

    // 添加到导出历史
    const exportRecord = {
      filename: `export-${Date.now()}.mp4`,
      timestamp: new Date(),
      options: exportState.value.exportOptions,
      size: blob.size,
    }
    exportState.value.exportHistory.unshift(exportRecord)

    // 限制历史记录数量
    if (exportState.value.exportHistory.length > 10) {
      exportState.value.exportHistory = exportState.value.exportHistory.slice(0, 10)
    }
  })

  clippa.on('exportError', (error) => {
    exportState.value.isExporting = false
    console.error('导出错误:', error)
  })

  // 清理导出状态
  const clearExportState = () => {
    exportState.value = {
      isExporting: false,
      exportProgress: 0,
      exportOptions: null,
      exportHistory: exportState.value.exportHistory,
    }
  }

  // 清空导出历史
  const clearExportHistory = () => {
    exportState.value.exportHistory = []
  }

  // 删除单个导出记录
  const removeExportRecord = (index: number) => {
    exportState.value.exportHistory.splice(index, 1)
  }

  // 获取导出状态文本
  const getExportStatusText = computed(() => {
    if (exportState.value.isExporting) {
      return `导出中 (${Math.round(exportState.value.exportProgress)}%)`
    }
    return '未导出'
  })

  // 检查是否可以导出
  const canExport = computed(() => {
    return !exportState.value.isExporting && clippa.theater.performers.length > 0
  })

  return {
    clippa,
    currentTime,
    duration,
    isPlaying,
    exportState,
    selectedVideo,
    clearExportState,
    clearExportHistory,
    removeExportRecord,
    getExportStatusText,
    canExport,
  }
})
