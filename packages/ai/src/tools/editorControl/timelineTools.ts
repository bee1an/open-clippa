import type { EditorControlToolFactory } from './types'
import {
  asFiniteNumber,
  asOptionalFiniteNumber,
  asOptionalString,
  invalidArgument,
  toRecord,
} from './shared'

export const createTimelineTools: EditorControlToolFactory = adapter => [
  {
    name: 'timeline_play',
    description: 'Start timeline playback.',
    jsonSchema: {
      type: 'object',
      properties: {},
      required: [],
      additionalProperties: false,
    },
    handler: async () => adapter.timelinePlay(),
  },
  {
    name: 'timeline_pause',
    description: 'Pause timeline playback.',
    jsonSchema: {
      type: 'object',
      properties: {},
      required: [],
      additionalProperties: false,
    },
    handler: async () => adapter.timelinePause(),
  },
  {
    name: 'timeline_seek',
    description: 'Seek timeline to specified time in milliseconds.',
    jsonSchema: {
      type: 'object',
      properties: {
        timeMs: { type: 'number' },
      },
      required: ['timeMs'],
      additionalProperties: false,
    },
    handler: async (rawInput) => {
      const input = toRecord(rawInput)
      const timeMs = asFiniteNumber(input.timeMs)
      if (timeMs === null)
        return invalidArgument('timeMs must be a finite number')

      return await adapter.timelineSeek({ timeMs })
    },
  },
  {
    name: 'timeline_split_at_time',
    description: 'Split timeline items at the given time. Defaults to current cursor when omitted.',
    jsonSchema: {
      type: 'object',
      properties: {
        timeMs: { type: 'number' },
      },
      required: [],
      additionalProperties: false,
    },
    handler: async (rawInput) => {
      const input = toRecord(rawInput)
      const timeMs = asOptionalFiniteNumber(input.timeMs)
      return await adapter.timelineSplitAtTime({ timeMs })
    },
  },
  {
    name: 'timeline_delete_active_item',
    description: 'Delete the currently active timeline item.',
    jsonSchema: {
      type: 'object',
      properties: {},
      required: [],
      additionalProperties: false,
    },
    handler: async () => adapter.timelineDeleteActiveItem(),
  },
  {
    name: 'timeline_select_train',
    description: 'Select timeline train by train id.',
    jsonSchema: {
      type: 'object',
      properties: {
        trainId: { type: 'string' },
      },
      required: ['trainId'],
      additionalProperties: false,
    },
    handler: async (rawInput) => {
      const trainId = asOptionalString(toRecord(rawInput).trainId)
      if (!trainId)
        return invalidArgument('trainId is required')

      return await adapter.timelineSelectTrain({ trainId })
    },
  },
  {
    name: 'timeline_clear_selection',
    description: 'Clear active timeline train selection.',
    jsonSchema: {
      type: 'object',
      properties: {},
      required: [],
      additionalProperties: false,
    },
    handler: async () => adapter.timelineClearSelection(),
  },
]
