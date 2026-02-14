import type { EditorControlToolFactory } from './types'
import {
  normalizeLimit,
  toRecord,
} from './shared'

export const createQueryTools: EditorControlToolFactory = adapter => [
  {
    name: 'query_project_state',
    description: 'Query current project state including time, playback, and current selections.',
    jsonSchema: {
      type: 'object',
      properties: {},
      required: [],
      additionalProperties: false,
    },
    handler: async () => adapter.queryProjectState(),
  },
  {
    name: 'query_media_assets',
    description: 'Query media assets from the media library.',
    jsonSchema: {
      type: 'object',
      properties: {
        type: {
          type: 'string',
          enum: ['all', 'video', 'image'],
        },
        limit: {
          type: 'number',
        },
      },
      required: [],
      additionalProperties: false,
    },
    handler: async (rawInput) => {
      const input = toRecord(rawInput)
      const type = input.type === 'video' || input.type === 'image' || input.type === 'all'
        ? input.type
        : 'all'
      const limit = normalizeLimit(input.limit, 300, 300)

      return await adapter.queryMediaAssets({ type, limit })
    },
  },
  {
    name: 'query_performers',
    description: 'Query performer elements on canvas and timeline.',
    jsonSchema: {
      type: 'object',
      properties: {
        onlySelected: { type: 'boolean' },
        includeOffscreen: { type: 'boolean' },
        limit: { type: 'number' },
      },
      required: [],
      additionalProperties: false,
    },
    handler: async (rawInput) => {
      const input = toRecord(rawInput)
      const onlySelected = input.onlySelected === true
      const includeOffscreen = input.includeOffscreen !== false
      const limit = normalizeLimit(input.limit, 300, 300)

      return await adapter.queryPerformers({
        onlySelected,
        includeOffscreen,
        limit,
      })
    },
  },
  {
    name: 'query_timeline_items',
    description: 'Query timeline trains across all rails.',
    jsonSchema: {
      type: 'object',
      properties: {
        limit: { type: 'number' },
      },
      required: [],
      additionalProperties: false,
    },
    handler: async (rawInput) => {
      const input = toRecord(rawInput)
      const limit = normalizeLimit(input.limit, 500, 500)
      return await adapter.queryTimelineItems({ limit })
    },
  },
  {
    name: 'query_filter_layers',
    description: 'Query filter layers and active filter state.',
    jsonSchema: {
      type: 'object',
      properties: {},
      required: [],
      additionalProperties: false,
    },
    handler: async () => adapter.queryFilterLayers(),
  },
  {
    name: 'query_transition_candidates',
    description: 'Query transition candidates that can be created at adjacent cuts.',
    jsonSchema: {
      type: 'object',
      properties: {},
      required: [],
      additionalProperties: false,
    },
    handler: async () => adapter.queryTransitionCandidates(),
  },
  {
    name: 'query_transitions',
    description: 'Query all transitions in project.',
    jsonSchema: {
      type: 'object',
      properties: {},
      required: [],
      additionalProperties: false,
    },
    handler: async () => adapter.queryTransitions(),
  },
]
