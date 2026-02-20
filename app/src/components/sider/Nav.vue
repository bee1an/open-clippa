<script setup lang="ts">
const emit = defineEmits<{
  navigate: [path: string]
}>()

const route = useRoute()

const navItems = [
  {
    path: '/editor/media',
    icon: 'i-ph-film-strip-bold',
    activeIcon: 'i-ph-film-strip-fill',
    title: '媒体',
  },
  {
    path: '/editor/filter',
    icon: 'i-ph-magic-wand-bold',
    activeIcon: 'i-ph-magic-wand-fill',
    title: '滤镜',
  },
  {
    path: '/editor/text',
    icon: 'i-ph-text-t-bold',
    activeIcon: 'i-ph-text-t-fill',
    title: '文本',
  },
  {
    path: '/editor/transition',
    icon: 'i-ph-arrow-bend-up-right-bold',
    activeIcon: 'i-ph-arrow-bend-up-right-fill',
    title: '转场',
  },
  {
    path: '/editor/video-library',
    icon: 'i-ph-video-camera-bold',
    activeIcon: 'i-ph-video-camera-fill',
    title: '视频库',
  },
  {
    path: '/editor/image-library',
    icon: 'i-ph-image-bold',
    activeIcon: 'i-ph-image-fill',
    title: '图片库',
  },
]

function handleItemClick(path: string) {
  emit('navigate', path)
}
</script>

<template>
  <div
    h-full w-16 flex-shrink-0 flex flex-col items-center pt-3 pb-3 gap-2 bg-background-elevated overflow-y-auto overflow-x-hidden
    data-preserve-canvas-selection="true"
  >
    <RouterLink
      v-for="item in navItems"
      :key="item.path"
      :to="item.path"
      @click="handleItemClick(item.path)"
      class="w-full select-none"
    >
      <NavItem
        :active="route.path === item.path"
        :icon="item.icon"
        :active-icon="item.activeIcon"
        :title="item.title"
      />
    </RouterLink>
  </div>
</template>
