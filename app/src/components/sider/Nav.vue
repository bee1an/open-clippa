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
    title: 'Media',
  },
  {
    path: '/editor/filter',
    icon: 'i-ph-magic-wand-bold',
    activeIcon: 'i-ph-magic-wand-fill',
    title: 'Filter',
  },
  {
    path: '/editor/text',
    icon: 'i-ph-text-t-bold',
    activeIcon: 'i-ph-text-t-fill',
    title: 'Text',
  },
  {
    path: '/editor/transition',
    icon: 'i-ph-arrow-bend-up-right-bold',
    activeIcon: 'i-ph-arrow-bend-up-right-fill',
    title: 'Transition',
  },
]

function handleItemClick(path: string) {
  emit('navigate', path)
}
</script>

<template>
  <div
    h-full w-14 flex-shrink-0 flex flex-col items-center pt-3 gap-1 bg-background-elevated
    data-preserve-canvas-selection="true"
  >
    <RouterLink
      v-for="item in navItems"
      :key="item.path"
      :to="item.path"
      :title="item.title"
      @click="handleItemClick(item.path)"
    >
      <NavItem
        :active="route.path === item.path"
        :icon="item.icon"
        :active-icon="item.activeIcon"
      />
    </RouterLink>
  </div>
</template>
