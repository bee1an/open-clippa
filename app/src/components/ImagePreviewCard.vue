<script setup lang="ts">
import type { ImageFile } from '@/store'
import { useEditorStore } from '@/store'
import { usePerformerStore } from '@/store/usePerformerStore'

interface Props {
  imageFile: ImageFile
}

const props = defineProps<Props>()

const DEFAULT_IMAGE_DURATION = 3000

const editorStore = useEditorStore()
const performerStore = usePerformerStore()
const { clippa } = editorStore

const isSelected = ref(false)

async function addToTimeline() {
  await clippa.ready

  const performer = performerStore.addPerformer({
    id: `image-${crypto.randomUUID()}`,
    type: 'image',
    src: props.imageFile.file,
    start: 0,
    duration: DEFAULT_IMAGE_DURATION,
    x: 0,
    y: 0,
    zIndex: clippa.timeline.rails!.maxZIndex + 1,
  })

  clippa.hire(performer)
}

function _showMenu() {
  console.warn('Show menu for', props.imageFile.name)
}

function _toggleSelect() {
  isSelected.value = !isSelected.value
}
</script>

<template>
  <div class="group hover:bg-secondary" rounded-md p-2 w-full transition-colors cursor-pointer>
    <div class="bg-black/50 border-border/50 group-hover:border-border" aspect-video rounded-md relative flex items-center justify-center overflow-hidden border transition-colors>
      <img
        :src="imageFile.url"
        :alt="imageFile.name"
        w-full h-full object-cover
      >

      <div
        absolute inset-0 class="bg-black/40" opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2
      >
        <button
          w-8 h-8 rounded-full bg-primary text-background flex items-center justify-center
          hover:scale-110 active:scale-95 transition-all shadow-lg
          title="Add to timeline"
          @click.stop="addToTimeline"
        >
          <div i-ph-plus-bold text-lg />
        </button>
      </div>

      <button
        opacity-0 group-hover:opacity-100
        absolute top-1 right-1
        w-6 h-6 rounded flex items-center justify-center
        class="bg-black/50 hover:bg-black/70" text-white
        transition-all
        @click.stop="_showMenu"
      >
        <div i-ph-dots-three-vert-bold text-sm />
      </button>
    </div>

    <div flex items-center justify-between mt-2 gap-2>
      <span
        text="xs foreground"
        font-medium
        truncate
        flex-1
        :title="imageFile.name"
      >
        {{ imageFile.name }}
      </span>

      <button
        w-4 h-4 rounded-full class="border-border/50" border flex items-center justify-center
        hover:border-primary transition-colors
        :class="{ 'bg-primary border-primary': isSelected, 'bg-transparent': !isSelected }"
        @click.stop="_toggleSelect"
      >
        <div v-if="isSelected" i-ph-check-bold text="xs background" />
      </button>
    </div>
  </div>
</template>
