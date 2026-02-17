<script setup lang="ts">
import { storeToRefs } from 'pinia'
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
import { useExportTaskStore } from '@/store/useExportTaskStore'
import { useLayoutStore } from '@/store/useLayoutStore'

definePage({ redirect: '/editor/media' })

const editorStore = useEditorStore()
const exportTaskStore = useExportTaskStore()
const aiSettingsStore = useAiSettingsStore()
const layoutStore = useLayoutStore()
const router = useRouter()
const isClippaReady = ref(false)
const exportFrameRate = 60
const showDebugPanel = import.meta.env.DEV
const { panelOpen: chatPanelOpen } = storeToRefs(aiSettingsStore)
const { siderCollapsed } = storeToRefs(layoutStore)
const {
  status: exportStatus,
  modalOpen: exportModalOpen,
  currentFrame: exportCurrentFrame,
  totalFrames: exportTotalFrames,
  previewUrl: exportPreviewUrl,
  errorMessage: exportErrorMessage,
} = storeToRefs(exportTaskStore)
const isExporting = computed(() => exportStatus.value === 'exporting')

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

async function exportHandler() {
  if (isExporting.value)
    return

  try {
    await exportTaskStore.startExport({
      frameRate: exportFrameRate,
    })
  }
  catch (error) {
    console.error('[editor] start export failed', error)
  }
}

function handleExportModalUpdate(value: boolean) {
  exportTaskStore.setModalOpen(value)
}

async function handleExportCancel() {
  await exportTaskStore.cancelExport()
}

function toggleChatPanel(): void {
  aiSettingsStore.setPanelOpen(!chatPanelOpen.value)
}

watch(exportStatus, (nextStatus) => {
  if (nextStatus === 'done')
    router.push('/export')
})
</script>

<template>
  <div w-full h-full bg-background text-foreground flex="~ col">
    <!-- Header - Minimalist Compact -->
    <header h-12 bg-background flex items-center px-4 z-50 shrink-0 gap-4>
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
        :style="{
          width: chatPanelOpen ? '360px' : '0px',
          marginLeft: chatPanelOpen ? '1rem' : '0px',
          marginRight: chatPanelOpen ? '1rem' : '0px',
        }"
        class="shrink-0 overflow-hidden transition-all duration-300 ease-[cubic-bezier(0.25,1,0.5,1)] my-4 rounded-2xl bg-background-elevated shadow-sm flex flex-col"
        :class="chatPanelOpen ? 'border' : 'border-0'"
        border="border/50"
      >
        <ChatPanel v-if="chatPanelOpen" />
      </aside>

      <!-- Right Column Group -->
      <div flex flex-col flex-1 min-w-0 relative h-full overflow-hidden>
        <!-- Top Row: Canvas + Right Side -->
        <div flex flex-1 min-h-0 relative w-full>
          <!-- Center Stage -->
          <main flex-1 flex flex-col min-w-0 bg-background relative z-0>
            <div flex-1 relative overflow-hidden flex items-center justify-center bg-background>
              <!-- Canvas Container with subtle pattern or shadow -->
              <Canvas />
            </div>
          </main>

          <!-- Right Sider -->
          <aside
            :style="{ width: siderCollapsed ? '56px' : '320px' }"
            class="shrink-0 bg-background-elevated border transition-all duration-300 ease-[cubic-bezier(0.25,1,0.5,1)] z-40 flex flex-col relative group overflow-hidden my-4 ml-4 mr-4 rounded-2xl shadow-sm"
            border="border/50"
          >
            <Sider />
          </aside>
        </div>

        <!-- Bottom Timeline -->
        <ResizableTimeline />
      </div>
    </div>

    <DebugPanel v-if="showDebugPanel" />

    <ExportProgressModal
      :model-value="exportModalOpen"
      :status="exportStatus"
      :current-frame="exportCurrentFrame"
      :total-frames="exportTotalFrames"
      :preview-url="exportPreviewUrl"
      :error-message="exportErrorMessage"
      @update:model-value="handleExportModalUpdate"
      @cancel="handleExportCancel"
    />
  </div>
</template>
