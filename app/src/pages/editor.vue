<script setup lang="ts">
import { CanvasExport } from 'open-clippa'
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
  <yy-layout w-screen bg-zinc-950 text-zinc-200>
    <yy-layout-header h-14 border-b border-zinc-800 bg-zinc-900 flex items-center px-4 shadow-sm z-10>
      <AppLogo size="md" />
      <div class="flex-1" />
      <button
        class="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-md shadow-sm text-sm font-medium transition-colors border-none outline-none cursor-pointer flex items-center justify-center gap-2"
        @click="exportHandler"
      >
        <div i-carbon-export text-lg />
        <span>导出</span>
      </button>
    </yy-layout-header>
    <div flex w-full overflow-hidden h="[calc(100vh-3.5rem)]">
      <div
        :w="siderCollapsed ? '65px' : '280px'"
        flex="shrink-0"
        h-full
        bg-zinc-900
        border-r border-zinc-800
        transition="width 300ms ease-in-out"
        overflow-hidden
        class="z-20"
        @click="siderCollapsed = !siderCollapsed"
      >
        <Sider />
      </div>

      <div flex="~ 1 col" min-w-0 relative bg-zinc-950>
        <Canvas />
        <ResizableTimeline />
      <!-- <KeyboardShortcutsHelp /> -->
      </div>

      <div
        :w="rightSiderCollapsed ? '65px' : '280px'"
        flex="shrink-0"
        h-full
        bg-zinc-900
        border-l border-zinc-800
        transition="width 300ms ease-in-out"
        overflow-hidden
        style="direction: rtl"
        class="z-20"
        @click="rightSiderCollapsed = !rightSiderCollapsed"
      >
        <div style="direction: ltr">
        <!-- 右侧 Sider 内容 -->
        </div>
      </div>
    </div>
  </yy-layout>
</template>
