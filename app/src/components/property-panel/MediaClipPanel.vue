<script setup lang="ts">
import type { CanvasPerformer } from '@/store/usePerformerStore'
import { Image, Video } from '@clippc/performer'
import { useMediaCropSession } from '@/composables/useMediaCropSession'
import { MEDIA_CLIP_SHAPE_PRESETS, resolveMediaClipShape } from '@/utils/mediaClipShape'

interface Props {
  performer: CanvasPerformer
}

const props = defineProps<Props>()
const { mediaCropStore, enterCropMode, exitCropMode, applyStandaloneCropMutation } = useMediaCropSession()
const revision = ref(0)

const mediaPerformer = computed(() => {
  return props.performer instanceof Image || props.performer instanceof Video
    ? props.performer
    : null
})

const activeShapeId = computed(() => {
  void revision.value
  return mediaPerformer.value?.getClipShape?.()?.id ?? null
})

const isCropModeActive = computed(() => {
  return mediaCropStore.isActiveFor(mediaPerformer.value?.id)
})

watch(mediaPerformer, (next, _previous, onCleanup) => {
  const handler = () => {
    revision.value += 1
  }

  next?.on?.('positionUpdate', handler)
  onCleanup(() => {
    next?.off?.('positionUpdate', handler)
  })
}, { immediate: true })

async function applyShape(shapeId: string | null): Promise<void> {
  const performer = mediaPerformer.value
  if (!performer)
    return

  const mutate = () => {
    const shape = resolveMediaClipShape(shapeId)
    if (shape)
      performer.setClipShape?.(shape)
    else
      performer.clearClipShape?.()
  }

  if (isCropModeActive.value) {
    mutate()
    revision.value += 1
    return
  }

  await applyStandaloneCropMutation(
    shapeId ? 'Apply Media Shape Crop' : 'Clear Media Shape Crop',
    mutate,
  )
  revision.value += 1
}

async function toggleCropMode(): Promise<void> {
  const performer = mediaPerformer.value
  if (!performer)
    return

  if (isCropModeActive.value) {
    await exitCropMode()
    return
  }

  await enterCropMode(performer)
}
</script>

<template>
  <div v-if="mediaPerformer" space-y-2>
    <div text="[10px]" uppercase tracking-wider text-foreground-subtle>
      裁剪
    </div>

    <button
      class="w-full flex items-center justify-between rounded-md border border-border/60 bg-secondary/30 px-2 py-1.5 text-[10px] text-foreground transition-colors hover:bg-secondary/50"
      data-preserve-canvas-selection="true"
      @click="toggleCropMode"
    >
      <span>{{ isCropModeActive ? '完成裁剪' : '进入裁剪模式' }}</span>
      <span class="font-mono text-[9px] text-foreground-subtle">
        {{ isCropModeActive ? 'ESC' : 'DBL' }}
      </span>
    </button>

    <div class="grid grid-cols-2 gap-1.5">
      <button
        class="group rounded-md border px-2 py-2 transition-colors"
        :class="activeShapeId === null ? 'border-foreground/50 bg-secondary/50 text-foreground' : 'border-border/60 bg-secondary/15 text-foreground-muted hover:border-foreground/30 hover:text-foreground'"
        data-preserve-canvas-selection="true"
        @click="applyShape(null)"
      >
        <div class="flex h-10 items-center justify-center rounded border border-dashed border-current/40 text-[10px]">
          无
        </div>
      </button>

      <button
        v-for="preset in MEDIA_CLIP_SHAPE_PRESETS"
        :key="preset.id"
        class="group rounded-md border px-2 py-2 transition-colors"
        :class="activeShapeId === preset.id ? 'border-foreground/50 bg-secondary/50 text-foreground' : 'border-border/60 bg-secondary/15 text-foreground-muted hover:border-foreground/30 hover:text-foreground'"
        data-preserve-canvas-selection="true"
        @click="applyShape(preset.id)"
      >
        <div
          class="flex h-10 items-center justify-center rounded bg-background/60"
          :aria-label="preset.label"
          v-html="preset.svg"
        />
      </button>
    </div>

    <div v-if="isCropModeActive" class="rounded-md border border-primary/30 bg-primary/6 px-2 py-1.5 text-[10px] text-foreground-muted">
      双击元素可再次进入裁剪模式，拖拽可平移原图。
    </div>
  </div>
</template>

<style scoped>
:deep(svg) {
  width: 22px;
  height: 22px;
}
</style>
