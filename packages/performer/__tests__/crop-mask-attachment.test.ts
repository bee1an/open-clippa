import { describe, expect, it } from 'vitest'
import { Image } from '../src/image'

type MockParent = {
  children: unknown[]
  addChild: (child: unknown) => void
  removeChild: (child: unknown) => void
}

function createParent(): MockParent {
  return {
    children: [],
    addChild(child: unknown) {
      if (!this.children.includes(child))
        this.children.push(child)
    },
    removeChild(child: unknown) {
      this.children = this.children.filter(item => item !== child)
    },
  }
}

function createImageHarness(parent: MockParent): Image {
  const performer = Object.create(Image.prototype) as Image
  const performerLike = performer as any
  performerLike._naturalSize = { width: 200, height: 100 }
  performerLike._cropInsets = {
    left: 24,
    top: 12,
    right: 0,
    bottom: 0,
  }
  performerLike._clipShape = null
  performerLike._sprite = {
    x: 320,
    y: 180,
    width: 400,
    height: 200,
    angle: 30,
    alpha: 0.8,
    scale: {
      x: 2,
      y: 2,
    },
    pivot: {
      x: 0,
      y: 0,
      set(x: number, y: number) {
        this.x = x
        this.y = y
      },
    },
    parent,
    mask: null,
  }
  return performer
}

describe('crop mask attachment', () => {
  it('attaches crop mask to sprite parent instead of sprite itself', () => {
    const parent = createParent()
    const performer = createImageHarness(parent)
    const performerLike = performer as any

    performer.syncRenderAssets?.()

    expect(parent.children).toHaveLength(1)
    expect(parent.children[0]).toBe(performerLike._cropMask)
    expect(performerLike._sprite.mask).toBe(performerLike._cropMask)
  })
})
