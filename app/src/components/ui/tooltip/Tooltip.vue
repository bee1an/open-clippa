<script setup lang="ts">
import type { TooltipRootProps } from 'radix-vue'
import { TooltipRoot } from 'radix-vue'

const props = defineProps<TooltipRootProps>()
</script>

<template>
  <TooltipRoot v-bind="props">
    <slot />
  </TooltipRoot>
</template>
