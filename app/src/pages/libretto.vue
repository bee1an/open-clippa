<script setup lang="ts">
import { Libretto } from 'open-clippa'

const libretto = new Libretto({ id: 'libretto' })

onMounted(() => {
  libretto.initial()
})

// eslint-disable-next-line no-console
const _log = console.log
</script>

<template>
  <div p-x-20px wfull>
    <div id="libretto" wfull h-200px bg-blue resize-y overflow-hidden />
  </div>
</template>
