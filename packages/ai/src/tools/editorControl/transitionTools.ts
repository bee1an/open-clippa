import type {
  EditorControlToolFactory,
  TransitionPatchInput,
} from './types'
import { transitionPatchSchema } from './schemas'
import {
  asOptionalBoolean,
  asOptionalFiniteNumber,
  asOptionalString,
  invalidArgument,
  isRecord,
  toRecord,
} from './shared'

export const createTransitionTools: EditorControlToolFactory = adapter => [
  {
    name: 'transition_select_pair',
    description: 'Select a transition candidate pair by from/to performer ids.',
    jsonSchema: {
      type: 'object',
      properties: {
        fromId: { type: 'string' },
        toId: { type: 'string' },
        toggle: { type: 'boolean' },
      },
      required: ['fromId', 'toId'],
      additionalProperties: false,
    },
    handler: async (rawInput) => {
      const input = toRecord(rawInput)
      const fromId = asOptionalString(input.fromId)
      const toId = asOptionalString(input.toId)

      if (!fromId || !toId)
        return invalidArgument('fromId and toId are required')

      return await adapter.transitionSelectPair({
        fromId,
        toId,
        toggle: asOptionalBoolean(input.toggle),
      })
    },
  },
  {
    name: 'transition_upsert_by_pair',
    description: 'Create or update transition by candidate pair.',
    jsonSchema: {
      type: 'object',
      properties: {
        fromId: { type: 'string' },
        toId: { type: 'string' },
        type: { type: 'string' },
        durationMs: { type: 'number' },
        params: {
          type: 'object',
          additionalProperties: true,
        },
      },
      required: ['fromId', 'toId'],
      additionalProperties: false,
    },
    handler: async (rawInput) => {
      const input = toRecord(rawInput)
      const fromId = asOptionalString(input.fromId)
      const toId = asOptionalString(input.toId)
      if (!fromId || !toId)
        return invalidArgument('fromId and toId are required')

      return await adapter.transitionUpsertByPair({
        fromId,
        toId,
        type: asOptionalString(input.type),
        durationMs: asOptionalFiniteNumber(input.durationMs),
        params: isRecord(input.params) ? input.params : undefined,
      })
    },
  },
  {
    name: 'transition_update',
    description: 'Update transition by transition id.',
    jsonSchema: {
      type: 'object',
      properties: {
        transitionId: { type: 'string' },
        patch: transitionPatchSchema,
      },
      required: ['transitionId', 'patch'],
      additionalProperties: false,
    },
    handler: async (rawInput) => {
      const input = toRecord(rawInput)
      const transitionId = asOptionalString(input.transitionId)
      if (!transitionId)
        return invalidArgument('transitionId is required')

      if (!isRecord(input.patch))
        return invalidArgument('patch must be an object')

      const patchInput = input.patch
      const patch: Record<string, unknown> = {}

      const fromId = asOptionalString(patchInput.fromId)
      if (fromId)
        patch.fromId = fromId

      const toId = asOptionalString(patchInput.toId)
      if (toId)
        patch.toId = toId

      const durationMs = asOptionalFiniteNumber(patchInput.durationMs)
      if (durationMs !== undefined)
        patch.durationMs = durationMs

      const type = asOptionalString(patchInput.type)
      if (type)
        patch.type = type

      if (patchInput.params !== undefined)
        patch.params = patchInput.params

      return await adapter.transitionUpdate({
        transitionId,
        patch: patch as TransitionPatchInput,
      })
    },
  },
  {
    name: 'transition_remove',
    description: 'Remove transition by transition id.',
    jsonSchema: {
      type: 'object',
      properties: {
        transitionId: { type: 'string' },
      },
      required: ['transitionId'],
      additionalProperties: false,
    },
    handler: async (rawInput) => {
      const transitionId = asOptionalString(toRecord(rawInput).transitionId)
      if (!transitionId)
        return invalidArgument('transitionId is required')

      return await adapter.transitionRemove({ transitionId })
    },
  },
  {
    name: 'transition_clear_selection',
    description: 'Clear active transition and pair selection.',
    jsonSchema: {
      type: 'object',
      properties: {},
      required: [],
      additionalProperties: false,
    },
    handler: async () => adapter.transitionClearSelection(),
  },
]
