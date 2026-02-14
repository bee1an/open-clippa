import type { EditorControlAdapter } from '../src/tools/editorControl'
import { describe, expect, it, vi } from 'vitest'
import { createEditorControlTools } from '../src/tools/editorControl'

function createAdapter(overrides: Partial<EditorControlAdapter> = {}): EditorControlAdapter {
  const target = { ...overrides } as Record<string | symbol, unknown>

  return new Proxy(target, {
    get(store, key: string | symbol) {
      if (!(key in store))
        store[key] = vi.fn(async () => ({ ok: true as const, data: {} }))

      return store[key]
    },
  }) as unknown as EditorControlAdapter
}

function getTool(adapter: EditorControlAdapter, name: string) {
  const tool = createEditorControlTools(adapter).find(item => item.name === name)
  if (!tool)
    throw new Error(`Tool not found: ${name}`)

  return tool
}

describe('createEditorControlTools', () => {
  const context = {
    round: 1,
    toolCallId: 'test-call',
  }

  it('registers all control tools without duplicate names', () => {
    const tools = createEditorControlTools(createAdapter())
    const names = tools.map(item => item.name)

    expect(names).toEqual(expect.arrayContaining([
      'query_project_state',
      'timeline_seek',
      'media_add_asset_to_timeline',
      'media_import_video_from_url',
      'create_text_element',
      'performer_update_text_style',
      'filter_update_config',
      'transition_upsert_by_pair',
      'export_get_status',
    ]))
    expect(new Set(names).size).toBe(names.length)
  })

  it('normalizes query_media_assets input before invoking adapter', async () => {
    const queryMediaAssets: EditorControlAdapter['queryMediaAssets'] = vi.fn(async input => ({ ok: true as const, data: { input } }))
    const adapter = createAdapter({ queryMediaAssets })
    const tool = getTool(adapter, 'query_media_assets')

    await tool.handler(
      {
        type: 'invalid',
        limit: 999.2,
      },
      context,
    )

    expect(queryMediaAssets).toHaveBeenCalledWith({
      type: 'all',
      limit: 300,
    })
  })

  it('returns INVALID_ARGUMENT for non-finite timeline_seek and does not call adapter', async () => {
    const timelineSeek: EditorControlAdapter['timelineSeek'] = vi.fn(async () => ({ ok: true as const, data: {} }))
    const adapter = createAdapter({ timelineSeek })
    const tool = getTool(adapter, 'timeline_seek')

    const result = await tool.handler({ timeMs: Number.POSITIVE_INFINITY }, context)

    expect(result).toEqual({
      ok: false,
      error: {
        code: 'INVALID_ARGUMENT',
        message: 'timeMs must be a finite number',
      },
    })
    expect(timelineSeek).not.toHaveBeenCalled()
  })

  it('returns INVALID_ARGUMENT for empty performer text content', async () => {
    const performerUpdateTextContent: EditorControlAdapter['performerUpdateTextContent'] = vi.fn(async () => ({ ok: true as const, data: {} }))
    const adapter = createAdapter({ performerUpdateTextContent })
    const tool = getTool(adapter, 'performer_update_text_content')

    const result = await tool.handler({ content: '   ' }, context)

    expect(result).toEqual({
      ok: false,
      error: {
        code: 'INVALID_ARGUMENT',
        message: 'content must be a non-empty string',
      },
    })
    expect(performerUpdateTextContent).not.toHaveBeenCalled()
  })

  it('normalizes create_text_element input before invoking adapter', async () => {
    const createTextElement: EditorControlAdapter['createTextElement'] = vi.fn(async input => ({ ok: true as const, data: { input } }))
    const adapter = createAdapter({ createTextElement })
    const tool = getTool(adapter, 'create_text_element')

    await tool.handler({
      content: '  片头  ',
      startMs: 1234,
      durationMs: 5000,
      x: 120,
      y: 80,
      style: {
        fontSize: 56,
        fill: '#fff',
        fontWeight: 'bold',
        align: 'center',
      },
      ignored: true,
    }, context)

    expect(createTextElement).toHaveBeenCalledWith({
      content: '片头',
      startMs: 1234,
      durationMs: 5000,
      x: 120,
      y: 80,
      style: {
        fontSize: 56,
        fill: '#fff',
        fontWeight: 'bold',
        align: 'center',
      },
    })
  })

  it('requires filter preset when creating layer', async () => {
    const filterCreateLayer: EditorControlAdapter['filterCreateLayer'] = vi.fn(async () => ({ ok: true as const, data: {} }))
    const adapter = createAdapter({ filterCreateLayer })
    const tool = getTool(adapter, 'filter_create_layer')

    const missingPresetResult = await tool.handler({}, context)
    expect(missingPresetResult).toEqual({
      ok: false,
      error: {
        code: 'INVALID_ARGUMENT',
        message: 'preset is required',
      },
    })

    const unsupportedPresetResult = await tool.handler({ preset: 'custom' }, context)
    expect(unsupportedPresetResult).toEqual({
      ok: false,
      error: {
        code: 'INVALID_ARGUMENT',
        message: 'Unsupported filter preset: custom',
      },
    })

    const configResult = await tool.handler({ preset: 'warm', config: { contrast: 1.5 } }, context)
    expect(configResult).toEqual({
      ok: false,
      error: {
        code: 'INVALID_ARGUMENT',
        message: 'config is not supported; use preset only',
      },
    })

    await tool.handler({ preset: 'bw' }, context)
    expect(filterCreateLayer).toHaveBeenCalledWith(expect.objectContaining({ preset: 'bw' }))
  })

  it('validates media_import_video_from_url arguments', async () => {
    const mediaImportVideoFromUrl: EditorControlAdapter['mediaImportVideoFromUrl'] = vi.fn(async () => ({ ok: true as const, data: {} }))
    const adapter = createAdapter({ mediaImportVideoFromUrl })
    const tool = getTool(adapter, 'media_import_video_from_url')

    const emptyResult = await tool.handler({}, context)
    expect(emptyResult).toEqual({
      ok: false,
      error: {
        code: 'INVALID_ARGUMENT',
        message: 'url is required',
      },
    })

    await tool.handler({ url: 'https://cdn.example.com/video.mp4', name: 'demo' }, context)
    expect(mediaImportVideoFromUrl).toHaveBeenCalledWith({
      url: 'https://cdn.example.com/video.mp4',
      name: 'demo',
    })
  })
})
