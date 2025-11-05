<script setup lang="ts">
import { CanvasExport } from 'open-clippa'
import { useEditorStore } from '@/store/useEditorStore'

definePage({ redirect: '/editor/media' })

const siderCollapsed = useStorage('siderCollapsed', false)

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
  <yy-layout w-screen>
    <yy-layout-header h50px bordered flex items-center px-4>
      <AppLogo size="md" />
      <div class="flex-1" />
      <yy-button @click="exportHandler">
        导出
      </yy-button>
    </yy-layout-header>

    <yy-layout has-sider max-w-full>
      <yy-layout-sider
        w300px
        content-class="h-[calc(100vh-50px)] p-y-2"
        collapsed-width="65"
        :collapsed="siderCollapsed"
        @collapsed="siderCollapsed = true"
        @expanded="siderCollapsed = false"
      >
        <Sider />
      </yy-layout-sider>

      <div flex-1 flex="~ col" relative bg="#1e1e29">
        <Canvas />
        <ResizableTimeline />
        <!-- <KeyboardShortcutsHelp /> -->
      </div>
      <!-- <yy-layout overflow-hidden>
        <yy-layout-content content-class="h-[calc(100vh-300px)]">

        </yy-layout-content>
        <yy-layout-footer>

        </yy-layout-footer>
      </yy-layout> -->
    </yy-layout>
  </yy-layout>
</template>
