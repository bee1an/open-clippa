<script setup lang="ts">
import { ref } from 'vue'
import { Button } from '@/components/ui/button'
import { pickMediaFileHandles } from '@/persistence/fileSystemAccess'
import { useMediaStore } from '@/store/useMediaStore'

const mediaStore = useMediaStore()
const mediaUrl = ref('')
const mediaUrlError = ref('')
const localImportError = ref('')
const isImportingByUrl = ref(false)
const isImportingLocal = ref(false)
const showUrlInput = ref(false)

async function handleImportLocalMedia(): Promise<void> {
  if (isImportingLocal.value)
    return

  localImportError.value = ''
  isImportingLocal.value = true

  try {
    const handles = await pickMediaFileHandles()
    if (!handles.length)
      return

    await mediaStore.importFromFileHandles(handles)
  }
  catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError')
      return

    localImportError.value = error instanceof Error ? error.message : 'Local media import failed'
  }
  finally {
    isImportingLocal.value = false
  }
}

function importVideoFromUrl() {
  mediaUrlError.value = ''
  const url = mediaUrl.value.trim()
  if (!url) {
    mediaUrlError.value = '请输入视频 URL'
    return
  }

  isImportingByUrl.value = true
  try {
    mediaStore.addVideoFromUrl(url)
    mediaUrl.value = ''
  }
  catch (error) {
    mediaUrlError.value = error instanceof Error ? error.message : 'URL 导入失败'
  }
  finally {
    isImportingByUrl.value = false
  }
}
</script>

<template>
  <div h-full min-h-0 flex="~ col" relative>
    <div class="p-3 border-b border-border/70 space-y-3">
      <div class="flex items-center justify-between">
        <span class="text-sm font-medium text-foreground">你的媒体</span>
      </div>

      <div flex w-full isolate>
        <Button
          variant="outline"
          class="flex-1 h-8 rounded-l-md rounded-r-none"
          :disabled="isImportingLocal"
          @click="handleImportLocalMedia"
        >
          <div i-carbon-add text-base />
          <span>{{ isImportingLocal ? '导入中...' : '导入媒体' }}</span>
        </Button>

        <Button
          variant="outline"
          class="shrink-0 h-8 px-2.5 rounded-l-none -ml-px relative z-0 hover:z-10 bg-background"
          :class="{ '!bg-secondary !border-primary/50 text-primary z-20': showUrlInput }"
          title="通过 URL 导入"
          @click="showUrlInput = !showUrlInput"
        >
          <div i-carbon-link text-base />
        </Button>
      </div>

      <div v-if="showUrlInput" mt-3 class="animate-in slide-in-from-top-2 fade-in duration-200">
        <div flex items-center gap-2>
          <div
            class="group flex-1 flex items-center gap-2 px-3 py-1.5 bg-background border border-border rounded-md focus-within:ring-2 focus-within:ring-primary/20 focus-within:border-primary transition-all min-w-0"
          >
            <input
              v-model="mediaUrl"
              type="text"
              placeholder="粘贴视频链接..."
              class="flex-1 bg-transparent border-none text-sm text-foreground outline-none placeholder:text-muted min-w-0"
              @keydown.enter.prevent="importVideoFromUrl"
            >
            <Button
              v-if="mediaUrl"
              variant="ghost"
              size="icon-xs"
              class="opacity-0 group-hover:opacity-100 transition-opacity text-muted hover:text-foreground shrink-0"
              @click="mediaUrl = ''"
            >
              <div i-carbon-close />
            </Button>
          </div>

          <Button
            variant="secondary"
            size="icon"
            class="shrink-0"
            :disabled="!mediaUrl || isImportingByUrl"
            @click="importVideoFromUrl"
          >
            <div v-if="isImportingByUrl" i-carbon-circle-dash animate-spin />
            <div v-else i-carbon-arrow-right />
          </Button>
        </div>

        <div v-if="mediaUrlError" class="mt-2 text-xs text-red-500 flex items-center gap-1 animate-fade-in break-all">
          <div i-carbon-warning-filled class="shrink-0" />
          <span>{{ mediaUrlError }}</span>
        </div>
      </div>

      <div v-if="localImportError" class="text-xs text-red-500 flex items-center gap-1 break-all">
        <div i-carbon-warning-filled class="shrink-0" />
        <span>{{ localImportError }}</span>
      </div>
    </div>

    <div flex-1 overflow-hidden>
      <VideoPreviewList />
    </div>
  </div>
</template>
