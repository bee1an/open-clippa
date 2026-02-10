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
    content: 'Double click to edit',
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
    <div p-4 p-b-0 text-foreground>
      Text
    </div>

    <div p-4>
      <Button
        variant="outline"
        class="w-full justify-start"
        @click="addText"
      >
        <div i-ph-text-t-bold text-lg mr-2 />
        <span>Text</span>
      </Button>
    </div>
  </div>
</template>
