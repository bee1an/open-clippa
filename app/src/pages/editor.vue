<script setup lang="ts">
import { CanvasExport, ExportCanceledError } from 'clippc'
import { storeToRefs } from 'pinia'
import { nextTick } from 'vue'
import { useRouter } from 'vue-router'
import ChatPanel from '@/components/chat/ChatPanel.vue'
import DebugPanel from '@/components/DebugPanel.vue'
import ExportProgressModal from '@/components/ExportProgressModal.vue'
import { Button } from '@/components/ui/button'
import { useFilterEngine } from '@/composables/useFilterEngine'
import { useTimelineBinding } from '@/composables/useTimelineBinding'
import { useTransitionEngine } from '@/composables/useTransitionEngine'
import { useAiSettingsStore } from '@/store/useAiSettingsStore'
import { useEditorStore } from '@/store/useEditorStore'
import { useExportStore } from '@/store/useExportStore'
import { useLayoutStore } from '@/store/useLayoutStore'

definePage({ redirect: '/editor/media' })

const editorStore = useEditorStore()
const exportStore = useExportStore()
const aiSettingsStore = useAiSettingsStore()
const layoutStore = useLayoutStore()
const router = useRouter()
const isClippaReady = ref(false)
const exportFrameRate = 60
const showDebugPanel = import.meta.env.DEV
const { panelOpen: chatPanelOpen } = storeToRefs(aiSettingsStore)
const { siderCollapsed } = storeToRefs(layoutStore)

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
useTimelineBinding()
useTransitionEngine()

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
    openExportError('编辑器尚未就绪')
    return
  }

  const duration = editorStore.duration
  if (!duration || duration <= 0) {
    openExportError('当前没有可导出的内容')
    return
  }

  if (editorStore.isPlaying)
    editorStore.clippa.pause()

  exportState.open = true
  exportState.status = 'exporting'
  exportState.currentFrame = 0
  exportState.totalFrames = Math.max(1, Math.ceil((duration / 1000) * exportFrameRate))
  exportState.previewUrl = ''
  exportState.errorMessage = ''

  const app = editorStore.clippa.stage.app
  const canvas = app.canvas
  exportState.previewUrl = captureCanvasPreview(canvas)
  let lastPreviewFrame = 0
  const previewFrameInterval = Math.max(1, Math.round(exportFrameRate / 6))

  const exportTask = new CanvasExport({
    canvas,
    duration,
    frameRate: exportFrameRate,
    nextFrame: async ({ timestampMs }) => {
      await editorStore.clippa.director.seek(timestampMs)
      await nextTick()
      await editorStore.syncTransitionFrame()
      app.renderer.render(app.stage)
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
      exportState.errorMessage = '导出已取消'
      return
    }

    const message = error instanceof Error ? error.message : '导出失败'
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

function toggleChatPanel(): void {
  aiSettingsStore.setPanelOpen(!chatPanelOpen.value)
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
        <!-- Right Sidebar Toggle -->
        <button
          w-8 h-8 rounded hover:bg-secondary flex items-center justify-center text-foreground-muted hover:text-foreground transition-colors
          title="切换右侧栏"
          @click="layoutStore.toggleSiderCollapsed()"
        >
          <div :class="!siderCollapsed ? 'i-ph-sidebar-simple-fill' : 'i-ph-sidebar-simple-bold'" text-lg />
        </button>

        <div w-px h-4 bg-border mx-2 />

        <button
          w-8 h-8 rounded hover:bg-secondary flex items-center justify-center text-foreground-muted hover:text-foreground transition-colors
          :title="chatPanelOpen ? '隐藏 AI 助手' : '显示 AI 助手'"
          @click="toggleChatPanel"
        >
          <div :class="chatPanelOpen ? 'i-ph-chat-circle-text-fill' : 'i-ph-chat-circle-text-bold'" text-lg />
        </button>

        <div w-px h-4 bg-border mx-2 />

        <Button
          h-8 px-3 rounded text-xs font-medium bg-foreground text-background hover:bg-foreground-90 transition-colors gap-1.5 shadow-sm
          :disabled="!isClippaReady || isExporting"
          @click="exportHandler"
        >
          <div i-ph-export-bold text-sm />
          <span>{{ isExporting ? '导出中' : '导出' }}</span>
        </Button>
      </div>
    </header>

    <!-- Main Workspace -->
    <div flex flex-1 w-full overflow-hidden relative>
      <!-- Left Chat Panel -->
      <aside
        :style="{ width: chatPanelOpen ? '360px' : '0px' }"
        class="h-full shrink-0 overflow-hidden transition-[width] duration-300 ease-[cubic-bezier(0.25,1,0.5,1)]"
        :class="chatPanelOpen ? 'border-r' : 'border-r-0'"
        border="border/50"
      >
        <ChatPanel v-if="chatPanelOpen" />
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
        :style="{ width: siderCollapsed ? '56px' : '320px' }"
        class="h-full shrink-0 bg-background-elevated border-l transition-[width] duration-300 ease-[cubic-bezier(0.25,1,0.5,1)] z-40 flex flex-col relative group overflow-hidden"
        border="border/50"
      >
        <Sider />
      </aside>
    </div>

    <DebugPanel v-if="showDebugPanel" />

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
