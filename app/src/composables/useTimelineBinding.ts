import type { Rail, Train } from 'open-clippa'
import type { CanvasPerformer } from '@/store/usePerformerStore'
import { getMsByPx, getPxByMs, VideoTrain } from 'open-clippa'
import { onMounted, onUnmounted } from 'vue'
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

export function useTimelineBinding(): void {
  const editorStore = useEditorStore()
  const performerStore = usePerformerStore()
  const { clippa } = editorStore

  const railDisposers = new Map<Rail, () => void>()
  const trainDisposers = new Map<Train, () => void>()

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

    const handleMoveEnd = (target: Train): void => {
      syncRailTiming(target.parent)
      syncTrainTiming(target)
    }

    const handleBeforeLeftResize = (site: { xValue: number, wValue: number, disdrawable: boolean }): void => {
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

        const maxSourceStart = Math.max(0, performer.sourceDuration)
        const clampedSourceStart = performer.sourceStart + (nextStart - oldStart)
        performer.sourceStart = Math.min(
          maxSourceStart,
          Math.max(0, clampedSourceStart),
        )

        if (train instanceof VideoTrain)
          train.updateSourceStart(performer.sourceStart)
      }

      site.wValue = Math.max(0, site.wValue)
      performer.start = nextStart
      performer.duration = Math.max(0, nextDuration)
    }

    const handleLeftResizeEnd = (target: Train): void => {
      syncRailTiming(target.parent)
      syncTrainTiming(target)
      syncVideoTrainSource()
      refreshVideoTrainThumbnails()
    }

    const handleRightResizeEnd = (target: Train): void => {
      syncRailTiming(target.parent)
      syncTrainTiming(target)
      syncVideoTrainSource()
      refreshVideoTrainThumbnails()
    }

    train.on('moveEnd', handleMoveEnd)
    train.on('beforeLeftResize', handleBeforeLeftResize)
    train.on('leftResizeEnd', handleLeftResizeEnd)
    train.on('rightResizeEnd', handleRightResizeEnd)

    trainDisposers.set(train, () => {
      train.off('moveEnd', handleMoveEnd)
      train.off('beforeLeftResize', handleBeforeLeftResize)
      train.off('leftResizeEnd', handleLeftResizeEnd)
      train.off('rightResizeEnd', handleRightResizeEnd)
    })
  }

  function bindRail(rail: Rail): void {
    if (railDisposers.has(rail))
      return

    const handleInsertTrain = (train: Train): void => {
      bindTrain(train)
    }

    rail.on('insertTrain', handleInsertTrain)
    rail.trains.forEach(bindTrain)

    railDisposers.set(rail, () => {
      rail.off('insertTrain', handleInsertTrain)
    })
  }

  function bindTimelineRails(): void {
    const rails = clippa.timeline.rails?.rails ?? []
    rails.forEach(bindRail)
  }

  const handleDurationChanged = (): void => {
    bindTimelineRails()
  }

  const handleHire = (): void => {
    bindTimelineRails()
  }

  onMounted(async () => {
    await clippa.ready
    bindTimelineRails()
    clippa.timeline.on('durationChanged', handleDurationChanged)
    clippa.theater.on('hire', handleHire)
  })

  onUnmounted(() => {
    clippa.timeline.off('durationChanged', handleDurationChanged)
    clippa.theater.off('hire', handleHire)

    railDisposers.forEach(dispose => dispose())
    railDisposers.clear()

    trainDisposers.forEach(dispose => dispose())
    trainDisposers.clear()
  })
}
