import type { EditorControlToolFactory } from './types'

export const createHistoryTools: EditorControlToolFactory = adapter => [
  {
    name: 'history_get_status',
    description: 'Get undo/redo availability and stack counters.',
    jsonSchema: {
      type: 'object',
      properties: {},
      required: [],
      additionalProperties: false,
    },
    handler: async () => {
      return await adapter.historyGetStatus()
    },
  },
  {
    name: 'history_undo',
    description: 'Undo the latest content edit step.',
    jsonSchema: {
      type: 'object',
      properties: {},
      required: [],
      additionalProperties: false,
    },
    handler: async () => {
      return await adapter.historyUndo()
    },
  },
  {
    name: 'history_redo',
    description: 'Redo the latest undone content edit step.',
    jsonSchema: {
      type: 'object',
      properties: {},
      required: [],
      additionalProperties: false,
    },
    handler: async () => {
      return await adapter.historyRedo()
    },
  },
]
