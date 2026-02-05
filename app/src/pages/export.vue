<script setup lang="ts">
import { computed, ref } from 'vue'
import { storeToRefs } from 'pinia'
import { useRouter } from 'vue-router'
import type { MetadataTags } from 'mediabunny'
import { ALL_FORMATS, BlobSource, BufferTarget, Conversion, Input, Mp4OutputFormat, Output } from 'mediabunny'
import { ms2TimeStr } from 'open-clippa'
import { Button } from '@/components/ui/button'
import { useExportStore, type ExportedVideo } from '@/store/useExportStore'

const router = useRouter()
const exportStore = useExportStore()
const { exportedVideo } = storeToRefs(exportStore)

const videoRef = ref<HTMLVideoElement | null>(null)
const coverInputRef = ref<HTMLInputElement | null>(null)
const isPreparingDownload = ref(false)

const hasExport = computed(() => Boolean(exportedVideo.value))

const fileSizeText = computed(() => {
  if (!exportedVideo.value)
    return '--'
  return formatBytes(exportedVideo.value.size)
})

const durationText = computed(() => {
  if (!exportedVideo.value)
    return '--'
  return ms2TimeStr(exportedVideo.value.duration)
})

const frameRateText = computed(() => {
  if (!exportedVideo.value)
    return '--'
  return `${exportedVideo.value.frameRate} fps`
})

const createdAtText = computed(() => {
  if (!exportedVideo.value)
    return '--'
  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(exportedVideo.value.createdAt)
})

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0)
    return '0 B'

  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const index = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)))
  const value = bytes / 1024 ** index
  return `${value.toFixed(2)} ${units[index]}`
}

function handleBack() {
  router.push('/editor/media')
}

function handleDownload() {
  if (!exportedVideo.value)
    return

  prepareDownload(exportedVideo.value)
}

async function prepareDownload(video: ExportedVideo) {
  if (isPreparingDownload.value)
    return

  isPreparingDownload.value = true

  try {
    const tags = await buildMetadataTags(video)
    if (isEmptyMetadata(tags)) {
      downloadBlob(video.blob, video.name)
      return
    }

    const blob = await remuxWithMetadata(video.blob, tags)
    downloadBlob(blob, video.name)
  }
  catch (error) {
    console.error('Export metadata write failed:', error)
  }
  finally {
    isPreparingDownload.value = false
  }
}

function isEmptyMetadata(tags: MetadataTags): boolean {
  return !tags.title && !tags.description && (!tags.images || tags.images.length === 0)
}

async function buildMetadataTags(video: ExportedVideo): Promise<MetadataTags> {
  const tags: MetadataTags = {}

  const title = video.info.title?.trim()
  const description = video.info.description?.trim()

  if (title)
    tags.title = title
  if (description)
    tags.description = description
  if (description)
    tags.comment = description

  if (video.coverUrl) {
    const cover = await resolveCoverImage(video.coverUrl)
    if (cover) {
      tags.images = [{
        data: cover.data,
        mimeType: cover.mimeType,
        kind: 'coverFront',
      }]
    }
  }

  return tags
}

async function resolveCoverImage(url: string): Promise<{ data: Uint8Array, mimeType: string } | null> {
  try {
    const response = await fetch(url)
    if (!response.ok)
      return null

    const blob = await response.blob()
    const buffer = await blob.arrayBuffer()
    return {
      data: new Uint8Array(buffer),
      mimeType: blob.type || 'image/jpeg',
    }
  }
  catch {
    return null
  }
}

async function remuxWithMetadata(blob: Blob, tags: MetadataTags): Promise<Blob> {
  const input = new Input({
    formats: ALL_FORMATS,
    source: new BlobSource(blob),
  })

  const output = new Output({
    format: new Mp4OutputFormat({ fastStart: 'in-memory', metadataFormat: 'mdir' }),
    target: new BufferTarget(),
  })

  const conversion = await Conversion.init({
    input,
    output,
    tags,
  })

  if (!conversion.isValid) {
    throw new Error('Metadata conversion is invalid')
  }

  await conversion.execute()

  const buffer = output.target.buffer
  if (!buffer) {
    throw new Error('Metadata conversion failed')
  }

  return new Blob([buffer], { type: output.format.mimeType })
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  document.body.removeChild(anchor)
  setTimeout(() => URL.revokeObjectURL(url), 100)
}

function handleCaptureCover() {
  if (!exportedVideo.value)
    return

  const video = videoRef.value
  if (!video || video.videoWidth === 0 || video.videoHeight === 0)
    return

  const canvas = document.createElement('canvas')
  canvas.width = video.videoWidth
  canvas.height = video.videoHeight
  const context = canvas.getContext('2d')
  if (!context)
    return

  context.drawImage(video, 0, 0, canvas.width, canvas.height)
  const dataUrl = canvas.toDataURL('image/jpeg', 0.9)
  exportStore.setCoverUrl(dataUrl)
}

function handleCoverUploadClick() {
  coverInputRef.value?.click()
}

function handleCoverFileChange(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file)
    return

  const url = URL.createObjectURL(file)
  exportStore.setCoverUrl(url)
  input.value = ''
}

function handleClearCover() {
  exportStore.setCoverUrl('')
}
</script>

<template>
  <div w-full h-full bg-background text-foreground flex="~ col">
    <header class="h-12 border-b border-border bg-background flex items-center px-4 gap-3">
      <AppLogo size="sm" />
      <div class="text-sm text-foreground-muted">Export Preview</div>
      <div class="flex-1" />
      <Button size="sm" variant="ghost" @click="handleBack">
        Back to Editor
      </Button>
      <Button size="sm" :disabled="!hasExport || isPreparingDownload" @click="handleDownload">
        {{ isPreparingDownload ? 'Preparing' : 'Download' }}
      </Button>
    </header>

    <main class="flex-1 overflow-auto p-6">
      <div v-if="!hasExport" class="h-full center text-foreground-muted">
        No export result available
      </div>

      <div
        v-else
        class="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]"
      >
        <section class="panel p-4 flex flex-col gap-4">
          <div class="text-sm font-semibold">Video Preview</div>
          <div class="w-full aspect-video rounded-md overflow-hidden bg-black/60 border border-border/50">
            <video
              ref="videoRef"
              class="h-full w-full"
              :src="exportedVideo?.url"
              controls
            />
          </div>

          <div class="grid grid-cols-2 gap-3 text-sm">
            <div class="text-foreground-muted">File</div>
            <div class="text-foreground">{{ exportedVideo?.name }}</div>

            <div class="text-foreground-muted">Size</div>
            <div class="text-foreground">{{ fileSizeText }}</div>

            <div class="text-foreground-muted">Duration</div>
            <div class="text-foreground">{{ durationText }}</div>

            <div class="text-foreground-muted">Frame Rate</div>
            <div class="text-foreground">{{ frameRateText }}</div>

            <div class="text-foreground-muted">Created</div>
            <div class="text-foreground">{{ createdAtText }}</div>
          </div>
        </section>

        <section class="panel p-4 flex flex-col gap-4">
          <div class="text-sm font-semibold">Cover</div>
          <div class="aspect-video w-full rounded-md overflow-hidden border border-border/50 bg-black/30 flex items-center justify-center">
            <img
              v-if="exportedVideo?.coverUrl"
              :src="exportedVideo.coverUrl"
              alt="Cover"
              class="h-full w-full object-cover"
            >
            <div v-else class="text-xs text-foreground-muted">
              No cover image
            </div>
          </div>

          <div class="flex flex-wrap gap-2">
            <Button size="xs" variant="secondary" @click="handleCaptureCover">
              Capture Frame
            </Button>
            <Button size="xs" variant="outline" @click="handleCoverUploadClick">
              Upload Cover
            </Button>
            <Button size="xs" variant="ghost" @click="handleClearCover">
              Clear
            </Button>
            <input
              ref="coverInputRef"
              type="file"
              accept="image/*"
              hidden
              @change="handleCoverFileChange"
            >
          </div>

          <div class="divider-h" />

          <div class="text-sm font-semibold">Info</div>
          <label class="text-xs text-foreground-muted" for="export-title">Title</label>
          <input
            id="export-title"
            v-model="exportedVideo.info.title"
            class="h-9 px-3 rounded-md bg-background border border-border text-sm focus-ring"
            type="text"
            placeholder="Title"
          >

          <label class="text-xs text-foreground-muted" for="export-description">Description</label>
          <textarea
            id="export-description"
            v-model="exportedVideo.info.description"
            class="min-h-20 px-3 py-2 rounded-md bg-background border border-border text-sm focus-ring"
            rows="3"
            placeholder="Description"
          />

        </section>
      </div>
    </main>
  </div>
</template>
