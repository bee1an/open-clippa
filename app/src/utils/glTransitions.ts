export type GlTransitionParamValue = number | number[]

export interface GlTransitionPreset {
  type: string
  name: string
  author: string
  license: string
  glsl: string
  defaultParams: Record<string, GlTransitionParamValue>
}

export const GL_TRANSITION_PRESETS: GlTransitionPreset[] = [
  {
    type: 'fade',
    name: 'Fade',
    author: 'gre',
    license: 'MIT',
    glsl: `
vec4 transition (vec2 uv) {
  return mix(
    getFromColor(uv),
    getToColor(uv),
    progress
  );
}
`.trim(),
    defaultParams: {},
  },
  {
    type: 'crosswarp',
    name: 'Crosswarp',
    author: 'Eke Peter',
    license: 'MIT',
    glsl: `
vec4 transition(vec2 p) {
  float x = progress;
  x = smoothstep(.0, 1.0, (x * 2.0 + p.x - 1.0));
  return mix(getFromColor((p - .5) * (1. - x) + .5), getToColor((p - .5) * x + .5), x);
}
`.trim(),
    defaultParams: {},
  },
  {
    type: 'directionalwipe',
    name: 'Directional Wipe',
    author: 'gre',
    license: 'MIT',
    glsl: `
uniform vec2 direction; // = vec2(1.0, -1.0)
uniform float smoothness; // = 0.5

const vec2 center = vec2(0.5, 0.5);

vec4 transition (vec2 uv) {
  vec2 v = normalize(direction);
  v /= abs(v.x) + abs(v.y);
  float d = v.x * center.x + v.y * center.y;
  float m =
    (1.0 - step(progress, 0.0)) *
    (1.0 - smoothstep(-smoothness, 0.0, v.x * uv.x + v.y * uv.y - (d - 0.5 + progress * (1. + smoothness))));
  return mix(getFromColor(uv), getToColor(uv), m);
}
`.trim(),
    defaultParams: {
      direction: [1, -1],
      smoothness: 0.5,
    },
  },
]

const presetMap = new Map(GL_TRANSITION_PRESETS.map(preset => [preset.type, preset]))

export const DEFAULT_GL_TRANSITION_TYPE = 'fade'

function cloneParamValue(value: GlTransitionParamValue): GlTransitionParamValue {
  if (Array.isArray(value))
    return [...value]
  return value
}

export function getGlTransitionPresetByType(type: string): GlTransitionPreset {
  return presetMap.get(type) ?? presetMap.get(DEFAULT_GL_TRANSITION_TYPE)!
}

export function getGlTransitionDefaultParams(type: string): Record<string, GlTransitionParamValue> {
  const preset = getGlTransitionPresetByType(type)
  const result: Record<string, GlTransitionParamValue> = {}

  Object.entries(preset.defaultParams).forEach(([key, value]) => {
    result[key] = cloneParamValue(value)
  })

  return result
}

function normalizeParamValue(current: unknown, fallback: GlTransitionParamValue): GlTransitionParamValue {
  if (Array.isArray(fallback)) {
    if (!Array.isArray(current) || current.length !== fallback.length)
      return cloneParamValue(fallback)

    const normalized = current.map((item, index) => {
      const next = Number(item)
      if (!Number.isFinite(next))
        return fallback[index]
      return next
    })
    return normalized
  }

  const next = Number(current)
  if (!Number.isFinite(next))
    return fallback
  return next
}

export function normalizeGlTransitionParams(
  type: string,
  params: Record<string, unknown> | null | undefined,
): Record<string, GlTransitionParamValue> {
  const preset = getGlTransitionPresetByType(type)
  const result: Record<string, GlTransitionParamValue> = {}

  Object.entries(preset.defaultParams).forEach(([key, fallback]) => {
    result[key] = normalizeParamValue(params?.[key], fallback)
  })

  return result
}

export function buildGlTransitionFragment(glsl: string): string {
  return `
precision mediump float;

varying vec2 vTextureCoord;

uniform sampler2D uFrom;
uniform sampler2D uTo;
uniform float uProgress;
uniform float uRatio;

#define progress uProgress
#define ratio uRatio

vec4 getFromColor(vec2 uv) {
  return texture2D(uFrom, uv);
}

vec4 getToColor(vec2 uv) {
  return texture2D(uTo, uv);
}

${glsl}

void main() {
  gl_FragColor = transition(vTextureCoord);
}
`.trim()
}
