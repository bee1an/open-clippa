import type { CanvasPerformer } from '@/store/usePerformerStore'
import { Video } from '@clippc/performer'
import { useEditorCommandActions } from '@/composables/useEditorCommandActions'
import { useMediaCropStore } from '@/store/useMediaCropStore'

export function useMediaCropSession() {
  const editorCommandActions = useEditorCommandActions()
  const mediaCropStore = useMediaCropStore()

  async function enterCropMode(performer: CanvasPerformer): Promise<void> {
    if (mediaCropStore.isActiveFor(performer.id))
      return

    if (mediaCropStore.activePerformerId)
      await exitCropMode()

    if (performer instanceof Video)
      await editorCommandActions.timelinePause()

    const beginResult = await editorCommandActions.historyBeginTransaction({
      source: 'ui',
      label: 'Adjust Media Crop',
    })

    let transactionId: string | null = null
    if (beginResult.ok) {
      transactionId = beginResult.data.transactionId
      await editorCommandActions.historyCheckpoint({
        source: 'ui',
        label: 'Adjust Media Crop Start',
      })
    }

    mediaCropStore.enter(performer.id, transactionId)
  }

  async function exitCropMode(): Promise<void> {
    const transactionId = mediaCropStore.activeTransactionId
    if (transactionId) {
      await editorCommandActions.historyCheckpoint({
        source: 'ui',
        label: 'Adjust Media Crop End',
      })
      await editorCommandActions.historyEndTransaction(transactionId)
    }

    mediaCropStore.exit()
  }

  async function applyStandaloneCropMutation(label: string, mutate: () => void): Promise<void> {
    const beginResult = await editorCommandActions.historyBeginTransaction({
      source: 'ui',
      label,
    })

    if (!beginResult.ok) {
      mutate()
      return
    }

    await editorCommandActions.historyCheckpoint({
      source: 'ui',
      label: `${label} Start`,
    })
    mutate()
    await editorCommandActions.historyCheckpoint({
      source: 'ui',
      label: `${label} End`,
    })
    await editorCommandActions.historyEndTransaction(beginResult.data.transactionId)
  }

  return {
    mediaCropStore,
    enterCropMode,
    exitCropMode,
    applyStandaloneCropMutation,
  }
}
