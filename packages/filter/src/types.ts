import type { TextTrain, Train } from '@clippa/timeline'
import type { ColorMatrixFilter } from 'pixi.js'

export interface FilterConfig {
  brightness: number
  contrast: number
  saturation: number
  hue: number
}

export interface FilterLayer {
  id: string
  name: string
  start: number
  duration: number
  zIndex: number
  config: FilterConfig
  filter: ColorMatrixFilter
  train: TextTrain
  createdAt: number
  version: number
}

export interface FilterLayerCreateOptions {
  start?: number
  duration?: number
  zIndex?: number
  name?: string
  preset?: string
  config?: FilterConfig
}

export interface FilterLayerTimingUpdate {
  start?: number
  duration?: number
  zIndex?: number
}

export interface FilterManagerSnapshot {
  layers: FilterLayer[]
  activeLayerId: string | null
}

export type FilterManagerEvents = {
  change: [FilterManagerSnapshot]
}

export type TrainResizePayload = {
  xValue: number
  wValue: number
  disdrawable: boolean
}

export type TrainMoveTarget = Train
