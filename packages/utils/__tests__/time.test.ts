import { describe, expect, it } from 'vitest'
import { ms2TimeStr } from '../index'

describe('time', () => {
  describe('ms2TimeStr', () => {
    it('should work', () => {
      expect(ms2TimeStr(43385666)).toMatchInlineSnapshot(`"12:03:05"`)
    })
  })
})
