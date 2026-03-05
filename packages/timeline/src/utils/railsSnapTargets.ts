import type { TimelineSnapTarget } from './snap'

export interface RailSnapTrainSnapshot {
  id: string
  x: number
  width: number
  start: number
  duration: number
}

export interface RailSnapRailSnapshot {
  zIndex: number
  trains: RailSnapTrainSnapshot[]
}

export function collectRailsSnapTargets(input: {
  rails: RailSnapRailSnapshot[]
  forRailZIndex: number
  trainId: string
}): TimelineSnapTarget[] {
  const result: TimelineSnapTarget[] = []

  for (const rail of input.rails) {
    const anchorMode: TimelineSnapTarget['anchorMode'] = rail.zIndex === input.forRailZIndex ? 'time' : 'visual'
    for (const train of rail.trains) {
      if (train.id === input.trainId)
        continue

      result.push({
        id: train.id,
        railZIndex: rail.zIndex,
        x: train.x,
        width: train.width,
        start: train.start,
        duration: train.duration,
        anchorMode,
      })
    }
  }

  return result
}
