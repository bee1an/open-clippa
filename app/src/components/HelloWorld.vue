<script setup lang="ts">
import { HelloWorld } from '@clippa/core'

const helloWorld = ref(new HelloWorld('333'))
</script>

<template>
  <div>{{ helloWorld.msg }}</div>
</template>
