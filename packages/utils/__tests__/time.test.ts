import { describe, expect, it } from 'vitest'
import { getMsByPx, getPxByMs, ms2TimeStr } from '../index'

describe('time', () => {
  describe('ms2TimeStr', () => {
    it('should work', () => {
      expect(ms2TimeStr(43385666)).toMatchInlineSnapshot(`"12:03:05"`)
      expect(ms2TimeStr(59000)).toBe('00:59')
      expect(ms2TimeStr(61000)).toBe('01:01')
      expect(ms2TimeStr(3600000)).toBe('01:00:00')
    })
  })

  describe('pixel/time conversions', () => {
    it('converts ms to px and back with the same scale', () => {
      const pxPerMs = 0.5
      expect(getPxByMs(200, pxPerMs)).toBe(100)
      expect(getMsByPx(100, pxPerMs)).toBe(200)
    })
  })
})
