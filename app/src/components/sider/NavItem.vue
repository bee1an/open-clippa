<script setup lang="ts">
defineProps<{
  active?: boolean
  icon: string
  activeIcon?: string
  title: string
}>()
</script>

<template>
  <div class="flex flex-col items-center justify-center gap-[6px] cursor-pointer group py-1 w-full">
    <!-- Icon Box -->
    <div
      class="w-11 h-11 rounded-[14px] flex items-center justify-center transition-all duration-200"
      :class="active
        ? 'bg-primary/10 text-primary'
        : 'bg-secondary/40 text-foreground-muted group-hover:bg-secondary/80 group-hover:text-foreground'"
    >
      <div
        class="text-[22px] transition-transform duration-200"
        :class="active && activeIcon ? activeIcon : icon"
      />
    </div>
    <!-- Title -->
    <span
      class="text-[11px] font-medium transition-colors duration-200 tracking-wide"
      :class="active ? 'text-primary' : 'text-foreground-subtle group-hover:text-foreground'"
    >
      {{ title }}
    </span>
  </div>
</template>
