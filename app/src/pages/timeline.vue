<script setup lang="ts">
import { Timeline } from 'open-clippa'

const timeline = new Timeline({ id: 'timeline', duration: 10000 })

onMounted(() => {
  timeline.initial()
})

// eslint-disable-next-line no-console
const _log = console.log
</script>

<template>
  <div p-x-20px wfull>
    <div id="timeline" wfull h-300px bg-blue resize-y overflow-hidden />
  </div>
</template>
