<script setup lang="ts">
import type { AudioFile } from '@/store'
import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/modal'
import { useEditorCommandActions } from '@/composables/useEditorCommandActions'
import { useEditorStore, useMediaStore } from '@/store'

interface Props {
  audioFile: AudioFile
}

const props = defineProps<Props>()

const editorStore = useEditorStore()
const mediaStore = useMediaStore()
const editorCommandActions = useEditorCommandActions()

const audioRef = ref<HTMLAudioElement | null>(null)
const isSelected = ref(false)
const isPlaying = ref(false)
const cardRef = ref<HTMLElement | null>(null)
const showMenu = ref(false)
const showDeleteConfirmModal = ref(false)
const removeErrorMessage = ref('')

const waveformBars = computed(() => {
  const peaks = props.audioFile.metadata.waveform.peaks
  if (peaks.length === 0)
    return Array.from({ length: 28 }, () => 0.15)

  const step = peaks.length / 28
  return Array.from({ length: 28 }, (_, index) => {
    const peakIndex = Math.min(peaks.length - 1, Math.floor(index * step))
    return Math.max(0.12, peaks[peakIndex] ?? 0)
  })
})

onClickOutside(cardRef, () => {
  showMenu.value = false
})

async function addToTimeline() {
  showMenu.value = false
  await editorStore.clippa.ready

  await editorCommandActions.mediaAddAssetToTimeline({
    assetId: props.audioFile.id,
    startMs: 0,
  })
}

async function togglePreview() {
  const audio = audioRef.value
  if (!audio)
    return

  if (isPlaying.value) {
    audio.pause()
    isPlaying.value = false
    return
  }

  await audio.play()
  isPlaying.value = true
}

function handleEnded() {
  isPlaying.value = false
}

function handlePause() {
  isPlaying.value = false
}

function requestRemoveFromMediaLibrary() {
  showMenu.value = false
  removeErrorMessage.value = ''
  showDeleteConfirmModal.value = true
}

async function removeFromMediaLibrary() {
  showDeleteConfirmModal.value = false
  const result = await editorCommandActions.mediaRemoveAsset({ assetId: props.audioFile.id })
  if (!result.ok)
    removeErrorMessage.value = result.error.message
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
    <audio
      ref="audioRef"
      :src="audioFile.url"
      preload="metadata"
      @ended="handleEnded"
      @pause="handlePause"
    />

    <div class="bg-black/50 border-border/50 group-hover:border-border" aspect-video rounded-md relative flex items-center justify-center overflow-hidden border transition-colors px-3 py-4>
      <div class="absolute inset-0 opacity-80 bg-gradient-to-br from-[#0f172a] via-[#111827] to-[#1f2937]" />

      <div class="relative z-1 flex h-full w-full items-center gap-3">
        <button
          class="h-10 w-10 shrink-0 rounded-full bg-primary/90 text-background flex items-center justify-center shadow-lg transition-transform hover:scale-105"
          @click.stop="togglePreview"
        >
          <div v-if="isPlaying" i-ph-pause-fill text-lg />
          <div v-else i-ph-play-fill text-lg ml-0.5 />
        </button>

        <div class="flex-1 flex items-center gap-1 h-full">
          <div
            v-for="(peak, index) in waveformBars"
            :key="`${audioFile.id}-${index}`"
            class="flex-1 rounded-full bg-[#5eead4]/85"
            :style="{ height: `${Math.max(18, peak * 100)}%` }"
          />
        </div>
      </div>

      <div
        v-if="audioFile.duration > 0"
        group-hover:opacity-0
        text="xs foreground-muted"
        font-mono
        absolute bottom-1 right-1
        class="bg-black/60 backdrop-blur-sm"
        px-1.5 py-0.5 rounded-sm
        transition-opacity
      >
        {{ mediaStore.formatDuration(audioFile.duration) }}
      </div>

      <div
        absolute inset-0 class="bg-black/35" opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2
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
          @click.stop="addToTimeline"
        >
          添加到时间轴
        </button>
        <button
          w-full text-left text-xs px-2 py-1.5 rounded
          class="hover:bg-secondary text-red-400"
          @click.stop="requestRemoveFromMediaLibrary"
        >
          从媒体库移除
        </button>
      </div>
    </div>

    <div flex items-center justify-between mt-2 gap-2>
      <div class="min-w-0 flex-1">
        <span
          text="xs foreground"
          font-medium
          truncate
          class="block"
          :title="audioFile.name"
        >
          {{ audioFile.name }}
        </span>
        <span class="block text-[10px] text-foreground-muted truncate">
          {{ audioFile.metadata.channels || '--' }} ch · {{ audioFile.metadata.sampleRate || '--' }} Hz
        </span>
      </div>

      <button
        w-4 h-4 rounded-full class="border-border/50" border flex items-center justify-center
        hover:border-primary transition-colors
        :class="{ 'bg-primary border-primary': isSelected, 'bg-transparent': !isSelected }"
        @click.stop="toggleSelect"
      >
        <div v-if="isSelected" i-ph-check-bold text="xs background" />
      </button>
    </div>

    <p v-if="removeErrorMessage" class="mt-1 text-xs text-red-400 break-all">
      {{ removeErrorMessage }}
    </p>

    <Modal
      :model-value="showDeleteConfirmModal"
      title="确认移除媒体"
      size="sm"
      @update:model-value="showDeleteConfirmModal = $event"
    >
      <p class="text-sm text-foreground-muted">
        删除后会同时移除时间线中使用该媒体的内容，是否继续？
      </p>
      <template #footer>
        <div class="flex justify-end gap-2">
          <Button
            variant="outline"
            size="sm"
            @click="showDeleteConfirmModal = false"
          >
            取消
          </Button>
          <Button
            variant="secondary"
            size="sm"
            class="text-red-400"
            @click="removeFromMediaLibrary"
          >
            移除
          </Button>
        </div>
      </template>
    </Modal>
  </div>
</template>
