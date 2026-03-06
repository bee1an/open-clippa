import { Container, Sprite } from 'pixi.js'
import { describe, expect, it } from 'vitest'
import { MediaCropPreviewController } from '../src/mediaCropPreviewController'

describe('media crop preview controller', () => {
  it('aligns ghost sprite with source pivot for rotated crops', () => {
    const overlayRoot = new Container()
    const stage = { overlayRoot } as any
    const controller = new MediaCropPreviewController(stage)
    const sprite = new Sprite()

    controller.setActivePerformer({
      sprite,
      getBounds: () => ({
        x: 320,
        y: 180,
        width: 280,
        height: 160,
        rotation: 30,
      }),
      getSourceRenderBounds: () => ({
        x: 320,
        y: 180,
        width: 400,
        height: 200,
        pivotX: 24,
        pivotY: 12,
        rotation: 30,
        alpha: 0.8,
      }),
    })

    const ghostSprite = overlayRoot.children[0]
    expect(ghostSprite).toBeInstanceOf(Sprite)

    const typedGhostSprite = ghostSprite as Sprite
    expect(typedGhostSprite.x).toBeCloseTo(320)
    expect(typedGhostSprite.y).toBeCloseTo(180)
    expect(typedGhostSprite.width).toBeCloseTo(400)
    expect(typedGhostSprite.height).toBeCloseTo(200)
    expect(typedGhostSprite.pivot.x).toBeCloseTo(24)
    expect(typedGhostSprite.pivot.y).toBeCloseTo(12)
    expect(typedGhostSprite.angle).toBeCloseTo(30)
    expect(typedGhostSprite.alpha).toBeCloseTo(0.16)
  })
})
