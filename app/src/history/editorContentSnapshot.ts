import type { FilterConfig } from '@/store/useFilterStore'
import type { CanvasPerformer, PerformerConfig } from '@/store/usePerformerStore'
import type { CropInsets, PerformerAnimationSpec, TextStyleOption } from '@clippc/performer'
import { Image, Text, Video } from '@clippc/performer'
import { buildTransitionPairKey } from '@clippc/transition'
import { cloneFilterConfig } from '@/store/useFilterStore'
import { useEditorStore } from '@/store/useEditorStore'
import { useFilterStore } from '@/store/useFilterStore'
import { usePerformerStore } from '@/store/usePerformerStore'
import { useTransitionStore } from '@/store/useTransitionStore'

export interface PerformerContentSnapshot {
  id: string
  kind: 'video' | 'image' | 'text'
  startMs: number
  durationMs: number
  zIndex: number
  x: number
  y: number
  width: number
  height: number
  rotation: number
  alpha: number
  src?: string
  sourceStartMs?: number
  sourceDurationMs?: number
  crop?: CropInsets | null
  text?: string
  style?: TextStyleOption
  animation?: PerformerAnimationSpec | null
}

export interface FilterLayerContentSnapshot {
  id: string
  name: string
  startMs: number
  durationMs: number
  zIndex: number
  config: FilterConfig
}

export interface TransitionContentSnapshot {
  id: string
  fromId: string
  toId: string
  durationMs: number
  type: string
  params: Record<string, unknown>
}

export interface EditorContentSnapshot {
  performers: PerformerContentSnapshot[]
  selectedPerformerIds: string[]
  activeTrainId: string | null
  currentTimeMs: number
  filters: FilterLayerContentSnapshot[]
  activeFilterLayerId: string | null
  transitions: TransitionContentSnapshot[]
  activeTransitionId: string | null
  activeTransitionPairKey: string | null
}

export interface EditorContentSnapshotDependencies {
  editorStore: ReturnType<typeof useEditorStore>
  performerStore: ReturnType<typeof usePerformerStore>
  filterStore: ReturnType<typeof useFilterStore>
  transitionStore: ReturnType<typeof useTransitionStore>
}

function cloneRecord<T extends Record<string, unknown>>(value: T): T {
  return {
    ...value,
  }
}

function resolvePerformerSnapshotKind(performer: CanvasPerformer): PerformerContentSnapshot['kind'] {
  if (performer instanceof Video)
    return 'video'
  if (performer instanceof Text)
    return 'text'
  return 'image'
}

function resolvePerformerCrop(performer: CanvasPerformer): CropInsets | null {
  if (!('getCropInsets' in performer) || typeof performer.getCropInsets !== 'function')
    return null

  const crop = performer.getCropInsets() as CropInsets | null
  if (!crop)
    return null

  return {
    left: crop.left,
    top: crop.top,
    right: crop.right,
    bottom: crop.bottom,
  }
}

function mapPerformerSnapshot(performer: CanvasPerformer, animation: PerformerAnimationSpec | null): PerformerContentSnapshot {
  const bounds = performer.getBaseBounds()
  const kind = resolvePerformerSnapshotKind(performer)

  const snapshot: PerformerContentSnapshot = {
    id: performer.id,
    kind,
    startMs: performer.start,
    durationMs: performer.duration,
    zIndex: performer.zIndex,
    x: bounds.x,
    y: bounds.y,
    width: bounds.width,
    height: bounds.height,
    rotation: bounds.rotation ?? 0,
    alpha: performer.sprite?.alpha ?? 1,
    animation,
  }

  if (kind === 'video') {
    const video = performer as Video
    snapshot.src = video.src
    snapshot.sourceStartMs = video.sourceStart
    snapshot.sourceDurationMs = video.sourceDuration
    snapshot.crop = resolvePerformerCrop(performer)
  }
  else if (kind === 'image') {
    const image = performer as Image
    snapshot.src = image.src
    snapshot.crop = resolvePerformerCrop(performer)
  }
  else {
    const text = performer as Text
    snapshot.text = text.getText()
    snapshot.style = text.getStyle()
  }

  return snapshot
}

function findTrainById(editorStore: ReturnType<typeof useEditorStore>, targetId: string): { updateActive: (value: boolean) => void } | null {
  const rails = editorStore.clippa.timeline.rails?.rails ?? []
  for (const rail of rails) {
    const train = rail.trains.find(item => item.id === targetId)
    if (train)
      return train
  }

  return null
}

function buildPerformerConfig(snapshot: PerformerContentSnapshot): PerformerConfig | null {
  const shared = {
    id: snapshot.id,
    start: snapshot.startMs,
    duration: snapshot.durationMs,
    x: snapshot.x,
    y: snapshot.y,
    width: snapshot.width,
    height: snapshot.height,
    zIndex: snapshot.zIndex,
    rotation: snapshot.rotation,
  }

  if (snapshot.kind === 'video') {
    if (!snapshot.src)
      return null

    return {
      ...shared,
      type: 'video',
      src: snapshot.src,
      sourceStart: snapshot.sourceStartMs,
      sourceDuration: snapshot.sourceDurationMs,
      crop: snapshot.crop ?? undefined,
    }
  }

  if (snapshot.kind === 'image') {
    if (!snapshot.src)
      return null

    return {
      ...shared,
      type: 'image',
      src: snapshot.src,
      crop: snapshot.crop ?? undefined,
    }
  }

  return {
    ...shared,
    type: 'text',
    content: snapshot.text ?? '',
    style: snapshot.style,
  }
}

export function captureEditorContentSnapshot(
  dependencies: EditorContentSnapshotDependencies,
): EditorContentSnapshot {
  const {
    editorStore,
    performerStore,
    filterStore,
    transitionStore,
  } = dependencies

  const performers = performerStore
    .getAllPerformers()
    .map((performer) => {
      return mapPerformerSnapshot(performer, performerStore.getAnimation(performer.id))
    })
    .sort((left, right) => {
      if (left.zIndex !== right.zIndex)
        return left.zIndex - right.zIndex
      return left.id.localeCompare(right.id)
    })

  const filters = filterStore.layers
    .map(layer => ({
      id: layer.id,
      name: layer.name,
      startMs: layer.start,
      durationMs: layer.duration,
      zIndex: layer.zIndex,
      config: cloneFilterConfig(layer.config),
    }))
    .sort((left, right) => {
      if (left.zIndex !== right.zIndex)
        return left.zIndex - right.zIndex
      if (left.startMs !== right.startMs)
        return left.startMs - right.startMs
      return left.id.localeCompare(right.id)
    })

  const transitions = transitionStore.transitions
    .map(transition => ({
      id: transition.id,
      fromId: transition.fromId,
      toId: transition.toId,
      durationMs: transition.durationMs,
      type: transition.type,
      params: cloneRecord(transition.params),
    }))
    .sort((left, right) => left.id.localeCompare(right.id))

  return {
    performers,
    selectedPerformerIds: performerStore.selectedPerformers.map(item => item.id),
    activeTrainId: editorStore.clippa.timeline.state.activeTrain?.id ?? null,
    currentTimeMs: editorStore.currentTime,
    filters,
    activeFilterLayerId: filterStore.activeLayerId,
    transitions,
    activeTransitionId: transitionStore.activeTransitionId,
    activeTransitionPairKey: transitionStore.activePairKey,
  }
}

export async function applyEditorContentSnapshot(
  snapshot: EditorContentSnapshot,
  dependencies: EditorContentSnapshotDependencies,
): Promise<void> {
  const {
    editorStore,
    performerStore,
    filterStore,
    transitionStore,
  } = dependencies

  await editorStore.clippa.ready

  transitionStore.clearActiveSelection?.()
  ;[...transitionStore.transitions].forEach(transition => transitionStore.removeTransition?.(transition.id))

  ;[...filterStore.layers].forEach(layer => filterStore.removeLayer?.(layer.id))

  performerStore.clearSelection?.()
  performerStore.clearPendingSelectionDrag?.()
  if (typeof performerStore.clearAllPerformers === 'function') {
    performerStore.clearAllPerformers()
  }
  else if (typeof performerStore.removePerformer === 'function') {
    performerStore.getAllPerformers().forEach((performer) => {
      performerStore.removePerformer(performer.id)
    })
  }

  for (const performerSnapshot of snapshot.performers) {
    const performerConfig = buildPerformerConfig(performerSnapshot)
    if (!performerConfig)
      continue

    const performer = performerStore.addPerformer(performerConfig)
    await editorStore.clippa.hire(performer)
    if (!editorStore.clippa.stage.performers.has(performer))
      editorStore.clippa.show(performer)

    if (Math.abs(performerSnapshot.alpha - 1) > 1e-6)
      performer.setAlpha(performerSnapshot.alpha)

    if (Math.abs(performerSnapshot.rotation) > 1e-6)
      performer.setRotation(performerSnapshot.rotation)

    if (performerSnapshot.animation)
      performerStore.setAnimation?.(performer.id, performerSnapshot.animation)

    if (
      performerSnapshot.crop
      && 'setCropInsets' in performer
      && typeof performer.setCropInsets === 'function'
    ) {
      performer.setCropInsets(performerSnapshot.crop)
    }
  }

  filterStore.bindTimeline?.(editorStore.clippa.timeline)
  const filterIdMap = new Map<string, string>()
  for (const filterSnapshot of snapshot.filters) {
    const layer = filterStore.createLayer({
      name: filterSnapshot.name,
      start: filterSnapshot.startMs,
      duration: filterSnapshot.durationMs,
      zIndex: filterSnapshot.zIndex,
      config: cloneFilterConfig(filterSnapshot.config),
    })

    if (layer)
      filterIdMap.set(filterSnapshot.id, layer.id)
  }

  if (snapshot.activeFilterLayerId) {
    const restoredActiveLayerId = filterIdMap.get(snapshot.activeFilterLayerId)
    filterStore.selectLayer?.(restoredActiveLayerId ?? null)
  }
  else {
    filterStore.selectLayer?.(null)
  }

  const transitionIdMap = new Map<string, string>()
  for (const transitionSnapshot of snapshot.transitions) {
    const created = transitionStore.createTransition({
      fromId: transitionSnapshot.fromId,
      toId: transitionSnapshot.toId,
      durationMs: transitionSnapshot.durationMs,
      type: transitionSnapshot.type,
      params: cloneRecord(transitionSnapshot.params),
    })
    transitionIdMap.set(transitionSnapshot.id, created.id)
  }

  if (snapshot.activeTransitionPairKey) {
    const activePair = snapshot.transitions.find((transition) => {
      return buildTransitionPairKey(transition.fromId, transition.toId) === snapshot.activeTransitionPairKey
    })
    if (activePair)
      transitionStore.selectPair?.(activePair.fromId, activePair.toId)
    else
      transitionStore.clearActiveSelection?.()
  }
  else if (snapshot.activeTransitionId) {
    const restoredTransitionId = transitionIdMap.get(snapshot.activeTransitionId)
    transitionStore.selectTransition?.(restoredTransitionId ?? null)
  }
  else {
    transitionStore.clearActiveSelection?.()
  }

  const selectedPerformerId = snapshot.selectedPerformerIds.find((id) => {
    return Boolean(performerStore.getPerformerById(id))
  })

  if (selectedPerformerId)
    performerStore.selectPerformer?.(selectedPerformerId)
  else
    performerStore.clearSelection?.()

  if (snapshot.activeTrainId) {
    const train = findTrainById(editorStore, snapshot.activeTrainId)
    train?.updateActive(true)
  }
  else {
    editorStore.clippa.timeline.state.activeTrain?.updateActive(false)
  }

  const nextTime = Math.max(0, Math.min(editorStore.duration, snapshot.currentTimeMs))
  editorStore.clippa.timeline.updateCurrentTime(nextTime)
  if (!editorStore.isPlaying)
    await editorStore.clippa.director.seek(nextTime)
}
