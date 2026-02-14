import type { EditorControlToolFactory } from './types'
import {
  asOptionalFiniteNumber,
  asOptionalString,
  toRecord,
} from './shared'

export const createExportTools: EditorControlToolFactory = adapter => [
  {
    name: 'export_start',
    description: 'Start a new export task.',
    jsonSchema: {
      type: 'object',
      properties: {
        frameRate: { type: 'number' },
        filename: { type: 'string' },
      },
      required: [],
      additionalProperties: false,
    },
    handler: async (rawInput) => {
      const input = toRecord(rawInput)
      return await adapter.exportStart({
        frameRate: asOptionalFiniteNumber(input.frameRate),
        filename: asOptionalString(input.filename),
      })
    },
  },
  {
    name: 'export_cancel',
    description: 'Cancel export task. If jobId is omitted, cancels current task.',
    jsonSchema: {
      type: 'object',
      properties: {
        jobId: { type: 'string' },
      },
      required: [],
      additionalProperties: false,
    },
    handler: async (rawInput) => {
      const jobId = asOptionalString(toRecord(rawInput).jobId)
      return await adapter.exportCancel({ jobId })
    },
  },
  {
    name: 'export_get_status',
    description: 'Query export task status and progress.',
    jsonSchema: {
      type: 'object',
      properties: {},
      required: [],
      additionalProperties: false,
    },
    handler: async () => adapter.exportGetStatus(),
  },
]
