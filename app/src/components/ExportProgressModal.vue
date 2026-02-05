<script setup lang="ts">
import { computed } from 'vue'
import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/modal'

interface Props {
  modelValue: boolean
  status?: 'idle' | 'exporting' | 'error' | 'canceled'
  currentFrame: number
  totalFrames: number
  previewUrl?: string
  errorMessage?: string
}

const props = withDefaults(defineProps<Props>(), {
  status: 'exporting',
  previewUrl: '',
  errorMessage: '',
})

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  cancel: []
}>()

const progress = computed(() => {
  if (props.totalFrames <= 0)
    return 0
  return Math.min(1, props.currentFrame / props.totalFrames)
})

const percentText = computed(() => `${Math.round(progress.value * 100)}%`)

const canClose = computed(() => props.status !== 'exporting')

const title = computed(() => {
  if (props.status === 'error')
    return 'Export failed'
  if (props.status === 'canceled')
    return 'Export canceled'
  return 'Exporting'
})

function handleClose() {
  emit('update:modelValue', false)
}

function handleCancel() {
  emit('cancel')
}
</script>

<template>
  <Modal
    :model-value="modelValue"
    :title="title"
    size="lg"
    :show-close="canClose"
    :close-on-overlay="canClose"
    @update:model-value="handleClose"
  >
    <div class="flex flex-col gap-4">
      <div class="flex items-center justify-between text-sm text-foreground-muted">
        <div>Frame {{ currentFrame }} / {{ totalFrames }}</div>
        <div>{{ percentText }}</div>
      </div>

      <div class="h-2 w-full rounded-full bg-border overflow-hidden">
        <div
          class="h-full bg-primary transition-[width] duration-150"
          :style="{ width: `${Math.round(progress * 100)}%` }"
        />
      </div>

      <div class="aspect-video w-full rounded-md border border-border/50 bg-black/40 overflow-hidden flex items-center justify-center">
        <img
          v-if="previewUrl"
          :src="previewUrl"
          alt="Export preview"
          class="h-full w-full object-cover"
        >
        <div v-else class="text-xs text-foreground-muted">
          Preview will appear here
        </div>
      </div>

      <div v-if="status === 'error'" class="text-sm text-destructive">
        {{ errorMessage || 'Export failed. Please try again.' }}
      </div>
      <div v-else-if="status === 'canceled'" class="text-sm text-foreground-muted">
        {{ errorMessage || 'Export canceled.' }}
      </div>
    </div>

    <template #footer>
      <div class="flex justify-end gap-2">
        <Button v-if="status === 'exporting'" size="sm" variant="ghost" @click="handleCancel">
          Cancel
        </Button>
        <Button size="sm" variant="secondary" :disabled="!canClose" @click="handleClose">
          Close
        </Button>
      </div>
    </template>
  </Modal>
</template>
