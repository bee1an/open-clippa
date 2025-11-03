<script setup lang="ts">
import { useRouter } from 'vue-router'

const router = useRouter()

goToEditor()

function goToEditor() {
  router.push('/editor/media')
}
</script>

<template>
  <div />
</template>
