<script setup lang="ts">
import { storeToRefs } from 'pinia'
import AnimationPanel from '@/components/property-panel/AnimationPanel.vue'
import PropertyPanel from '@/components/property-panel/PropertyPanel.vue'
import { usePerformerStore } from '@/store/usePerformerStore'

const siderCollapsed = useStorage('siderCollapsed', false)
const route = useRoute()

const performerStore = usePerformerStore()
const { selectedPerformers } = storeToRefs(performerStore)

const hasSelection = computed(() => selectedPerformers.value.length > 0)

type SiderPanel = 'properties' | 'animation'
const siderPanel = ref<SiderPanel>('properties')

watch(hasSelection, (selected) => {
  if (selected) {
    if (siderCollapsed.value) {
      siderCollapsed.value = false
    }
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
    siderCollapsed.value = true
    return
  }

  if (siderCollapsed.value) {
    siderCollapsed.value = false
  }
}
</script>

<template>
  <div w-full h-full flex bg-background-elevated>
    <Nav
      @navigate="handleNavigate"
    />

    <div
      v-if="!siderCollapsed"
      overflow-hidden bg-background-elevated flex-1
      class="border-l border-border/50"
    >
      <div h-full overflow-y-auto>
        <template v-if="hasSelection">
          <AnimationPanel
            v-if="siderPanel === 'animation'"
            @back="siderPanel = 'properties'"
          />
          <PropertyPanel
            v-else
            @navigate:animation="siderPanel = 'animation'"
          />
        </template>
        <RouterView v-else />
      </div>
    </div>
  </div>
</template>
