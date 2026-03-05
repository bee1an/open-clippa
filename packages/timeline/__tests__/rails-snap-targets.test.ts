import { describe, expect, it } from 'vitest'
import { collectRailsSnapTargets } from '../src/utils/railsSnapTargets'

describe('rails snap targets', () => {
  it('collects same-rail and cross-rail targets with different anchor modes', () => {
    const targets = collectRailsSnapTargets({
      forRailZIndex: 2,
      trainId: 'dragging',
      rails: [
        {
          zIndex: 2,
          trains: [
            { id: 'dragging', x: 100, width: 80, start: 1000, duration: 500 },
            { id: 'same', x: 220, width: 60, start: 2000, duration: 600 },
          ],
        },
        {
          zIndex: 1,
          trains: [
            { id: 'cross-a', x: 300, width: 120, start: 3000, duration: 700 },
          ],
        },
      ],
    })

    expect(targets).toEqual([
      {
        id: 'same',
        railZIndex: 2,
        x: 220,
        width: 60,
        start: 2000,
        duration: 600,
        anchorMode: 'time',
      },
      {
        id: 'cross-a',
        railZIndex: 1,
        x: 300,
        width: 120,
        start: 3000,
        duration: 700,
        anchorMode: 'visual',
      },
    ])
  })

  it('keeps stable order by rail order then train order', () => {
    const targets = collectRailsSnapTargets({
      forRailZIndex: 5,
      trainId: 'none',
      rails: [
        {
          zIndex: 6,
          trains: [
            { id: 'a', x: 10, width: 20, start: 100, duration: 50 },
            { id: 'b', x: 40, width: 20, start: 200, duration: 50 },
          ],
        },
        {
          zIndex: 5,
          trains: [
            { id: 'c', x: 70, width: 20, start: 300, duration: 50 },
          ],
        },
      ],
    })

    expect(targets.map(target => target.id)).toEqual(['a', 'b', 'c'])
    expect(targets.map(target => target.anchorMode)).toEqual(['visual', 'visual', 'time'])
  })
})
