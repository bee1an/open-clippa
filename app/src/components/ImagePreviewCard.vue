<script setup lang="ts">
import type { ImageFile } from '@/store'
import { useEditorCommandActions } from '@/composables/useEditorCommandActions'
import { useEditorStore } from '@/store'
import { useMediaStore } from '@/store/useMediaStore'

interface Props {
  imageFile: ImageFile
}

const props = defineProps<Props>()

const DEFAULT_IMAGE_DURATION = 3000

const editorStore = useEditorStore()
const mediaStore = useMediaStore()
const editorCommandActions = useEditorCommandActions()

const isSelected = ref(false)
const cardRef = ref<HTMLElement | null>(null)
const showMenu = ref(false)

onClickOutside(cardRef, () => {
  showMenu.value = false
})

async function addToTimeline() {
  showMenu.value = false
  await editorStore.clippa.ready

  await editorCommandActions.mediaAddAssetToTimeline({
    assetId: props.imageFile.id,
    startMs: 0,
    durationMs: DEFAULT_IMAGE_DURATION,
  })
}

async function handleMenuAddToTimeline() {
  await addToTimeline()
}

function removeFromMediaLibrary() {
  mediaStore.removeImageFile(props.imageFile.id)
  showMenu.value = false
}

function toggleMenu() {
  showMenu.value = !showMenu.value
}

function toggleSelect() {
  isSelected.value = !isSelected.value
}
</script>

<template>
  <div ref="cardRef" class="group hover:bg-secondary" rounded-md p-2 w-full transition-colors cursor-pointer>
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
          title="添加到时间轴"
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
        @click.stop="toggleMenu"
      >
        <div i-ph-dots-three-vertical-bold text-sm />
      </button>

      <div
        v-if="showMenu"
        absolute top-8 right-1 z-10
        min-w-34 rounded-md border border-border
        class="bg-background-elevated shadow-xl"
        p-1
      >
        <button
          w-full text-left text-xs px-2 py-1.5 rounded
          class="hover:bg-secondary text-foreground"
          @click.stop="handleMenuAddToTimeline"
        >
          添加到时间轴
        </button>
        <button
          w-full text-left text-xs px-2 py-1.5 rounded
          class="hover:bg-secondary text-red-400"
          @click.stop="removeFromMediaLibrary"
        >
          从媒体库移除
        </button>
      </div>
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
        @click.stop="toggleSelect"
      >
        <div v-if="isSelected" i-ph-check-bold text="xs background" />
      </button>
    </div>
  </div>
</template>
