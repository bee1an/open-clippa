import type { PerformerBounds, TextStyleOption } from '@clippc/performer'
import type { CanvasPerformer } from '@/store/usePerformerStore'
import { Image, Text, Video } from '@clippc/performer'
import { useEditorCommandActions } from '@/composables/useEditorCommandActions'
import { usePerformerStore } from '@/store/usePerformerStore'

export type PerformerType = 'video' | 'image' | 'text'

/**
 * Rotate a vector (x, y) by the given angle (degrees).
 * Shared with SelectionGroup.vue's coordinate system.
 */
function rotateVector(x: number, y: number, rotation: number): { x: number, y: number } {
  if (!rotation)
    return { x, y }
  const rad = rotation * Math.PI / 180
  const cos = Math.cos(rad)
  const sin = Math.sin(rad)
  return {
    x: x * cos - y * sin,
    y: x * sin + y * cos,
  }
}

/**
 * Convert top-left-origin bounds to center-rotation visual position.
 * Performer stores (x, y) as top-left corner, but visually the element
 * rotates around its center. This returns the position that corresponds
 * to the center-based rotation coordinate system used by SelectionGroup.
 */
function toCenterRotationPosition(bounds: PerformerBounds): { x: number, y: number } {
  const rotation = bounds.rotation ?? 0
  const offset = rotateVector(bounds.width / 2, bounds.height / 2, rotation)
  const centerX = bounds.x + offset.x
  const centerY = bounds.y + offset.y
  return {
    x: centerX - bounds.width / 2,
    y: centerY - bounds.height / 2,
  }
}

/**
 * Convert center-rotation visual position back to top-left-origin position.
 * Inverse of toCenterRotationPosition.
 */
function toTopLeftPosition(visualX: number, visualY: number, width: number, height: number, rotation: number): { x: number, y: number } {
  const centerX = visualX + width / 2
  const centerY = visualY + height / 2
  const offset = rotateVector(width / 2, height / 2, rotation)
  return {
    x: centerX - offset.x,
    y: centerY - offset.y,
  }
}

export function usePerformerProperties(performerId: Ref<string | null>) {
  const performerStore = usePerformerStore()
  const editorCommandActions = useEditorCommandActions()

  // revision counter to drive reactivity for non-reactive performer instances
  const revision = ref(0)
  const bump = () => {
    revision.value += 1
  }

  const performer = computed<CanvasPerformer | null>(() => {
    void revision.value
    const id = performerId.value
    if (!id)
      return null
    return performerStore.getPerformerById(id) ?? null
  })

  const performerType = computed<PerformerType | null>(() => {
    const p = performer.value
    if (!p)
      return null
    if (p instanceof Video)
      return 'video'
    if (p instanceof Image)
      return 'image'
    if (p instanceof Text)
      return 'text'
    return null
  })

  const bounds = computed<PerformerBounds | null>(() => {
    void revision.value
    return performer.value?.getBaseBounds() ?? null
  })

  // visual position in center-rotation coordinate system
  const visualPosition = computed<{ x: number, y: number } | null>(() => {
    const b = bounds.value
    if (!b)
      return null
    return toCenterRotationPosition(b)
  })

  const alpha = computed<number>(() => {
    void revision.value
    return performer.value?.sprite?.alpha ?? 1
  })

  // listen to positionUpdate events from the performer
  let cleanupListener: (() => void) | null = null

  watch(performer, (next, _prev) => {
    cleanupListener?.()
    cleanupListener = null

    if (!next)
      return

    const handler = () => bump()
    ;(next as any).on('positionUpdate', handler)
    cleanupListener = () => {
      (next as any).off?.('positionUpdate', handler)
    }
  }, { immediate: true })

  onScopeDispose(() => {
    cleanupListener?.()
  })

  // --- common setters ---

  /**
   * Update position using center-rotation visual coordinates.
   * Converts back to top-left-origin before applying to performer.
   */
  function updatePosition(visualX: number, visualY: number) {
    const id = performerId.value
    const b = bounds.value
    if (!id || !b)
      return
    const topLeft = toTopLeftPosition(visualX, visualY, b.width, b.height, b.rotation ?? 0)
    void editorCommandActions.performerUpdateTransform({
      performerId: id,
      x: topLeft.x,
      y: topLeft.y,
    })
    bump()
  }

  /**
   * Update rotation around the visual center.
   * Performer rotates around top-left by default, so we compensate
   * the position to keep the center point stable.
   */
  function updateRotation(angle: number) {
    const id = performerId.value
    const b = bounds.value
    if (!id || !b)
      return

    const oldRotation = b.rotation ?? 0
    const hw = b.width / 2
    const hh = b.height / 2

    // center under old rotation
    const oldOffset = rotateVector(hw, hh, oldRotation)
    const cx = b.x + oldOffset.x
    const cy = b.y + oldOffset.y

    // new top-left so center stays the same
    const newOffset = rotateVector(hw, hh, angle)

    void editorCommandActions.performerUpdateTransform({
      performerId: id,
      x: cx - newOffset.x,
      y: cy - newOffset.y,
      rotation: angle,
    })
    bump()
  }

  function updateAlpha(alpha: number) {
    const id = performerId.value
    if (!id)
      return
    void editorCommandActions.performerUpdateTransform({
      performerId: id,
      alpha,
    })
    bump()
  }

  // --- text-specific ---

  const textContent = computed<string>(() => {
    void revision.value
    const p = performer.value
    if (!(p instanceof Text))
      return ''
    return p.getText()
  })

  const textStyle = computed<TextStyleOption>(() => {
    void revision.value
    const p = performer.value
    if (!(p instanceof Text))
      return {}
    return p.getStyle()
  })

  function updateTextContent(content: string) {
    const p = performer.value
    if (!(p instanceof Text))
      return
    void editorCommandActions.performerUpdateTextContent({
      performerId: p.id,
      content,
    })
    bump()
  }

  function updateTextStyle(style: TextStyleOption) {
    const p = performer.value
    if (!(p instanceof Text))
      return
    void editorCommandActions.performerUpdateTextStyle({
      performerId: p.id,
      style,
    })
    bump()
  }

  return {
    performer,
    performerType,
    bounds,
    visualPosition,
    alpha,
    textContent,
    textStyle,
    updatePosition,
    updateRotation,
    updateAlpha,
    updateTextContent,
    updateTextStyle,
  }
}
