<script setup lang="ts">
import { Timeline } from 'open-clippa'

const timeline = new Timeline({ id: 'timeline', duration: 10000 })
onMounted(() => timeline.initial())
</script>

<template>
  <div id="timeline" hfull />
</template>
