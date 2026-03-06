<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { Audio } from '@clippc/performer'
import AnimationPanel from '@/components/property-panel/AnimationPanel.vue'
import PropertyPanel from '@/components/property-panel/PropertyPanel.vue'
import { useEditorCommandActions } from '@/composables/useEditorCommandActions'
import { useEditorStore } from '@/store/useEditorStore'
import { useLayoutStore } from '@/store/useLayoutStore'
import { usePerformerStore } from '@/store/usePerformerStore'

const route = useRoute()

const editorStore = useEditorStore()
const performerStore = usePerformerStore()
const editorCommandActions = useEditorCommandActions()
const layoutStore = useLayoutStore()
const { selectedPerformers } = storeToRefs(performerStore)
const { siderCollapsed } = storeToRefs(layoutStore)
const activeTrainId = ref<string | null>(editorStore.clippa.timeline.state.activeTrain?.id ?? null)

function handleActiveTrainChanged(train: { id: string } | null): void {
  activeTrainId.value = train?.id ?? null
}

onMounted(() => {
  editorStore.clippa.timeline.state.on('activeTrainChanged', handleActiveTrainChanged)
})

onUnmounted(() => {
  editorStore.clippa.timeline.state.off('activeTrainChanged', handleActiveTrainChanged)
})

const hasSelection = computed(() => {
  if (selectedPerformers.value.length > 0)
    return true

  const activePerformer = activeTrainId.value ? performerStore.getPerformerById(activeTrainId.value) : null
  return activePerformer instanceof Audio
})

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
    const activePerformer = activeTrainId.value ? performerStore.getPerformerById(activeTrainId.value) : null
    if (activePerformer instanceof Audio) {
      editorStore.clippa.timeline.state.activeTrain?.updateActive(false)
      return
    }

    void editorCommandActions.performerClearSelection()
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
