<script setup lang="ts">
import { useClipboard, useDraggable, useStorage, useWindowSize } from '@vueuse/core'
import { storeToRefs } from 'pinia'
import { clampDebugPanelPosition } from '@/components/debugPanelPosition'
import { captureEditorContentSnapshot } from '@/history/editorContentSnapshot'
import { capturePersistedProjectState } from '@/persistence/projectSessionSerializer'
import { comparePersistedProjectStateSync, stringifyPersistedProjectStateForDebug } from '@/components/debugProjectState'
import { useEditorStore } from '@/store/useEditorStore'
import { useFilterStore } from '@/store/useFilterStore'
import { useMediaStore } from '@/store/useMediaStore'
import { usePerformerStore } from '@/store/usePerformerStore'
import { useProjectStore } from '@/store/useProjectStore'
import { useTransitionStore } from '@/store/useTransitionStore'

const editorStore = useEditorStore()
const performerStore = usePerformerStore()
const projectStore = useProjectStore()
const filterStore = useFilterStore()
const transitionStore = useTransitionStore()
const mediaStore = useMediaStore()

const panelEl = ref<HTMLElement | null>(null)
const handleEl = ref<HTMLElement | null>(null)
const viewportEl = computed(() => {
  return typeof document === 'undefined' ? null : document.documentElement
})
const { width: viewportWidth, height: viewportHeight } = useWindowSize()
const { copy: copyToClipboard } = useClipboard({ legacy: true })

const savedPosition = useStorage('debugPanelPosition', {
  x: window.innerWidth - 340,
  y: window.innerHeight - 200,
})

const collapsed = useStorage('debugPanelCollapsed', false)

let dragged = false
function onHandlePointerUp() {
  if (!collapsed.value && !dragged)
    return
  if (!dragged) {
    collapsed.value = false
  }
  dragged = false
}

const { style, position } = useDraggable(panelEl, {
  initialValue: savedPosition.value,
  containerElement: viewportEl,
  handle: handleEl,
  onMove: () => {
    dragged = true
  },
  onEnd: (position) => {
    savedPosition.value = { x: position.x, y: position.y }
  },
})
const { selectedPerformers, selectionRevision } = storeToRefs(performerStore)
const { currentTime, duration: totalDuration } = storeToRefs(editorStore)
const { activeProjectId } = storeToRefs(projectStore)

const tick = ref(0)
let timer: ReturnType<typeof setInterval> | null = null

onMounted(() => {
  timer = setInterval(() => tick.value++, 200)
  void nextTick(() => {
    clampPanelPosition()
  })
})

onUnmounted(() => {
  if (timer)
    clearInterval(timer)
})

watch([viewportWidth, viewportHeight], () => {
  void nextTick(() => {
    clampPanelPosition()
  })
})

watch(collapsed, () => {
  void nextTick(() => {
    clampPanelPosition()
  })
})

interface TrainSnapshot {
  id: string
  start: number
  duration: number
  railIndex: number
}

function findTrainById(id: string): TrainSnapshot | null {
  const rails = editorStore.clippa.timeline.rails?.rails ?? []
  for (let ri = 0; ri < rails.length; ri++) {
    const rail = rails[ri]
    const train = rail.trains.find((t: any) => t.id === id)
    if (train) {
      return { id: train.id, start: train.start, duration: train.duration, railIndex: ri }
    }
  }
  return null
}

const selectedDetails = computed(() => {
  // force re-compute on tick / selection change
  void tick.value
  void selectionRevision.value

  return selectedPerformers.value.map((sel) => {
    const performer = performerStore.getPerformerById(sel.id)
    const train = findTrainById(sel.id)

    const pStart = performer?.start ?? null
    const pDuration = performer?.duration ?? null
    const tStart = train?.start ?? null
    const tDuration = train?.duration ?? null

    const startSynced = pStart !== null && tStart !== null && Math.abs(pStart - tStart) < 0.01
    const durationSynced = pDuration !== null && tDuration !== null && Math.abs(pDuration - tDuration) < 0.01

    return {
      id: sel.id,
      performerExists: !!performer,
      trainExists: !!train,
      railIndex: train?.railIndex ?? -1,
      performer: { start: pStart, duration: pDuration },
      train: { start: tStart, duration: tDuration },
      startSynced,
      durationSynced,
    }
  })
})

const allPerformerIds = computed(() => {
  void tick.value
  return performerStore.getAllPerformers().map(p => p.id)
})

const allTrainIds = computed(() => {
  void tick.value
  const rails = editorStore.clippa.timeline.rails?.rails ?? []
  return rails.flatMap((rail: any, ri: number) =>
    rail.trains.map((t: any) => ({ id: t.id, rail: ri })),
  )
})

function fmtMs(ms: number | null): string {
  if (ms === null)
    return 'N/A'
  return `${Math.round(ms)}ms`
}

function formatTimestamp(timestamp: number | null): string {
  if (timestamp === null)
    return 'N/A'

  return new Date(timestamp).toLocaleString()
}

function clampPanelPosition(): void {
  const panel = panelEl.value
  if (!panel)
    return

  const nextPosition = clampDebugPanelPosition(
    position.value,
    {
      width: viewportWidth.value,
      height: viewportHeight.value,
    },
    {
      width: panel.offsetWidth,
      height: panel.offsetHeight,
    },
  )

  position.value = nextPosition
  savedPosition.value = nextPosition
}

interface IndexedDbSyncState {
  status: 'idle' | 'checking' | 'synced' | 'out-of-sync' | 'missing' | 'error'
  message: string
  mismatchSections: string[]
  persistedSavedAt: number | null
  comparedAt: number | null
  currentPayload: string
  persistedPayload: string
}

function createIndexedDbSyncState(overrides: Partial<IndexedDbSyncState> = {}): IndexedDbSyncState {
  return {
    status: 'idle',
    message: 'Not checked',
    mismatchSections: [],
    persistedSavedAt: null,
    comparedAt: null,
    currentPayload: '',
    persistedPayload: '',
    ...overrides,
  }
}

function buildCurrentPersistedState() {
  const snapshot = captureEditorContentSnapshot({
    editorStore,
    performerStore,
    filterStore,
    transitionStore,
  })

  return capturePersistedProjectState({
    projectId: activeProjectId.value ?? 'debug-export',
    canvasPresetId: editorStore.canvasPresetId,
    snapshot,
    videoAssets: mediaStore.videoFiles,
    audioAssets: mediaStore.audioFiles,
    imageAssets: mediaStore.imageFiles,
  })
}

function parseDebugPayload(payload: string): unknown {
  if (!payload)
    return null

  try {
    return JSON.parse(payload)
  }
  catch {
    return payload
  }
}

function buildDebugExportPayload(syncState: IndexedDbSyncState): string {
  const currentPersistedState = buildCurrentPersistedState()

  return JSON.stringify({
    generatedAt: new Date().toISOString(),
    activeProjectId: activeProjectId.value,
    canvasPresetId: editorStore.canvasPresetId,
    timeline: {
      currentTimeMs: currentTime.value,
      totalDurationMs: totalDuration.value,
    },
    idMaps: {
      performerIds: allPerformerIds.value,
      trainIds: allTrainIds.value,
    },
    selectedDetails: selectedDetails.value,
    indexedDbSync: {
      ...syncState,
      currentPayload: parseDebugPayload(syncState.currentPayload),
      persistedPayload: parseDebugPayload(syncState.persistedPayload),
    },
    currentComparableState: parseDebugPayload(
      stringifyPersistedProjectStateForDebug(currentPersistedState),
    ),
  }, null, 2)
}

const indexedDbSyncState = ref<IndexedDbSyncState>(createIndexedDbSyncState())

const copyState = ref({
  status: 'idle' as 'idle' | 'copying' | 'copied' | 'error',
  message: '',
})

const copyStateClass = computed(() => {
  switch (copyState.value.status) {
    case 'copied':
      return 'text-success'
    case 'copying':
      return 'text-warning'
    case 'error':
      return 'text-destructive'
    default:
      return 'text-muted'
  }
})
const indexedDbSyncStatusClass = computed(() => {
  switch (indexedDbSyncState.value.status) {
    case 'synced':
      return 'text-success'
    case 'checking':
      return 'text-warning'
    case 'missing':
      return 'text-warning'
    case 'out-of-sync':
    case 'error':
      return 'text-destructive'
    default:
      return 'text-muted'
  }
})

async function resolveIndexedDbSyncState(): Promise<IndexedDbSyncState> {
  const projectId = activeProjectId.value
  if (!projectId) {
    const nextState = createIndexedDbSyncState({
      status: 'missing',
      message: 'No active project',
      comparedAt: Date.now(),
    })
    indexedDbSyncState.value = nextState
    return nextState
  }

  indexedDbSyncState.value = createIndexedDbSyncState({
    ...indexedDbSyncState.value,
    status: 'checking',
    message: 'Comparing current state with IndexedDB...',
  })

  try {
    const persistedState = await projectStore.loadActiveProjectState()
    if (!persistedState) {
      const nextState = createIndexedDbSyncState({
        status: 'missing',
        message: 'IndexedDB has no saved state for the active project',
        comparedAt: Date.now(),
      })
      indexedDbSyncState.value = nextState
      return nextState
    }

    const currentState = buildCurrentPersistedState()
    const result = comparePersistedProjectStateSync(currentState, persistedState)
    const mismatchSections = result.sections
      .filter(section => !section.synced)
      .map(section => section.key)

    const nextState = createIndexedDbSyncState({
      status: result.synced ? 'synced' : 'out-of-sync',
      message: result.synced ? 'Current state matches IndexedDB' : 'Current state differs from IndexedDB',
      mismatchSections,
      persistedSavedAt: result.persistedSavedAt,
      comparedAt: Date.now(),
      currentPayload: result.currentPayload,
      persistedPayload: result.persistedPayload,
    })
    indexedDbSyncState.value = nextState
    return nextState
  }
  catch (error) {
    const nextState = createIndexedDbSyncState({
      status: 'error',
      message: error instanceof Error ? error.message : 'Failed to compare project state',
      comparedAt: Date.now(),
    })
    indexedDbSyncState.value = nextState
    return nextState
  }
}

async function checkIndexedDbSync(): Promise<void> {
  await resolveIndexedDbSyncState()
}

async function copyDebugData(): Promise<void> {
  copyState.value = {
    status: 'copying',
    message: 'Preparing debug bundle...',
  }

  try {
    const syncState = await resolveIndexedDbSyncState()
    const payload = buildDebugExportPayload(syncState)
    await copyToClipboard(payload)
    copyState.value = {
      status: 'copied',
      message: 'Debug bundle copied',
    }
  }
  catch (error) {
    copyState.value = {
      status: 'error',
      message: error instanceof Error ? error.message : 'Failed to copy debug bundle',
    }
  }
}
</script>

<template>
  <div
    ref="panelEl"
    :style="style"
    fixed z-9999
    bg="black/85" text-white shadow-xl
    backdrop-blur-sm
    pointer-events-auto
    :class="collapsed
      ? 'w-10 h-10 rounded-full flex items-center justify-center'
      : 'w-80 rounded-lg font-mono text-11px leading-relaxed max-h-[50vh] overflow-y-auto'"
  >
    <!-- handle: collapsed = circle, expanded = title bar -->
    <div
      ref="handleEl"
      cursor-move select-none
      :class="collapsed
        ? 'w-full h-full flex items-center justify-center'
        : 'px-3 py-2 border-b border-white/10 flex items-center gap-2'"
      @pointerup="onHandlePointerUp"
    >
      <div w-2 h-2 rounded-full bg-green-400 animate-pulse />
      <template v-if="!collapsed">
        <span text-xs font-semibold tracking-wide op-80 flex-1>DEBUG</span>
        <button
          text-xs op-50 hover:op-100 transition-opacity
          @click.stop="collapsed = true"
        >
          −
        </button>
      </template>
    </div>

    <template v-if="!collapsed">
      <div px-3 py-2 space-y-1 border-b border="white/10">
        <div flex justify-between>
          <span op-50>currentTime</span>
          <span>{{ fmtMs(currentTime) }}</span>
        </div>
        <div flex justify-between>
          <span op-50>totalDuration</span>
          <span>{{ fmtMs(totalDuration) }}</span>
        </div>
        <div flex items-center justify-between gap-2 pt-1>
          <span op-50>analysis bundle</span>
          <button
            class="btn-base focus-ring rounded-sm bg-primary px-2 py-1 text-10px text-primary-foreground hover:bg-primary-hover"
            @click="copyDebugData"
          >
            Copy debug data
          </button>
        </div>
        <div v-if="copyState.message" text-10px :class="copyStateClass">
          {{ copyState.message }}
        </div>
      </div>

      <div px-3 py-2 space-y-2 border-b border="white/10">
        <div flex items-center justify-between gap-2>
          <span op-50>IndexedDB sync</span>
          <button
            class="btn-base focus-ring rounded-sm bg-secondary px-2 py-1 text-10px text-secondary-foreground hover:bg-secondary-hover disabled:cursor-not-allowed disabled:op-40"
            :disabled="indexedDbSyncState.status === 'checking'"
            @click="checkIndexedDbSync"
          >
            {{ indexedDbSyncState.status === 'checking' ? 'Checking...' : 'Check sync' }}
          </button>
        </div>
        <div flex justify-between gap-2>
          <span op-50>activeProjectId</span>
          <span text-right break-all>{{ activeProjectId ?? 'N/A' }}</span>
        </div>
        <div flex justify-between gap-2>
          <span op-50>status</span>
          <span :class="indexedDbSyncStatusClass">{{ indexedDbSyncState.message }}</span>
        </div>
        <div flex justify-between gap-2>
          <span op-50>savedAt</span>
          <span text-right>{{ formatTimestamp(indexedDbSyncState.persistedSavedAt) }}</span>
        </div>
        <div flex justify-between gap-2>
          <span op-50>comparedAt</span>
          <span text-right>{{ formatTimestamp(indexedDbSyncState.comparedAt) }}</span>
        </div>
        <div v-if="indexedDbSyncState.mismatchSections.length > 0" space-y-1>
          <div op-50 text-10px>
            mismatch sections
          </div>
          <div flex flex-wrap gap-1>
            <span
              v-for="section in indexedDbSyncState.mismatchSections"
              :key="section"
              rounded bg="destructive/12" px-1.5 py-0.5 text-10px text-destructive
            >
              {{ section }}
            </span>
          </div>
        </div>
        <details v-if="indexedDbSyncState.currentPayload && indexedDbSyncState.persistedPayload">
          <summary cursor-pointer op-60 text-10px>
            comparable payload
          </summary>
          <div mt-2 space-y-2>
            <div>
              <div mb-1 op-50 text-10px>
                current
              </div>
              <pre max-h-40 overflow-auto whitespace-pre-wrap break-all rounded border border-border-subtle bg="background-overlay/60" p-2 text-foreground-muted>{{ indexedDbSyncState.currentPayload }}</pre>
            </div>
            <div>
              <div mb-1 op-50 text-10px>
                indexedDB
              </div>
              <pre max-h-40 overflow-auto whitespace-pre-wrap break-all rounded border border-border-subtle bg="background-overlay/60" p-2 text-foreground-muted>{{ indexedDbSyncState.persistedPayload }}</pre>
            </div>
          </div>
        </details>
      </div>

      <!-- ID mapping overview -->
      <div px-3 py-2 space-y-1 border-b border="white/10">
        <div op-50 text-10px mb-1>
          performerMap IDs
        </div>
        <div v-for="pid in allPerformerIds" :key="pid" flex items-center gap-1>
          <span text-green-300>{{ pid }}</span>
          <span v-if="!allTrainIds.find((t: any) => t.id === pid)" text-red-400 text-10px>(no train match)</span>
        </div>
        <div v-if="allPerformerIds.length === 0" op-30>
          empty
        </div>
      </div>

      <div px-3 py-2 space-y-1 border-b border="white/10">
        <div op-50 text-10px mb-1>
          train IDs
        </div>
        <div v-for="t in allTrainIds" :key="t.id" flex items-center gap-1>
          <span text-blue-300>{{ t.id }}</span>
          <span op-30 text-10px>rail[{{ t.rail }}]</span>
          <span v-if="!allPerformerIds.includes(t.id)" text-red-400 text-10px>(no performer match)</span>
        </div>
        <div v-if="allTrainIds.length === 0" op-30>
          empty
        </div>
      </div>

      <div v-if="selectedDetails.length === 0" px-3 py-3 text-center op-40>
        No selection
      </div>

      <div v-for="item in selectedDetails" :key="item.id" px-3 py-2 space-y-1>
        <div flex items-center gap-1.5 mb-1>
          <span font-semibold text-blue-300>{{ item.id }}</span>
          <span v-if="item.railIndex >= 0" text-10px op-40>rail[{{ item.railIndex }}]</span>
        </div>

        <!-- performer existence -->
        <div flex justify-between>
          <span op-50>performer</span>
          <span :class="item.performerExists ? 'text-green-400' : 'text-red-400'">
            {{ item.performerExists ? 'found' : 'MISSING' }}
          </span>
        </div>

        <!-- train existence -->
        <div flex justify-between>
          <span op-50>train</span>
          <span :class="item.trainExists ? 'text-green-400' : 'text-red-400'">
            {{ item.trainExists ? 'found' : 'MISSING' }}
          </span>
        </div>

        <!-- start comparison -->
        <div v-if="item.performerExists || item.trainExists" mt-1>
          <div flex justify-between>
            <span op-50>performer.start</span>
            <span>{{ fmtMs(item.performer.start) }}</span>
          </div>
          <div flex justify-between>
            <span op-50>train.start</span>
            <span>{{ fmtMs(item.train.start) }}</span>
          </div>
          <div flex justify-between>
            <span op-50>start synced?</span>
            <span :class="item.startSynced ? 'text-green-400' : 'text-red-400 font-bold'">
              {{ item.startSynced ? 'YES' : 'NO !!!' }}
            </span>
          </div>
        </div>

        <!-- duration comparison -->
        <div v-if="item.performerExists || item.trainExists" mt-1>
          <div flex justify-between>
            <span op-50>performer.duration</span>
            <span>{{ fmtMs(item.performer.duration) }}</span>
          </div>
          <div flex justify-between>
            <span op-50>train.duration</span>
            <span>{{ fmtMs(item.train.duration) }}</span>
          </div>
          <div flex justify-between>
            <span op-50>duration synced?</span>
            <span :class="item.durationSynced ? 'text-green-400' : 'text-red-400 font-bold'">
              {{ item.durationSynced ? 'YES' : 'NO !!!' }}
            </span>
          </div>
        </div>

        <!-- in show time check -->
        <div v-if="item.performer.start !== null && item.performer.duration !== null" mt-1>
          <div flex justify-between>
            <span op-50>performer visible?</span>
            <span :class="currentTime >= item.performer.start && currentTime < item.performer.start + item.performer.duration ? 'text-green-400' : 'text-yellow-400'">
              {{ currentTime >= item.performer.start && currentTime < item.performer.start + item.performer.duration ? 'IN range' : 'OUT of range' }}
            </span>
          </div>
        </div>
        <div v-if="item.train.start !== null && item.train.duration !== null">
          <div flex justify-between>
            <span op-50>train visible?</span>
            <span :class="currentTime >= item.train.start && currentTime < item.train.start + item.train.duration ? 'text-green-400' : 'text-yellow-400'">
              {{ currentTime >= item.train.start && currentTime < item.train.start + item.train.duration ? 'IN range' : 'OUT of range' }}
            </span>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>
