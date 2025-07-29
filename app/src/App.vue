<script setup lang="ts">
import { sum } from '@clippa/utils'

const a = ref(0)
const b = ref(0)
const count = ref(0)

function clickHandle() {
  a.value++
  b.value++

  count.value = sum(a.value, b.value)
}
</script>

<template>
  <HelloWorld />
  <button @click="clickHandle()">
    {{ count }}
  </button>
</template>
