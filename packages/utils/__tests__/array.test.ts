import { describe, expect, it } from 'vitest'
import { isIntersection } from '..'

describe('array', () => {
  describe('isIntersection', () => {
    it('should work', () => {
      expect(isIntersection([0, 10], [5, 15])).toMatchInlineSnapshot(`true`)

      expect(isIntersection([0, 10], [12, 15])).toMatchInlineSnapshot(`false`)

      expect(isIntersection([5, 15], [0, 10])).toMatchInlineSnapshot(`true`)

      expect(isIntersection([12, 15], [0, 10])).toMatchInlineSnapshot(`false`)

      expect(isIntersection([0, 10], [10, 15])).toMatchInlineSnapshot(`false`)

      expect(isIntersection([0, 10], [5, 7])).toMatchInlineSnapshot(`true`)

      expect(isIntersection([0, 10], [0, 10])).toMatchInlineSnapshot(`true`)
    })
  })
})
