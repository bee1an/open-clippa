<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useEditorStore } from '@/store/useEditorStore'

definePage({ redirect: '/editor/media' })

const editorStore = useEditorStore()
const clippa = computed(() => editorStore.clippa)
const isClippaReady = ref(false)

// 等待 clippa 准备就绪
onMounted(async () => {
  try {
    await editorStore.clippa.ready
    isClippaReady.value = true
  } catch (error) {
    console.error('Clippa ready failed:', error)
  }
})
</script>

<template>
  <yy-layout w-screen>
    <yy-layout-header h50px bordered flex items-center px-4>
      <AppLogo size="md" />
      <div class="flex-1" />
      <VideoExporter :clippa="isClippaReady ? clippa : undefined" />
    </yy-layout-header>

    <yy-layout has-sider max-w-full>
      <yy-layout-sider
        w300px
        content-class="h-[calc(100vh-50px)] p-y-2"
        collapsed-width="65"
        collapsed
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
