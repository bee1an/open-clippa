<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { useEditorStore } from '@/store'
import TimelineTransitionHandles from './TimelineTransitionHandles.vue'

const editorStore = useEditorStore()
const { duration } = storeToRefs(editorStore)
const { clippa } = editorStore

onMounted(() => clippa.timeline.mount('timeline'))
</script>

<template>
  <div id="timeline" relative hfull>
    <div
      v-if="duration <= 0"
      class="pointer-events-none absolute inset-0 z-10 flex items-center justify-center bg-background/60 backdrop-blur-[1px]"
    >
      <div class="rounded-lg border border-border bg-background-elevated px-4 py-3 text-center">
        <div class="text-sm text-foreground">
          时间轴为空
        </div>
        <div class="mt-1 text-xs text-foreground-muted">
          请先导入媒体并添加到时间轴后再播放
        </div>
      </div>
    </div>

    <TimelineTransitionHandles />
  </div>
</template>
