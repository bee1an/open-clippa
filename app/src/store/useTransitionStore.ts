import type { TransitionSpec } from '@/utils/transition'
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { DEFAULT_GL_TRANSITION_TYPE, getGlTransitionDefaultParams } from '@/utils/glTransitions'
import { DEFAULT_TRANSITION_DURATION, buildTransitionPairKey } from '@/utils/transition'

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
    activeTransitionId.value = transition.id
    return transition
  }

  function updateTransition(id: string, patch: Partial<Omit<TransitionSpec, 'id'>>): void {
    const index = transitions.value.findIndex(item => item.id === id)
    if (index < 0)
      return

    const current = transitions.value[index]
    transitions.value[index] = {
      ...current,
      ...patch,
      durationMs: patch.durationMs !== undefined ? Math.max(0, patch.durationMs) : current.durationMs,
      params: patch.params !== undefined ? patch.params : current.params,
    }
  }

  function removeTransition(id: string): void {
    transitions.value = transitions.value.filter(item => item.id !== id)
    if (activeTransitionId.value === id)
      activeTransitionId.value = null
  }

  function selectTransition(id: string | null): void {
    activeTransitionId.value = id
  }

  return {
    transitions,
    activeTransitionId,
    activeTransition,
    transitionsSignature,
    createTransition,
    updateTransition,
    removeTransition,
    selectTransition,
    getTransitionByPair,
  }
})
