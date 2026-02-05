import { defineStore } from 'pinia'
import { markRaw } from 'vue'

export interface ExportVideoInfo {
  title: string
  description: string
}

export interface ExportedVideo {
  id: string
  name: string
  blob: Blob
  url: string
  size: number
  createdAt: Date
  duration: number
  frameRate: number
  coverUrl: string
  info: ExportVideoInfo
}

interface SetExportPayload {
  blob: Blob
  filename: string
  duration: number
  frameRate: number
  coverUrl?: string
}

function revokeIfBlobUrl(url: string) {
  if (url && url.startsWith('blob:'))
    URL.revokeObjectURL(url)
}

export const useExportStore = defineStore('export', () => {
  const exportedVideo = ref<ExportedVideo | null>(null)

  function setExportResult(payload: SetExportPayload) {
    if (exportedVideo.value) {
      revokeIfBlobUrl(exportedVideo.value.url)
      revokeIfBlobUrl(exportedVideo.value.coverUrl)
    }

    const url = URL.createObjectURL(payload.blob)

    exportedVideo.value = {
      id: crypto.randomUUID(),
      name: payload.filename,
      blob: markRaw(payload.blob),
      url,
      size: payload.blob.size,
      createdAt: new Date(),
      duration: payload.duration,
      frameRate: payload.frameRate,
      coverUrl: payload.coverUrl || '',
      info: {
        title: '',
        description: '',
      },
    }
  }

  function clearExportResult() {
    if (!exportedVideo.value)
      return

    revokeIfBlobUrl(exportedVideo.value.url)
    revokeIfBlobUrl(exportedVideo.value.coverUrl)
    exportedVideo.value = null
  }

  function setCoverUrl(url: string) {
    if (!exportedVideo.value)
      return

    revokeIfBlobUrl(exportedVideo.value.coverUrl)
    exportedVideo.value.coverUrl = url
  }

  function updateInfo(payload: Partial<ExportVideoInfo>) {
    if (!exportedVideo.value)
      return

    Object.assign(exportedVideo.value.info, payload)
  }

  return {
    exportedVideo,
    setExportResult,
    clearExportResult,
    setCoverUrl,
    updateInfo,
  }
})
