<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { Audio } from '@clippc/performer'
import { usePerformerProperties } from '@/composables/usePerformerProperties'
import { useEditorStore } from '@/store/useEditorStore'
import { usePerformerStore } from '@/store/usePerformerStore'
import AudioPropertyPanel from './AudioPropertyPanel.vue'
import CommonProperties from './CommonProperties.vue'
import ImagePropertyPanel from './ImagePropertyPanel.vue'
import TextPropertyPanel from './TextPropertyPanel.vue'
import VideoPropertyPanel from './VideoPropertyPanel.vue'

const emit = defineEmits<{
  navigateAnimation: []
}>()

const performerStore = usePerformerStore()
const editorStore = useEditorStore()
const { selectedPerformers } = storeToRefs(performerStore)
const activeTrainId = ref<string | null>(editorStore.clippa.timeline.state.activeTrain?.id ?? null)

function handleActiveTrainChanged(train: { id: string } | null): void {
  activeTrainId.value = train?.id ?? null
}

onMounted(() => {
  editorStore.clippa.timeline.state.on('activeTrainChanged', handleActiveTrainChanged)
})

onUnmounted(() => {
  editorStore.clippa.timeline.state.off('activeTrainChanged', handleActiveTrainChanged)
})

const selectedId = computed(() => {
  const selectedPerformerId = selectedPerformers.value[0]?.id ?? null
  if (selectedPerformerId)
    return selectedPerformerId

  const activePerformer = activeTrainId.value ? performerStore.getPerformerById(activeTrainId.value) : null
  if (activePerformer instanceof Audio)
    return activePerformer.id

  return null
})

const {
  performer,
  performerType,
  bounds,
  visualPosition,
  alpha,
  textContent,
  textStyle,
  audioVolume,
  audioMuted,
  updatePosition,
  updateRotation,
  updateAlpha,
  updateTextContent,
  updateTextStyle,
  updateAudioVolume,
  updateAudioMuted,
} = usePerformerProperties(selectedId)

const typeComponents = {
  audio: AudioPropertyPanel,
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
        :volume="audioVolume"
        :muted="audioMuted"
        @update:content="updateTextContent"
        @update:style="updateTextStyle"
        @update:volume="updateAudioVolume"
        @update:muted="updateAudioMuted"
      />

      <div v-if="performerType !== 'audio'" class="h-px bg-border/30" />

      <!-- Animation entry -->
      <button
        v-if="performerType !== 'audio'"
        class="w-full flex items-center justify-between rounded-md px-2 py-1.5 text-xs text-foreground-muted transition-colors hover:bg-secondary/50 hover:text-foreground group"
        @click="emit('navigateAnimation')"
      >
        <span flex items-center gap-2>
          <div class="i-ph-sparkle-bold text-primary/70 group-hover:text-primary transition-colors" text-xs />
          动画
        </span>
        <div class="i-ph-caret-right-bold" text-xs opacity-50 />
      </button>

      <div v-if="performerType !== 'audio'" class="h-px bg-border/30" />

      <!-- Common transform properties -->
      <CommonProperties
        v-if="performerType !== 'audio'"
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
