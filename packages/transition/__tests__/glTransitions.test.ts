import { describe, expect, it } from 'vitest'
import {
  buildGlTransitionFragment,
  getGlTransitionDefaultParams,
  getGlTransitionPresetByType,
  GL_TRANSITION_PRESETS,
  normalizeGlTransitionParams,
} from '../index'

describe('glTransitions presets', () => {
  it('contains directionalwrap preset with expected default params', () => {
    const preset = GL_TRANSITION_PRESETS.find(item => item.type === 'directionalwrap')

    expect(preset).toBeTruthy()
    expect(getGlTransitionDefaultParams('directionalwrap')).toEqual({
      direction: [0, 1],
    })
  })

  it('normalizes directionalwrap direction params', () => {
    const normalized = normalizeGlTransitionParams('directionalwrap', {
      direction: ['2', 3],
    })

    expect(normalized).toEqual({
      direction: [2, 3],
    })
  })

  it('falls back to default direction on invalid params', () => {
    const normalized = normalizeGlTransitionParams('directionalwrap', {
      direction: [1],
    })

    expect(normalized).toEqual({
      direction: [0, 1],
    })
  })

  it('falls back to fade preset for unknown type', () => {
    const preset = getGlTransitionPresetByType('not-exist')
    expect(preset.type).toBe('fade')
  })

  it('returns cloned default params to avoid shared mutation', () => {
    const first = getGlTransitionDefaultParams('directionalwrap')
    const second = getGlTransitionDefaultParams('directionalwrap')
    ;(first.direction as number[])[0] = 999
    expect(second).toEqual({
      direction: [0, 1],
    })
  })

  it('normalizes scalar params and falls back when value is invalid', () => {
    expect(normalizeGlTransitionParams('directionalwipe', {
      smoothness: '0.2',
      direction: ['1', '-1'],
    })).toEqual({
      direction: [1, -1],
      smoothness: 0.2,
    })

    expect(normalizeGlTransitionParams('directionalwipe', {
      smoothness: Number.NaN,
      direction: [1, Number.NaN],
    })).toEqual({
      direction: [1, -1],
      smoothness: 0.5,
    })
  })
})

describe('buildGlTransitionFragment', () => {
  it('builds a pixi v8 compatible fragment shader wrapper', () => {
    const fragment = buildGlTransitionFragment(`
vec4 transition(vec2 uv) {
  return getFromColor(uv);
}
`.trim())

    expect(fragment).toContain('out vec4 finalColor;')
    expect(fragment).toContain('finalColor = transition(vTextureCoord);')
  })
})
