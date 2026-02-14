export const textStyleSchema = {
  type: 'object',
  properties: {
    fontFamily: {
      oneOf: [
        { type: 'string' },
        {
          type: 'array',
          items: { type: 'string' },
        },
      ],
    },
    fontSize: { type: 'number' },
    fontWeight: {
      oneOf: [
        {
          type: 'string',
          enum: ['normal', 'bold', 'bolder', 'lighter'],
        },
        { type: 'number' },
      ],
    },
    fontStyle: {
      type: 'string',
      enum: ['normal', 'italic', 'oblique'],
    },
    fill: {
      oneOf: [{ type: 'string' }, { type: 'number' }],
    },
    stroke: {
      type: 'object',
      properties: {
        color: {
          oneOf: [{ type: 'string' }, { type: 'number' }],
        },
        width: { type: 'number' },
      },
      additionalProperties: false,
    },
    align: {
      type: 'string',
      enum: ['left', 'center', 'right'],
    },
    wordWrap: { type: 'boolean' },
    wordWrapWidth: { type: 'number' },
    lineHeight: { type: 'number' },
    letterSpacing: { type: 'number' },
    dropShadow: {
      type: 'object',
      properties: {
        alpha: { type: 'number' },
        angle: { type: 'number' },
        blur: { type: 'number' },
        color: {
          oneOf: [{ type: 'string' }, { type: 'number' }],
        },
        distance: { type: 'number' },
      },
      additionalProperties: false,
    },
  },
  additionalProperties: false,
} as const

export const animationSchema = {
  type: 'object',
  properties: {
    enter: {
      oneOf: [
        {
          type: 'object',
          properties: {
            preset: { type: 'string' },
            durationMs: { type: 'number' },
          },
          additionalProperties: false,
        },
        { type: 'null' },
      ],
    },
    exit: {
      oneOf: [
        {
          type: 'object',
          properties: {
            preset: { type: 'string' },
            durationMs: { type: 'number' },
          },
          additionalProperties: false,
        },
        { type: 'null' },
      ],
    },
    loop: {
      oneOf: [
        {
          type: 'object',
          properties: {
            preset: { type: 'string' },
            durationMs: { type: 'number' },
          },
          additionalProperties: false,
        },
        { type: 'null' },
      ],
    },
  },
  required: [],
  additionalProperties: false,
} as const

export const filterConfigPatchSchema = {
  type: 'object',
  properties: {
    brightness: { type: 'number' },
    contrast: { type: 'number' },
    saturation: { type: 'number' },
    hue: { type: 'number' },
  },
  additionalProperties: false,
} as const

export const FILTER_PRESET_ENUM = [
  'warm',
  'cool',
  'vintage',
  'bw',
  'vivid',
  'faded',
  'dramatic',
  'sepia',
] as const

export const transitionPatchSchema = {
  type: 'object',
  properties: {
    fromId: { type: 'string' },
    toId: { type: 'string' },
    durationMs: { type: 'number' },
    type: { type: 'string' },
    params: {
      type: 'object',
      additionalProperties: true,
    },
  },
  additionalProperties: false,
} as const
