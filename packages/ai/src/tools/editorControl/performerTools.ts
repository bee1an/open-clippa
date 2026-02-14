import type {
  EditorControlCreateTextInput,
  EditorControlCreateTextStyle,
  EditorControlToolFactory,
} from './types'
import {
  animationSchema,
  textStyleSchema,
} from './schemas'
import {
  asOptionalFiniteNumber,
  asOptionalString,
  invalidArgument,
  isRecord,
  toRecord,
} from './shared'

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function resolveCreateTextStyle(value: unknown): EditorControlCreateTextStyle | undefined {
  if (!isRecord(value))
    return undefined

  const style: EditorControlCreateTextStyle = {}

  if (typeof value.fontFamily === 'string') {
    style.fontFamily = value.fontFamily
  }
  else if (Array.isArray(value.fontFamily)) {
    const fontFamily = value.fontFamily.filter(item => typeof item === 'string')
    if (fontFamily.length > 0)
      style.fontFamily = fontFamily
  }

  if (
    value.fontWeight === 'normal'
    || value.fontWeight === 'bold'
    || value.fontWeight === 'bolder'
    || value.fontWeight === 'lighter'
    || isFiniteNumber(value.fontWeight)
  ) {
    style.fontWeight = value.fontWeight
  }

  if (value.fontStyle === 'normal' || value.fontStyle === 'italic' || value.fontStyle === 'oblique')
    style.fontStyle = value.fontStyle

  if (typeof value.fill === 'string' || isFiniteNumber(value.fill))
    style.fill = value.fill

  if (value.align === 'left' || value.align === 'center' || value.align === 'right')
    style.align = value.align

  if (typeof value.wordWrap === 'boolean')
    style.wordWrap = value.wordWrap

  const fontSize = asOptionalFiniteNumber(value.fontSize)
  if (fontSize !== undefined)
    style.fontSize = fontSize

  const wordWrapWidth = asOptionalFiniteNumber(value.wordWrapWidth)
  if (wordWrapWidth !== undefined)
    style.wordWrapWidth = wordWrapWidth

  const lineHeight = asOptionalFiniteNumber(value.lineHeight)
  if (lineHeight !== undefined)
    style.lineHeight = lineHeight

  const letterSpacing = asOptionalFiniteNumber(value.letterSpacing)
  if (letterSpacing !== undefined)
    style.letterSpacing = letterSpacing

  if (isRecord(value.stroke)) {
    const stroke: EditorControlCreateTextStyle['stroke'] = {}
    if (typeof value.stroke.color === 'string' || isFiniteNumber(value.stroke.color))
      stroke.color = value.stroke.color

    const strokeWidth = asOptionalFiniteNumber(value.stroke.width)
    if (strokeWidth !== undefined)
      stroke.width = strokeWidth

    if (Object.keys(stroke).length > 0)
      style.stroke = stroke
  }

  if (isRecord(value.dropShadow)) {
    const dropShadow: EditorControlCreateTextStyle['dropShadow'] = {}
    const dropShadowAlpha = asOptionalFiniteNumber(value.dropShadow.alpha)
    if (dropShadowAlpha !== undefined)
      dropShadow.alpha = dropShadowAlpha

    const dropShadowAngle = asOptionalFiniteNumber(value.dropShadow.angle)
    if (dropShadowAngle !== undefined)
      dropShadow.angle = dropShadowAngle

    const dropShadowBlur = asOptionalFiniteNumber(value.dropShadow.blur)
    if (dropShadowBlur !== undefined)
      dropShadow.blur = dropShadowBlur

    if (typeof value.dropShadow.color === 'string' || isFiniteNumber(value.dropShadow.color))
      dropShadow.color = value.dropShadow.color

    const dropShadowDistance = asOptionalFiniteNumber(value.dropShadow.distance)
    if (dropShadowDistance !== undefined)
      dropShadow.distance = dropShadowDistance

    if (Object.keys(dropShadow).length > 0)
      style.dropShadow = dropShadow
  }

  if (Object.keys(style).length === 0)
    return undefined

  return style
}

function resolveCreateTextInput(value: unknown): EditorControlCreateTextInput {
  if (!isRecord(value))
    return {}

  const input: EditorControlCreateTextInput = {}
  const content = asOptionalString(value.content)
  if (content)
    input.content = content

  const startMs = asOptionalFiniteNumber(value.startMs)
  if (startMs !== undefined)
    input.startMs = startMs

  const durationMs = asOptionalFiniteNumber(value.durationMs)
  if (durationMs !== undefined)
    input.durationMs = durationMs

  const x = asOptionalFiniteNumber(value.x)
  if (x !== undefined)
    input.x = x

  const y = asOptionalFiniteNumber(value.y)
  if (y !== undefined)
    input.y = y

  const style = resolveCreateTextStyle(value.style)
  if (style)
    input.style = style

  return input
}

export const createPerformerTools: EditorControlToolFactory = adapter => [
  {
    name: 'create_text_element',
    description: 'Create a text element on the timeline and canvas.',
    jsonSchema: {
      type: 'object',
      properties: {
        content: {
          type: 'string',
          description: 'Text content.',
        },
        startMs: {
          type: 'number',
          description: 'Start time in milliseconds.',
        },
        durationMs: {
          type: 'number',
          description: 'Duration in milliseconds.',
        },
        x: {
          type: 'number',
          description: 'Canvas X coordinate.',
        },
        y: {
          type: 'number',
          description: 'Canvas Y coordinate.',
        },
        style: textStyleSchema,
      },
      required: [],
      additionalProperties: false,
    },
    handler: async (rawInput) => {
      return await adapter.createTextElement(resolveCreateTextInput(rawInput))
    },
  },
  {
    name: 'performer_update_transform',
    description: 'Update performer transform values by performer id.',
    jsonSchema: {
      type: 'object',
      properties: {
        performerId: { type: 'string' },
        x: { type: 'number' },
        y: { type: 'number' },
        width: { type: 'number' },
        height: { type: 'number' },
        rotation: { type: 'number' },
        alpha: { type: 'number' },
        zIndex: { type: 'number' },
      },
      required: ['performerId'],
      additionalProperties: false,
    },
    handler: async (rawInput) => {
      const input = toRecord(rawInput)
      const performerId = asOptionalString(input.performerId)
      if (!performerId)
        return invalidArgument('performerId is required')

      return await adapter.performerUpdateTransform({
        performerId,
        x: asOptionalFiniteNumber(input.x),
        y: asOptionalFiniteNumber(input.y),
        width: asOptionalFiniteNumber(input.width),
        height: asOptionalFiniteNumber(input.height),
        rotation: asOptionalFiniteNumber(input.rotation),
        alpha: asOptionalFiniteNumber(input.alpha),
        zIndex: asOptionalFiniteNumber(input.zIndex),
      })
    },
  },
  {
    name: 'performer_select',
    description: 'Select performer by id.',
    jsonSchema: {
      type: 'object',
      properties: {
        performerId: { type: 'string' },
      },
      required: ['performerId'],
      additionalProperties: false,
    },
    handler: async (rawInput) => {
      const performerId = asOptionalString(toRecord(rawInput).performerId)
      if (!performerId)
        return invalidArgument('performerId is required')

      return await adapter.performerSelect({ performerId })
    },
  },
  {
    name: 'performer_clear_selection',
    description: 'Clear current performer selection.',
    jsonSchema: {
      type: 'object',
      properties: {},
      required: [],
      additionalProperties: false,
    },
    handler: async () => adapter.performerClearSelection(),
  },
  {
    name: 'performer_remove',
    description: 'Remove performer by id.',
    jsonSchema: {
      type: 'object',
      properties: {
        performerId: { type: 'string' },
      },
      required: ['performerId'],
      additionalProperties: false,
    },
    handler: async (rawInput) => {
      const performerId = asOptionalString(toRecord(rawInput).performerId)
      if (!performerId)
        return invalidArgument('performerId is required')

      return await adapter.performerRemove({ performerId })
    },
  },
  {
    name: 'performer_update_text_content',
    description: 'Update text performer content. Uses selected performer when performerId is omitted.',
    jsonSchema: {
      type: 'object',
      properties: {
        performerId: { type: 'string' },
        content: { type: 'string' },
      },
      required: ['content'],
      additionalProperties: false,
    },
    handler: async (rawInput) => {
      const input = toRecord(rawInput)
      const content = asOptionalString(input.content)
      if (!content)
        return invalidArgument('content must be a non-empty string')

      return await adapter.performerUpdateTextContent({
        performerId: asOptionalString(input.performerId),
        content,
      })
    },
  },
  {
    name: 'performer_update_text_style',
    description: 'Update text performer style patch. Uses selected performer when performerId is omitted.',
    jsonSchema: {
      type: 'object',
      properties: {
        performerId: { type: 'string' },
        style: textStyleSchema,
      },
      required: ['style'],
      additionalProperties: false,
    },
    handler: async (rawInput) => {
      const input = toRecord(rawInput)
      if (!isRecord(input.style))
        return invalidArgument('style must be an object')

      return await adapter.performerUpdateTextStyle({
        performerId: asOptionalString(input.performerId),
        style: input.style,
      })
    },
  },
  {
    name: 'performer_set_animation',
    description: 'Set performer animation spec. Uses selected performer when performerId is omitted.',
    jsonSchema: {
      type: 'object',
      properties: {
        performerId: { type: 'string' },
        animation: animationSchema,
      },
      required: ['animation'],
      additionalProperties: false,
    },
    handler: async (rawInput) => {
      const input = toRecord(rawInput)
      if (!isRecord(input.animation))
        return invalidArgument('animation must be an object')

      return await adapter.performerSetAnimation({
        performerId: asOptionalString(input.performerId),
        animation: input.animation,
      })
    },
  },
  {
    name: 'performer_clear_animation',
    description: 'Clear performer animation. Uses selected performer when performerId is omitted.',
    jsonSchema: {
      type: 'object',
      properties: {
        performerId: { type: 'string' },
      },
      required: [],
      additionalProperties: false,
    },
    handler: async (rawInput) => {
      const input = toRecord(rawInput)
      return await adapter.performerClearAnimation({
        performerId: asOptionalString(input.performerId),
      })
    },
  },
]
