<script setup lang="ts">
import { CanvasExport, ExportCanceledError } from 'open-clippa'
import { useRouter } from 'vue-router'
import ExportProgressModal from '@/components/ExportProgressModal.vue'
import { Button } from '@/components/ui/button'
import { useFilterEngine } from '@/composables/useFilterEngine'
import { useEditorStore } from '@/store/useEditorStore'
import { useExportStore } from '@/store/useExportStore'

definePage({ redirect: '/editor/media' })

const siderCollapsed = useStorage('siderCollapsed', false)
const rightSiderCollapsed = useStorage('rightSiderCollapsed', false)

const editorStore = useEditorStore()
const exportStore = useExportStore()
const router = useRouter()
const isClippaReady = ref(false)
const exportFrameRate = 30

const exportState = reactive({
  open: false,
  status: 'idle' as 'idle' | 'exporting' | 'error' | 'canceled',
  currentFrame: 0,
  totalFrames: 0,
  previewUrl: '',
  errorMessage: '',
})

const isExporting = computed(() => exportState.status === 'exporting')
const exportInstance = ref<CanvasExport | null>(null)

useFilterEngine()

// 等待 clippa 准备就绪
onMounted(async () => {
  try {
    await editorStore.clippa.ready
    isClippaReady.value = true
  }
  catch (error) {
    console.error('Clippa ready failed:', error)
  }
})

function captureCanvasPreview(canvas: HTMLCanvasElement) {
  try {
    return canvas.toDataURL('image/jpeg', 0.85)
  }
  catch {
    return ''
  }
}

function resetExportState() {
  exportState.status = 'idle'
  exportState.currentFrame = 0
  exportState.totalFrames = 0
  exportState.previewUrl = ''
  exportState.errorMessage = ''
}

function openExportError(message: string) {
  exportState.open = true
  exportState.status = 'error'
  exportState.errorMessage = message
}

async function exportHandler() {
  if (isExporting.value)
    return

  if (!isClippaReady.value) {
    openExportError('Editor is not ready yet')
    return
  }

  const duration = editorStore.duration
  if (!duration || duration <= 0) {
    openExportError('Nothing to export')
    return
  }

  exportState.open = true
  exportState.status = 'exporting'
  exportState.currentFrame = 0
  exportState.totalFrames = Math.floor((duration / 1000) * exportFrameRate)
  exportState.previewUrl = ''
  exportState.errorMessage = ''

  const canvas = editorStore.clippa.stage.app.canvas
  exportState.previewUrl = captureCanvasPreview(canvas)
  const frameStep = 1000 / exportFrameRate
  let exportTime = 0
  let lastPreviewFrame = 0
  const previewFrameInterval = Math.max(1, Math.round(exportFrameRate / 6))

  const exportTask = new CanvasExport({
    canvas,
    duration,
    frameRate: exportFrameRate,
    nextFrame: async () => {
      await editorStore.clippa.director.seek(exportTime)
      exportTime = Math.min(duration, exportTime + frameStep)
      return new Promise((resolve) => {
        requestAnimationFrame(() => {
          resolve()
        })
      })
    },
    onProgress: ({ currentFrame, totalFrames }) => {
      exportState.currentFrame = currentFrame
      exportState.totalFrames = totalFrames

      if (currentFrame - lastPreviewFrame >= previewFrameInterval || currentFrame === totalFrames) {
        const preview = captureCanvasPreview(canvas)
        if (preview)
          exportState.previewUrl = preview
        lastPreviewFrame = currentFrame
      }
    },
  })
  exportInstance.value = exportTask

  try {
    const blob = await exportTask.export()
    const filename = `video-${Date.now()}.mp4`
    const coverUrl = exportState.previewUrl || captureCanvasPreview(canvas)

    exportStore.setExportResult({
      blob,
      filename,
      duration,
      frameRate: exportFrameRate,
      coverUrl,
    })

    exportState.open = false
    resetExportState()
    router.push('/export')
  }
  catch (error) {
    if (error instanceof ExportCanceledError) {
      exportState.status = 'canceled'
      exportState.errorMessage = 'Export canceled'
      return
    }

    const message = error instanceof Error ? error.message : 'Export failed'
    openExportError(message)
  }
  finally {
    exportInstance.value = null
  }
}

function handleExportModalUpdate(value: boolean) {
  exportState.open = value
  if (!value && exportState.status !== 'exporting')
    resetExportState()
}

async function handleExportCancel() {
  if (!exportInstance.value)
    return

  await exportInstance.value.cancel()
}
</script>

<template>
  <div w-full h-full bg-background text-foreground flex="~ col">
    <!-- Header - Minimalist Compact -->
    <header h-12 border-b border-border bg-background flex items-center px-4 z-50 shrink-0 gap-4>
      <div flex items-center gap-3>
        <AppLogo size="sm" />
      </div>

      <div flex-1 />

      <div flex items-center gap-1>
        <!-- Left Sidebar Toggle -->
        <button
          w-8 h-8 rounded hover:bg-secondary flex items-center justify-center text-foreground-muted hover:text-foreground transition-colors
          title="Toggle Left Sidebar"
          @click="siderCollapsed = !siderCollapsed"
        >
          <div :class="!siderCollapsed ? 'i-ph-sidebar-simple-fill' : 'i-ph-sidebar-simple-bold'" text-lg />
        </button>

        <!-- Right Sidebar Toggle -->
        <button
          w-8 h-8 rounded hover:bg-secondary flex items-center justify-center text-foreground-muted hover:text-foreground transition-colors
          title="Toggle Right Sidebar"
          @click="rightSiderCollapsed = !rightSiderCollapsed"
        >
          <div :class="!rightSiderCollapsed ? 'i-ph-sidebar-simple-fill' : 'i-ph-sidebar-simple-bold'" text-lg transform="scale-x-[-1]" />
        </button>

        <div w-px h-4 bg-border mx-2 />

        <Button
          h-8 px-3 rounded text-xs font-medium bg-foreground text-background hover:bg-foreground-90 transition-colors gap-1.5 shadow-sm
          :disabled="!isClippaReady || isExporting"
          @click="exportHandler"
        >
          <div i-ph-export-bold text-sm />
          <span>{{ isExporting ? 'Exporting' : 'Export' }}</span>
        </Button>
      </div>
    </header>

    <!-- Main Workspace -->
    <div flex flex-1 w-full overflow-hidden relative>
      <!-- Left Sider -->
      <aside
        :style="{ width: siderCollapsed ? '56px' : '280px' }"
        flex-shrink-0 bg-background-elevated border-r border="border/50" transition-all duration-300 ease="[cubic-bezier(0.25,1,0.5,1)]" z-40 flex flex-col relative group
      >
        <Sider />
      </aside>

      <!-- Center Stage -->
      <main flex-1 flex flex-col min-w-0 bg-background relative z-0>
        <div flex-1 relative overflow-hidden flex items-center justify-center bg-background>
          <!-- Canvas Container with subtle pattern or shadow -->
          <Canvas />
        </div>
        <ResizableTimeline />
      </main>

      <!-- Right Sider -->
      <aside
        :style="{ width: rightSiderCollapsed ? '0px' : '280px' }"
        flex-shrink-0
        bg-background-elevated
        border-l border="border/50"
        transition-all duration-300 ease-in-out
        z-40
        flex flex-col
      >
        <div h-full overflow-hidden w-280px>
          <!-- Right Sider Content -->
          <div p-4 text-sm text-foreground-muted text-center mt-10>
            属性面板
          </div>
        </div>
      </aside>
    </div>

    <ExportProgressModal
      :model-value="exportState.open"
      :status="exportState.status"
      :current-frame="exportState.currentFrame"
      :total-frames="exportState.totalFrames"
      :preview-url="exportState.previewUrl"
      :error-message="exportState.errorMessage"
      @update:model-value="handleExportModalUpdate"
      @cancel="handleExportCancel"
    />
  </div>
</template>
