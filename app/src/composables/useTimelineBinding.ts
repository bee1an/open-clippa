import type { Rail, Train } from 'clippc'
import type { CanvasPerformer } from '@/store/usePerformerStore'
import { getMsByPx, getPxByMs, VideoTrain } from 'clippc'
import { onMounted, onUnmounted } from 'vue'
import { useEditorCommandActions } from '@/composables/useEditorCommandActions'
import { useEditorStore } from '@/store'
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

    const syncVideoTrainSource = (): void => {
      const performer = performerStore.getPerformerById(train.id)
      if (!performer || !hasSourceTiming(performer) || !(train instanceof VideoTrain))
        return

      train.updateSourceStart(performer.sourceStart)
    }

    const refreshVideoTrainThumbnails = (): void => {
      if (!(train instanceof VideoTrain))
        return

      train.refreshThumbnails().catch((error) => {
        console.warn('[timeline-binding] refresh video train thumbnails failed', error)
      })
    }

    syncVideoTrainSource()

    const handleMoveStart = (): void => {
      beginTrainGestureTransaction(train, 'Move Timeline Item')
    }

    const handleMoveEnd = (target: Train): void => {
      syncRailTiming(target.parent)
      syncTrainTiming(target)
      queueCanvasTimingSync()
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

      if (hasSourceTiming(performer)) {
        const sourceDelta = nextStart - oldStart
        const nextSourceStart = performer.sourceStart + sourceDelta

        if (nextSourceStart < 0) {
          const clampedDelta = -performer.sourceStart
          const blockedDelta = clampedDelta - sourceDelta
          const blockedPx = getPxByMs(blockedDelta, pxPerMs)

          site.xValue += blockedPx
          site.wValue -= blockedPx

          nextStart = oldStart + clampedDelta
          nextDuration = oldDuration - clampedDelta
        }
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
      }

      if (hasSourceTiming(performer)) {
        const maxSourceStart = Math.max(0, performer.sourceDuration)
        const clampedSourceStart = performer.sourceStart + (nextStart - oldStart)
        performer.sourceStart = Math.min(
          maxSourceStart,
          Math.max(0, clampedSourceStart),
        )

        if (train instanceof VideoTrain)
          train.updateSourceStart(performer.sourceStart)
      }

      performer.start = nextStart
      performer.duration = Math.max(MIN_TRAIN_DURATION_MS, nextDuration)
    }

    const handleBeforeRightResize = (site: { wValue: number, disdrawable: boolean }): void => {
      // 按最小时长约束最小宽度
      const minW = resolveMinTrainWidth(clippa.timeline.state.pxPerMs)
      site.wValue = Math.max(minW, site.wValue)
    }

    const handleRightResizeStart = (): void => {
      beginTrainGestureTransaction(train, 'Resize Timeline Item')
    }

    const handleLeftResizeEnd = (target: Train): void => {
      syncRailTiming(target.parent)
      syncTrainTiming(target)
      syncVideoTrainSource()
      refreshVideoTrainThumbnails()
      queueCanvasTimingSync()
      void endTrainGestureTransaction(train, 'Resize Timeline Item')
    }

    const handleRightResizeEnd = (target: Train): void => {
      syncRailTiming(target.parent)
      syncTrainTiming(target)
      syncVideoTrainSource()
      refreshVideoTrainThumbnails()
      queueCanvasTimingSync()
      void endTrainGestureTransaction(train, 'Resize Timeline Item')
    }

    train.on('moveStart', handleMoveStart)
    train.on('moveEnd', handleMoveEnd)
    train.on('beforeLeftResize', handleBeforeLeftResize)
    train.on('leftResizeEnd', handleLeftResizeEnd)
    train.on('rightResizeStart', handleRightResizeStart)
    train.on('beforeRightResize', handleBeforeRightResize)
    train.on('rightResizeEnd', handleRightResizeEnd)

    trainDisposers.set(train, () => {
      train.off('moveStart', handleMoveStart)
      train.off('moveEnd', handleMoveEnd)
      train.off('beforeLeftResize', handleBeforeLeftResize)
      train.off('leftResizeEnd', handleLeftResizeEnd)
      train.off('rightResizeStart', handleRightResizeStart)
      train.off('beforeRightResize', handleBeforeRightResize)
      train.off('rightResizeEnd', handleRightResizeEnd)
      void cancelTrainGestureTransaction(train)
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
    clippa.timeline.on('durationChanged', handleDurationChanged)
    clippa.timeline.on('currentTimeUpdated', handleCurrentTimeUpdated)
    clippa.timeline.state.on('activeTrainChanged', handleActiveTrainChanged)
    clippa.theater.on('hire', handleHire)
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
