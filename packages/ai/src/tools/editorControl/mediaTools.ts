import type { EditorControlToolFactory } from './types'
import {
  asFiniteNumber,
  asOptionalFiniteNumber,
  asOptionalString,
  invalidArgument,
  toRecord,
} from './shared'

const RANDOM_ORIENTATION_VALUES = ['landscape', 'portrait', 'square'] as const
const RANDOM_ORIENTATION_SET = new Set<string>(RANDOM_ORIENTATION_VALUES)

function parseOptionalOrientation(value: unknown): {
  ok: true
  value?: typeof RANDOM_ORIENTATION_VALUES[number]
} | {
  ok: false
  message: string
} {
  if (value === undefined)
    return { ok: true }

  const orientation = asOptionalString(value)
  if (!orientation || !RANDOM_ORIENTATION_SET.has(orientation)) {
    return {
      ok: false,
      message: `orientation must be one of: ${RANDOM_ORIENTATION_VALUES.join(', ')}`,
    }
  }

  return {
    ok: true,
    value: orientation as typeof RANDOM_ORIENTATION_VALUES[number],
  }
}

function parseOptionalFinite(
  value: unknown,
  fieldName: string,
): { ok: true, value?: number } | { ok: false, message: string } {
  if (value === undefined)
    return { ok: true }

  const parsed = asFiniteNumber(value)
  if (parsed === null) {
    return {
      ok: false,
      message: `${fieldName} must be a finite number`,
    }
  }

  return {
    ok: true,
    value: parsed,
  }
}

export const createMediaTools: EditorControlToolFactory = adapter => [
  {
    name: 'media_add_asset_to_timeline',
    description: 'Add an existing media asset from media library to timeline.',
    jsonSchema: {
      type: 'object',
      properties: {
        assetId: { type: 'string' },
        startMs: { type: 'number' },
        durationMs: { type: 'number' },
        x: { type: 'number' },
        y: { type: 'number' },
        zIndex: { type: 'number' },
      },
      required: ['assetId'],
      additionalProperties: false,
    },
    handler: async (rawInput) => {
      const input = toRecord(rawInput)
      const assetId = asOptionalString(input.assetId)
      if (!assetId)
        return invalidArgument('assetId is required')

      return await adapter.mediaAddAssetToTimeline({
        assetId,
        startMs: asOptionalFiniteNumber(input.startMs),
        durationMs: asOptionalFiniteNumber(input.durationMs),
        x: asOptionalFiniteNumber(input.x),
        y: asOptionalFiniteNumber(input.y),
        zIndex: asOptionalFiniteNumber(input.zIndex),
      })
    },
  },
  {
    name: 'media_import_video_from_url',
    description: 'Import a video asset from remote URL into media library.',
    jsonSchema: {
      type: 'object',
      properties: {
        url: { type: 'string' },
        name: { type: 'string' },
      },
      required: ['url'],
      additionalProperties: false,
    },
    handler: async (rawInput) => {
      const input = toRecord(rawInput)
      const url = asOptionalString(input.url)
      if (!url)
        return invalidArgument('url is required')

      return await adapter.mediaImportVideoFromUrl({
        url,
        name: asOptionalString(input.name),
      })
    },
  },
  {
    name: 'media_import_random_image',
    description: 'Import a random image from Pexels into media library.',
    jsonSchema: {
      type: 'object',
      properties: {
        query: { type: 'string' },
        orientation: {
          type: 'string',
          enum: RANDOM_ORIENTATION_VALUES,
        },
        name: { type: 'string' },
      },
      required: [],
      additionalProperties: false,
    },
    handler: async (rawInput) => {
      const input = toRecord(rawInput)
      const orientation = parseOptionalOrientation(input.orientation)
      if (!orientation.ok)
        return invalidArgument(orientation.message)

      return await adapter.mediaImportRandomImage({
        query: asOptionalString(input.query),
        orientation: orientation.value,
        name: asOptionalString(input.name),
      })
    },
  },
  {
    name: 'media_import_random_video',
    description: 'Import a random video from Pexels into media library.',
    jsonSchema: {
      type: 'object',
      properties: {
        query: { type: 'string' },
        orientation: {
          type: 'string',
          enum: RANDOM_ORIENTATION_VALUES,
        },
        minDurationSec: { type: 'number' },
        maxDurationSec: { type: 'number' },
        name: { type: 'string' },
      },
      required: [],
      additionalProperties: false,
    },
    handler: async (rawInput) => {
      const input = toRecord(rawInput)
      const orientation = parseOptionalOrientation(input.orientation)
      if (!orientation.ok)
        return invalidArgument(orientation.message)

      const minDuration = parseOptionalFinite(input.minDurationSec, 'minDurationSec')
      if (!minDuration.ok)
        return invalidArgument(minDuration.message)
      if (minDuration.value !== undefined && minDuration.value < 0)
        return invalidArgument('minDurationSec must be >= 0')

      const maxDuration = parseOptionalFinite(input.maxDurationSec, 'maxDurationSec')
      if (!maxDuration.ok)
        return invalidArgument(maxDuration.message)
      if (maxDuration.value !== undefined && maxDuration.value < 0)
        return invalidArgument('maxDurationSec must be >= 0')

      if (
        minDuration.value !== undefined
        && maxDuration.value !== undefined
        && maxDuration.value < minDuration.value
      ) {
        return invalidArgument('maxDurationSec must be >= minDurationSec')
      }

      return await adapter.mediaImportRandomVideo({
        query: asOptionalString(input.query),
        orientation: orientation.value,
        minDurationSec: minDuration.value,
        maxDurationSec: maxDuration.value,
        name: asOptionalString(input.name),
      })
    },
  },
  {
    name: 'media_pick_random_asset',
    description: 'Pick one random asset from current media library by type.',
    jsonSchema: {
      type: 'object',
      properties: {
        type: {
          type: 'string',
          enum: ['all', 'video', 'image'],
        },
      },
      required: [],
      additionalProperties: false,
    },
    handler: async (rawInput) => {
      const input = toRecord(rawInput)
      if (
        input.type !== undefined
        && input.type !== 'all'
        && input.type !== 'video'
        && input.type !== 'image'
      ) {
        return invalidArgument('type must be one of: all, video, image')
      }

      const type = input.type === 'video' || input.type === 'image' || input.type === 'all'
        ? input.type
        : 'all'

      return await adapter.mediaPickRandomAsset({ type })
    },
  },
  {
    name: 'media_remove_asset',
    description: 'Remove an asset from media library by id.',
    jsonSchema: {
      type: 'object',
      properties: {
        assetId: { type: 'string' },
      },
      required: ['assetId'],
      additionalProperties: false,
    },
    handler: async (rawInput) => {
      const assetId = asOptionalString(toRecord(rawInput).assetId)
      if (!assetId)
        return invalidArgument('assetId is required')

      return await adapter.mediaRemoveAsset({ assetId })
    },
  },
  {
    name: 'media_clear_library',
    description: 'Clear media library assets by type or clear all.',
    jsonSchema: {
      type: 'object',
      properties: {
        type: {
          type: 'string',
          enum: ['all', 'video', 'image'],
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
      return await adapter.mediaClearLibrary({ type })
    },
  },
]
