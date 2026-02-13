import type { Timeline, Train } from 'clippc'
import type { TransitionCandidate, TransitionClip } from './transition'
import { EventBus } from '@clippc/utils'
import { buildTransitionCandidates, buildTransitionPairKey } from './transition'

interface RailLike {
  trains: Train[]
  on: (event: 'insertTrain' | 'trainsPosUpdated' | 'trainMoveEnd' | 'trainRightResizeEnd', handler: (...args: any[]) => void) => void
  off: (event: 'insertTrain' | 'trainsPosUpdated' | 'trainMoveEnd' | 'trainRightResizeEnd', handler: (...args: any[]) => void) => void
}

interface RailsLike {
  rails: RailLike[]
  on?: (event: 'layoutChanged', handler: (...args: any[]) => void) => void
  off?: (event: 'layoutChanged', handler: (...args: any[]) => void) => void
}

interface TrainLike {
  on: (event: 'afterMove' | 'moveEnd' | 'beforeLeftResize' | 'beforeRightResize' | 'rightResizeEnd', handler: (...args: any[]) => void) => void
  off: (event: 'afterMove' | 'moveEnd' | 'beforeLeftResize' | 'beforeRightResize' | 'rightResizeEnd', handler: (...args: any[]) => void) => void
}

export interface TrackedTransitionCandidate extends TransitionCandidate {
  pairKey: string
}

export interface TransitionCandidateSnapshot {
  candidates: TrackedTransitionCandidate[]
  version: number
}

export interface TransitionCandidateTrackerAdapter {
  timeline: Timeline
  resolveClip: (performerId: string) => TransitionClip | null
  getActivePairKey?: () => string | null
  clearActiveSelection?: () => void
}

export type TransitionCandidateTrackerEvents = {
  change: [TransitionCandidateSnapshot]
}

export class TransitionCandidateTracker extends EventBus<TransitionCandidateTrackerEvents> {
  private started = false
  private disposed = false
  private version = 0
  private snapshot: TransitionCandidateSnapshot = {
    candidates: [],
    version: 0,
  }

  private timelineDisposer: (() => void) | null = null
  private railDisposers = new Map<RailLike, () => void>()
  private trainDisposers = new Map<TrainLike, () => void>()

  constructor(private readonly adapter: TransitionCandidateTrackerAdapter) {
    super()
  }

  getSnapshot(): TransitionCandidateSnapshot {
    return {
      version: this.snapshot.version,
      candidates: this.snapshot.candidates.map(item => ({ ...item })),
    }
  }

  subscribe(callback: (snapshot: TransitionCandidateSnapshot) => void): () => void {
    this.on('change', callback)
    return () => this.off('change', callback)
  }

  start(): void {
    if (this.started || this.disposed)
      return

    this.started = true
    this.bindTimeline()
    this.refresh()
  }

  stop(): void {
    if (!this.started)
      return

    this.started = false
    this.timelineDisposer?.()
    this.timelineDisposer = null

    this.railDisposers.forEach(dispose => dispose())
    this.railDisposers.clear()

    this.trainDisposers.forEach(dispose => dispose())
    this.trainDisposers.clear()
  }

  private bindTimeline(): void {
    const timeline = this.adapter.timeline
    const rails = timeline.rails as unknown as RailsLike | undefined

    const handleDurationChanged = (): void => {
      this.bindRails()
      this.refresh()
    }

    const handleRailsLayoutChanged = (): void => {
      this.bindRails()
      this.refresh()
    }

    timeline.on('durationChanged', handleDurationChanged)
    rails?.on?.('layoutChanged', handleRailsLayoutChanged)

    this.timelineDisposer = () => {
      timeline.off('durationChanged', handleDurationChanged)
      rails?.off?.('layoutChanged', handleRailsLayoutChanged)
    }

    this.bindRails()
  }

  private bindRails(): void {
    const rails = (this.adapter.timeline.rails as unknown as RailsLike | undefined)?.rails ?? []
    rails.forEach(rail => this.bindRail(rail as RailLike))
  }

  private bindRail(rail: RailLike): void {
    if (this.railDisposers.has(rail))
      return

    const handleInsertTrain = (train: Train): void => {
      this.bindTrain(train as TrainLike)
      this.refresh()
    }

    const handleRailChanged = (): void => {
      this.refresh()
    }

    rail.on('insertTrain', handleInsertTrain)
    rail.on('trainsPosUpdated', handleRailChanged)
    rail.on('trainMoveEnd', handleRailChanged)
    rail.on('trainRightResizeEnd', handleRailChanged)

    rail.trains.forEach(train => this.bindTrain(train as TrainLike))

    this.railDisposers.set(rail, () => {
      rail.off('insertTrain', handleInsertTrain)
      rail.off('trainsPosUpdated', handleRailChanged)
      rail.off('trainMoveEnd', handleRailChanged)
      rail.off('trainRightResizeEnd', handleRailChanged)
    })
  }

  private bindTrain(train: TrainLike): void {
    if (this.trainDisposers.has(train))
      return

    const handleTrainChanged = (): void => {
      this.refresh()
    }

    train.on('afterMove', handleTrainChanged)
    train.on('moveEnd', handleTrainChanged)
    train.on('beforeLeftResize', handleTrainChanged)
    train.on('beforeRightResize', handleTrainChanged)
    train.on('rightResizeEnd', handleTrainChanged)

    this.trainDisposers.set(train, () => {
      train.off('afterMove', handleTrainChanged)
      train.off('moveEnd', handleTrainChanged)
      train.off('beforeLeftResize', handleTrainChanged)
      train.off('beforeRightResize', handleTrainChanged)
      train.off('rightResizeEnd', handleTrainChanged)
    })
  }

  private refresh(): void {
    if (!this.started || this.disposed)
      return

    const rawCandidates = buildTransitionCandidates(this.adapter.timeline)
    const candidates = rawCandidates
      .filter((candidate) => {
        const from = this.adapter.resolveClip(candidate.fromId)
        const to = this.adapter.resolveClip(candidate.toId)
        return Boolean(from && to)
      })
      .map((candidate) => {
        return {
          ...candidate,
          pairKey: buildTransitionPairKey(candidate.fromId, candidate.toId),
        }
      })

    const activePairKey = this.adapter.getActivePairKey?.() ?? null
    if (activePairKey && !candidates.some(candidate => candidate.pairKey === activePairKey))
      this.adapter.clearActiveSelection?.()

    this.version += 1
    this.snapshot = {
      version: this.version,
      candidates,
    }

    this.emit('change', this.getSnapshot())
  }
}
