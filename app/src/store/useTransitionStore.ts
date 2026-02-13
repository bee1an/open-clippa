import type { TransitionManagerSnapshot, TransitionSpec } from '@clippc/transition'
import {
  DEFAULT_TRANSITION_DURATION,
  TransitionManager,
} from '@clippc/transition'
import { defineStore } from 'pinia'
import { computed, markRaw, ref } from 'vue'

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
  const manager = markRaw(new TransitionManager())

  const transitions = ref<TransitionSpec[]>([])
  const activeTransitionId = ref<string | null>(null)
  const activePairKey = ref<string | null>(null)
  const transitionsSignature = ref('')

  const activeTransition = computed(() => {
    if (!activeTransitionId.value)
      return null

    return transitions.value.find(item => item.id === activeTransitionId.value) ?? null
  })

  const syncSnapshot = (snapshot: TransitionManagerSnapshot): void => {
    transitions.value = snapshot.transitions
    activeTransitionId.value = snapshot.activeTransitionId
    activePairKey.value = snapshot.activePairKey
    transitionsSignature.value = snapshot.transitionsSignature
  }

  syncSnapshot(manager.getSnapshot())
  manager.on('change', syncSnapshot)

  function getTransitionByPair(fromId: string, toId: string): TransitionSpec | null {
    return manager.getTransitionByPair(fromId, toId)
  }

  function createTransition(input: TransitionCreateInput): TransitionSpec {
    return manager.createTransition(input)
  }

  function updateTransition(id: string, patch: Partial<Omit<TransitionSpec, 'id'>>): void {
    manager.updateTransition(id, patch)
  }

  function removeTransition(id: string): void {
    manager.removeTransition(id)
  }

  function selectTransition(id: string | null): void {
    manager.selectTransition(id)
  }

  function selectPair(fromId: string, toId: string, toggle: boolean = false): void {
    manager.selectPair(fromId, toId, toggle)
  }

  function clearActiveSelection(): void {
    manager.clearActiveSelection()
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
