<script setup lang="ts">
import { buildRouteWithProjectId, resolveRouteProjectId } from '@/utils/projectRoute'

const emit = defineEmits<{
  navigate: [path: string]
}>()

const route = useRoute()
const routeProjectId = computed(() => resolveRouteProjectId(route.params.projectId as string | string[] | undefined))

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
  emit('navigate', buildNavPath(path))
}

function buildNavTarget(path: string) {
  return buildRouteWithProjectId(path, routeProjectId.value)
}

function buildNavPath(path: string): string {
  const target = buildRouteWithProjectId(path, routeProjectId.value)
  if (typeof target === 'string')
    return target

  return typeof target.path === 'string' ? target.path : path
}

function isItemActive(path: string): boolean {
  return route.path === buildNavPath(path)
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
      :to="buildNavTarget(item.path)"
      class="w-full select-none"
      @click="handleItemClick(item.path)"
    >
      <NavItem
        :active="isItemActive(item.path)"
        :icon="item.icon"
        :active-icon="item.activeIcon"
        :title="item.title"
      />
    </RouterLink>
  </div>
</template>
