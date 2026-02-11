import type { Train } from './train'
import { EventBus } from '@clippc/utils'

export type StateEvents = {
  updatedPxPerMs: [number]
  activeTrainChanged: [Train | null]
}

export class State extends EventBus<StateEvents> {
  private static _instance: State | null = null

  static getInstance(): State {
    if (!State._instance) {
      State._instance = new State()
    }
    return State._instance
  }

  private constructor() { super() }

  /**
   * 当前train是否在拖拽中
   */
  trainDragging: boolean = false
  setTrainDragging(value: boolean): void {
    if (this.trainDragging === value)
      return

    this.trainDragging = value
  }

  /**
   * 当前正在拖拽的train
   */
  atDragTrain: Train | null = null
  setDraggingTrain(train: Train | null): void {
    this.atDragTrain = train
  }

  /**
   * 每ms对应的px
   */
  pxPerMs: number = 0.024
  // pxPerMs: number = 0.3
  updatePxPerMs(pxPerMs: number): void {
    this.pxPerMs = pxPerMs
    this.emit('updatedPxPerMs', pxPerMs)
  }

  /**
   * 当前激活的train
   */
  activeTrain: Train | null = null
  setActiveTrain(train: Train | null): void {
    if (this.activeTrain === train)
      return

    this.activeTrain = train
    this.emit('activeTrainChanged', train)
  }
}
