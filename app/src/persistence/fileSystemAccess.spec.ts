import { describe, expect, it, vi } from 'vitest'
import { ensureFileHandleReadable, FileHandlePermissionError, isFileHandlePermissionError, readFileFromHandle } from './fileSystemAccess'

function createMockFile(name: string, type: string, content: string = 'content'): File {
  if (typeof File !== 'undefined')
    return new File([content], name, { type })

  const blob = new Blob([content], { type }) as File & { name?: string }
  Object.defineProperty(blob, 'name', { value: name })
  return blob as File
}

function createHandle(options: {
  queryPermission: PermissionState
  requestPermission?: PermissionState
  requestError?: unknown
}): FileSystemFileHandle & {
  queryPermission: ReturnType<typeof vi.fn>
  requestPermission: ReturnType<typeof vi.fn>
} {
  const queryPermission = vi.fn(async () => options.queryPermission)
  const requestPermission = vi.fn(async () => {
    if (options.requestError)
      throw options.requestError
    return options.requestPermission ?? 'granted'
  })

  return {
    kind: 'file',
    name: 'clip.mp4',
    queryPermission,
    requestPermission,
    getFile: vi.fn(async () => createMockFile('clip.mp4', 'video/mp4')),
  } as unknown as FileSystemFileHandle & {
    queryPermission: ReturnType<typeof vi.fn>
    requestPermission: ReturnType<typeof vi.fn>
  }
}

describe('fileSystemAccess', () => {
  it('does not request permission when requestPermission is disabled', async () => {
    const handle = createHandle({
      queryPermission: 'prompt',
      requestPermission: 'granted',
    })

    const granted = await ensureFileHandleReadable(handle, { requestPermission: false })
    expect(granted).toBe(false)
    expect(handle.requestPermission).not.toHaveBeenCalled()
  })

  it('throws permission error when consent is required in passive mode', async () => {
    const handle = createHandle({
      queryPermission: 'prompt',
      requestPermission: 'granted',
    })

    await expect(readFileFromHandle(handle, { requestPermission: false })).rejects.toMatchObject({
      name: 'FileHandlePermissionError',
      reason: 'requires-user-consent',
    })
  })

  it('throws denied permission error when active permission request is rejected', async () => {
    const handle = createHandle({
      queryPermission: 'prompt',
      requestPermission: 'denied',
    })

    await expect(readFileFromHandle(handle)).rejects.toMatchObject({
      name: 'FileHandlePermissionError',
      reason: 'denied',
    })
  })

  it('maps SecurityError request failures to user-consent error', async () => {
    const handle = createHandle({
      queryPermission: 'prompt',
      requestError: new DOMException('user activation required', 'SecurityError'),
    })

    await expect(readFileFromHandle(handle)).rejects.toMatchObject({
      name: 'FileHandlePermissionError',
      reason: 'requires-user-consent',
    })
  })

  it('exposes permission error type guard', () => {
    const error = new FileHandlePermissionError('requires-user-consent', 'permission required')
    expect(isFileHandlePermissionError(error)).toBe(true)
    expect(isFileHandlePermissionError(new Error('other'))).toBe(false)
  })
})
