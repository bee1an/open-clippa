<script setup lang="ts">
import type { AttachedImage, MetadataTags } from 'mediabunny'
import { ALL_FORMATS, BlobSource, Input } from 'mediabunny'
import { storeToRefs } from 'pinia'
import { computed, onBeforeUnmount, ref, shallowRef } from 'vue'
import { Button } from '@/components/ui/button'
import { useExportStore } from '@/store/useExportStore'

definePage({
  meta: {
    devOnly: true,
  },
})

interface VideoSummary {
  codec: string | null
  codedWidth: number
  codedHeight: number
  displayWidth: number
  displayHeight: number
  rotation: number
}

interface AudioSummary {
  codec: string | null
  sampleRate: number
  channels: number
}

interface MediaSummary {
  duration: number | null
  mimeType: string | null
  video: VideoSummary | null
  audio: AudioSummary | null
}

const exportStore = useExportStore()
const { exportedVideo } = storeToRefs(exportStore)

const fileInputRef = ref<HTMLInputElement | null>(null)
const isLoading = ref(false)
const errorMessage = ref('')
const sourceLabel = ref('')
const coverUrl = ref('')

const metadata = shallowRef<MetadataTags | null>(null)
const summary = shallowRef<MediaSummary | null>(null)

const hasExportedVideo = computed(() => Boolean(exportedVideo.value))
const hasCover = computed(() => Boolean(coverUrl.value))

const durationText = computed(() => {
  if (!summary.value?.duration)
    return '--'
  return `${summary.value.duration.toFixed(3)} s`
})

const tagsText = computed(() => {
  if (!metadata.value)
    return ''
  return formatJson(normalizeTags(metadata.value))
})

const rawText = computed(() => {
  if (!metadata.value?.raw)
    return ''
  return formatJson(metadata.value.raw)
})

function handlePickFile() {
  fileInputRef.value?.click()
}

function handleFileChange(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file)
    return

  loadFromBlob(file, file.name)
  input.value = ''
}

function handleUseExported() {
  if (!exportedVideo.value)
    return

  loadFromBlob(exportedVideo.value.blob, exportedVideo.value.name)
}

async function loadFromBlob(blob: Blob, label: string) {
  if (isLoading.value)
    return

  resetState()
  isLoading.value = true
  sourceLabel.value = label

  const input = new Input({
    source: new BlobSource(blob),
    formats: ALL_FORMATS,
  })

  try {
    const [tags, duration, videoTrack, audioTrack, mimeType] = await Promise.all([
      input.getMetadataTags(),
      input.computeDuration(),
      input.getPrimaryVideoTrack(),
      input.getPrimaryAudioTrack(),
      input.getMimeType(),
    ])

    metadata.value = tags
    summary.value = {
      duration: Number.isFinite(duration) ? duration : null,
      mimeType,
      video: videoTrack
        ? {
            codec: videoTrack.codec ? String(videoTrack.codec) : null,
            codedWidth: videoTrack.codedWidth,
            codedHeight: videoTrack.codedHeight,
            displayWidth: videoTrack.displayWidth,
            displayHeight: videoTrack.displayHeight,
            rotation: videoTrack.rotation,
          }
        : null,
      audio: audioTrack
        ? {
            codec: audioTrack.codec ? String(audioTrack.codec) : null,
            sampleRate: audioTrack.sampleRate,
            channels: audioTrack.numberOfChannels,
          }
        : null,
    }

    updateCover(tags)
  }
  catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'Failed to read metadata'
    metadata.value = null
    summary.value = null
  }
  finally {
    input.dispose()
    isLoading.value = false
  }
}

function resetState() {
  errorMessage.value = ''
  metadata.value = null
  summary.value = null
  revokeCoverUrl()
}

function revokeCoverUrl() {
  if (!coverUrl.value)
    return
  URL.revokeObjectURL(coverUrl.value)
  coverUrl.value = ''
}

function updateCover(tags: MetadataTags) {
  revokeCoverUrl()
  const image = pickCoverImage(tags.images)
  if (!image)
    return

  const coverBytes = Uint8Array.from(image.data)
  const blob = new Blob([coverBytes], { type: image.mimeType || 'image/jpeg' })
  coverUrl.value = URL.createObjectURL(blob)
}

function pickCoverImage(images?: AttachedImage[]): AttachedImage | null {
  if (!images || images.length === 0)
    return null
  return images.find(image => image.kind === 'coverFront') ?? images[0]
}

function normalizeTags(tags: MetadataTags) {
  const { raw, images, ...rest } = tags
  return {
    ...rest,
    images: images?.map(image => ({
      kind: image.kind,
      mimeType: image.mimeType,
      size: image.data.byteLength,
      name: image.name,
      description: image.description,
    })),
  }
}

function formatJson(value: unknown): string {
  const json = JSON.stringify(
    value,
    (_key, item) => {
      if (item instanceof Uint8Array)
        return `Uint8Array(${item.byteLength})`
      if (item instanceof ArrayBuffer)
        return `ArrayBuffer(${item.byteLength})`
      return item
    },
    2,
  )
  return json ?? ''
}

onBeforeUnmount(() => {
  revokeCoverUrl()
})
</script>

<template>
  <div w-full h-full bg-background text-foreground flex="~ col">
    <header class="h-12 border-b border-border bg-background flex items-center px-4 gap-3">
      <AppLogo size="sm" />
      <div class="text-sm text-foreground-muted">
        Metadata Inspector (Dev)
      </div>
      <div class="flex-1" />
      <Button size="sm" :disabled="isLoading || !hasExportedVideo" @click="handleUseExported">
        Use Exported Video
      </Button>
      <Button size="sm" variant="outline" :disabled="isLoading" @click="handlePickFile">
        Choose File
      </Button>
      <input
        ref="fileInputRef"
        type="file"
        accept="video/*"
        hidden
        @change="handleFileChange"
      >
    </header>

    <main class="flex-1 overflow-auto p-6 flex flex-col gap-6">
      <section class="panel p-4 flex flex-col gap-2">
        <div class="text-sm font-semibold">
          Source
        </div>
        <div class="text-xs text-foreground-muted">
          Selected: {{ sourceLabel || 'None' }}
        </div>
        <div v-if="isLoading" class="text-xs text-foreground-muted">
          Reading metadata...
        </div>
        <div v-if="errorMessage" class="text-xs text-red-500">
          {{ errorMessage }}
        </div>
      </section>

      <section class="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div class="panel p-4 flex flex-col gap-3">
          <div class="text-sm font-semibold">
            Summary
          </div>
          <div class="grid grid-cols-2 gap-2 text-sm">
            <div class="text-foreground-muted">
              MIME Type
            </div>
            <div class="text-foreground">
              {{ summary?.mimeType || '--' }}
            </div>

            <div class="text-foreground-muted">
              Duration
            </div>
            <div class="text-foreground">
              {{ durationText }}
            </div>

            <div class="text-foreground-muted">
              Video Codec
            </div>
            <div class="text-foreground">
              {{ summary?.video?.codec || '--' }}
            </div>

            <div class="text-foreground-muted">
              Display Size
            </div>
            <div class="text-foreground">
              <span v-if="summary?.video">
                {{ summary.video.displayWidth }} x {{ summary.video.displayHeight }}
              </span>
              <span v-else>--</span>
            </div>

            <div class="text-foreground-muted">
              Coded Size
            </div>
            <div class="text-foreground">
              <span v-if="summary?.video">
                {{ summary.video.codedWidth }} x {{ summary.video.codedHeight }}
              </span>
              <span v-else>--</span>
            </div>

            <div class="text-foreground-muted">
              Rotation
            </div>
            <div class="text-foreground">
              <span v-if="summary?.video">{{ summary.video.rotation }} deg</span>
              <span v-else>--</span>
            </div>

            <div class="text-foreground-muted">
              Audio Codec
            </div>
            <div class="text-foreground">
              {{ summary?.audio?.codec || '--' }}
            </div>

            <div class="text-foreground-muted">
              Audio Channels
            </div>
            <div class="text-foreground">
              <span v-if="summary?.audio">{{ summary.audio.channels }}</span>
              <span v-else>--</span>
            </div>

            <div class="text-foreground-muted">
              Sample Rate
            </div>
            <div class="text-foreground">
              <span v-if="summary?.audio">{{ summary.audio.sampleRate }} Hz</span>
              <span v-else>--</span>
            </div>
          </div>
        </div>

        <div class="panel p-4 flex flex-col gap-3">
          <div class="text-sm font-semibold">
            Cover
          </div>
          <div class="aspect-video w-full rounded-md overflow-hidden border border-border/50 bg-black/30 flex items-center justify-center">
            <img
              v-if="hasCover"
              :src="coverUrl"
              alt="Cover"
              class="h-full w-full object-cover"
            >
            <div v-else class="text-xs text-foreground-muted">
              No cover image
            </div>
          </div>
        </div>
      </section>

      <section class="panel p-4 flex flex-col gap-3">
        <div class="text-sm font-semibold">
          Metadata Tags
        </div>
        <pre class="text-xs whitespace-pre-wrap rounded-md border border-border/50 bg-background/60 p-3 min-h-24">
{{ tagsText || 'No tags available' }}
        </pre>
      </section>

      <section class="panel p-4 flex flex-col gap-3">
        <div class="text-sm font-semibold">
          Raw Tags
        </div>
        <pre class="text-xs whitespace-pre-wrap rounded-md border border-border/50 bg-background/60 p-3 min-h-24">
{{ rawText || 'No raw tags available' }}
        </pre>
      </section>
    </main>
  </div>
</template>
