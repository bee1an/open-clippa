<script setup lang="ts">
import { useEditorStore } from '@/store'
import TimelineTransitionHandles from './TimelineTransitionHandles.vue'

const editorStore = useEditorStore()
const { clippa } = editorStore

onMounted(() => clippa.timeline.mount('timeline'))
</script>

<template>
  <div id="timeline" relative hfull>
    <TimelineTransitionHandles />
  </div>
</template>
