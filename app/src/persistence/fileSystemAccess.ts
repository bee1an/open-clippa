const MEDIA_PICKER_TYPES = [
  {
    description: 'Media Files',
    accept: {
      'video/*': ['.mp4', '.mov', '.mkv', '.webm', '.avi', '.m4v'],
      'image/*': ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.bmp', '.svg', '.heic'],
    },
  },
]

interface PickerWindow extends Window {
  showOpenFilePicker?: (options?: {
    multiple?: boolean
    types?: ReadonlyArray<{
      description?: string
      accept: Record<string, string[]>
    }>
    excludeAcceptAllOption?: boolean
  }) => Promise<FileSystemFileHandle[]>
}

interface PermissionCapableFileHandle extends FileSystemFileHandle {
  queryPermission: (descriptor?: { mode?: 'read' | 'readwrite' }) => Promise<PermissionState>
  requestPermission: (descriptor?: { mode?: 'read' | 'readwrite' }) => Promise<PermissionState>
}

function resolvePickerWindow(): PickerWindow | null {
  if (typeof window === 'undefined')
    return null

  return window as PickerWindow
}

export function isFileSystemAccessSupported(): boolean {
  if (typeof window === 'undefined')
    return false

  const pickerWindow = resolvePickerWindow()
  return Boolean(
    globalThis.isSecureContext
    && typeof globalThis.indexedDB !== 'undefined'
    && typeof pickerWindow?.showOpenFilePicker === 'function'
    && typeof FileSystemFileHandle !== 'undefined',
  )
}

export async function pickMediaFileHandles(): Promise<FileSystemFileHandle[]> {
  const pickerWindow = resolvePickerWindow()
  const showOpenFilePicker = pickerWindow?.showOpenFilePicker
  if (typeof showOpenFilePicker !== 'function')
    throw new Error('File System Access API is not available')

  const handles = await showOpenFilePicker({
    multiple: true,
    types: MEDIA_PICKER_TYPES,
    excludeAcceptAllOption: false,
  })

  return handles.filter(handle => handle.kind === 'file')
}

export async function ensureFileHandleReadable(handle: FileSystemFileHandle): Promise<boolean> {
  const permissionHandle = handle as unknown as PermissionCapableFileHandle
  const descriptor = { mode: 'read' } as const

  if (typeof permissionHandle.queryPermission !== 'function' || typeof permissionHandle.requestPermission !== 'function')
    return true

  const query = await permissionHandle.queryPermission(descriptor)
  if (query === 'granted')
    return true

  const request = await permissionHandle.requestPermission(descriptor)
  return request === 'granted'
}

export async function readFileFromHandle(handle: FileSystemFileHandle): Promise<File> {
  const granted = await ensureFileHandleReadable(handle)
  if (!granted)
    throw new Error(`Permission denied for file handle: ${handle.name}`)

  return await handle.getFile()
}
