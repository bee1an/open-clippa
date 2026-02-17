<script setup lang="ts">
import { Button } from '@/components/ui/button'
import { useEditorStore } from '@/store/useEditorStore'
import { usePerformerStore } from '@/store/usePerformerStore'

const editorStore = useEditorStore()
const performerStore = usePerformerStore()

async function addText() {
  await editorStore.clippa.ready

  const maxZIndex = editorStore.clippa.timeline.rails?.maxZIndex ?? 0
  const nextZIndex = Math.max(1, maxZIndex + 1)

  const textPerformer = performerStore.addPerformer({
    id: `text-${Date.now()}`,
    type: 'text',
    content: '双击编辑文本',
    start: 0,
    duration: 5000,
    zIndex: nextZIndex,
    x: 100,
    y: 100,
    style: {
      fontSize: 32,
      fontWeight: 'normal',
    },
  })

  textPerformer.update(editorStore.currentTime - textPerformer.start)
  await editorStore.clippa.hire(textPerformer)
  if (!editorStore.clippa.stage.performers.has(textPerformer)) {
    editorStore.clippa.show(textPerformer)
  }
}
</script>

<template>
  <div h-full flex="~ col">
    <div class="p-3 space-y-2">
      <div class="text-sm font-medium text-foreground">文本</div>
      <Button
        variant="outline"
        class="w-full justify-start h-9 text-xs"
        @click="addText"
      >
        <div i-ph-text-t-bold text-base mr-2 />
        <span>添加文本</span>
      </Button>
    </div>
  </div>
</template>
