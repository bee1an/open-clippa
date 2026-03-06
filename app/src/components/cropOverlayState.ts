import type { CanvasPerformer } from '@/store/usePerformerStore'
import { Image, Video } from '@clippc/performer'

export interface CropOverlayState {
  showOverlay: boolean
  showSideHandles: boolean
  showFrame: boolean
}

export function resolveCropOverlayState(input: {
  isCropModeActive: boolean
  performer: CanvasPerformer | null
  revision: number
}): CropOverlayState {
  void input.revision

  const performer = input.performer
  const isMediaPerformer = performer instanceof Image || performer instanceof Video
  const showOverlay = input.isCropModeActive && isMediaPerformer
  const hasClipShape = isMediaPerformer ? Boolean(performer.getClipShape?.()) : false

  return {
    showOverlay,
    showSideHandles: showOverlay && !hasClipShape,
    showFrame: showOverlay,
  }
}
