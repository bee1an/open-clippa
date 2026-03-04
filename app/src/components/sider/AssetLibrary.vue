<script setup lang="ts">
import type { ImageFile, VideoFile } from '@/store/useMediaStore'
import { nextTick } from 'vue'
import { Button } from '@/components/ui/button'
import { useEditorCommandActions } from '@/composables/useEditorCommandActions'
import { useEditorStore } from '@/store'
import { useMediaStore } from '@/store/useMediaStore'

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

interface CategoryPreset {
  key: string
  title: string
  query?: string
}

interface CategoryRowState extends CategoryPreset {
  assets: LibraryAsset[]
  isLoading: boolean
  error: string
}

const props = defineProps<{
  kind: AssetKind
}>()
const LOAD_MORE_THRESHOLD_PX = 300
const DEFAULT_IMAGE_DURATION_MS = 3000
const DEFAULT_VIDEO_DURATION_MS = 5000
const GRID_PER_PAGE = 24
const CATEGORY_ROW_PER_PAGE = 40

const IMAGE_CATEGORY_PRESETS: CategoryPreset[] = [
  { key: 'featured', title: '精选' },
  { key: 'nature', title: '自然', query: 'nature' },
  { key: 'people', title: '人物', query: 'people' },
  { key: 'business', title: '商务', query: 'business' },
  { key: 'technology', title: '科技', query: 'technology' },
  { key: 'city', title: '城市', query: 'city' },
  { key: 'food', title: '美食', query: 'food' },
]

const VIDEO_CATEGORY_PRESETS: CategoryPreset[] = [
  { key: 'featured', title: '精选' },
  { key: 'lifestyle', title: '生活', query: 'lifestyle' },
  { key: 'nature', title: '自然', query: 'nature' },
  { key: 'people', title: '人物', query: 'people' },
  { key: 'business', title: '商务', query: 'business' },
  { key: 'sport', title: '运动', query: 'sport' },
  { key: 'travel', title: '旅行', query: 'travel' },
]

const mediaStore = useMediaStore()
const editorStore = useEditorStore()
const editorCommandActions = useEditorCommandActions()

const query = ref('')
const submittedQuery = ref('')
const activeCategoryKey = ref<string | null>(null)
const page = ref(1)
const total = ref<number | null>(null)
const assets = ref<LibraryAsset[]>([])
const categoryRows = ref<CategoryRowState[]>([])
const hasMore = ref(true)
const isLoading = ref(false)
const isLoadingMore = ref(false)
const loadError = ref('')
const importError = ref('')
const isImporting = ref(false)
const importingIds = ref<string[]>([])
const addingToCanvasIds = ref<string[]>([])
const listContainerRef = ref<HTMLElement | null>(null)
const gridSkeletonItems = Array.from({ length: 8 }, (_, index) => index)
const rowSkeletonItems = Array.from({ length: 6 }, (_, index) => index)

let categoryLoadVersion = 0

const trimmedQuery = computed(() => query.value.trim())
const trimmedSubmittedQuery = computed(() => submittedQuery.value.trim())
const categoryPresets = computed<CategoryPreset[]>(() => (
  props.kind === 'video' ? VIDEO_CATEGORY_PRESETS : IMAGE_CATEGORY_PRESETS
))
const activeCategoryPreset = computed<CategoryPreset | null>(() => {
  if (!activeCategoryKey.value)
    return null
  return categoryPresets.value.find(preset => preset.key === activeCategoryKey.value) ?? null
})
const isCategoryRowsMode = computed(() => trimmedSubmittedQuery.value.length === 0 && !activeCategoryPreset.value)
const isCategoryMoreMode = computed(() => trimmedSubmittedQuery.value.length === 0 && !!activeCategoryPreset.value)
const activeGridQuery = computed(() => {
  if (isCategoryMoreMode.value)
    return activeCategoryPreset.value?.query
  if (trimmedSubmittedQuery.value.length > 0)
    return trimmedSubmittedQuery.value
  return undefined
})

const allLoadedAssets = computed<LibraryAsset[]>(() => {
  const sourceAssets = isCategoryRowsMode.value
    ? categoryRows.value.flatMap(row => row.assets)
    : assets.value

  const deduped = new Map<string, LibraryAsset>()
  sourceAssets.forEach((asset) => {
    if (!deduped.has(asset.externalId))
      deduped.set(asset.externalId, asset)
  })
  return Array.from(deduped.values())
})
const importedVideoSourceSet = computed(() => {
  return new Set(mediaStore.videoFiles.map(file => (typeof file.source === 'string' ? file.source : file.url)))
})
const importedImageSourceSet = computed(() => {
  return new Set(mediaStore.imageFiles.map(file => (typeof file.source === 'string' ? file.source : file.url)))
})
const importedSourceSet = computed(() => {
  return props.kind === 'video'
    ? importedVideoSourceSet.value
    : importedImageSourceSet.value
})

const libraryTitle = computed(() => (props.kind === 'video' ? '视频库' : '图片库'))
const libraryHint = computed(() => (props.kind === 'video' ? '视频素材' : '图片素材'))
const importLibraryLabel = computed(() => '导入媒体库')
const loadedSummary = computed(() => {
  if (isCategoryRowsMode.value) {
    const loadedRows = categoryRows.value.filter(row => !row.isLoading).length
    return `已加载 ${allLoadedAssets.value.length} · ${loadedRows}/${categoryRows.value.length} 行`
  }

  if (total.value === null)
    return `已加载 ${assets.value.length}`
  return `已加载 ${assets.value.length} / ${total.value}`
})
const loadProgressPercent = computed<number | null>(() => {
  if (isCategoryRowsMode.value)
    return null
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

function buildRequestUrl(
  targetPage: number,
  options: { queryText?: string, perPageValue?: number } = {},
): string {
  const params = new URLSearchParams({
    kind: props.kind,
    page: String(targetPage),
    perPage: String(options.perPageValue ?? GRID_PER_PAGE),
  })

  if (options.queryText && options.queryText.trim().length > 0)
    params.set('query', options.queryText.trim())

  return `/api/pexels/list?${params.toString()}`
}

async function requestAssetPage(
  targetPage: number,
  options: { queryText?: string, perPageValue?: number } = {},
): Promise<NonNullable<LibraryResponse['data']>> {
  const response = await fetch(buildRequestUrl(targetPage, options), { method: 'GET' })
  const payload = await response.json() as LibraryResponse

  if (!response.ok || !payload.ok || !payload.data)
    throw new Error(payload.error ?? `加载失败（HTTP ${response.status}）`)

  return payload.data
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

function updateHasMoreByResponse(incomingCount: number, pageSize: number): void {
  if (total.value !== null) {
    hasMore.value = assets.value.length < total.value
    return
  }

  hasMore.value = incomingCount >= pageSize
}

function maybeLoadMoreOnScroll(): void {
  if (isCategoryRowsMode.value)
    return

  const container = listContainerRef.value
  if (!container || isLoading.value || isLoadingMore.value || !hasMore.value)
    return

  const remaining = container.scrollHeight - container.scrollTop - container.clientHeight
  if (remaining > LOAD_MORE_THRESHOLD_PX)
    return

  void loadAssets()
}

function handleCategoryRowWheel(event: WheelEvent): void {
  const scroller = event.currentTarget as HTMLElement | null
  if (!scroller)
    return

  const maxHorizontalOffset = scroller.scrollWidth - scroller.clientWidth
  if (maxHorizontalOffset <= 0)
    return

  const preferredHorizontalDelta = Math.abs(event.deltaY) >= Math.abs(event.deltaX)
    ? event.deltaY
    : event.deltaX
  if (preferredHorizontalDelta === 0)
    return

  const epsilon = 1
  const currentOffset = scroller.scrollLeft
  const canScrollLeft = currentOffset > epsilon
  const canScrollRight = currentOffset < maxHorizontalOffset - epsilon
  const isMovingLeft = preferredHorizontalDelta < 0
  const canConsumeWheel = isMovingLeft ? canScrollLeft : canScrollRight
  if (!canConsumeWheel)
    return

  event.preventDefault()
  scroller.scrollLeft += preferredHorizontalDelta
}

async function loadAssets(options: { reset?: boolean } = {}): Promise<void> {
  if (isCategoryRowsMode.value)
    return

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
    total.value = null
    hasMore.value = true
    page.value = 1
  }
  else {
    isLoadingMore.value = true
  }

  try {
    const payload = await requestAssetPage(targetPage, {
      queryText: activeGridQuery.value,
      perPageValue: GRID_PER_PAGE,
    })
    const incomingAssets = payload.assets
    total.value = payload.total
    assets.value = isReset
      ? incomingAssets
      : mergeAssetsByExternalId(assets.value, incomingAssets)

    page.value = targetPage + 1
    updateHasMoreByResponse(incomingAssets.length, GRID_PER_PAGE)
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

function updateCategoryRow(rowKey: string, updater: (row: CategoryRowState) => CategoryRowState): void {
  categoryRows.value = categoryRows.value.map((row) => {
    if (row.key !== rowKey)
      return row
    return updater(row)
  })
}

async function loadCategoryRow(rowKey: string, version: number): Promise<void> {
  const row = categoryRows.value.find(item => item.key === rowKey)
  if (!row)
    return

  updateCategoryRow(rowKey, current => ({
    ...current,
    isLoading: true,
    error: '',
  }))

  try {
    const payload = await requestAssetPage(1, {
      queryText: row.query,
      perPageValue: CATEGORY_ROW_PER_PAGE,
    })
    if (version !== categoryLoadVersion)
      return

    updateCategoryRow(rowKey, current => ({
      ...current,
      assets: payload.assets,
      isLoading: false,
      error: '',
    }))
  }
  catch (error) {
    if (version !== categoryLoadVersion)
      return

    updateCategoryRow(rowKey, current => ({
      ...current,
      assets: [],
      isLoading: false,
      error: error instanceof Error ? error.message : '分类加载失败',
    }))
  }
}

async function loadCategoryRows(): Promise<void> {
  const version = ++categoryLoadVersion

  loadError.value = ''
  categoryRows.value = categoryPresets.value.map(preset => ({
    ...preset,
    assets: [],
    isLoading: true,
    error: '',
  }))

  await Promise.all(categoryRows.value.map(row => loadCategoryRow(row.key, version)))
}

async function retryCategoryRow(rowKey: string): Promise<void> {
  if (!isCategoryRowsMode.value)
    return

  const currentVersion = categoryLoadVersion
  await loadCategoryRow(rowKey, currentVersion)
}

async function openCategoryMore(rowKey: string): Promise<void> {
  if (trimmedSubmittedQuery.value.length > 0)
    return

  const row = categoryRows.value.find(item => item.key === rowKey)
  if (!row || row.isLoading || !!row.error)
    return

  activeCategoryKey.value = rowKey
  await loadAssets({ reset: true })

  const container = listContainerRef.value
  if (container)
    container.scrollTop = 0
}

function backToCategoryRows(): void {
  if (!activeCategoryKey.value)
    return

  activeCategoryKey.value = null
  assets.value = []
  total.value = null
  page.value = 1
  hasMore.value = true
  loadError.value = ''

  const container = listContainerRef.value
  if (container)
    container.scrollTop = 0
}

function isAssetImported(asset: LibraryAsset): boolean {
  return importedSourceSet.value.has(asset.sourceUrl)
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

    if (props.kind === 'image') {
      const imageFile = importAssetToMediaLibrary(asset) as ImageFile
      await editorCommandActions.mediaAddAssetToTimeline({
        assetId: imageFile.id,
        startMs,
        durationMs: DEFAULT_IMAGE_DURATION_MS,
      })
      return
    }

    const videoFile = importAssetToMediaLibrary(asset) as VideoFile
    const resolvedDuration = videoFile.duration > 0 ? videoFile.duration : DEFAULT_VIDEO_DURATION_MS
    await editorCommandActions.mediaAddAssetToTimeline({
      assetId: videoFile.id,
      startMs,
      durationMs: resolvedDuration,
    })
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

function onSearch(): void {
  const nextSubmittedQuery = trimmedQuery.value
  submittedQuery.value = nextSubmittedQuery

  if (nextSubmittedQuery.length === 0) {
    if (activeCategoryKey.value) {
      void loadAssets({ reset: true })
      return
    }

    void loadCategoryRows()
    return
  }

  if (activeCategoryKey.value)
    activeCategoryKey.value = null

  void loadAssets({ reset: true })
}

function clearQuery(): void {
  if (trimmedQuery.value.length === 0 && trimmedSubmittedQuery.value.length === 0)
    return

  activeCategoryKey.value = null
  submittedQuery.value = ''
  query.value = ''

  void loadCategoryRows()
}

watch(() => props.kind, () => {
  activeCategoryKey.value = null

  if (trimmedSubmittedQuery.value.length === 0) {
    void loadCategoryRows()
    return
  }

  void loadAssets({ reset: true })
}, { immediate: true })

watch(trimmedQuery, (value) => {
  if (value.length > 0)
    return
  if (trimmedSubmittedQuery.value.length === 0)
    return

  submittedQuery.value = ''
  activeCategoryKey.value = null
  void loadCategoryRows()
})
</script>

<template>
  <div class="library-shell h-full min-h-0 flex flex-col text-foreground">
    <div class="flex flex-col gap-3 p-3 border-b border-border/70">
      <!-- Header Row: Title & Stats -->
      <div class="flex items-center justify-between">
        <div class="text-sm font-medium text-foreground">
          {{ libraryTitle }}
        </div>
        <div class="flex items-center gap-2 text-[10px] text-foreground-muted">
          <span>{{ loadedSummary }}</span>
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
            v-if="trimmedQuery.length > 0"
            class="absolute right-2 top-1/2 -translate-y-1/2 text-foreground-muted hover:text-foreground"
            @click="clearQuery"
          >
            <div i-carbon-close text-xs />
          </button>
        </div>
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
      <template v-if="isCategoryRowsMode">
        <div class="flex flex-col gap-4">
          <section v-for="row in categoryRows" :key="`${props.kind}-${row.key}`" class="space-y-2">
            <div class="flex items-center justify-between gap-2">
              <h3 class="text-xs font-medium text-foreground">
                {{ row.title }}
              </h3>
              <button
                v-if="!row.isLoading && !row.error && row.assets.length > 0"
                type="button"
                class="shrink-0 text-[10px] text-foreground-muted transition-colors hover:text-foreground"
                @click="openCategoryMore(row.key)"
              >
                查看更多
              </button>
            </div>

            <div
              v-if="row.isLoading"
              class="category-row-scroller flex gap-2 overflow-x-auto pb-1"
              @wheel="handleCategoryRowWheel"
            >
              <div
                v-for="item in rowSkeletonItems"
                :key="`${row.key}-skeleton-${item}`"
                class="w-[118px] shrink-0 rounded-xl border border-border/70 bg-secondary/20 p-1"
              >
                <div class="aspect-video w-full animate-pulse rounded-lg bg-secondary/70" />
              </div>
            </div>

            <div
              v-else-if="row.error"
              class="flex items-center gap-1.5 rounded-md border border-destructive/40 bg-destructive/10 px-2 py-1.5 text-[10px] text-destructive"
            >
              <div i-carbon-warning-filled class="shrink-0 text-xs" />
              <span class="truncate">{{ row.error }}</span>
              <button
                type="button"
                class="ml-auto shrink-0 text-foreground underline underline-offset-2"
                @click="retryCategoryRow(row.key)"
              >
                重试
              </button>
            </div>

            <div v-else-if="row.assets.length === 0" class="rounded-md border border-border/60 bg-secondary/20 px-2 py-2 text-[10px] text-foreground-muted">
              暂无素材
            </div>

            <div
              v-else
              class="category-row-scroller flex gap-2 overflow-x-auto pb-1"
              @wheel="handleCategoryRowWheel"
            >
              <div
                v-for="asset in row.assets"
                :key="`${row.key}-${asset.externalId}`"
                class="library-card library-card--row w-[118px] shrink-0 rounded-xl border border-border/80 bg-background-elevated/90 p-1 hover:border-border-emphasis hover:bg-secondary/20"
              >
                <div class="group relative aspect-video overflow-hidden rounded-lg border border-border/60 bg-black/40">
                  <img
                    :src="asset.previewUrl"
                    :alt="asset.name"
                    loading="lazy"
                    class="library-media-image h-full w-full object-cover"
                  >
                  <div class="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/35 via-transparent to-transparent" />

                  <div
                    v-if="props.kind === 'video'"
                    class="absolute right-1 bottom-1 rounded bg-black/70 px-1 py-0.5 text-[9px] text-white"
                  >
                    {{ formatDuration(asset.durationMs) }}
                  </div>

                  <div
                    class="absolute right-1 top-1 opacity-0 pointer-events-none transition-opacity duration-150 group-hover:opacity-100 group-hover:pointer-events-auto group-focus-within:opacity-100 group-focus-within:pointer-events-auto"
                  >
                    <div class="flex items-center gap-1">
                      <button
                        type="button"
                        class="flex h-5 items-center justify-center rounded-md border border-white/30 bg-black/65 px-1.5 text-[10px] text-white transition-colors hover:bg-black/80 disabled:opacity-60 disabled:cursor-not-allowed"
                        :disabled="isImporting || isAssetImported(asset)"
                        :title="importLibraryLabel"
                        :aria-label="`导入媒体库：${asset.name}`"
                        @click.stop="importAsset(asset)"
                        @keydown.enter.stop
                        @keydown.space.stop
                      >
                        <div
                          v-if="importingIds.includes(asset.externalId) && !addingToCanvasIds.includes(asset.externalId)"
                          i-carbon-circle-dash
                          class="text-[10px] animate-spin"
                        />
                        <div
                          v-else-if="isAssetImported(asset)"
                          i-ph-check-bold
                          class="text-[10px]"
                        />
                        <span v-else>导入</span>
                      </button>

                      <button
                        type="button"
                        class="flex h-5 w-5 items-center justify-center rounded-md border border-white/30 bg-black/65 text-white transition-colors hover:bg-black/80 disabled:opacity-60 disabled:cursor-not-allowed"
                        :disabled="isImporting"
                        title="添加到画布"
                        :aria-label="`添加到画布：${asset.name}`"
                        @click.stop="addAssetToCanvas(asset)"
                        @keydown.enter.stop
                        @keydown.space.stop
                      >
                        <div
                          v-if="addingToCanvasIds.includes(asset.externalId)"
                          i-carbon-circle-dash
                          class="text-[10px] animate-spin"
                        />
                        <div v-else i-carbon-add class="text-[10px]" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>
        </div>
      </template>

      <template v-else>
        <div
          v-if="isCategoryMoreMode"
          class="mb-3 flex items-center justify-between gap-2"
        >
          <Button size="xs" variant="ghost" class="h-7 px-2 text-[10px]" @click="backToCategoryRows">
            <div i-carbon-arrow-left class="mr-1 text-xs" />
            返回分类
          </Button>
          <span class="text-[10px] text-foreground-muted">查看更多 · {{ activeCategoryPreset?.title }}</span>
        </div>

        <div
          v-if="isLoading && assets.length === 0"
          class="grid gap-2 sm:gap-3 grid-cols-[repeat(auto-fill,minmax(120px,1fr))] sm:grid-cols-[repeat(auto-fill,minmax(150px,1fr))]"
        >
          <div
            v-for="item in gridSkeletonItems"
            :key="item"
            class="rounded-xl border border-border/70 bg-secondary/20 p-1"
          >
            <div class="aspect-video w-full animate-pulse rounded-lg bg-secondary/70" />
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
          class="grid gap-2 sm:gap-3 grid-cols-[repeat(auto-fill,minmax(120px,1fr))] sm:grid-cols-[repeat(auto-fill,minmax(150px,1fr))]"
        >
          <div
            v-for="asset in assets"
            :key="asset.externalId"
            class="library-card rounded-xl border border-border/80 bg-background-elevated/90 p-1 hover:border-border-emphasis hover:bg-secondary/20"
          >
            <div class="group relative aspect-video overflow-hidden rounded-lg border border-border/60 bg-black/40">
              <img
                :src="asset.previewUrl"
                :alt="asset.name"
                loading="lazy"
                class="library-media-image h-full w-full object-cover"
              >
              <div class="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/35 via-transparent to-transparent" />

              <div
                v-if="props.kind === 'video'"
                class="absolute right-1.5 bottom-1.5 rounded bg-black/70 px-1.5 py-0.5 text-[10px] text-white"
              >
                {{ formatDuration(asset.durationMs) }}
              </div>

              <div
                class="absolute right-1.5 top-1.5 opacity-0 pointer-events-none transition-opacity duration-150 group-hover:opacity-100 group-hover:pointer-events-auto group-focus-within:opacity-100 group-focus-within:pointer-events-auto"
              >
                <div class="flex items-center gap-1">
                  <button
                    type="button"
                    class="flex h-6 items-center justify-center rounded-md border border-white/30 bg-black/65 px-2 text-[10px] text-white transition-colors hover:bg-black/80 disabled:opacity-60 disabled:cursor-not-allowed"
                    :disabled="isImporting || isAssetImported(asset)"
                    :title="importLibraryLabel"
                    :aria-label="`导入媒体库：${asset.name}`"
                    @click.stop="importAsset(asset)"
                    @keydown.enter.stop
                    @keydown.space.stop
                  >
                    <div
                      v-if="importingIds.includes(asset.externalId) && !addingToCanvasIds.includes(asset.externalId)"
                      i-carbon-circle-dash
                      class="text-xs animate-spin"
                    />
                    <div
                      v-else-if="isAssetImported(asset)"
                      i-ph-check-bold
                      class="text-xs"
                    />
                    <span v-else>导入</span>
                  </button>

                  <button
                    type="button"
                    class="flex h-6 w-6 items-center justify-center rounded-md border border-white/30 bg-black/65 text-white transition-colors hover:bg-black/80 disabled:opacity-60 disabled:cursor-not-allowed"
                    :disabled="isImporting"
                    title="添加到画布"
                    :aria-label="`添加到画布：${asset.name}`"
                    @click.stop="addAssetToCanvas(asset)"
                    @keydown.enter.stop
                    @keydown.space.stop
                  >
                    <div
                      v-if="addingToCanvasIds.includes(asset.externalId)"
                      i-carbon-circle-dash
                      class="text-xs animate-spin"
                    />
                    <div v-else i-carbon-add class="text-xs" />
                  </button>
                </div>
              </div>
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
      </template>
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

.library-card--row:hover {
  transform: translateY(-1px);
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

.category-row-scroller {
  scrollbar-width: none;
  -ms-overflow-style: none;
}

.category-row-scroller::-webkit-scrollbar {
  display: none;
  width: 0;
  height: 0;
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
