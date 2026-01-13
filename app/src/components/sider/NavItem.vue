<script setup lang="ts">
const { active = true } = defineProps<{
  active?: boolean
}>()
</script>

<template>
  <div
    w-14 h-14 rounded-xl flex flex-col items-center justify-center cursor-pointer
    transition-colors duration-200
    class="group"
    :class="active ? 'bg-zinc-800 text-zinc-100' : 'hover:bg-zinc-800/50 text-zinc-400 hover:text-zinc-200'"
  >
    <div i-material-symbols-service-directory text-2xl mb-1 />
    <span text-xs font-medium>媒体</span>
  </div>
</template>

<style scoped></style>
