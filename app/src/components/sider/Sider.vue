<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { usePerformerStore } from '@/store/usePerformerStore'

const siderCollapsed = useStorage('siderCollapsed', false)
const router = useRouter()
const route = useRoute()

const performerStore = usePerformerStore()
const { selectedPerformers } = storeToRefs(performerStore)

const hasSelection = computed(() => selectedPerformers.value.length > 0)

// remember the route before navigating to properties
let previousRoute: string | null = null

watch(hasSelection, (selected) => {
  if (selected) {
    // auto-expand sider
    if (siderCollapsed.value) {
      siderCollapsed.value = false
    }
    // navigate to properties route, remember previous
    if (route.path !== '/editor/properties') {
      previousRoute = route.path
      router.replace('/editor/properties')
    }
  }
  else {
    // restore previous route on deselection
    const target = previousRoute ?? '/editor/media'
    previousRoute = null
    if (route.path === '/editor/properties') {
      router.replace(target)
    }
  }
})
</script>

<template>
  <div w-full h-full flex bg-background-elevated>
    <Nav :expanded="!siderCollapsed" @toggle="siderCollapsed = !siderCollapsed" />

    <div
      v-if="!siderCollapsed"
      overflow-hidden bg-background-elevated flex-1
      class="border-l border-border/50"
    >
      <div h-full overflow-y-auto>
        <RouterView />
      </div>
    </div>
  </div>
</template>
