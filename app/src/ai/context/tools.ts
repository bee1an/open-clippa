import type { AiToolDefinition } from '@clippc/ai'
import { createEditorContextTools } from '@clippc/ai'
import { createEditorContextAdapter } from './editorContextAdapter'

export function resolveAppAiTools(): AiToolDefinition[] {
  return createEditorContextTools(createEditorContextAdapter())
}
