<script setup lang="ts">
import { useEditorStore } from '@/store'

const editorStore = useEditorStore()
const { clippa } = editorStore

onMounted(() => clippa.timeline.mount('timeline'))
</script>

<template>
  <div id="timeline" hfull />
</template>
