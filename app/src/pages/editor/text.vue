<script setup lang="ts">
import { Button } from '@/components/ui/button'
import { useEditorCommandActions } from '@/composables/useEditorCommandActions'
const editorCommandActions = useEditorCommandActions()

async function addText() {
  await editorCommandActions.createTextElement({
    content: '双击编辑文本',
    startMs: 0,
    durationMs: 5000,
    x: 100,
    y: 100,
    style: {
      fontSize: 32,
      fontWeight: 'normal',
    },
  })
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
