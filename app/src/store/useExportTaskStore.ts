import { CanvasExport, ExportCanceledError } from 'clippc'
import { defineStore } from 'pinia'
import { nextTick } from 'vue'
import { useEditorStore } from './useEditorStore'
import { useExportStore } from './useExportStore'

export type ExportTaskStatus = 'idle' | 'exporting' | 'error' | 'canceled' | 'done'

export interface ExportTaskStartOptions {
  frameRate?: number
  filename?: string
}

interface ExportTaskResult {
  filename: string
  durationMs: number
  frameRate: number
}

const DEFAULT_EXPORT_FRAME_RATE = 60

function captureCanvasPreview(canvas: HTMLCanvasElement): string {
  try {
    return canvas.toDataURL('image/jpeg', 0.85)
  }
  catch {
    return ''
  }
}

function generateJobId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function')
    return `export-${crypto.randomUUID()}`

  return `export-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

function normalizeFrameRate(value: number | undefined): number {
  if (typeof value !== 'number' || !Number.isFinite(value))
    return DEFAULT_EXPORT_FRAME_RATE

  return Math.max(1, Math.round(value))
}

function createFilename(customName: string | undefined): string {
  if (typeof customName === 'string') {
    const trimmed = customName.trim()
    if (trimmed.length > 0)
      return trimmed
  }

  return `video-${Date.now()}.mp4`
}

export const useExportTaskStore = defineStore('export-task', () => {
  const editorStore = useEditorStore()
  const exportStore = useExportStore()

  const status = ref<ExportTaskStatus>('idle')
  const jobId = ref<string | null>(null)
  const currentFrame = ref(0)
  const totalFrames = ref(0)
  const previewUrl = ref('')
  const errorMessage = ref('')
  const result = ref<ExportTaskResult | null>(null)
  const modalOpen = ref(false)

  const activeExport = ref<CanvasExport | null>(null)

  const progress = computed(() => {
    if (totalFrames.value <= 0)
      return 0

    return Math.min(1, currentFrame.value / totalFrames.value)
  })

  function resetTransientState(): void {
    currentFrame.value = 0
    totalFrames.value = 0
    previewUrl.value = ''
    errorMessage.value = ''
  }

  function setErrorState(message: string): void {
    status.value = 'error'
    modalOpen.value = true
    result.value = null
    resetTransientState()
    errorMessage.value = message
  }

  function clearStatus(): void {
    if (status.value === 'exporting')
      return

    status.value = 'idle'
    jobId.value = null
    result.value = null
    modalOpen.value = false
    resetTransientState()
  }

  function setModalOpen(nextOpen: boolean): void {
    modalOpen.value = nextOpen
    if (!nextOpen && status.value !== 'exporting')
      clearStatus()
  }

  async function startExport(options: ExportTaskStartOptions = {}): Promise<string> {
    if (status.value === 'exporting')
      throw new Error('Export task is already running')

    try {
      await editorStore.clippa.ready
    }
    catch {
      const message = '编辑器尚未就绪'
      setErrorState(message)
      throw new Error(message)
    }

    const duration = editorStore.duration
    if (!duration || duration <= 0) {
      const message = '当前没有可导出的内容'
      setErrorState(message)
      throw new Error('当前没有可导出的内容')
    }

    if (editorStore.isPlaying)
      editorStore.clippa.pause()

    const app = editorStore.clippa.stage.app
    const canvas = app.canvas
    const frameRate = normalizeFrameRate(options.frameRate)
    const nextJobId = generateJobId()

    jobId.value = nextJobId
    status.value = 'exporting'
    modalOpen.value = true
    currentFrame.value = 0
    totalFrames.value = Math.max(1, Math.ceil((duration / 1000) * frameRate))
    previewUrl.value = captureCanvasPreview(canvas)
    errorMessage.value = ''
    result.value = null

    let lastPreviewFrame = 0
    const previewFrameInterval = Math.max(1, Math.round(frameRate / 6))

    const exportTask = new CanvasExport({
      canvas,
      duration,
      frameRate,
      nextFrame: async ({ timestampMs }) => {
        await editorStore.clippa.director.seek(timestampMs)
        await nextTick()
        await editorStore.syncTransitionFrame()
        app.renderer.render(app.stage)
      },
      onProgress: ({ currentFrame: nextFrame, totalFrames: nextTotalFrames }) => {
        if (jobId.value !== nextJobId)
          return

        currentFrame.value = nextFrame
        totalFrames.value = nextTotalFrames

        if (nextFrame - lastPreviewFrame >= previewFrameInterval || nextFrame === nextTotalFrames) {
          const preview = captureCanvasPreview(canvas)
          if (preview)
            previewUrl.value = preview

          lastPreviewFrame = nextFrame
        }
      },
    })

    activeExport.value = exportTask

    void (async () => {
      try {
        const blob = await exportTask.export()
        if (jobId.value !== nextJobId)
          return

        const filename = createFilename(options.filename)
        const coverUrl = previewUrl.value || captureCanvasPreview(canvas)

        exportStore.setExportResult({
          blob,
          filename,
          duration,
          frameRate,
          coverUrl,
        })

        status.value = 'done'
        modalOpen.value = false
        result.value = {
          filename,
          durationMs: duration,
          frameRate,
        }
      }
      catch (error) {
        if (jobId.value !== nextJobId)
          return

        if (error instanceof ExportCanceledError) {
          status.value = 'canceled'
          errorMessage.value = '导出已取消'
          modalOpen.value = true
          return
        }

        status.value = 'error'
        errorMessage.value = error instanceof Error ? error.message : '导出失败'
        modalOpen.value = true
      }
      finally {
        if (jobId.value === nextJobId)
          activeExport.value = null
      }
    })()

    return nextJobId
  }

  async function cancelExport(targetJobId?: string): Promise<void> {
    if (status.value !== 'exporting')
      return

    if (targetJobId && jobId.value && targetJobId !== jobId.value)
      return

    const active = activeExport.value
    if (!active) {
      status.value = 'canceled'
      errorMessage.value = '导出已取消'
      modalOpen.value = true
      return
    }

    await active.cancel()
  }

  function getStatus() {
    return {
      status: status.value,
      jobId: jobId.value,
      currentFrame: currentFrame.value,
      totalFrames: totalFrames.value,
      progress: progress.value,
      previewUrl: previewUrl.value,
      errorMessage: errorMessage.value,
      result: result.value,
    }
  }

  return {
    status,
    jobId,
    currentFrame,
    totalFrames,
    progress,
    previewUrl,
    errorMessage,
    result,
    modalOpen,
    startExport,
    cancelExport,
    clearStatus,
    setModalOpen,
    getStatus,
  }
})
