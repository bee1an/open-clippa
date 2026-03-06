import { computed, ref } from 'vue'
import { describe, expect, it, vi } from 'vitest'
import { resolveCropOverlayState } from './cropOverlayState'

vi.mock('@clippc/performer', () => {
  class MockImage {
    private shape: null | { id: string, points: Array<{ x: number, y: number }> }

    constructor(_option?: unknown) {
      this.shape = null
    }

    getClipShape() {
      return this.shape
    }

    setClipShape(shape: null | { id: string, points: Array<{ x: number, y: number }> }) {
      this.shape = shape
    }
  }

  return {
    Image: MockImage,
    Video: MockImage,
  }
})

import { Image } from '@clippc/performer'

describe('resolveCropOverlayState', () => {
  it('switches from rectangular crop to shape crop when revision changes', () => {
    const performer = new Image({} as any)
    const revision = ref(0)
    const state = computed(() => {
      return resolveCropOverlayState({
        isCropModeActive: true,
        performer: performer as any,
        revision: revision.value,
      })
    })

    expect(state.value.showOverlay).toBe(true)
    expect(state.value.showSideHandles).toBe(true)

    performer.setClipShape({
      id: 'star',
      points: [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
        { x: 1, y: 1 },
      ],
    })
    revision.value += 1

    expect(state.value.showOverlay).toBe(true)
    expect(state.value.showSideHandles).toBe(false)
    expect(state.value.showFrame).toBe(true)
  })
})
