import type { TransitionSpec } from './transition'
import { EventBus } from '@clippc/utils'
import { DEFAULT_GL_TRANSITION_TYPE, getGlTransitionDefaultParams } from './glTransitions'
import { buildTransitionPairKey, DEFAULT_TRANSITION_DURATION } from './transition'

export interface TransitionManagerSnapshot {
  transitions: TransitionSpec[]
  activeTransitionId: string | null
  activePairKey: string | null
  activeTransition: TransitionSpec | null
  transitionsSignature: string
}

export type TransitionManagerEvents = {
  change: [TransitionManagerSnapshot]
}

export interface TransitionCreateInput {
  fromId: string
  toId: string
  type?: string
  params?: Record<string, unknown>
  durationMs?: number
}

export class TransitionManager extends EventBus<TransitionManagerEvents> {
  private transitions: TransitionSpec[] = []
  private activeTransitionId: string | null = null
  private activePairKey: string | null = null

  private buildTransitionId(): string {
    return `transition-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  }

  private buildTransitionsSignature(): string {
    return this.transitions
      .map(item => `${item.id}:${item.fromId}:${item.toId}:${item.durationMs}:${item.type}:${JSON.stringify(item.params)}`)
      .join('|')
  }

  private cloneTransition(transition: TransitionSpec): TransitionSpec {
    return {
      ...transition,
      params: { ...transition.params },
    }
  }

  private emitChange(): void {
    this.emit('change', this.getSnapshot())
  }

  subscribe(callback: (snapshot: TransitionManagerSnapshot) => void): () => void {
    this.on('change', callback)
    return () => this.off('change', callback)
  }

  getSnapshot(): TransitionManagerSnapshot {
    const transitions = this.transitions.map(transition => this.cloneTransition(transition))
    const activeTransition = this.activeTransitionId
      ? transitions.find(item => item.id === this.activeTransitionId) ?? null
      : null

    return {
      transitions,
      activeTransitionId: this.activeTransitionId,
      activePairKey: this.activePairKey,
      activeTransition,
      transitionsSignature: this.buildTransitionsSignature(),
    }
  }

  getTransitionByPair(fromId: string, toId: string): TransitionSpec | null {
    const pairKey = buildTransitionPairKey(fromId, toId)
    const matched = this.transitions.find(item => buildTransitionPairKey(item.fromId, item.toId) === pairKey)
    return matched ? this.cloneTransition(matched) : null
  }

  createTransition(input: TransitionCreateInput): TransitionSpec {
    const transitionType = input.type ?? DEFAULT_GL_TRANSITION_TYPE
    const transition: TransitionSpec = {
      id: this.buildTransitionId(),
      fromId: input.fromId,
      toId: input.toId,
      durationMs: Math.max(0, input.durationMs ?? DEFAULT_TRANSITION_DURATION),
      type: transitionType,
      params: input.params ?? getGlTransitionDefaultParams(transitionType),
    }

    this.transitions.push(transition)
    this.activePairKey = buildTransitionPairKey(transition.fromId, transition.toId)
    this.activeTransitionId = transition.id
    this.emitChange()

    return this.cloneTransition(transition)
  }

  updateTransition(id: string, patch: Partial<Omit<TransitionSpec, 'id'>>): void {
    const index = this.transitions.findIndex(item => item.id === id)
    if (index < 0)
      return

    const current = this.transitions[index]
    const next: TransitionSpec = {
      ...current,
      ...patch,
      durationMs: patch.durationMs !== undefined ? Math.max(0, patch.durationMs) : current.durationMs,
      params: patch.params !== undefined ? patch.params : current.params,
    }

    this.transitions[index] = next

    if (this.activeTransitionId === id)
      this.activePairKey = buildTransitionPairKey(next.fromId, next.toId)

    this.emitChange()
  }

  removeTransition(id: string): void {
    const nextTransitions = this.transitions.filter(item => item.id !== id)
    if (nextTransitions.length === this.transitions.length)
      return

    this.transitions = nextTransitions
    if (this.activeTransitionId === id)
      this.activeTransitionId = null

    this.emitChange()
  }

  selectTransition(id: string | null): void {
    if (!id) {
      if (this.activeTransitionId !== null) {
        this.activeTransitionId = null
        this.emitChange()
      }
      return
    }

    const selected = this.transitions.find(item => item.id === id)
    if (!selected) {
      if (this.activeTransitionId !== null) {
        this.activeTransitionId = null
        this.emitChange()
      }
      return
    }

    this.activePairKey = buildTransitionPairKey(selected.fromId, selected.toId)
    this.activeTransitionId = id
    this.emitChange()
  }

  selectPair(fromId: string, toId: string, toggle: boolean = false): void {
    const pairKey = buildTransitionPairKey(fromId, toId)
    if (toggle && this.activePairKey === pairKey) {
      this.clearActiveSelection()
      return
    }

    this.activePairKey = pairKey
    const existing = this.transitions.find(item => buildTransitionPairKey(item.fromId, item.toId) === pairKey)
    this.activeTransitionId = existing?.id ?? null
    this.emitChange()
  }

  clearActiveSelection(): void {
    if (this.activeTransitionId === null && this.activePairKey === null)
      return

    this.activeTransitionId = null
    this.activePairKey = null
    this.emitChange()
  }
}
