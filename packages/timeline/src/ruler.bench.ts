import { bench, describe } from 'vitest'
import { Ruler } from './ruler'

describe('ruler render performance', () => {
  const ruler = new Ruler({
    screenWidth: 1000,
    duration: 60000,
  })

  // We want to benchmark the render method, specifically _drawTick
  // We can simulate scrolling by updating offsetX

  let offsetX = 0

  bench('ruler.render', () => {
    offsetX += 10
    ruler.updateOffsetX(offsetX)
  })
})
