export type SeamTrain = {
  x: number
  width: number
}

export type TrainJoinState = {
  joinLeft: boolean
  joinRight: boolean
}

export function collectAdjacentBoundaries(
  trains: readonly SeamTrain[],
  epsilon: number,
  expectedGap: number = 0,
): number[] {
  if (trains.length < 2)
    return []

  const boundaries: number[] = []

  for (let i = 0; i < trains.length - 1; i++) {
    const current = trains[i]
    const next = trains[i + 1]
    const right = current.x + current.width
    const gap = next.x - right

    if (Math.abs(gap - expectedGap) <= epsilon) {
      boundaries.push(right + expectedGap / 2)
    }
  }

  return boundaries
}

export function collectTrainJoinStates(
  trains: readonly SeamTrain[],
  epsilon: number,
  expectedGap: number = 0,
): TrainJoinState[] {
  const states = trains.map<TrainJoinState>(() => ({
    joinLeft: false,
    joinRight: false,
  }))

  if (trains.length < 2)
    return states

  for (let i = 0; i < trains.length - 1; i++) {
    const current = trains[i]
    const next = trains[i + 1]
    const boundary = current.x + current.width
    const gap = next.x - boundary

    if (Math.abs(gap - expectedGap) <= epsilon) {
      states[i].joinRight = true
      states[i + 1].joinLeft = true
    }
  }

  return states
}
