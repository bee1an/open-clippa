import { createSSRApp, h } from 'vue'
import { renderToString } from 'vue/server-renderer'
import { describe, expect, it, vi } from 'vitest'

vi.mock('@clippc/performer', () => {
  class MockImage {
    private listeners = new Map<string, Set<(...args: unknown[]) => void>>()

    on(event: string, handler: (...args: unknown[]) => void): void {
      if (!this.listeners.has(event))
        this.listeners.set(event, new Set())
      this.listeners.get(event)?.add(handler)
    }

    off(event: string, handler: (...args: unknown[]) => void): void {
      this.listeners.get(event)?.delete(handler)
    }

    getBounds() {
      return {
        x: 10,
        y: 20,
        width: 100,
        height: 50,
        rotation: 0,
      }
    }
  }

  return {
    Image: MockImage,
    Video: MockImage,
  }
})

import { Image } from '@clippc/performer'
import MediaCropBoxOverlay from './MediaCropBoxOverlay.vue'

async function renderOverlay(showSideHandles: boolean): Promise<string> {
  const performer = new Image({} as any)
  const app = createSSRApp({
    render() {
      return h(MediaCropBoxOverlay, {
        performer,
        scaleRatio: 1,
        showSideHandles,
        showFrame: true,
      })
    },
  })

  return await renderToString(app)
}

describe('MediaCropBoxOverlay', () => {
  it('renders corner and side resize buttons for regular crop mode', async () => {
    const html = await renderOverlay(true)

    expect(html.match(/data-crop-handle="corner"/g)).toHaveLength(4)
    expect(html.match(/data-crop-handle="side"/g)).toHaveLength(4)
    expect(html).toContain('data-direction="left"')
    expect(html).toContain('pointer-events-auto')
    expect(html).toContain('transform-origin:top left')
  })

  it('renders only corner handles for shape crop mode', async () => {
    const html = await renderOverlay(false)

    expect(html.match(/data-crop-handle="corner"/g)).toHaveLength(4)
    expect(html).not.toContain('data-crop-handle="side"')
  })
})
