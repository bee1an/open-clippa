<script setup lang="ts">
const { active = true } = defineProps<{
  active?: boolean
}>()
</script>

<template>
  <div
    w-10 h-10 mb-2 rounded-lg flex items-center justify-center cursor-pointer relative group transition-all duration-200
    :class="active ? 'bg-foreground text-background' : 'hover:bg-secondary text-foreground-muted hover:text-foreground'"
  >
    <!-- Icon -->
    <div
      text-lg transition-transform duration-200
      :class="active ? 'i-ph-film-strip-fill' : 'i-ph-film-strip-bold'"
    />
  </div>
</template>
