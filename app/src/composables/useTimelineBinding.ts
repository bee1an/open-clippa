import type { Rail, Train } from 'clippc'
import type { CanvasPerformer } from '@/store/usePerformerStore'
import { Audio, AudioTrain, getMsByPx, getPxByMs, VideoTrain } from 'clippc'
import { onMounted, onUnmounted } from 'vue'
import { useEditorCommandActions } from '@/composables/useEditorCommandActions'
import { useEditorStore } from '@/store'
import { useMediaStore } from '@/store/useMediaStore'
import { usePerformerStore } from '@/store/usePerformerStore'

type SourceTimingPerformer = CanvasPerformer & {
  sourceStart: number
  sourceDuration: number
}

function hasSourceTiming(performer: CanvasPerformer): performer is SourceTimingPerformer {
  return typeof (performer as Partial<SourceTimingPerformer>).sourceStart === 'number'
    && typeof (performer as Partial<SourceTimingPerformer>).sourceDuration === 'number'
}

function isPromiseLike<T>(value: T | Promise<T>): value is Promise<T> {
  return typeof (value as Promise<T> | undefined)?.then === 'function'
}

export function useTimelineBinding(): void {
  const editorStore = useEditorStore()
  const mediaStore = useMediaStore()
  const performerStore = usePerformerStore()
  const editorCommandActions = useEditorCommandActions()
  const { clippa } = editorStore
  const MIN_TRAIN_DURATION_MS = 1

  const railDisposers = new Map<Rail, () => void>()
  const trainDisposers = new Map<Train, () => void>()
  const trainGestureTransactions = new Map<Train, string>()
  const trainGestureTransactionStarting = new Set<Train>()
  const TIME_EPSILON_MS = 0.001
  let pendingCanvasTimingSync: number | null = null
  let syncingCanvasTiming = false

  const flushCanvasTimingSync = async (): Promise<void> => {
    if (syncingCanvasTiming)
      return

    syncingCanvasTiming = true

    try {
      while (pendingCanvasTimingSync !== null) {
        const time = pendingCanvasTimingSync
        pendingCanvasTimingSync = null
        await clippa.director.seek(time)
      }
    }
    catch (error) {
      console.warn('[timeline-binding] sync canvas timing failed', error)
    }
    finally {
      syncingCanvasTiming = false
    }
  }

  const queueCanvasTimingSync = (): void => {
    if (editorStore.isPlaying)
      return

    pendingCanvasTimingSync = clippa.timeline.currentTime
    void flushCanvasTimingSync()
  }

  function syncTrainTiming(train: Train): void {
    const performer = performerStore.getPerformerById(train.id)
    if (!performer)
      return

    performer.start = train.start
    performer.duration = train.duration

    const parentZIndex = train.parent?.zIndex
    if (typeof parentZIndex === 'number') {
      const timelinePerformer = performer as CanvasPerformer & { timelineLane?: number }
      timelinePerformer.timelineLane = parentZIndex
    }
  }

  function syncRailTiming(rail: Rail | null): void {
    if (!rail)
      return

    rail.trains.forEach((train) => {
      syncTrainTiming(train)
    })
  }

  function resolveStartByVisualX(train: Train, visualX: number): number {
    if (train.parent)
      return train.parent.getRawMsByVisualPx(train, visualX)

    return getMsByPx(visualX, clippa.timeline.state.pxPerMs)
  }

  function resolveMinTrainWidth(pxPerMs: number): number {
    return getPxByMs(MIN_TRAIN_DURATION_MS, pxPerMs)
  }

  function findTrainById(targetId: string): Train | null {
    const rails = clippa.timeline.rails?.rails ?? []
    for (const rail of rails) {
      const train = rail.trains.find(item => item.id === targetId)
      if (train)
        return train
    }

    return null
  }

  function resolveLinkedContext(train: Train): { train: Train | null, performer: CanvasPerformer } | null {
    const performer = performerStore.getPerformerById(train.id)
    const linkGroupId = (performer as { linkGroupId?: string | null } | undefined)?.linkGroupId
    if (!performer || !linkGroupId)
      return null

    const linkedPerformer = performerStore.getAllPerformers().find((item) => {
      return item.id !== performer.id
        && (item as { linkGroupId?: string | null }).linkGroupId === linkGroupId
    })
    if (!linkedPerformer)
      return null

    const linkedTrain = findTrainById(linkedPerformer.id)
    return {
      train: linkedTrain,
      performer: linkedPerformer,
    }
  }

  function updateTrainVisualStart(train: Train, startMs: number): void {
    const nextX = getPxByMs(startMs, clippa.timeline.state.pxPerMs)
    train.updatePos(nextX)
    train.x = nextX
    train.start = startMs
  }

  function updateTrainVisualDuration(train: Train, durationMs: number): void {
    const normalizedDuration = Math.max(MIN_TRAIN_DURATION_MS, durationMs)
    const nextWidth = getPxByMs(normalizedDuration, clippa.timeline.state.pxPerMs)
    train.updateWidth(nextWidth)
    train.width = nextWidth
    train.duration = normalizedDuration
  }

  function syncMediaTrainState(train: Train, performer: CanvasPerformer): void {
    if (!hasSourceTiming(performer))
      return

    if (train instanceof VideoTrain)
      train.updateSourceStart(performer.sourceStart)

    if (train instanceof AudioTrain) {
      train.updateAudioWindow(
        performer.sourceStart,
        performer.duration,
        performer.sourceDuration,
      )
      const audioPerformer = performer as Audio
      train.updateWaveform([...audioPerformer.waveformPeaks])
      train.updateAudioState({
        muted: audioPerformer.muted,
        volume: audioPerformer.volume,
      })
    }
  }

  function refreshVideoTrainThumbnails(train: Train): void {
    if (!(train instanceof VideoTrain))
      return

    train.refreshThumbnails().catch((error) => {
      console.warn('[timeline-binding] refresh video train thumbnails failed', error)
    })
  }

  function syncLinkedMove(train: Train, nextStart: number): void {
    const linked = resolveLinkedContext(train)
    if (!linked)
      return

    linked.performer.start = nextStart
    if (linked.train)
      updateTrainVisualStart(linked.train, nextStart)
  }

  function syncLinkedLeftResize(train: Train, deltaStart: number): void {
    const linked = resolveLinkedContext(train)
    if (!linked)
      return

    const nextStart = linked.performer.start + deltaStart
    linked.performer.start = nextStart
    linked.performer.duration = Math.max(MIN_TRAIN_DURATION_MS, linked.performer.duration - deltaStart)

    if (hasSourceTiming(linked.performer)) {
      linked.performer.sourceStart = Math.max(
        0,
        Math.min(
          linked.performer.sourceDuration,
          linked.performer.sourceStart + deltaStart,
        ),
      )
    }

    if (linked.train) {
      updateTrainVisualStart(linked.train, nextStart)
      updateTrainVisualDuration(linked.train, linked.performer.duration)
      syncMediaTrainState(linked.train, linked.performer)
    }
  }

  function syncLinkedRightResize(train: Train, nextDuration: number): void {
    const linked = resolveLinkedContext(train)
    if (!linked)
      return

    linked.performer.duration = Math.max(MIN_TRAIN_DURATION_MS, nextDuration)
    if (linked.train) {
      updateTrainVisualDuration(linked.train, linked.performer.duration)
      syncMediaTrainState(linked.train, linked.performer)
    }
  }

  function markTimelineMutationComplete(rails: Array<Rail | null | undefined>): void {
    rails.forEach((rail) => {
      if (rail)
        syncRailTiming(rail)
    })
    performerStore.markContentDirty()
    queueCanvasTimingSync()
  }

  function beginTrainGestureTransaction(train: Train, label: string): void {
    if (trainGestureTransactions.has(train) || trainGestureTransactionStarting.has(train))
      return

    trainGestureTransactionStarting.add(train)
    const transaction = editorCommandActions.historyBeginTransaction({
      source: 'ui',
      label,
      mergeKey: `timeline:${train.id}:${label}`,
    })

    const applyBeginResult = (beginResult: { ok: true, data: { transactionId: string } } | { ok: false }) => {
      if (!beginResult.ok)
        return

      trainGestureTransactions.set(train, beginResult.data.transactionId)
      void editorCommandActions.historyCheckpoint({
        source: 'ui',
        label: `${label} Start`,
      })
    }

    if (isPromiseLike(transaction)) {
      void transaction
        .then(applyBeginResult)
        .finally(() => {
          trainGestureTransactionStarting.delete(train)
        })
      return
    }

    trainGestureTransactionStarting.delete(train)
    applyBeginResult(transaction)
  }

  async function endTrainGestureTransaction(train: Train, label: string): Promise<void> {
    const transactionId = trainGestureTransactions.get(train)
    if (!transactionId)
      return

    await editorCommandActions.historyCheckpoint({
      source: 'ui',
      label: `${label} End`,
    })

    await editorCommandActions.historyEndTransaction(transactionId)
    trainGestureTransactions.delete(train)
  }

  async function cancelTrainGestureTransaction(train: Train): Promise<void> {
    trainGestureTransactionStarting.delete(train)

    const transactionId = trainGestureTransactions.get(train)
    if (!transactionId)
      return

    await editorCommandActions.historyCancelTransaction(transactionId)
    trainGestureTransactions.delete(train)
  }

  function bindTrain(train: Train): void {
    if (trainDisposers.has(train))
      return

    const performer = performerStore.getPerformerById(train.id)
    if (!performer)
      return

    const syncCurrentTrainMediaState = (): void => {
      const nextPerformer = performerStore.getPerformerById(train.id)
      if (!nextPerformer)
        return

      syncMediaTrainState(train, nextPerformer)
    }

    syncCurrentTrainMediaState()

    const handleMoveStart = (): void => {
      beginTrainGestureTransaction(train, 'Move Timeline Item')
    }

    const handleBeforeMove = (site: { xValue: number }): void => {
      const nextStart = resolveStartByVisualX(train, site.xValue)
      syncLinkedMove(train, nextStart)
    }

    const handleMoveEnd = (target: Train): void => {
      syncTrainTiming(target)
      const linked = resolveLinkedContext(target)
      markTimelineMutationComplete([target.parent, linked?.train?.parent])
      void endTrainGestureTransaction(train, 'Move Timeline Item')
    }

    const handleBeforeLeftResize = (site: { xValue: number, wValue: number, disdrawable: boolean }): void => {
      beginTrainGestureTransaction(train, 'Resize Timeline Item')

      const performer = performerStore.getPerformerById(train.id)
      if (!performer)
        return

      const pxPerMs = clippa.timeline.state.pxPerMs
      const oldStart = performer.start
      const oldDuration = performer.duration

      let nextStart = resolveStartByVisualX(train, site.xValue)
      let nextDuration = getMsByPx(site.wValue, pxPerMs)
      let sourceDelta = nextStart - oldStart

      const linked = resolveLinkedContext(train)
      const sourceTimingPerformers = [performer, linked?.performer].filter((item): item is SourceTimingPerformer => {
        return !!item && hasSourceTiming(item)
      })
      const minDelta = sourceTimingPerformers.reduce((result, item) => {
        return Math.max(result, -item.sourceStart)
      }, Number.NEGATIVE_INFINITY)
      if (Number.isFinite(minDelta) && sourceDelta < minDelta) {
        const blockedDelta = minDelta - sourceDelta
        const blockedPx = getPxByMs(blockedDelta, pxPerMs)

        site.xValue += blockedPx
        site.wValue -= blockedPx

        nextStart = oldStart + minDelta
        nextDuration = oldDuration - minDelta
        sourceDelta = minDelta
      }

      // 按最小时长约束最小宽度
      const minW = resolveMinTrainWidth(pxPerMs)
      if (site.wValue < minW) {
        const overflow = minW - site.wValue
        site.xValue -= overflow
        site.wValue = minW
        // rail 可能已将 disdrawable 置为 true，这里强制走 train 自身重绘
        site.disdrawable = false
        nextStart = resolveStartByVisualX(train, site.xValue)
        nextDuration = getMsByPx(site.wValue, pxPerMs)
        sourceDelta = nextStart - oldStart
      }

      if (hasSourceTiming(performer)) {
        const maxSourceStart = Math.max(0, performer.sourceDuration)
        const clampedSourceStart = performer.sourceStart + sourceDelta
        performer.sourceStart = Math.min(
          maxSourceStart,
          Math.max(0, clampedSourceStart),
        )
      }

      performer.start = nextStart
      performer.duration = Math.max(MIN_TRAIN_DURATION_MS, nextDuration)
      syncMediaTrainState(train, performer)
      syncLinkedLeftResize(train, sourceDelta)
    }

    const handleBeforeRightResize = (site: { wValue: number, disdrawable: boolean }): void => {
      // 按最小时长约束最小宽度
      const minW = resolveMinTrainWidth(clippa.timeline.state.pxPerMs)
      site.wValue = Math.max(minW, site.wValue)

      const nextDuration = getMsByPx(site.wValue, clippa.timeline.state.pxPerMs)
      performer.duration = Math.max(MIN_TRAIN_DURATION_MS, nextDuration)
      syncMediaTrainState(train, performer)
      syncLinkedRightResize(train, performer.duration)
    }

    const handleRightResizeStart = (): void => {
      beginTrainGestureTransaction(train, 'Resize Timeline Item')
    }

    const handleLeftResizeEnd = (target: Train): void => {
      syncTrainTiming(target)
      syncCurrentTrainMediaState()
      refreshVideoTrainThumbnails(target)
      const linked = resolveLinkedContext(target)
      if (linked?.train)
        refreshVideoTrainThumbnails(linked.train)
      markTimelineMutationComplete([target.parent, linked?.train?.parent])
      void endTrainGestureTransaction(train, 'Resize Timeline Item')
    }

    const handleRightResizeEnd = (target: Train): void => {
      syncTrainTiming(target)
      syncCurrentTrainMediaState()
      refreshVideoTrainThumbnails(target)
      const linked = resolveLinkedContext(target)
      if (linked?.train)
        refreshVideoTrainThumbnails(linked.train)
      markTimelineMutationComplete([target.parent, linked?.train?.parent])
      void endTrainGestureTransaction(train, 'Resize Timeline Item')
    }

    const handleAudioStateChange = (state: { muted: boolean, volume: number }): void => {
      if (!(train instanceof AudioTrain))
        return

      train.updateAudioState(state)
    }

    const handleWaveformChange = (peaks: number[]): void => {
      if (!(train instanceof AudioTrain))
        return

      train.updateWaveform(peaks)
    }

    train.on('moveStart', handleMoveStart)
    train.on('beforeMove', handleBeforeMove)
    train.on('moveEnd', handleMoveEnd)
    train.on('beforeLeftResize', handleBeforeLeftResize)
    train.on('leftResizeEnd', handleLeftResizeEnd)
    train.on('rightResizeStart', handleRightResizeStart)
    train.on('beforeRightResize', handleBeforeRightResize)
    train.on('rightResizeEnd', handleRightResizeEnd)
    if (performer instanceof Audio) {
      performer.on('audioStateChange', handleAudioStateChange)
      performer.on('waveformChange', handleWaveformChange)
    }

    trainDisposers.set(train, () => {
      train.off('moveStart', handleMoveStart)
      train.off('beforeMove', handleBeforeMove)
      train.off('moveEnd', handleMoveEnd)
      train.off('beforeLeftResize', handleBeforeLeftResize)
      train.off('leftResizeEnd', handleLeftResizeEnd)
      train.off('rightResizeStart', handleRightResizeStart)
      train.off('beforeRightResize', handleBeforeRightResize)
      train.off('rightResizeEnd', handleRightResizeEnd)
      if (performer instanceof Audio) {
        performer.off('audioStateChange', handleAudioStateChange)
        performer.off('waveformChange', handleWaveformChange)
      }
      void cancelTrainGestureTransaction(train)
    })
  }

  function syncAudioWaveformsFromLibrary(): void {
    const audioWaveforms = new Map<string, number[]>()
    mediaStore.audioFiles.forEach((audioFile) => {
      audioWaveforms.set(audioFile.url, [...audioFile.metadata.waveform.peaks])
    })

    performerStore.getAllPerformers().forEach((performer) => {
      if (!(performer instanceof Audio) || performer.linkGroupId)
        return

      const nextPeaks = audioWaveforms.get(performer.src)
      if (!nextPeaks || nextPeaks.length === 0)
        return

      const sameLength = performer.waveformPeaks.length === nextPeaks.length
      const samePeaks = sameLength && performer.waveformPeaks.every((value, index) => value === nextPeaks[index])
      if (samePeaks)
        return

      performer.setWaveformPeaks(nextPeaks)
    })
  }

  function bindRail(rail: Rail): void {
    if (railDisposers.has(rail))
      return

    const handleInsertTrain = (train: Train): void => {
      bindTrain(train)
    }
    const handleTrainsPosUpdated = (): void => {
      syncRailTiming(rail)
      queueCanvasTimingSync()
    }

    rail.on('insertTrain', handleInsertTrain)
    rail.on('trainsPosUpdated', handleTrainsPosUpdated)
    rail.trains.forEach(bindTrain)

    railDisposers.set(rail, () => {
      rail.off('insertTrain', handleInsertTrain)
      rail.off('trainsPosUpdated', handleTrainsPosUpdated)
    })
  }

  function bindTimelineRails(): void {
    const rails = clippa.timeline.rails?.rails ?? []
    rails.forEach(bindRail)
  }

  const handleActiveTrainChanged = (train: Train | null): void => {
    if (!train)
      return

    const currentTime = clippa.timeline.currentTime
    const trainStart = Math.max(0, train.start)
    const trainEnd = trainStart + Math.max(0, train.duration)
    if (
      currentTime >= trainStart - TIME_EPSILON_MS
      && currentTime <= trainEnd + TIME_EPSILON_MS
    ) {
      return
    }

    const nextTime = Math.min(clippa.timeline.duration, trainStart)
    if (Math.abs(currentTime - nextTime) < TIME_EPSILON_MS)
      return

    clippa.timeline.updateCurrentTime(nextTime)
  }

  const handleDurationChanged = (): void => {
    bindTimelineRails()
  }

  const handleCurrentTimeUpdated = (): void => {
    queueCanvasTimingSync()
  }

  const handleHire = (): void => {
    // clippa.hire() 中 theater.hire(p) 先于 timeline.addTrainByZIndex() 执行，
    // 此时新 rail/train 尚未创建，需延迟到当前微任务完成后再绑定
    queueMicrotask(() => bindTimelineRails())
  }

  onMounted(async () => {
    await clippa.ready
    bindTimelineRails()
    syncAudioWaveformsFromLibrary()
    clippa.timeline.on('durationChanged', handleDurationChanged)
    clippa.timeline.on('currentTimeUpdated', handleCurrentTimeUpdated)
    clippa.timeline.state.on('activeTrainChanged', handleActiveTrainChanged)
    clippa.theater.on('hire', handleHire)

    watch(
      () => mediaStore.audioFiles.map(file => `${file.id}:${file.metadata.waveform.peaks.join(',')}`),
      () => {
        syncAudioWaveformsFromLibrary()
      },
      { deep: false },
    )
  })

  onUnmounted(() => {
    clippa.timeline.off('durationChanged', handleDurationChanged)
    clippa.timeline.off('currentTimeUpdated', handleCurrentTimeUpdated)
    clippa.timeline.state.off('activeTrainChanged', handleActiveTrainChanged)
    clippa.theater.off('hire', handleHire)

    railDisposers.forEach(dispose => dispose())
    railDisposers.clear()

    trainDisposers.forEach(dispose => dispose())
    trainDisposers.clear()

    trainGestureTransactions.forEach((transactionId) => {
      void editorCommandActions.historyCancelTransaction(transactionId)
    })
    trainGestureTransactions.clear()
    trainGestureTransactionStarting.clear()
  })
}
