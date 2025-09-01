<script setup lang="ts">
definePage({ redirect: '/editor/media' })
</script>

<template>
  <yy-layout w-screen>
    <yy-layout-header h50px bordered flex items-center pl-2>
      open-clippa
    </yy-layout-header>

    <yy-layout has-sider max-w-full>
      <yy-layout-sider
        w300px
        content-class="h-[calc(100vh-50px)] p-y-2"
        collapsed-width="65"
      >
        <Sider />
      </yy-layout-sider>

      <div flex-1 flex="~ col">
        <div class="flex-1">
          <Canvas />
        </div>
        <ResizableTimeline />
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
