export interface VideoMetadata {
  duration: number
  width: number
  height: number
}

export function loadVideoMetadata(source: string | File | Blob): Promise<VideoMetadata> {
  return new Promise((resolve) => {
    const video = document.createElement('video')
    const url = typeof source === 'string' ? source : URL.createObjectURL(source)

    const cleanup = () => {
      if (typeof source !== 'string') {
        URL.revokeObjectURL(url)
      }
    }

    video.preload = 'metadata'

    video.onloadedmetadata = () => {
      const duration = Number.isFinite(video.duration) ? video.duration * 1000 : 0
      const width = video.videoWidth || video.width || 0
      const height = video.videoHeight || video.height || 0
      cleanup()
      resolve({ duration, width, height })
    }

    video.onerror = () => {
      cleanup()
      resolve({ duration: 0, width: 0, height: 0 })
    }

    video.src = url
  })
}
