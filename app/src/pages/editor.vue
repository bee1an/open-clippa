<script setup lang="ts">

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

      <yy-layout overflow-hidden>
        <yy-layout-content content-class="h-[calc(100vh-300px)]">
          <Canvas />
        </yy-layout-content>
        <yy-layout-footer>
          <TimelineCmp />
        </yy-layout-footer>
      </yy-layout>
    </yy-layout>
  </yy-layout>
</template>
