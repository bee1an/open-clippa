<script setup lang="ts">
import { CanvasExport } from 'open-clippa'
import { Button } from '@/components/ui/button'
import { useEditorStore } from '@/store/useEditorStore'

definePage({ redirect: '/editor/media' })

const siderCollapsed = useStorage('siderCollapsed', false)
const rightSiderCollapsed = useStorage('rightSiderCollapsed', false)

const editorStore = useEditorStore()
const isClippaReady = ref(false)

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

function exportHandler() {
  const exportInstance = new CanvasExport({
    canvas: editorStore.clippa.stage.app.canvas,
    duration: editorStore.duration,
    frameRate: 30,
    nextFrame: async () => {
      await editorStore.clippa.director.seek(editorStore.currentTime + 1000 / 30)
      return new Promise((resolve) => {
        requestAnimationFrame(() => {
          resolve()
        })
      })
    },
  })

  exportInstance.export().then((blob) => {
    console.warn('导出成功', blob)

    // 创建下载链接
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `video-${Date.now()}.mp4`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)

    // 清理 URL
    setTimeout(() => URL.revokeObjectURL(url), 100)
  }).catch((error) => {
    console.error('导出失败:', error)
  })
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
          @click="exportHandler"
        >
          <div i-ph-export-bold text-sm />
          <span>Export</span>
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
  </div>
</template>
