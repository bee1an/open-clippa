<script setup lang="ts">
definePage({ redirect: '/editor/media' })

function handleExport() {
  // 这里可以添加导出逻辑
  console.warn('导出功能尚未实现')
}
</script>

<template>
  <yy-layout w-screen>
    <yy-layout-header h50px bordered flex items-center px-4>
      <AppLogo size="md" />
      <div class="flex-1" />
      <yy-button type="primary" @click="handleExport">
        导出
      </yy-button>
    </yy-layout-header>

    <yy-layout has-sider max-w-full>
      <yy-layout-sider
        w300px
        content-class="h-[calc(100vh-50px)] p-y-2"
        collapsed-width="65"
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
