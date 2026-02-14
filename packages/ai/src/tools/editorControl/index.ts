import type { AiToolDefinition } from '../../tooling/types'
import type { EditorControlAdapter } from './types'
import { createExportTools } from './exportTools'
import { createFilterTools } from './filterTools'
import { createMediaTools } from './mediaTools'
import { createPerformerTools } from './performerTools'
import { createQueryTools } from './queryTools'
import { createTimelineTools } from './timelineTools'
import { createTransitionTools } from './transitionTools'

export * from './types'

export function createEditorControlTools(adapter: EditorControlAdapter): AiToolDefinition[] {
  return [
    ...createQueryTools(adapter),
    ...createTimelineTools(adapter),
    ...createMediaTools(adapter),
    ...createPerformerTools(adapter),
    ...createFilterTools(adapter),
    ...createTransitionTools(adapter),
    ...createExportTools(adapter),
  ]
}
