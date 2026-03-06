import type { PersistedMediaAsset } from '@/persistence/types'
import { applyEditorContentSnapshot, captureEditorContentSnapshot } from '@/history/editorContentSnapshot'
import { isFileHandlePermissionError } from '@/persistence/fileSystemAccess'
import { capturePersistedProjectState, restoreSnapshotFromPersistedSources } from '@/persistence/projectSessionSerializer'
import { useEditorStore } from '@/store/useEditorStore'
import { useFilterStore } from '@/store/useFilterStore'
import { useHistoryStore } from '@/store/useHistoryStore'
import { useMediaStore } from '@/store/useMediaStore'
import { usePerformerStore } from '@/store/usePerformerStore'
import { useProjectStore } from '@/store/useProjectStore'
import { useTransitionStore } from '@/store/useTransitionStore'

const AUTO_SAVE_DELAY_MS = 800

function mapMediaAssetUrlById(): Map<string, string> {
  const mediaStore = useMediaStore()
  const map = new Map<string, string>()

  mediaStore.videoFiles.forEach((asset) => {
    map.set(asset.id, asset.url)
  })

  mediaStore.audioFiles.forEach((asset) => {
    map.set(asset.id, asset.url)
  })

  mediaStore.imageFiles.forEach((asset) => {
    map.set(asset.id, asset.url)
  })

  return map
}

async function restoreMediaAssets(
  assets: PersistedMediaAsset[],
  kind: 'video' | 'audio' | 'image',
  options: { requestPermission: boolean, onPermissionRequired: () => void },
): Promise<void> {
  const mediaStore = useMediaStore()

  for (let index = assets.length - 1; index >= 0; index -= 1) {
    const asset = assets[index]
    if (!asset)
      continue

    try {
      if (asset.sourceType === 'url') {
        if (kind === 'video')
          mediaStore.addVideoFromUrl(asset.url, asset.name, asset.id)
        else if (kind === 'audio')
          mediaStore.addAudioFromUrl(asset.url, asset.name, asset.id)
        else
          mediaStore.addImageFromUrl(asset.url, asset.name, asset.id)
        continue
      }

      if (kind === 'video')
        await mediaStore.addVideoFromFileHandle(asset.handle, { id: asset.id, requestPermission: options.requestPermission })
      else if (kind === 'audio')
        await mediaStore.addAudioFromFileHandle(asset.handle, { id: asset.id, requestPermission: options.requestPermission })
      else
        await mediaStore.addImageFromFileHandle(asset.handle, { id: asset.id, requestPermission: options.requestPermission })
    }
    catch (error) {
      if (isFileHandlePermissionError(error)) {
        options.onPermissionRequired()
        continue
      }

      console.warn(
        `[project-persistence] skip unreadable ${kind} asset "${asset.name}" (${asset.id})`,
        error,
      )
    }
  }
}

export function useProjectPersistence() {
  const projectStore = useProjectStore()
  const editorStore = useEditorStore()
  const performerStore = usePerformerStore()
  const filterStore = useFilterStore()
  const transitionStore = useTransitionStore()
  const mediaStore = useMediaStore()
  const historyStore = useHistoryStore()

  const isHydrating = ref(false)
  const requiresHandlePermission = ref(false)
  let initialized = false
  let saveTimer: ReturnType<typeof setTimeout> | null = null
  const stopHandles: Array<() => void> = []

  function clearSaveTimer(): void {
    if (saveTimer === null)
      return

    clearTimeout(saveTimer)
    saveTimer = null
  }

  async function saveNow(): Promise<void> {
    const projectId = projectStore.activeProjectId
    if (!projectId || isHydrating.value)
      return

    // Avoid overwriting persisted local-media state with a partial snapshot
    // before user grants permission to restore handle assets.
    if (requiresHandlePermission.value)
      return

    const snapshot = captureEditorContentSnapshot({
      editorStore,
      performerStore,
      filterStore,
      transitionStore,
    })

    const persisted = capturePersistedProjectState({
      projectId,
      canvasPresetId: editorStore.canvasPresetId,
      snapshot,
      videoAssets: mediaStore.videoFiles,
      audioAssets: mediaStore.audioFiles,
      imageAssets: mediaStore.imageFiles,
    })

    await projectStore.saveActiveProjectState(persisted)
  }

  function scheduleSave(): void {
    if (!projectStore.activeProjectId || isHydrating.value)
      return

    clearSaveTimer()
    saveTimer = setTimeout(() => {
      void saveNow()
    }, AUTO_SAVE_DELAY_MS)
  }

  async function flushSave(): Promise<void> {
    clearSaveTimer()
    await saveNow()
  }

  async function restoreActiveProject(options: { requestPermission?: boolean } = {}): Promise<void> {
    const { requestPermission = false } = options
    const projectId = projectStore.activeProjectId
    if (!projectId)
      return

    isHydrating.value = true
    requiresHandlePermission.value = false
    try {
      const persisted = await projectStore.loadActiveProjectState()
      if (!persisted)
        return

      let permissionRequired = false
      const markPermissionRequired = () => {
        permissionRequired = true
      }

      await editorStore.clippa.ready
      mediaStore.clearAllMedia()

      await restoreMediaAssets(persisted.videoAssets, 'video', {
        requestPermission,
        onPermissionRequired: markPermissionRequired,
      })
      await restoreMediaAssets(persisted.audioAssets ?? [], 'audio', {
        requestPermission,
        onPermissionRequired: markPermissionRequired,
      })
      await restoreMediaAssets(persisted.imageAssets, 'image', {
        requestPermission,
        onPermissionRequired: markPermissionRequired,
      })

      const assetUrlMap = mapMediaAssetUrlById()
      const restoredSnapshot = restoreSnapshotFromPersistedSources(
        persisted.editorContentSnapshot,
        assetId => assetUrlMap.get(assetId) ?? null,
      )

      editorStore.setCanvasPreset(persisted.canvasPresetId)
      await applyEditorContentSnapshot(restoredSnapshot, {
        editorStore,
        performerStore,
        filterStore,
        transitionStore,
      })

      requiresHandlePermission.value = permissionRequired
    }
    finally {
      isHydrating.value = false
    }
  }

  async function restoreWithUserPermission(): Promise<void> {
    await restoreActiveProject({ requestPermission: true })
  }

  function setupAutoSave(): void {
    const stopWatch = watch(
      () => [
        mediaStore.persistenceRevision,
        editorStore.canvasPresetId,
        performerStore.selectionRevision,
        performerStore.contentRevision,
        filterStore.layersSignature,
        filterStore.activeLayerId,
        transitionStore.transitionsSignature,
        transitionStore.activeTransitionId,
        transitionStore.activePairKey,
        historyStore.status.value.pastCount,
        historyStore.status.value.futureCount,
        historyStore.status.value.activeTransaction?.id ?? '',
      ],
      () => {
        scheduleSave()
      },
      {
        deep: false,
      },
    )

    const flushWithGuard = () => {
      if (!projectStore.activeProjectId || isHydrating.value)
        return

      void flushSave()
    }

    window.addEventListener('pagehide', flushWithGuard)
    window.addEventListener('beforeunload', flushWithGuard)

    stopHandles.push(() => {
      stopWatch()
      window.removeEventListener('pagehide', flushWithGuard)
      window.removeEventListener('beforeunload', flushWithGuard)
    })
  }

  async function initialize(): Promise<void> {
    if (initialized)
      return

    initialized = true
    setupAutoSave()
    await restoreActiveProject()
  }

  onUnmounted(() => {
    clearSaveTimer()
    stopHandles.forEach(stop => stop())
    stopHandles.splice(0, stopHandles.length)
  })

  return {
    isHydrating,
    requiresHandlePermission,
    initialize,
    flushSave,
    restoreActiveProject,
    restoreWithUserPermission,
  }
}
