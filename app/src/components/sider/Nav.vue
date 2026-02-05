<script setup lang="ts">
const props = defineProps<{
  expanded: boolean
}>()

const emit = defineEmits<{
  toggle: []
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
]

function handleItemClick(path: string) {
  if (!props.expanded) {
    emit('toggle')
    return
  }

  if (route.path === path) {
    emit('toggle')
  }
}
</script>

<template>
  <div h-full w-14 flex-shrink-0 flex flex-col items-center pt-3 gap-1 bg-background-elevated border-r border-border>
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
