import { defineStore } from 'pinia'

export const useMediaCropStore = defineStore('media-crop', () => {
  const activePerformerId = ref<string | null>(null)
  const activeTransactionId = ref<string | null>(null)

  function enter(performerId: string, transactionId: string | null = null): void {
    activePerformerId.value = performerId
    activeTransactionId.value = transactionId
  }

  function exit(): void {
    activePerformerId.value = null
    activeTransactionId.value = null
  }

  function isActiveFor(performerId: string | null | undefined): boolean {
    return Boolean(performerId) && activePerformerId.value === performerId
  }

  return {
    activePerformerId,
    activeTransactionId,
    enter,
    exit,
    isActiveFor,
  }
})
