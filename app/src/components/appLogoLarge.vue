<script setup lang="ts">
// 大尺寸 Logo 组件，用于启动页面或欢迎页面
</script>

<template>
  <div class="logo-large" flex="~ col" items-center gap-6>
    <!-- 大标题 -->
    <div class="logo-text-large" flex items-baseline gap-2>
      <h1 class="text-5xl font-semibold text-blue-400">
        open
      </h1>
      <h1 class="text-5xl font-light text-gray-300">
        clippa
      </h1>
    </div>

    <!-- 副标题 -->
    <p class="text-gray-400 text-lg font-light tracking-wide">
      Professional Video Editor
    </p>
  </div>
</template>

<style scoped>
.logo-large {
  user-select: none;
}

.logo-text-large {
  font-family:
    'Inter',
    -apple-system,
    BlinkMacSystemFont,
    sans-serif;
  letter-spacing: -0.03em;
}
</style>
