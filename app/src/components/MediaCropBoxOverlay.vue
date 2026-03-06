<script setup lang="ts">
import type { ResizeDirection } from '@clippc/selection'
import type { CanvasPerformer } from '@/store/usePerformerStore'
import { Image, Video } from '@clippc/performer'
import { computed, ref, watch } from 'vue'

interface Props {
  performer: CanvasPerformer
  scaleRatio: number
  showSideHandles?: boolean
  showFrame?: boolean
}

interface Emits {
  (event: 'resizeStart', direction: ResizeDirection, pointerEvent: PointerEvent): void
}

const props = withDefaults(defineProps<Props>(), {
  showSideHandles: true,
  showFrame: true,
})
const emit = defineEmits<Emits>()
const revision = ref(0)

const mediaPerformer = computed(() => {
  return props.performer instanceof Image || props.performer instanceof Video
    ? props.performer
    : null
})

const bounds = computed(() => {
  void revision.value
  return mediaPerformer.value?.getBounds() ?? null
})

const containerStyle = computed(() => {
  const nextBounds = bounds.value
  if (!nextBounds) {
    return {
      display: 'none',
    }
  }

  return {
    left: `${nextBounds.x * props.scaleRatio}px`,
    top: `${nextBounds.y * props.scaleRatio}px`,
    width: `${nextBounds.width * props.scaleRatio}px`,
    height: `${nextBounds.height * props.scaleRatio}px`,
    transform: `rotate(${nextBounds.rotation ?? 0}deg)`,
    transformOrigin: 'top left',
  }
})

const cornerDirections: ResizeDirection[] = ['top-left', 'top-right', 'bottom-left', 'bottom-right']
const sideDirections: ResizeDirection[] = ['top', 'right', 'bottom', 'left']

watch(mediaPerformer, (next, _previous, onCleanup) => {
  revision.value += 1
  if (!next)
    return

  const handler = () => {
    revision.value += 1
  }

  next.on?.('positionUpdate', handler)
  onCleanup(() => {
    next.off?.('positionUpdate', handler)
  })
}, { immediate: true })

function getHandleClass(direction: ResizeDirection): string {
  switch (direction) {
    case 'top-left':
      return '-left-1.5 -top-1.5 cursor-nwse-resize'
    case 'top-right':
      return '-right-1.5 -top-1.5 cursor-nesw-resize'
    case 'bottom-left':
      return '-left-1.5 -bottom-1.5 cursor-nesw-resize'
    case 'bottom-right':
      return '-right-1.5 -bottom-1.5 cursor-nwse-resize'
    case 'top':
      return 'left-1/2 -top-1 -translate-x-1/2 cursor-ns-resize'
    case 'right':
      return 'right-[-4px] top-1/2 -translate-y-1/2 cursor-ew-resize'
    case 'bottom':
      return 'left-1/2 -bottom-1 -translate-x-1/2 cursor-ns-resize'
    case 'left':
      return 'left-[-4px] top-1/2 -translate-y-1/2 cursor-ew-resize'
  }
}

function getHandleSizeClass(direction: ResizeDirection): string {
  return direction.includes('-') ? 'h-3 w-3 rounded-[2px]' : 'h-5 w-2 rounded'
}

</script>

<template>
  <div
    v-if="bounds"
    class="absolute pointer-events-none z-3"
    :style="containerStyle"
  >
    <div
      v-if="showFrame"
      class="absolute inset-0 border border-white/90 shadow-[0_0_0_1px_rgba(0,0,0,0.45)]"
    />

    <button
      v-for="direction in cornerDirections"
      :key="direction"
      type="button"
      class="absolute pointer-events-auto border border-white/90 bg-background-overlay shadow-[0_0_0_1px_rgba(0,0,0,0.6)]"
      :class="[getHandleClass(direction), getHandleSizeClass(direction)]"
      data-preserve-canvas-selection="true"
      data-crop-handle="corner"
      :data-direction="direction"
      @pointerdown.stop.prevent="emit('resizeStart', direction, $event)"
    />

    <template v-if="showSideHandles">
      <button
        v-for="direction in sideDirections"
        :key="direction"
        type="button"
        class="absolute pointer-events-auto border border-white/90 bg-background-overlay shadow-[0_0_0_1px_rgba(0,0,0,0.6)]"
        :class="[getHandleClass(direction), getHandleSizeClass(direction)]"
        data-preserve-canvas-selection="true"
        data-crop-handle="side"
        :data-direction="direction"
        @pointerdown.stop.prevent="emit('resizeStart', direction, $event)"
      />
    </template>
  </div>
</template>
