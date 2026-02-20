<script setup lang="ts">
import type { ImageFile, VideoFile } from '@/store/useMediaStore'
import { nextTick } from 'vue'
import { Button } from '@/components/ui/button'
import { useEditorStore } from '@/store'
import { useMediaStore } from '@/store/useMediaStore'
import { usePerformerStore } from '@/store/usePerformerStore'

type AssetKind = 'image' | 'video'

interface LibraryAsset {
  sourceUrl: string
  previewUrl: string
  width: number
  height: number
  durationMs?: number
  name: string
  authorName?: string
  authorUrl?: string
  externalId: string
}

interface LibraryResponse {
  ok: boolean
  error?: string
  data?: {
    provider: 'pexels'
    kind: AssetKind
    page: number
    perPage: number
    total: number | null
    assets: LibraryAsset[]
  }
}

const LOAD_MORE_THRESHOLD_PX = 300
const DEFAULT_IMAGE_DURATION_MS = 3000
const DEFAULT_VIDEO_DURATION_MS = 5000

const props = defineProps<{
  kind: AssetKind
}>()

const mediaStore = useMediaStore()
const editorStore = useEditorStore()
const performerStore = usePerformerStore()

const query = ref('')
const page = ref(1)
const perPage = ref(24)
const total = ref<number | null>(null)
const assets = ref<LibraryAsset[]>([])
const hasMore = ref(true)
const isLoading = ref(false)
const isLoadingMore = ref(false)
const loadError = ref('')
const importError = ref('')
const isImporting = ref(false)
const importingIds = ref<string[]>([])
const addingToCanvasIds = ref<string[]>([])
const selectedExternalIds = ref<string[]>([])
const listContainerRef = ref<HTMLElement | null>(null)
const skeletonItems = Array.from({ length: 8 }, (_, index) => index)

const selectedCount = computed(() => selectedExternalIds.value.length)
const allLoadedSelected = computed(() => {
  return assets.value.length > 0
    && assets.value.every(asset => selectedExternalIds.value.includes(asset.externalId))
})
const libraryTitle = computed(() => (props.kind === 'video' ? '视频库' : '图片库'))
const libraryHint = computed(() => (props.kind === 'video' ? '视频素材' : '图片素材'))
const importLibraryLabel = computed(() => '导入媒体库')
const loadedSummary = computed(() => {
  if (total.value === null)
    return `已加载 ${assets.value.length}`
  return `已加载 ${assets.value.length} / ${total.value}`
})
const loadProgressPercent = computed<number | null>(() => {
  if (total.value === null || total.value <= 0)
    return null
  return Math.min(100, Math.round((assets.value.length / total.value) * 100))
})

function formatDuration(ms?: number): string {
  if (!ms || ms <= 0)
    return '--:--'

  const totalSeconds = Math.floor(ms / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${String(seconds).padStart(2, '0')}`
}

function formatResolution(asset: LibraryAsset): string {
  if (asset.width <= 0 || asset.height <= 0)
    return '--'
  return `${asset.width}x${asset.height}`
}

function buildRequestUrl(targetPage: number): string {
  const params = new URLSearchParams({
    kind: props.kind,
    page: String(targetPage),
    perPage: String(perPage.value),
  })

  if (query.value.trim().length > 0)
    params.set('query', query.value.trim())

  return `/api/pexels/list?${params.toString()}`
}

function mergeAssetsByExternalId(
  current: LibraryAsset[],
  incoming: LibraryAsset[],
): LibraryAsset[] {
  const deduped = new Map<string, LibraryAsset>()
  current.forEach(asset => deduped.set(asset.externalId, asset))
  incoming.forEach((asset) => {
    if (!deduped.has(asset.externalId))
      deduped.set(asset.externalId, asset)
  })
  return Array.from(deduped.values())
}

function updateHasMoreByResponse(incomingCount: number): void {
  if (total.value !== null) {
    hasMore.value = assets.value.length < total.value
    return
  }

  hasMore.value = incomingCount >= perPage.value
}

function maybeLoadMoreOnScroll(): void {
  const container = listContainerRef.value
  if (!container || isLoading.value || isLoadingMore.value || !hasMore.value)
    return

  const remaining = container.scrollHeight - container.scrollTop - container.clientHeight
  if (remaining > LOAD_MORE_THRESHOLD_PX)
    return

  void loadAssets()
}

async function loadAssets(options: { reset?: boolean } = {}): Promise<void> {
  const isReset = options.reset === true
  if (isLoading.value || isLoadingMore.value)
    return
  if (!isReset && !hasMore.value)
    return

  const targetPage = isReset ? 1 : page.value
  if (isReset) {
    isLoading.value = true
    loadError.value = ''
    assets.value = []
    selectedExternalIds.value = []
    total.value = null
    hasMore.value = true
    page.value = 1
  }
  else {
    isLoadingMore.value = true
  }

  try {
    const response = await fetch(buildRequestUrl(targetPage), { method: 'GET' })
    const payload = await response.json() as LibraryResponse
    if (!response.ok || !payload.ok || !payload.data) {
      loadError.value = payload.error ?? `加载失败（HTTP ${response.status}）`
      if (isReset) {
        assets.value = []
        total.value = null
      }
      hasMore.value = false
      return
    }

    const incomingAssets = payload.data.assets
    total.value = payload.data.total
    assets.value = isReset
      ? incomingAssets
      : mergeAssetsByExternalId(assets.value, incomingAssets)

    page.value = targetPage + 1
    updateHasMoreByResponse(incomingAssets.length)
  }
  catch (error) {
    loadError.value = error instanceof Error ? error.message : '素材加载失败'
    if (isReset) {
      assets.value = []
      total.value = null
    }
    hasMore.value = false
  }
  finally {
    if (isReset)
      isLoading.value = false
    else
      isLoadingMore.value = false

    await nextTick()
    maybeLoadMoreOnScroll()
  }
}

function isSelected(externalId: string): boolean {
  return selectedExternalIds.value.includes(externalId)
}

function toggleSelected(externalId: string): void {
  if (isImporting.value)
    return

  if (isSelected(externalId)) {
    selectedExternalIds.value = selectedExternalIds.value.filter(id => id !== externalId)
    return
  }

  selectedExternalIds.value = [...selectedExternalIds.value, externalId]
}

function toggleSelectLoaded(): void {
  if (isImporting.value)
    return

  if (allLoadedSelected.value) {
    selectedExternalIds.value = []
    return
  }

  selectedExternalIds.value = assets.value.map(asset => asset.externalId)
}

function clearSelection(): void {
  if (isImporting.value)
    return
  selectedExternalIds.value = []
}

function importAssetToMediaLibrary(asset: LibraryAsset): ImageFile | VideoFile {
  if (props.kind === 'image')
    return mediaStore.addImageFromUrl(asset.sourceUrl, asset.name)

  const videoFile = mediaStore.addVideoFromUrl(asset.sourceUrl, asset.name)
  if (typeof asset.durationMs === 'number' && asset.durationMs > 0)
    videoFile.duration = asset.durationMs
  if (asset.width > 0 && asset.height > 0)
    videoFile.metadata.resolution = { width: asset.width, height: asset.height }
  return videoFile
}

async function addAssetToCanvas(asset: LibraryAsset): Promise<void> {
  if (isImporting.value)
    return

  isImporting.value = true
  importError.value = ''
  importingIds.value = [asset.externalId]
  addingToCanvasIds.value = [asset.externalId]
  try {
    await editorStore.clippa.ready
    const startMs = editorStore.currentTime
    const stageWidth = editorStore.clippa.stage.app?.renderer.width ?? 0
    const stageHeight = editorStore.clippa.stage.app?.renderer.height ?? 0

    if (props.kind === 'image') {
      const imageFile = importAssetToMediaLibrary(asset) as ImageFile
      const performer = performerStore.addPerformer({
        id: `image-${crypto.randomUUID()}`,
        type: 'image',
        src: imageFile.source,
        start: startMs,
        duration: DEFAULT_IMAGE_DURATION_MS,
        x: 0,
        y: 0,
        zIndex: Math.max(1, (editorStore.clippa.timeline.rails?.maxZIndex ?? 0) + 1),
      })
      await editorStore.clippa.hire(performer)
      if (!editorStore.clippa.stage.performers.has(performer))
        editorStore.clippa.show(performer)
      performerStore.selectPerformer(performer.id)
      return
    }

    const videoFile = importAssetToMediaLibrary(asset) as VideoFile
    const resolvedDuration = videoFile.duration > 0 ? videoFile.duration : DEFAULT_VIDEO_DURATION_MS
    const performer = performerStore.addPerformer({
      id: `video-${crypto.randomUUID()}`,
      type: 'video',
      src: videoFile.source,
      start: startMs,
      duration: resolvedDuration,
      sourceDuration: resolvedDuration,
      width: asset.width > 0 ? asset.width : stageWidth,
      height: asset.height > 0 ? asset.height : stageHeight,
      x: 0,
      y: 0,
      zIndex: Math.max(1, (editorStore.clippa.timeline.rails?.maxZIndex ?? 0) + 1),
    })
    await editorStore.clippa.hire(performer)
    if (!editorStore.clippa.stage.performers.has(performer))
      editorStore.clippa.show(performer)
    performerStore.selectPerformer(performer.id)
  }
  catch (error) {
    importError.value = error instanceof Error ? error.message : '添加到画布失败'
  }
  finally {
    importingIds.value = []
    addingToCanvasIds.value = []
    isImporting.value = false
  }
}

async function importAssetsToMediaLibrary(targetAssets: LibraryAsset[]): Promise<void> {
  if (targetAssets.length === 0 || isImporting.value)
    return

  isImporting.value = true
  importError.value = ''
  importingIds.value = targetAssets.map(asset => asset.externalId)
  addingToCanvasIds.value = []
  try {
    targetAssets.forEach(asset => importAssetToMediaLibrary(asset))
    selectedExternalIds.value = []
  }
  catch (error) {
    importError.value = error instanceof Error ? error.message : '导入素材失败'
  }
  finally {
    importingIds.value = []
    addingToCanvasIds.value = []
    isImporting.value = false
  }
}

async function importAsset(asset: LibraryAsset): Promise<void> {
  await importAssetsToMediaLibrary([asset])
}

async function importSelectedAssets(): Promise<void> {
  const selected = assets.value.filter(asset => selectedExternalIds.value.includes(asset.externalId))
  await importAssetsToMediaLibrary(selected)
}

function onSearch(): void {
  void loadAssets({ reset: true })
}

function clearQuery(): void {
  if (query.value.trim().length === 0)
    return
  query.value = ''
  void loadAssets({ reset: true })
}

watch(() => props.kind, () => {
  void loadAssets({ reset: true })
}, { immediate: true })
</script>

<template>
  <div class="library-shell h-full min-h-0 flex flex-col text-foreground">
    <div class="flex flex-col gap-3 p-3 border-b border-border/70">
      <!-- Header Row: Title & Stats -->
      <div class="flex items-center justify-between">
        <div class="text-sm font-medium text-foreground">{{ libraryTitle }}</div>
        <div class="flex items-center gap-2 text-[10px] text-foreground-muted">
          <span>{{ loadedSummary }}</span>
          <span v-if="selectedCount > 0" class="text-primary font-medium">
            已选 {{ selectedCount }}
          </span>
        </div>
      </div>

      <!-- Search -->
      <div class="flex items-center gap-2">
        <div class="relative flex-1 group">
          <div class="absolute left-2.5 top-1/2 -translate-y-1/2 text-foreground-muted i-carbon-search text-xs" />
          <input
            v-model="query"
            type="text"
            placeholder="搜索..."
            class="w-full h-8 rounded-md border border-border/70 bg-secondary/30 pl-8 pr-7 text-xs text-foreground outline-none focus:border-border-emphasis focus:bg-background transition-all placeholder:text-foreground-subtle"
            @keydown.enter.prevent="onSearch"
          >
          <button
            v-if="query.trim().length > 0"
            class="absolute right-2 top-1/2 -translate-y-1/2 text-foreground-muted hover:text-foreground"
            @click="clearQuery"
          >
            <div i-carbon-close text-xs />
          </button>
        </div>
      </div>

      <!-- Action Buttons -->
      <div class="flex items-center justify-between gap-2">
        <div class="flex items-center gap-1">
          <Button
            size="xs"
            variant="ghost"
            class="h-7 px-2 text-[10px]"
            :disabled="assets.length === 0 || isImporting"
            @click="toggleSelectLoaded"
          >
            {{ allLoadedSelected ? '取消全选' : '全选' }}
          </Button>
          <Button
            size="xs"
            variant="ghost"
            class="h-7 px-2 text-[10px]"
            :disabled="selectedCount === 0 || isImporting"
            @click="clearSelection"
          >
            清空
          </Button>
        </div>
        <Button
          size="xs"
          class="h-7 px-3 text-[10px]"
          :disabled="selectedCount === 0 || isImporting"
          @click="importSelectedAssets"
        >
          <div v-if="isImporting && addingToCanvasIds.length === 0" i-carbon-circle-dash animate-spin mr-1 />
          {{ importLibraryLabel }} ({{ selectedCount }})
        </Button>
      </div>

      <div v-if="importError" class="flex items-center gap-1 rounded-md bg-destructive/10 px-2 py-1.5 text-[10px] text-destructive break-all">
        <div i-carbon-warning-filled class="shrink-0 text-xs" />
        <span>{{ importError }}</span>
      </div>

      <!-- Progress Bar (Subtle) -->
      <div
        v-if="loadProgressPercent !== null && loadProgressPercent < 100"
        class="h-0.5 w-full overflow-hidden rounded-full bg-secondary/70 mt-1"
      >
        <div class="h-full rounded-full bg-primary/75 transition-all duration-200" :style="{ width: `${loadProgressPercent}%` }" />
      </div>
    </div>

    <div
      ref="listContainerRef"
      class="min-h-0 flex-1 overflow-y-auto px-3 pb-4 pt-3"
      @scroll.passive="maybeLoadMoreOnScroll"
    >
      <div
        v-if="isLoading && assets.length === 0"
        class="grid gap-3 grid-cols-[repeat(auto-fill,minmax(150px,1fr))] sm:grid-cols-[repeat(auto-fill,minmax(180px,1fr))]"
      >
        <div
          v-for="item in skeletonItems"
          :key="item"
          class="rounded-xl border border-border/70 bg-secondary/20 p-2.5"
        >
          <div class="aspect-video w-full animate-pulse rounded-lg bg-secondary/70" />
          <div class="mt-2 h-3 w-4/5 animate-pulse rounded bg-secondary/70" />
          <div class="mt-1 h-3 w-2/3 animate-pulse rounded bg-secondary/70" />
          <div class="mt-2 h-7 w-full animate-pulse rounded bg-secondary/70" />
        </div>
      </div>

      <div v-else-if="loadError && assets.length === 0" class="py-8">
        <div class="mx-auto max-w-72 rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-4 text-center">
          <div i-carbon-warning-filled class="mx-auto mb-2 text-xl text-destructive" />
          <div class="text-sm text-destructive">
            {{ loadError }}
          </div>
          <Button size="sm" variant="outline" class="mt-3" @click="onSearch">
            重试加载
          </Button>
        </div>
      </div>

      <div v-else-if="assets.length === 0" class="py-8">
        <div class="mx-auto max-w-72 rounded-xl border border-border/70 bg-secondary/20 px-4 py-5 text-center">
          <div i-ph-image-square-bold class="mx-auto mb-2 text-xl text-foreground-muted" />
          <div class="text-sm text-foreground">
            暂无素材
          </div>
          <div class="mt-1 text-xs text-foreground-muted">
            尝试更换关键词搜索{{ libraryHint }}
          </div>
        </div>
      </div>

      <div
        v-else
        class="grid gap-3 sm:gap-4 grid-cols-[repeat(auto-fill,minmax(150px,1fr))] sm:grid-cols-[repeat(auto-fill,minmax(180px,1fr))]"
      >
        <div
          v-for="asset in assets"
          :key="asset.externalId"
          tabindex="0"
          role="button"
          :aria-pressed="isSelected(asset.externalId)"
          :aria-label="`选择素材 ${asset.name}`"
          class="library-card cursor-pointer rounded-xl border bg-background-elevated/90 p-2.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          :class="isSelected(asset.externalId)
            ? 'border-primary/70 bg-secondary/30 shadow-[0_0_0_1px_hsl(var(--primary)/0.2)]'
            : 'border-border/80 hover:border-border-emphasis hover:bg-secondary/20'"
          @click="toggleSelected(asset.externalId)"
          @keydown.enter.prevent="toggleSelected(asset.externalId)"
          @keydown.space.prevent="toggleSelected(asset.externalId)"
        >
          <div class="relative aspect-video overflow-hidden rounded-lg border border-border/60 bg-black/40">
            <img
              :src="asset.previewUrl"
              :alt="asset.name"
              loading="lazy"
              class="library-media-image h-full w-full object-cover"
            >
            <div class="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />

            <div
              v-if="props.kind === 'video'"
              class="absolute right-1.5 bottom-1.5 rounded bg-black/70 px-1.5 py-0.5 text-xs text-white"
            >
              {{ formatDuration(asset.durationMs) }}
            </div>

            <div
              class="absolute left-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full border border-white/70 bg-black/50 transition-colors"
              :class="isSelected(asset.externalId) ? 'bg-primary text-primary-foreground border-primary' : 'text-white'"
            >
              <div
                v-if="isSelected(asset.externalId)"
                i-ph-check-bold class="text-xs"
              />
            </div>
          </div>

          <div class="mt-2">
            <div class="truncate text-xs font-semibold text-foreground" :title="asset.name">
              {{ asset.name }}
            </div>
            <div class="mt-1 flex items-center justify-between gap-2 text-[11px] text-foreground-muted">
              <div class="truncate" :title="asset.authorName ?? 'Pexels'">
                {{ asset.authorName ?? 'Pexels' }}
              </div>
              <div class="shrink-0">
                {{ formatResolution(asset) }}
              </div>
            </div>
          </div>

          <div class="mt-2 grid grid-cols-2 gap-1.5">
            <Button
              size="sm"
              variant="outline"
              class="w-full px-2 text-[11px]"
              :disabled="isImporting"
              @click.stop="importAsset(asset)"
            >
              <div
                v-if="importingIds.includes(asset.externalId) && !addingToCanvasIds.includes(asset.externalId)"
                i-carbon-circle-dash animate-spin mr-1
              />
              {{ importLibraryLabel }}
            </Button>
            <Button
              size="sm"
              class="w-full px-2 text-[11px]"
              :disabled="isImporting"
              @click.stop="addAssetToCanvas(asset)"
            >
              <div
                v-if="addingToCanvasIds.includes(asset.externalId)"
                i-carbon-circle-dash animate-spin mr-1
              />
              添加到画布
            </Button>
          </div>
        </div>
      </div>

      <div v-if="isLoadingMore" class="flex items-center justify-center gap-2 py-4 text-sm text-foreground-muted">
        <div i-carbon-circle-dash animate-spin />
        正在加载更多...
      </div>
      <div
        v-else-if="!hasMore && assets.length > 0"
        class="py-4 text-center text-xs text-foreground-muted"
      >
        已加载全部素材
      </div>
      <div
        v-else-if="loadError && assets.length > 0"
        class="py-4 text-center text-xs text-destructive"
      >
        <span>{{ loadError }}</span>
        <button
          type="button"
          class="ml-2 cursor-pointer text-foreground underline underline-offset-2"
          @click="onSearch"
        >
          重试
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.library-shell {
  background: hsl(var(--background-elevated));
}

.library-header {
  background: linear-gradient(180deg, hsl(var(--background-overlay) / 0.42) 0%, transparent 100%);
}

.library-card {
  transition:
    border-color 160ms var(--ease-out),
    transform 180ms var(--ease-out),
    background-color 160ms var(--ease-out),
    box-shadow 160ms var(--ease-out);
}

.library-card:hover {
  transform: translateY(-2px);
}

.library-media-image {
  transition:
    transform 220ms var(--ease-out),
    filter 220ms var(--ease-out);
}

.library-card:hover .library-media-image {
  transform: scale(1.03);
  filter: saturate(1.08);
}

@media (prefers-reduced-motion: reduce) {
  .library-card {
    transition: none;
  }

  .library-card:hover {
    transform: none;
  }

  .library-media-image {
    transition: none;
  }

  .library-card:hover .library-media-image {
    transform: none;
    filter: none;
  }
}
</style>
