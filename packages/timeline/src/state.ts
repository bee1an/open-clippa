import type { Train } from './train'

export class State {
  private static _instance: State | null = null

  static getInstance(): State {
    if (!State._instance) {
      State._instance = new State()
    }
    return State._instance
  }

  private constructor() {}

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
}
