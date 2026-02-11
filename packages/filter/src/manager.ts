import type { Rail, TextTrain, Timeline, Train } from '@clippc/timeline'
import type { ColorMatrixFilter } from 'pixi.js'
import type {
  FilterConfig,
  FilterLayer,
  FilterLayerCreateOptions,
  FilterLayerTimingUpdate,
  FilterManagerEvents,
  FilterManagerSnapshot,
  TrainResizePayload,
} from './types'
import { TextTrain as TextTrainImpl } from '@clippc/timeline'
import { EventBus, getMsByPx, getPxByMs } from '@clippc/utils'
import { ColorMatrixFilter as ColorMatrixFilterImpl } from 'pixi.js'
import {
  applyFilterConfig,
  cloneFilterConfig,
  DEFAULT_FILTER_CONFIG,
  DEFAULT_FILTER_DURATION,
} from './utils'

export class FilterManager extends EventBus<FilterManagerEvents> {
  private layers: FilterLayer[] = []
  private activeLayerId: string | null = null
  private timelineRef: Timeline | null = null
  private hasBoundTimeline = false
  private layerSequence = 1

  getSnapshot(): FilterManagerSnapshot {
    return {
      layers: [...this.layers],
      activeLayerId: this.activeLayerId,
    }
  }

  getActiveLayer(): FilterLayer | null {
    if (!this.activeLayerId)
      return null
    return this.layers.find(layer => layer.id === this.activeLayerId) ?? null
  }

  bindTimeline(timeline: Timeline): void {
    if (this.hasBoundTimeline)
      return

    this.timelineRef = timeline
    this.hasBoundTimeline = true

    timeline.state.on('activeTrainChanged', (train) => {
      if (!train) {
        this.activeLayerId = null
        this.emitChange()
        return
      }

      const target = this.layers.find(layer => layer.train === train)
      this.activeLayerId = target ? target.id : null
      this.emitChange()
    })
  }

  createLayer(options: FilterLayerCreateOptions = {}): FilterLayer | null {
    const timeline = this.timelineRef
    if (!timeline) {
      console.warn('timeline not ready')
      return null
    }

    const now = Date.now()
    const id = `filter-${now}-${Math.random().toString(36).slice(2, 8)}`
    const name = options.name ?? `Filter ${this.layerSequence++}`
    const start = options.start ?? 0
    const duration = options.duration ?? DEFAULT_FILTER_DURATION
    const zIndex = options.zIndex ?? 1

    const config = options.config
      ? cloneFilterConfig(options.config)
      : cloneFilterConfig(DEFAULT_FILTER_CONFIG)
    const filter: ColorMatrixFilter = new ColorMatrixFilterImpl()
    applyFilterConfig(filter, config)

    const train: TextTrain = new TextTrainImpl({
      id: `filter-train-${id}`,
      start,
      duration,
      label: name,
      variant: 'filter',
    })

    timeline.addTrainByZIndex(train, zIndex)

    const layer: FilterLayer = {
      id,
      name,
      start,
      duration,
      zIndex,
      config,
      filter,
      train,
      createdAt: now,
      version: 0,
    }

    this.layers.push(layer)
    this.bindTrainEvents(layer, train)
    this.selectLayer(layer.id)
    this.emitChange()
    return layer
  }

  selectLayer(id: string | null): void {
    this.activeLayerId = id
    if (!id) {
      this.emitChange()
      return
    }

    const layer = this.layers.find(item => item.id === id)
    if (layer) {
      layer.train.updateActive(true)
    }

    this.emitChange()
  }

  updateLayerConfig(id: string, patch: Partial<FilterConfig>): void {
    const layer = this.layers.find(item => item.id === id)
    if (!layer)
      return

    Object.assign(layer.config, patch)
    applyFilterConfig(layer.filter, layer.config)
    layer.version += 1
    this.emitChange()
  }

  resetLayerConfig(id: string): void {
    this.updateLayerConfig(id, cloneFilterConfig(DEFAULT_FILTER_CONFIG))
  }

  updateLayerZIndex(id: string, zIndex: number): void {
    const layer = this.layers.find(item => item.id === id)
    const timeline = this.timelineRef
    if (!layer || !timeline)
      return

    if (layer.zIndex === zIndex)
      return

    layer.zIndex = zIndex
    layer.version += 1

    const rails = timeline.rails
    if (!rails) {
      this.emitChange()
      return
    }

    let targetRail = rails.getRailByZIndex(zIndex)
    if (!targetRail || !targetRail.canAcceptTrain(layer.train)) {
      targetRail = rails.createRailByZIndex(zIndex, layer.train.railStyle)
    }

    const sourceRail = layer.train.parent
    if (layer.train.parent) {
      layer.train.parent.removeTrain(layer.train)
    }

    targetRail.insertTrain(layer.train)
    this.removeRailIfEmpty(sourceRail)

    layer.train.updateActive(true)
    this.emitChange()
  }

  splitLayerByTrainId(trainId: string, splitTime: number): FilterLayer | null {
    const timeline = this.timelineRef
    if (!timeline)
      return null

    const sourceLayer = this.layers.find(layer => layer.train.id === trainId)
    if (!sourceLayer)
      return null

    const start = sourceLayer.start
    const end = sourceLayer.start + sourceLayer.duration
    if (splitTime <= start || splitTime >= end)
      return null

    const leftDuration = splitTime - start
    const rightDuration = end - splitTime
    const now = Date.now()
    const id = `filter-${now}-${Math.random().toString(36).slice(2, 8)}`

    sourceLayer.duration = leftDuration
    sourceLayer.train.duration = leftDuration
    sourceLayer.train.updateWidth(getPxByMs(leftDuration, sourceLayer.train.state.pxPerMs))
    sourceLayer.version += 1

    const train: TextTrain = new TextTrainImpl({
      id: `filter-train-${id}`,
      start: splitTime,
      duration: rightDuration,
      label: sourceLayer.name,
      variant: 'filter',
    })
    timeline.addTrainByZIndex(train, sourceLayer.zIndex)

    const config = cloneFilterConfig(sourceLayer.config)
    const filter: ColorMatrixFilter = new ColorMatrixFilterImpl()
    applyFilterConfig(filter, config)

    const nextLayer: FilterLayer = {
      id,
      name: sourceLayer.name,
      start: splitTime,
      duration: rightDuration,
      zIndex: sourceLayer.zIndex,
      config,
      filter,
      train,
      createdAt: now,
      version: 0,
    }

    const sourceLayerIndex = this.layers.findIndex(layer => layer.id === sourceLayer.id)
    const insertIndex = sourceLayerIndex >= 0 ? sourceLayerIndex + 1 : this.layers.length
    this.layers.splice(insertIndex, 0, nextLayer)
    this.bindTrainEvents(nextLayer, train)

    this.emitChange()
    return nextLayer
  }

  removeLayer(id: string): void {
    const index = this.layers.findIndex(item => item.id === id)
    if (index === -1)
      return

    const layer = this.layers[index]
    const sourceRail = layer.train.parent
    layer.train.updateActive(false)
    if (layer.train.parent) {
      layer.train.parent.removeTrain(layer.train)
    }

    this.layers.splice(index, 1)
    this.removeRailIfEmpty(sourceRail)

    if (this.activeLayerId === id) {
      this.activeLayerId = null
    }

    this.emitChange()
  }

  private updateLayerTiming(layer: FilterLayer, updates: FilterLayerTimingUpdate): void {
    let changed = false

    if (updates.start !== undefined && updates.start !== layer.start) {
      layer.start = updates.start
      changed = true
    }

    if (updates.duration !== undefined && updates.duration !== layer.duration) {
      layer.duration = updates.duration
      changed = true
    }

    if (updates.zIndex !== undefined && updates.zIndex !== layer.zIndex) {
      layer.zIndex = updates.zIndex
      changed = true
    }

    if (changed) {
      layer.version += 1
      this.emitChange()
    }
  }

  private bindTrainEvents(layer: FilterLayer, train: TextTrain): void {
    train.on('moveEnd', (target: Train) => {
      this.updateLayerTiming(layer, {
        start: target.start,
        duration: target.duration,
        zIndex: target.parent?.zIndex ?? layer.zIndex,
      })
    })

    train.on('beforeLeftResize', (payload: TrainResizePayload, target: Train) => {
      const start = getMsByPx(payload.xValue, target.state.pxPerMs)
      const duration = getMsByPx(payload.wValue, target.state.pxPerMs)
      this.updateLayerTiming(layer, { start, duration })
    })

    train.on('rightResizeEnd', (target: Train) => {
      this.updateLayerTiming(layer, {
        start: target.start,
        duration: target.duration,
      })
    })
  }

  private removeRailIfEmpty(rail: Rail | null): void {
    if (!rail || rail.trains.length > 0)
      return

    const rails = this.timelineRef?.rails
    if (!rails || !rails.rails.includes(rail))
      return

    rails.removeRail(rail)
    this.syncLayerZIndexFromTrainParent()
  }

  private syncLayerZIndexFromTrainParent(): void {
    this.layers.forEach((layer) => {
      const zIndex = layer.train.parent?.zIndex
      if (typeof zIndex !== 'number' || zIndex === layer.zIndex)
        return

      layer.zIndex = zIndex
      layer.version += 1
    })
  }

  private emitChange(): void {
    this.emit('change', this.getSnapshot())
  }
}
