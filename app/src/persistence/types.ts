import type { EditorContentSnapshot } from '@/history/editorContentSnapshot'

export type PersistedMediaAssetKind = 'video' | 'image'
export type PersistedMediaSourceType = 'url' | 'handle'

export interface PersistedProjectMeta {
  id: string
  name: string
  createdAt: number
  updatedAt: number
  lastOpenedAt: number
  schemaVersion: number
}

interface PersistedMediaAssetBase {
  id: string
  kind: PersistedMediaAssetKind
  name: string
  sourceType: PersistedMediaSourceType
  size?: number
  createdAt?: number
}

export interface PersistedUrlMediaAsset extends PersistedMediaAssetBase {
  sourceType: 'url'
  url: string
}

export interface PersistedHandleMediaAsset extends PersistedMediaAssetBase {
  sourceType: 'handle'
  handle: FileSystemFileHandle
}

export type PersistedMediaAsset = PersistedUrlMediaAsset | PersistedHandleMediaAsset

export interface PersistedProjectState {
  projectId: string
  schemaVersion: number
  savedAt: number
  canvasPresetId: string
  editorContentSnapshot: EditorContentSnapshot
  videoAssets: PersistedMediaAsset[]
  imageAssets: PersistedMediaAsset[]
}
