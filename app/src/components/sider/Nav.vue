<script setup lang="ts">
defineProps<{
  expanded: boolean
}>()

const emit = defineEmits<{
  toggle: []
}>()
</script>

<template>
  <div h-full w-14 flex-shrink-0 flex flex-col items-center pt-3 gap-1 bg-background-elevated border-r border-border>
    <NavItem :active="expanded" @click="emit('toggle')" />
  </div>
</template>
