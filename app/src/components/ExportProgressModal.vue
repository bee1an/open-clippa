<script setup lang="ts">
import { computed } from 'vue'
import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/modal'

interface Props {
  modelValue: boolean
  status?: 'idle' | 'exporting' | 'error' | 'canceled' | 'done'
  currentFrame: number
  totalFrames: number
  previewUrl?: string
  previewCanvasSize?: { width: number, height: number }
  errorMessage?: string
}

const props = withDefaults(defineProps<Props>(), {
  status: 'exporting',
  previewUrl: '',
  errorMessage: '',
})

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  'cancel': []
}>()

const progress = computed(() => {
  if (props.totalFrames <= 0)
    return 0
  return Math.min(1, props.currentFrame / props.totalFrames)
})

const percentText = computed(() => `${Math.round(progress.value * 100)}%`)

const canClose = computed(() => props.status !== 'exporting')

const normalizedPreviewCanvasSize = computed(() => {
  const width = props.previewCanvasSize?.width ?? 16
  const height = props.previewCanvasSize?.height ?? 9
  const normalizedWidth = Number.isFinite(width) ? Math.max(1, Math.round(width)) : 16
  const normalizedHeight = Number.isFinite(height) ? Math.max(1, Math.round(height)) : 9

  return {
    width: normalizedWidth,
    height: normalizedHeight,
    ratio: normalizedWidth / normalizedHeight,
  }
})

const previewFrameStyle = computed(() => {
  const { width, height, ratio } = normalizedPreviewCanvasSize.value
  const safeRatio = Number.isFinite(ratio) && ratio > 0 ? ratio : 16 / 9

  return {
    aspectRatio: `${width} / ${height}`,
    width: `min(100%, calc(52vh * ${safeRatio.toFixed(6)}))`,
  }
})

const title = computed(() => {
  if (props.status === 'error')
    return '导出失败'
  if (props.status === 'canceled')
    return '导出已取消'
  if (props.status === 'done')
    return '导出完成'
  return '正在导出'
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
        <div>帧 {{ currentFrame }} / {{ totalFrames }}</div>
        <div>{{ percentText }}</div>
      </div>

      <div class="h-2 w-full rounded-full bg-border overflow-hidden">
        <div
          class="h-full bg-primary transition-[width] duration-150"
          :style="{ width: `${Math.round(progress * 100)}%` }"
        />
      </div>

      <div class="w-full rounded-md border border-border/50 bg-black/40 p-2">
        <div class="mx-auto flex items-center justify-center overflow-hidden rounded-sm bg-black/60" :style="previewFrameStyle">
          <img
            v-if="previewUrl"
            :src="previewUrl"
            alt="导出预览"
            class="h-full w-full object-contain"
          >
          <div v-else class="text-xs text-foreground-muted">
            预览图将在这里显示
          </div>
        </div>
      </div>

      <div v-if="status === 'error'" class="text-sm text-destructive">
        {{ errorMessage || '导出失败，请重试。' }}
      </div>
      <div v-else-if="status === 'canceled'" class="text-sm text-foreground-muted">
        {{ errorMessage || '导出已取消。' }}
      </div>
      <div v-else-if="status === 'done'" class="text-sm text-foreground-muted">
        导出已完成。
      </div>
    </div>

    <template #footer>
      <div class="flex justify-end gap-2">
        <Button v-if="status === 'exporting'" size="sm" variant="ghost" @click="handleCancel">
          取消
        </Button>
        <Button size="sm" variant="secondary" :disabled="!canClose" @click="handleClose">
          关闭
        </Button>
      </div>
    </template>
  </Modal>
</template>
