import type { EditorControlToolFactory } from './types'
import {
  asOptionalFiniteNumber,
  asOptionalString,
  invalidArgument,
  toRecord,
} from './shared'

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
