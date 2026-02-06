import type { Rail, Train } from 'open-clippa'
import type { CanvasPerformer } from '@/store/usePerformerStore'
import { getMsByPx } from 'open-clippa'
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

  function bindTrain(train: Train): void {
    if (trainDisposers.has(train))
      return

    const handleMoveEnd = (target: Train): void => {
      syncRailTiming(target.parent)
      syncTrainTiming(target)
    }

    const handleBeforeLeftResize = (site: { xValue: number, wValue: number }): void => {
      const performer = performerStore.getPerformerById(train.id)
      if (!performer)
        return

      const oldStart = performer.start
      const nextStart = getMsByPx(site.xValue, clippa.timeline.state.pxPerMs)
      const nextDuration = getMsByPx(site.wValue, clippa.timeline.state.pxPerMs)

      performer.start = nextStart
      performer.duration = nextDuration

      if (!hasSourceTiming(performer))
        return

      const sourceDelta = nextStart - oldStart
      const nextSourceStart = performer.sourceStart + sourceDelta
      performer.sourceStart = Math.min(
        Math.max(0, performer.sourceDuration),
        Math.max(0, nextSourceStart),
      )
    }

    const handleRightResizeEnd = (target: Train): void => {
      syncRailTiming(target.parent)
      syncTrainTiming(target)
    }

    train.on('moveEnd', handleMoveEnd)
    train.on('beforeLeftResize', handleBeforeLeftResize)
    train.on('rightResizeEnd', handleRightResizeEnd)

    trainDisposers.set(train, () => {
      train.off('moveEnd', handleMoveEnd)
      train.off('beforeLeftResize', handleBeforeLeftResize)
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
