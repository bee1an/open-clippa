import { describe, expect, it, vi } from 'vitest'
import { Train } from '../src/train/train'

vi.mock('../src/rail', () => {
  return {
    getRailHeightByStyle: () => 60,
  }
})

type TrainHarness = Train & Record<string, any>

function createTrainHarness(): TrainHarness {
  const train = Object.create(Train.prototype) as TrainHarness

  train.id = 'train-1'
  train.start = 100
  train.duration = 500
  train.height = 40
  train.width = 120
  train.x = 0
  train.y = 0
  train.dragStatus = 'normal'
  train.railStyle = 'default'
  train.parent = { height: 120 }

  train.container = {
    x: 0,
    y: 0,
    alpha: 1,
    zIndex: 0,
    getBounds: vi.fn(() => ({ x: 20, y: 30 })),
  }

  train._joinLeft = false
  train._joinRight = false
  train._drawSlot = vi.fn()
  train._drawBorder = vi.fn()
  train._drawResizer = vi.fn()
  train._onJoinStateUpdated = vi.fn()

  return train
}

describe('train core behavior', () => {
  it('updates drag visual state with alpha fallback', () => {
    const train = createTrainHarness()

    train.updateState('translucent')
    expect(train.dragStatus).toBe('translucent')
    expect(train.container.alpha).toBe(0.5)

    train.updateState('free')
    expect(train.container.alpha).toBe(0.5)

    train.updateState('normal')
    expect(train.container.alpha).toBe(1)
  })

  it('updates position on both train state and container', () => {
    const train = createTrainHarness()

    train.updatePos(45, 60)
    expect(train.x).toBe(45)
    expect(train.y).toBe(60)
    expect(train.container.x).toBe(45)
    expect(train.container.y).toBe(60)

    train.updatePos(undefined, 12)
    expect(train.x).toBe(45)
    expect(train.y).toBe(12)
  })

  it('syncs y to rail center', () => {
    const train = createTrainHarness()
    train.height = 20
    train.parent = { height: 100 }

    train.syncRailY()

    expect(train.y).toBe(40)
    expect(train.container.y).toBe(40)
  })

  it('refreshes shapes when join state changes', () => {
    const train = createTrainHarness()

    train.updateJoinState(true, false)
    expect(train._drawSlot).toHaveBeenCalledTimes(1)
    expect(train._drawBorder).toHaveBeenCalledTimes(1)
    expect(train._drawResizer).toHaveBeenCalledTimes(1)
    expect(train._onJoinStateUpdated).toHaveBeenCalledTimes(1)

    train.updateJoinState(true, false)
    expect(train._drawSlot).toHaveBeenCalledTimes(1)
    expect(train._drawBorder).toHaveBeenCalledTimes(1)
    expect(train._drawResizer).toHaveBeenCalledTimes(1)
    expect(train._onJoinStateUpdated).toHaveBeenCalledTimes(1)
  })

  it('resolves pointer offset from local position when available', () => {
    const train = createTrainHarness()
    const offset = train._resolveDragPointerOffset({
      getLocalPosition: () => ({ x: 11, y: 22 }),
      x: 0,
      y: 0,
    } as PointerEvent)

    expect(offset).toEqual({ x: 11, y: 22 })
  })

  it('falls back to bounds-based pointer offset', () => {
    const train = createTrainHarness()
    const offset = train._resolveDragPointerOffset({
      x: 50,
      y: 80,
    } as PointerEvent)

    expect(offset).toEqual({ x: 30, y: 50 })
  })

  it('serializes basic train shape to json', () => {
    const train = createTrainHarness()

    expect(train.toJson()).toEqual({
      id: 'train-1',
      start: 100,
      duration: 500,
      height: 40,
    })
  })
})
