export interface AxisSnapCandidate<TMeta = unknown> {
  id: string
  value: number
  meta?: TMeta
}

export interface AxisSnapState {
  lockedCandidateId: string
  escapeOffset: number
}

export interface SolveAxisSnapInput<TMeta = unknown> {
  nextValue: number
  candidates: Array<AxisSnapCandidate<TMeta>>
  state: AxisSnapState | null
  enterThreshold: number
  exitThreshold: number
  bypass?: boolean
  mode?: 'absolute' | 'incremental'
}

export interface SolveAxisSnapResult<TMeta = unknown> {
  value: number
  snapped: boolean
  candidate: AxisSnapCandidate<TMeta> | null
  state: AxisSnapState | null
  distance: number | null
}

export function pickNearestCandidate<TMeta = unknown>(
  nextValue: number,
  candidates: Array<AxisSnapCandidate<TMeta>>,
): { candidate: AxisSnapCandidate<TMeta>, distance: number } | null {
  let nearest: { candidate: AxisSnapCandidate<TMeta>, distance: number } | null = null

  for (const candidate of candidates) {
    if (!Number.isFinite(candidate.value))
      continue

    const distance = Math.abs(nextValue - candidate.value)
    if (!nearest || distance < nearest.distance) {
      nearest = { candidate, distance }
    }
  }

  return nearest
}

export function clearSnapState(): AxisSnapState | null {
  return null
}

export function solveAxisSnap<TMeta = unknown>(
  input: SolveAxisSnapInput<TMeta>,
): SolveAxisSnapResult<TMeta> {
  const { nextValue, candidates, state, enterThreshold, exitThreshold, bypass } = input
  const safeValue = Number.isFinite(nextValue) ? nextValue : 0
  const mode = input.mode ?? 'absolute'

  if (bypass) {
    return {
      value: safeValue,
      snapped: false,
      candidate: null,
      state: clearSnapState(),
      distance: null,
    }
  }

  const normalizedCandidates = candidates.filter((candidate) => {
    return Number.isFinite(candidate.value)
  })

  const activeCandidate = state
    ? normalizedCandidates.find(candidate => candidate.id === state.lockedCandidateId) ?? null
    : null
  if (activeCandidate && state) {
    const nextEscapeOffset = mode === 'incremental'
      ? state.escapeOffset + (safeValue - activeCandidate.value)
      : (safeValue - activeCandidate.value)
    const releaseDistance = Math.abs(nextEscapeOffset)

    if (releaseDistance <= exitThreshold) {
      return {
        value: activeCandidate.value,
        snapped: true,
        candidate: activeCandidate,
        state: {
          lockedCandidateId: activeCandidate.id,
          escapeOffset: nextEscapeOffset,
        },
        distance: Math.abs(safeValue - activeCandidate.value),
      }
    }

    return {
      value: activeCandidate.value + nextEscapeOffset,
      snapped: false,
      candidate: null,
      state: clearSnapState(),
      distance: null,
    }
  }

  const nearest = pickNearestCandidate(safeValue, normalizedCandidates)
  if (!nearest || nearest.distance > enterThreshold) {
    return {
      value: safeValue,
      snapped: false,
      candidate: null,
      state: clearSnapState(),
      distance: nearest?.distance ?? null,
    }
  }

  return {
    value: nearest.candidate.value,
    snapped: true,
    candidate: nearest.candidate,
    state: {
      lockedCandidateId: nearest.candidate.id,
      escapeOffset: 0,
    },
    distance: nearest.distance,
  }
}
