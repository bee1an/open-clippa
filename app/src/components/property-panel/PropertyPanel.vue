<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { usePerformerProperties } from '@/composables/usePerformerProperties'
import { usePerformerStore } from '@/store/usePerformerStore'
import CommonProperties from './CommonProperties.vue'
import ImagePropertyPanel from './ImagePropertyPanel.vue'
import TextPropertyPanel from './TextPropertyPanel.vue'
import VideoPropertyPanel from './VideoPropertyPanel.vue'

const emit = defineEmits<{
  'navigate:animation': []
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
    <div p-4 pb-0 text-foreground font-medium>
      属性
    </div>

    <div flex-1 overflow-y-auto p-4 space-y-3>
      <!-- Target Info -->
      <div flex items-center justify-between gap-3>
        <span text-xs uppercase tracking-widest text-foreground-subtle>目标</span>
        <span class="max-w-44 truncate rounded-md border border-border/70 bg-secondary/40 px-2 py-1 text-xs font-medium text-foreground">
          {{ selectedId }}
        </span>
      </div>

      <!-- Type-specific panel -->
      <component
        :is="typeComponents[performerType]"
        :performer="performer"
        :text-content="textContent"
        :text-style="textStyle"
        @update:content="updateTextContent"
        @update:style="updateTextStyle"
      />

      <div class="h-px bg-border/50" />

      <!-- Animation entry -->
      <button
        class="w-full flex items-center justify-between rounded-md border border-border/70 px-3 py-2.5 text-xs text-foreground-muted transition-colors hover:bg-secondary/40 hover:text-foreground"
        @click="emit('navigate:animation')"
      >
        <span flex items-center gap-2>
          <div class="i-ph-sparkle-bold" text-sm />
          动画
        </span>
        <div class="i-ph-caret-left-bold" text-xs opacity-50 />
      </button>

      <div class="h-px bg-border/50" />

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
