import { describe, expect, it } from 'vitest'
import {
  buildGlTransitionFragment,
  getGlTransitionDefaultParams,
  GL_TRANSITION_PRESETS,
  normalizeGlTransitionParams,
} from './glTransitions'

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
