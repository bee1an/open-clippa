import type { PersistedHandleMediaAsset, PersistedMediaAsset, PersistedProjectState, PersistedUrlMediaAsset } from './types'
import type { EditorContentSnapshot } from '@/history/editorContentSnapshot'
import type { AudioFile, ImageFile, VideoFile } from '@/store/useMediaStore'
import { toRaw } from 'vue'

const ASSET_TOKEN_PREFIX = 'asset://'

function cloneSnapshot(snapshot: EditorContentSnapshot): EditorContentSnapshot {
  return structuredClone(snapshot)
}

function buildPersistedUrlAsset(
  kind: PersistedUrlMediaAsset['kind'],
  source: VideoFile | AudioFile | ImageFile,
): PersistedUrlMediaAsset {
  return {
    id: source.id,
    kind,
    name: source.name,
    sourceType: 'url',
    url: source.url,
    size: source.size,
    createdAt: source.createdAt?.getTime(),
  }
}

function buildPersistedHandleAsset(
  kind: PersistedHandleMediaAsset['kind'],
  source: VideoFile | AudioFile | ImageFile,
): PersistedHandleMediaAsset | null {
  const rawHandle = source.fileHandle ? toRaw(source.fileHandle) : null
  if (!rawHandle)
    return null

  return {
    id: source.id,
    kind,
    name: source.name,
    sourceType: 'handle',
    handle: rawHandle,
    size: source.size,
    createdAt: source.createdAt?.getTime(),
  }
}

function mapVideoAsset(source: VideoFile): PersistedMediaAsset | null {
  if (source.sourceType === 'url')
    return buildPersistedUrlAsset('video', source)

  if (source.sourceType === 'handle')
    return buildPersistedHandleAsset('video', source)

  return null
}

function mapImageAsset(source: ImageFile): PersistedMediaAsset | null {
  if (source.sourceType === 'url')
    return buildPersistedUrlAsset('image', source)

  if (source.sourceType === 'handle')
    return buildPersistedHandleAsset('image', source)

  return null
}

function mapAudioAsset(source: AudioFile): PersistedMediaAsset | null {
  if (source.sourceType === 'url')
    return buildPersistedUrlAsset('audio', source)

  if (source.sourceType === 'handle')
    return buildPersistedHandleAsset('audio', source)

  return null
}

function toAssetToken(assetId: string): string {
  return `${ASSET_TOKEN_PREFIX}${assetId}`
}

function fromAssetToken(source: string): string | null {
  if (!source.startsWith(ASSET_TOKEN_PREFIX))
    return null

  const id = source.slice(ASSET_TOKEN_PREFIX.length)
  if (!id)
    return null
  return id
}

export function capturePersistedProjectState(input: {
  projectId: string
  canvasPresetId: string
  snapshot: EditorContentSnapshot
  videoAssets: VideoFile[]
  audioAssets: AudioFile[]
  imageAssets: ImageFile[]
}): PersistedProjectState {
  const persistedVideos = input.videoAssets
    .map(mapVideoAsset)
    .filter((asset): asset is PersistedMediaAsset => asset !== null)

  const persistedImages = input.imageAssets
    .map(mapImageAsset)
    .filter((asset): asset is PersistedMediaAsset => asset !== null)

  const persistedAudios = input.audioAssets
    .map(mapAudioAsset)
    .filter((asset): asset is PersistedMediaAsset => asset !== null)

  const localAssetUrlToId = new Map<string, string>()
  persistedVideos.forEach((asset) => {
    if (asset.sourceType !== 'handle')
      return

    const matched = input.videoAssets.find(item => item.id === asset.id)
    if (matched?.url)
      localAssetUrlToId.set(matched.url, asset.id)
  })
  persistedImages.forEach((asset) => {
    if (asset.sourceType !== 'handle')
      return

    const matched = input.imageAssets.find(item => item.id === asset.id)
    if (matched?.url)
      localAssetUrlToId.set(matched.url, asset.id)
  })
  persistedAudios.forEach((asset) => {
    if (asset.sourceType !== 'handle')
      return

    const matched = input.audioAssets.find(item => item.id === asset.id)
    if (matched?.url)
      localAssetUrlToId.set(matched.url, asset.id)
  })

  const tokenizedSnapshot = cloneSnapshot(input.snapshot)
  tokenizedSnapshot.performers = tokenizedSnapshot.performers.map((performer) => {
    if (!performer.src)
      return performer

    const assetId = localAssetUrlToId.get(performer.src)
    if (!assetId)
      return performer

    return {
      ...performer,
      src: toAssetToken(assetId),
    }
  })

  return {
    projectId: input.projectId,
    schemaVersion: 2,
    audioAssets: persistedAudios,
    savedAt: Date.now(),
    canvasPresetId: input.canvasPresetId,
    editorContentSnapshot: tokenizedSnapshot,
    videoAssets: persistedVideos,
    imageAssets: persistedImages,
  }
}

export function restoreSnapshotFromPersistedSources(
  snapshot: EditorContentSnapshot,
  resolveAssetUrlById: (assetId: string) => string | null,
): EditorContentSnapshot {
  const restored = cloneSnapshot(snapshot)

  restored.performers = restored.performers.map((performer) => {
    if (!performer.src)
      return performer

    const tokenId = fromAssetToken(performer.src)
    if (!tokenId)
      return performer

    const restoredUrl = resolveAssetUrlById(tokenId)
    if (!restoredUrl)
      return { ...performer, src: undefined }

    return {
      ...performer,
      src: restoredUrl,
    }
  })

  return restored
}
