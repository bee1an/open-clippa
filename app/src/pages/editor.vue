<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { useRouter } from 'vue-router'
import ChatPanel from '@/components/chat/ChatPanel.vue'
import DebugPanel from '@/components/DebugPanel.vue'
import ExportProgressModal from '@/components/ExportProgressModal.vue'
import { Button } from '@/components/ui/button'
import { useEditorCommandActions } from '@/composables/useEditorCommandActions'
import { useFilterEngine } from '@/composables/useFilterEngine'
import { useThemeColor } from '@/composables/useThemeColor'
import { useTimelineBinding } from '@/composables/useTimelineBinding'
import { useTransitionEngine } from '@/composables/useTransitionEngine'
import { useAiSettingsStore } from '@/store/useAiSettingsStore'
import { useEditorStore } from '@/store/useEditorStore'
import { useExportTaskStore } from '@/store/useExportTaskStore'
import { useHistoryStore } from '@/store/useHistoryStore'
import { useLayoutStore } from '@/store/useLayoutStore'

definePage({ redirect: '/editor/media' })

const editorStore = useEditorStore()
const exportTaskStore = useExportTaskStore()
const aiSettingsStore = useAiSettingsStore()
const layoutStore = useLayoutStore()
const historyStore = useHistoryStore()
const editorCommandActions = useEditorCommandActions()
const router = useRouter()
const {
  activePresetId,
  themeColorPresets,
  setPrimaryPreset,
  previewPrimaryPreset,
  restorePrimaryPreview,
} = useThemeColor()
const themePickerRef = ref<HTMLElement | null>(null)
const showThemePicker = ref(false)
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
  previewCanvasSize: exportPreviewCanvasSize,
  errorMessage: exportErrorMessage,
} = storeToRefs(exportTaskStore)
const isExporting = computed(() => exportStatus.value === 'exporting')
const SIDER_MAIN_ICON = {
  expanded: 'i-ph-sidebar-simple-fill [transform:scaleX(-1)]',
  collapsed: 'i-ph-sidebar-simple-bold [transform:scaleX(-1)]',
} as const
const CHAT_MAIN_ICON = {
  expanded: 'i-ph-chat-circle-text-fill',
  collapsed: 'i-ph-chat-circle-text-bold',
} as const
const rightPanelMainIcon = computed(() => {
  return siderCollapsed.value ? SIDER_MAIN_ICON.collapsed : SIDER_MAIN_ICON.expanded
})
const leftPanelMainIcon = computed(() => {
  return chatPanelOpen.value ? CHAT_MAIN_ICON.expanded : CHAT_MAIN_ICON.collapsed
})
const leftPanelToggleClass = computed(() => {
  return chatPanelOpen.value
    ? 'bg-secondary text-foreground'
    : 'text-foreground-muted hover:text-foreground'
})
const rightPanelToggleClass = computed(() => {
  return siderCollapsed.value
    ? 'text-foreground-muted hover:text-foreground'
    : 'bg-secondary text-foreground'
})
const canUndo = computed(() => {
  return historyStore.status.value.canUndo
    && !historyStore.state.value.isApplying
    && !historyStore.state.value.activeTransaction
})
const canRedo = computed(() => {
  return historyStore.status.value.canRedo
    && !historyStore.state.value.isApplying
    && !historyStore.state.value.activeTransaction
})

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

function handleUndoClick(): void {
  if (!canUndo.value)
    return

  void editorCommandActions.historyUndo()
}

function handleRedoClick(): void {
  if (!canRedo.value)
    return

  void editorCommandActions.historyRedo()
}

function toggleThemePicker(): void {
  if (showThemePicker.value)
    restorePrimaryPreview()
  showThemePicker.value = !showThemePicker.value
}

function applyThemePreset(presetId: Parameters<typeof setPrimaryPreset>[0]): void {
  setPrimaryPreset(presetId)
  showThemePicker.value = false
}

function previewThemePreset(presetId: Parameters<typeof setPrimaryPreset>[0]): void {
  previewPrimaryPreset(presetId)
}

function restoreThemePreview(): void {
  restorePrimaryPreview()
}

onClickOutside(themePickerRef, () => {
  restoreThemePreview()
  showThemePicker.value = false
})

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
        <div ref="themePickerRef" class="relative">
          <button
            w-8 h-8 rounded flex items-center justify-center transition-colors
            :class="showThemePicker ? 'bg-secondary text-foreground' : 'text-foreground-muted hover:text-foreground'"
            title="切换主题色"
            aria-label="切换主题色"
            :aria-expanded="showThemePicker"
            :aria-haspopup="true"
            @click="toggleThemePicker"
          >
            <div i-ph-palette-bold text="[18px]" />
          </button>

          <div
            v-if="showThemePicker"
            class="absolute right-0 top-10 z-100 rounded-lg border border-border bg-background-elevated p-2 shadow-md"
            @mouseleave="restoreThemePreview"
          >
            <div class="flex items-center gap-1">
              <button
                v-for="preset in themeColorPresets"
                :key="preset.id"
                w-4 h-4 rounded-full border transition-all duration-150
                :class="activePresetId === preset.id ? 'border-foreground scale-110' : 'border-border hover:border-foreground-muted'"
                :title="`切换主题色为 ${preset.label}`"
                :aria-label="`切换主题色为 ${preset.label}`"
                :aria-pressed="activePresetId === preset.id"
                :style="{ backgroundColor: preset.hex }"
                @mouseenter="previewThemePreset(preset.id)"
                @click="applyThemePreset(preset.id)"
              />
            </div>
          </div>
        </div>

        <div w-px h-4 bg-border mx-2 />

        <button
          w-8 h-8 rounded flex items-center justify-center transition-colors
          :class="canUndo ? 'text-foreground-muted hover:text-foreground hover:bg-secondary' : 'text-foreground-muted opacity-30 cursor-not-allowed'"
          :disabled="!canUndo"
          :title="canUndo ? '撤销 (Cmd/Ctrl+Z)' : '暂无可撤销操作'"
          aria-label="撤销"
          data-preserve-canvas-selection="true"
          @click="handleUndoClick"
        >
          <div i-ph-arrow-counter-clockwise-bold text="[18px]" />
        </button>

        <button
          w-8 h-8 rounded flex items-center justify-center transition-colors
          :class="canRedo ? 'text-foreground-muted hover:text-foreground hover:bg-secondary' : 'text-foreground-muted opacity-30 cursor-not-allowed'"
          :disabled="!canRedo"
          :title="canRedo ? '重做 (Cmd+Shift+Z / Ctrl+Y)' : '暂无可重做操作'"
          aria-label="重做"
          data-preserve-canvas-selection="true"
          @click="handleRedoClick"
        >
          <div i-ph-arrow-clockwise-bold text="[18px]" />
        </button>

        <div w-px h-4 bg-border mx-2 />

        <!-- Left AI Toggle -->
        <button
          w-8 h-8 rounded flex items-center justify-center transition-colors
          :class="leftPanelToggleClass"
          :title="chatPanelOpen ? '收起左侧 AI 面板' : '展开左侧 AI 面板'"
          :aria-pressed="chatPanelOpen"
          aria-label="左侧 AI 面板开关"
          @click="toggleChatPanel"
        >
          <div :class="leftPanelMainIcon" text="[18px]" />
        </button>

        <div w-px h-4 bg-border mx-2 />

        <!-- Right Sidebar Toggle -->
        <button
          w-8 h-8 rounded flex items-center justify-center transition-colors
          :class="rightPanelToggleClass"
          :title="siderCollapsed ? '展开右侧面板' : '收起右侧面板'"
          :aria-pressed="!siderCollapsed"
          aria-label="右侧面板开关"
          @click="layoutStore.toggleSiderCollapsed()"
        >
          <div :class="rightPanelMainIcon" text="[18px]" />
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
            :style="{ width: siderCollapsed ? '64px' : '320px' }"
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
      :preview-canvas-size="exportPreviewCanvasSize"
      :error-message="exportErrorMessage"
      @update:model-value="handleExportModalUpdate"
      @cancel="handleExportCancel"
    />
  </div>
</template>
