import type { AiToolDefinition } from '@clippc/ai'
import {
  createEditorContextTools,
  createEditorControlTools,
} from '@clippc/ai'
import { createEditorControlRuntime } from '@/ai/control/runtime'
import { createEditorContextAdapter } from './editorContextAdapter'

export function resolveAppAiTools(): AiToolDefinition[] {
  const runtime = createEditorControlRuntime()

  return [
    ...createEditorContextTools(createEditorContextAdapter()),
    ...createEditorControlTools(runtime),
  ]
}
