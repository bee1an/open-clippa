import { EditorCommandBus } from '@clippc/history'

export { EditorCommandBus }
export * from '@clippc/history'

let sharedEditorCommandBus: EditorCommandBus | null = null

export function getEditorCommandBus(): EditorCommandBus {
  if (!sharedEditorCommandBus)
    sharedEditorCommandBus = new EditorCommandBus()

  return sharedEditorCommandBus
}

export function resetEditorCommandBusForTesting(): void {
  if (!sharedEditorCommandBus)
    return

  sharedEditorCommandBus.resetForTesting()
  sharedEditorCommandBus = null
}
