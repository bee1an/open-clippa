import type { TransitionSpec } from '@/utils/transition'
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { DEFAULT_GL_TRANSITION_TYPE, getGlTransitionDefaultParams } from '@/utils/glTransitions'
import { buildTransitionPairKey, DEFAULT_TRANSITION_DURATION } from '@/utils/transition'

export type { TransitionSpec }
export { DEFAULT_TRANSITION_DURATION }

interface TransitionCreateInput {
  fromId: string
  toId: string
  type?: string
  params?: Record<string, unknown>
  durationMs?: number
}

export const useTransitionStore = defineStore('transition', () => {
  const transitions = ref<TransitionSpec[]>([])
  const activeTransitionId = ref<string | null>(null)
  const activePairKey = ref<string | null>(null)

  const activeTransition = computed(() => {
    if (!activeTransitionId.value)
      return null

    return transitions.value.find(item => item.id === activeTransitionId.value) ?? null
  })

  const transitionsSignature = computed(() => {
    return transitions.value
      .map(item => `${item.id}:${item.fromId}:${item.toId}:${item.durationMs}:${item.type}:${JSON.stringify(item.params)}`)
      .join('|')
  })

  function buildTransitionId(): string {
    return `transition-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  }

  function getTransitionByPair(fromId: string, toId: string): TransitionSpec | null {
    const pairKey = buildTransitionPairKey(fromId, toId)
    return transitions.value.find(item => buildTransitionPairKey(item.fromId, item.toId) === pairKey) ?? null
  }

  function createTransition(input: TransitionCreateInput): TransitionSpec {
    const transitionType = input.type ?? DEFAULT_GL_TRANSITION_TYPE
    const transition: TransitionSpec = {
      id: buildTransitionId(),
      fromId: input.fromId,
      toId: input.toId,
      durationMs: Math.max(0, input.durationMs ?? DEFAULT_TRANSITION_DURATION),
      type: transitionType,
      params: input.params ?? getGlTransitionDefaultParams(transitionType),
    }

    transitions.value.push(transition)
    activePairKey.value = buildTransitionPairKey(transition.fromId, transition.toId)
    activeTransitionId.value = transition.id
    return transition
  }

  function updateTransition(id: string, patch: Partial<Omit<TransitionSpec, 'id'>>): void {
    const index = transitions.value.findIndex(item => item.id === id)
    if (index < 0)
      return

    const current = transitions.value[index]
    const next = {
      ...current,
      ...patch,
      durationMs: patch.durationMs !== undefined ? Math.max(0, patch.durationMs) : current.durationMs,
      params: patch.params !== undefined ? patch.params : current.params,
    }
    transitions.value[index] = next

    if (activeTransitionId.value === id) {
      activePairKey.value = buildTransitionPairKey(next.fromId, next.toId)
    }
  }

  function removeTransition(id: string): void {
    transitions.value = transitions.value.filter(item => item.id !== id)
    if (activeTransitionId.value === id)
      activeTransitionId.value = null
  }

  function selectTransition(id: string | null): void {
    if (!id) {
      activeTransitionId.value = null
      return
    }

    const selected = transitions.value.find(item => item.id === id)
    if (!selected) {
      activeTransitionId.value = null
      return
    }

    activePairKey.value = buildTransitionPairKey(selected.fromId, selected.toId)
    activeTransitionId.value = id
  }

  function selectPair(fromId: string, toId: string, toggle: boolean = false): void {
    const pairKey = buildTransitionPairKey(fromId, toId)
    if (toggle && activePairKey.value === pairKey) {
      clearActiveSelection()
      return
    }

    activePairKey.value = pairKey
    const existing = getTransitionByPair(fromId, toId)
    activeTransitionId.value = existing?.id ?? null
  }

  function clearActiveSelection(): void {
    activeTransitionId.value = null
    activePairKey.value = null
  }

  return {
    transitions,
    activeTransitionId,
    activePairKey,
    activeTransition,
    transitionsSignature,
    createTransition,
    updateTransition,
    removeTransition,
    selectTransition,
    selectPair,
    clearActiveSelection,
    getTransitionByPair,
  }
})
