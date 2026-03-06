import type { PerformerClipShape, SourceRenderBounds } from '@clippc/performer'
import type { Stage } from './stage'
import { Graphics, Sprite } from 'pixi.js'

export interface MediaCropPreviewPerformer {
  sprite?: unknown
  getBounds: () => { x: number, y: number, width: number, height: number, rotation?: number }
  getClipShape?: () => PerformerClipShape | null
  getSourceRenderBounds?: () => SourceRenderBounds | null
}

export class MediaCropPreviewController {
  private ghostSprite: Sprite | null = null
  private outlineGraphics: Graphics | null = null
  private activePerformer: MediaCropPreviewPerformer | null = null

  constructor(private readonly stage: Stage) {}

  setActivePerformer(performer: MediaCropPreviewPerformer | null): void {
    this.activePerformer = performer
    this.sync()
  }

  sync(): void {
    const performer = this.activePerformer
    const sourceBounds = performer?.getSourceRenderBounds?.()
    const sourceSprite = performer?.sprite

    if (
      !performer
      || !(sourceSprite instanceof Sprite)
      || !sourceSprite.texture
      || !sourceBounds
      || !this.ensurePreviewNodes()
      || !this.ghostSprite
      || !this.outlineGraphics
    ) {
      this.clear()
      return
    }

    this.ghostSprite.texture = sourceSprite.texture
    this.ghostSprite.x = sourceBounds.x
    this.ghostSprite.y = sourceBounds.y
    this.ghostSprite.width = sourceBounds.width
    this.ghostSprite.height = sourceBounds.height
    this.ghostSprite.angle = sourceBounds.rotation
    this.ghostSprite.alpha = Math.min(0.16, sourceBounds.alpha * 0.2)
    this.ghostSprite.zIndex = 0
    this.ghostSprite.filters = sourceSprite.filters ? [...sourceSprite.filters] : null

    this.outlineGraphics.zIndex = 1
    this.drawClipOutline(this.outlineGraphics, performer)

    this.stage.overlayRoot.sortChildren()
  }

  clear(): void {
    this.ghostSprite?.parent?.removeChild(this.ghostSprite)
    this.ghostSprite?.destroy()
    this.ghostSprite = null

    this.outlineGraphics?.parent?.removeChild(this.outlineGraphics)
    this.outlineGraphics?.destroy()
    this.outlineGraphics = null
  }

  destroy(): void {
    this.activePerformer = null
    this.clear()
  }

  private ensurePreviewNodes(): boolean {
    const overlayRoot = this.stage.overlayRoot
    if (!overlayRoot)
      return false

    if (!this.ghostSprite) {
      this.ghostSprite = new Sprite()
      this.ghostSprite.eventMode = 'none'
      overlayRoot.addChild(this.ghostSprite)
    }

    if (!this.outlineGraphics) {
      this.outlineGraphics = new Graphics({ label: 'media-crop-preview-outline' })
      this.outlineGraphics.eventMode = 'none'
      overlayRoot.addChild(this.outlineGraphics)
    }

    return true
  }

  private drawClipOutline(
    graphics: Graphics,
    performer: MediaCropPreviewPerformer,
  ): void {
    const bounds = performer.getBounds()
    const clipShape = performer.getClipShape?.() ?? null

    graphics.clear()
    graphics.x = bounds.x
    graphics.y = bounds.y
    graphics.angle = bounds.rotation ?? 0

    if (!clipShape || clipShape.points.length < 3) {
      graphics
        .rect(0, 0, bounds.width, bounds.height)
        .stroke({ color: 0xFFFFFF, alpha: 0.88, width: 1.5, join: 'round' })
      return
    }

    clipShape.points.forEach((point, index) => {
      const x = point.x * bounds.width
      const y = point.y * bounds.height
      if (index === 0)
        graphics.moveTo(x, y)
      else
        graphics.lineTo(x, y)
    })
    graphics.closePath()
      .stroke({ color: 0xFFFFFF, alpha: 0.92, width: 1.5, join: 'round' })
  }
}
