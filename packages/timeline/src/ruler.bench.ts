import { bench, describe } from 'vitest'
import { Ruler } from './ruler'
import { Application } from 'pixi.js'

describe('Ruler render performance', () => {
  const ruler = new Ruler({
    screenWidth: 1000,
    duration: 60000,
  })

  // We want to benchmark the render method, specifically _drawTick
  // We can simulate scrolling by updating offsetX

  let offsetX = 0

  bench('Ruler.render', () => {
    offsetX += 10
    ruler.updateOffsetX(offsetX)
  })
})
