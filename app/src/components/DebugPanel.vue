<script setup lang="ts">
import { useDraggable, useStorage } from '@vueuse/core'
import { storeToRefs } from 'pinia'
import { useEditorStore } from '@/store/useEditorStore'
import { usePerformerStore } from '@/store/usePerformerStore'

const editorStore = useEditorStore()
const performerStore = usePerformerStore()

const panelEl = ref<HTMLElement | null>(null)
const handleEl = ref<HTMLElement | null>(null)

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

const { style } = useDraggable(panelEl, {
  initialValue: savedPosition.value,
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

const tick = ref(0)
let timer: ReturnType<typeof setInterval> | null = null

onMounted(() => {
  timer = setInterval(() => tick.value++, 200)
})

onUnmounted(() => {
  if (timer)
    clearInterval(timer)
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
