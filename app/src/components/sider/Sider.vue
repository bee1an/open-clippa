<script setup lang="ts">
import { storeToRefs } from 'pinia'
import AnimationPanel from '@/components/property-panel/AnimationPanel.vue'
import PropertyPanel from '@/components/property-panel/PropertyPanel.vue'
import { useLayoutStore } from '@/store/useLayoutStore'
import { usePerformerStore } from '@/store/usePerformerStore'

const route = useRoute()

const performerStore = usePerformerStore()
const layoutStore = useLayoutStore()
const { selectedPerformers } = storeToRefs(performerStore)
const { siderCollapsed } = storeToRefs(layoutStore)

const hasSelection = computed(() => selectedPerformers.value.length > 0)

type SiderPanel = 'properties' | 'animation'
const siderPanel = ref<SiderPanel>('properties')

watch(hasSelection, (selected) => {
  if (selected) {
    if (siderCollapsed.value)
      layoutStore.setSiderCollapsed(false)
    siderPanel.value = 'properties'
  }
  else {
    siderPanel.value = 'properties'
  }
})

function handleNavigate(path: string) {
  // if properties panel is showing, first click just dismisses it
  if (hasSelection.value) {
    performerStore.clearSelection()
    return
  }

  if (!siderCollapsed.value && route.path === path) {
    layoutStore.setSiderCollapsed(true)
    return
  }

  if (siderCollapsed.value)
    layoutStore.setSiderCollapsed(false)
}
</script>

<template>
  <div w-full h-full relative bg-background-elevated>
    <div
      h-full overflow-hidden bg-background-elevated mr-16 min-w-0
      class="transition-opacity duration-220 ease-[cubic-bezier(0.25,1,0.5,1)]"
      border="border/50"
      :class="siderCollapsed
        ? 'opacity-0 pointer-events-none border-r-0'
        : 'opacity-100 border-r'"
    >
      <div h-full overflow-y-auto>
        <template v-if="hasSelection">
          <AnimationPanel
            v-if="siderPanel === 'animation'"
            @back="siderPanel = 'properties'"
          />
          <PropertyPanel
            v-else
            @navigate-animation="siderPanel = 'animation'"
          />
        </template>
        <RouterView v-else />
      </div>
    </div>

    <div absolute inset-y-0 right-0>
      <Nav
        @navigate="handleNavigate"
      />
    </div>
  </div>
</template>
