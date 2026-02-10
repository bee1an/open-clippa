<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { usePerformerStore } from '@/store/usePerformerStore'

const props = defineProps<{
  expanded: boolean
}>()

const emit = defineEmits<{
  toggle: []
}>()

const route = useRoute()
const performerStore = usePerformerStore()
const { selectedPerformers } = storeToRefs(performerStore)

const hasSelection = computed(() => selectedPerformers.value.length > 0)

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
    path: '/editor/animation',
    icon: 'i-ph-sparkle-bold',
    activeIcon: 'i-ph-sparkle-fill',
    title: 'Animation',
  },
  {
    path: '/editor/transition',
    icon: 'i-ph-arrow-bend-up-right-bold',
    activeIcon: 'i-ph-arrow-bend-up-right-fill',
    title: 'Transition (Unavailable)',
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
  <div
    h-full w-14 flex-shrink-0 flex flex-col items-center pt-3 gap-1 bg-background-elevated border-r border-border
    data-preserve-canvas-selection="true"
  >
    <!-- Properties (visible only when a performer is selected) -->
    <RouterLink
      v-if="hasSelection"
      to="/editor/properties"
      title="Properties"
      @click="handleItemClick('/editor/properties')"
    >
      <NavItem
        :active="route.path === '/editor/properties'"
        icon="i-ph-sliders-bold"
        active-icon="i-ph-sliders-fill"
      />
    </RouterLink>

    <div v-if="hasSelection" class="mx-3 my-0.5 h-px w-6 bg-border/50" />

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
