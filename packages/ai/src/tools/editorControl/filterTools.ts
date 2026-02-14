import type { EditorControlToolFactory } from './types'
import {
  FILTER_PRESET_ENUM,
  filterConfigPatchSchema,
} from './schemas'
import {
  asOptionalFiniteNumber,
  asOptionalString,
  invalidArgument,
  isRecord,
  toRecord,
} from './shared'

export const createFilterTools: EditorControlToolFactory = adapter => [
  {
    name: 'filter_create_layer',
    description: 'Create a new filter layer on timeline from built-in presets only.',
    jsonSchema: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        startMs: { type: 'number' },
        durationMs: { type: 'number' },
        zIndex: { type: 'number' },
        preset: {
          type: 'string',
          enum: [...FILTER_PRESET_ENUM],
        },
      },
      required: ['preset'],
      additionalProperties: false,
    },
    handler: async (rawInput) => {
      const input = toRecord(rawInput)
      if (input.config !== undefined)
        return invalidArgument('config is not supported; use preset only')

      const preset = asOptionalString(input.preset)
      if (!preset)
        return invalidArgument('preset is required')

      if (!FILTER_PRESET_ENUM.includes(preset as (typeof FILTER_PRESET_ENUM)[number]))
        return invalidArgument(`Unsupported filter preset: ${preset}`)

      return await adapter.filterCreateLayer({
        name: asOptionalString(input.name),
        startMs: asOptionalFiniteNumber(input.startMs),
        durationMs: asOptionalFiniteNumber(input.durationMs),
        zIndex: asOptionalFiniteNumber(input.zIndex),
        preset,
      })
    },
  },
  {
    name: 'filter_select_layer',
    description: 'Select filter layer by layer id.',
    jsonSchema: {
      type: 'object',
      properties: {
        layerId: { type: 'string' },
      },
      required: ['layerId'],
      additionalProperties: false,
    },
    handler: async (rawInput) => {
      const layerId = asOptionalString(toRecord(rawInput).layerId)
      if (!layerId)
        return invalidArgument('layerId is required')

      return await adapter.filterSelectLayer({ layerId })
    },
  },
  {
    name: 'filter_update_config',
    description: 'Update filter layer config patch.',
    jsonSchema: {
      type: 'object',
      properties: {
        layerId: { type: 'string' },
        patch: filterConfigPatchSchema,
      },
      required: ['layerId', 'patch'],
      additionalProperties: false,
    },
    handler: async (rawInput) => {
      const input = toRecord(rawInput)
      const layerId = asOptionalString(input.layerId)
      if (!layerId)
        return invalidArgument('layerId is required')

      if (!isRecord(input.patch))
        return invalidArgument('patch must be an object')

      return await adapter.filterUpdateConfig({
        layerId,
        patch: input.patch,
      })
    },
  },
  {
    name: 'filter_reset_config',
    description: 'Reset filter layer config to default values.',
    jsonSchema: {
      type: 'object',
      properties: {
        layerId: { type: 'string' },
      },
      required: ['layerId'],
      additionalProperties: false,
    },
    handler: async (rawInput) => {
      const layerId = asOptionalString(toRecord(rawInput).layerId)
      if (!layerId)
        return invalidArgument('layerId is required')

      return await adapter.filterResetConfig({ layerId })
    },
  },
  {
    name: 'filter_update_z_index',
    description: 'Update filter layer z-index.',
    jsonSchema: {
      type: 'object',
      properties: {
        layerId: { type: 'string' },
        zIndex: { type: 'number' },
      },
      required: ['layerId', 'zIndex'],
      additionalProperties: false,
    },
    handler: async (rawInput) => {
      const input = toRecord(rawInput)
      const layerId = asOptionalString(input.layerId)
      const zIndex = asOptionalFiniteNumber(input.zIndex)

      if (!layerId)
        return invalidArgument('layerId is required')

      if (zIndex === undefined)
        return invalidArgument('zIndex must be a finite number')

      return await adapter.filterUpdateZIndex({ layerId, zIndex })
    },
  },
  {
    name: 'filter_remove_layer',
    description: 'Remove filter layer by layer id.',
    jsonSchema: {
      type: 'object',
      properties: {
        layerId: { type: 'string' },
      },
      required: ['layerId'],
      additionalProperties: false,
    },
    handler: async (rawInput) => {
      const layerId = asOptionalString(toRecord(rawInput).layerId)
      if (!layerId)
        return invalidArgument('layerId is required')

      return await adapter.filterRemoveLayer({ layerId })
    },
  },
]
