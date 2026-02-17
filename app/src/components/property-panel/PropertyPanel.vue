<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { usePerformerProperties } from '@/composables/usePerformerProperties'
import { usePerformerStore } from '@/store/usePerformerStore'
import CommonProperties from './CommonProperties.vue'
import ImagePropertyPanel from './ImagePropertyPanel.vue'
import TextPropertyPanel from './TextPropertyPanel.vue'
import VideoPropertyPanel from './VideoPropertyPanel.vue'

const emit = defineEmits<{
  navigateAnimation: []
}>()

const performerStore = usePerformerStore()
const { selectedPerformers } = storeToRefs(performerStore)

const selectedId = computed(() => selectedPerformers.value[0]?.id ?? null)

const {
  performer,
  performerType,
  bounds,
  visualPosition,
  alpha,
  textContent,
  textStyle,
  updatePosition,
  updateRotation,
  updateAlpha,
  updateTextContent,
  updateTextStyle,
} = usePerformerProperties(selectedId)

const typeComponents = {
  video: VideoPropertyPanel,
  image: ImagePropertyPanel,
  text: TextPropertyPanel,
} as const
</script>

<template>
  <div
    v-if="performer && performerType"
    h-full flex="~ col" overflow-hidden
    data-preserve-canvas-selection="true"
  >
    <div flex-1 overflow-y-auto p-3 space-y-2>
      <!-- Type-specific panel -->
      <component
        :is="typeComponents[performerType]"
        :performer="performer"
        :text-content="textContent"
        :text-style="textStyle"
        @update:content="updateTextContent"
        @update:style="updateTextStyle"
      />

      <div class="h-px bg-border/30" />

      <!-- Animation entry -->
      <button
        class="w-full flex items-center justify-between rounded-md px-2 py-1.5 text-xs text-foreground-muted transition-colors hover:bg-secondary/50 hover:text-foreground group"
        @click="emit('navigateAnimation')"
      >
        <span flex items-center gap-2>
          <div class="i-ph-sparkle-bold text-primary/70 group-hover:text-primary transition-colors" text-xs />
          动画
        </span>
        <div class="i-ph-caret-right-bold" text-xs opacity-50 />
      </button>

      <div class="h-px bg-border/30" />

      <!-- Common transform properties -->
      <CommonProperties
        :bounds="bounds"
        :visual-position="visualPosition"
        :alpha="alpha"
        @update:position="updatePosition"
        @update:rotation="updateRotation"
        @update:alpha="updateAlpha"
      />
    </div>
  </div>
</template>
