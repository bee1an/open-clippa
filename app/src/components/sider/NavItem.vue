<script setup lang="ts">
defineProps<{
  active?: boolean
  icon: string
  activeIcon?: string
}>()
</script>

<template>
  <div
    w-10 h-10 rounded-lg flex items-center justify-center cursor-pointer relative group transition-all duration-200
    :class="active ? 'bg-foreground text-background' : 'hover:bg-secondary text-foreground-muted hover:text-foreground'"
  >
    <!-- Icon -->
    <div
      text-lg transition-transform duration-200
      :class="active && activeIcon ? activeIcon : icon"
    />
  </div>
</template>
