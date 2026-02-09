import { describe, expect, it } from 'vitest'
import { collectAdjacentBoundaries, collectTrainJoinStates } from '../src/utils/seam'

describe('seam', () => {
  it('returns seam when trains are exactly attached', () => {
    expect(
      collectAdjacentBoundaries(
        [
          { x: 0, width: 100 },
          { x: 100, width: 80 },
        ],
        0.5,
      ),
    ).toEqual([100])
  })

  it('returns seam when trains are attached within epsilon', () => {
    expect(
      collectAdjacentBoundaries(
        [
          { x: 0, width: 100 },
          { x: 100.3, width: 80 },
        ],
        0.5,
      ),
    ).toEqual([100])
  })

  it('returns no seam when trains have real gap', () => {
    expect(
      collectAdjacentBoundaries(
        [
          { x: 0, width: 100 },
          { x: 102, width: 80 },
        ],
        0.5,
      ),
    ).toEqual([])
  })

  it('returns no seam when trains overlap beyond epsilon', () => {
    expect(
      collectAdjacentBoundaries(
        [
          { x: 0, width: 100 },
          { x: 98, width: 80 },
        ],
        0.5,
      ),
    ).toEqual([])
  })

  it('returns multiple seams for chained trains', () => {
    expect(
      collectAdjacentBoundaries(
        [
          { x: 0, width: 50 },
          { x: 50, width: 50 },
          { x: 100, width: 30 },
        ],
        0.5,
      ),
    ).toEqual([50, 100])
  })

  it('returns seam at expected gap center when expected gap is configured', () => {
    expect(
      collectAdjacentBoundaries(
        [
          { x: 0, width: 100 },
          { x: 104, width: 80 },
        ],
        0.5,
        4,
      ),
    ).toEqual([102])
  })
})

describe('train join state', () => {
  it('returns no join for single train', () => {
    expect(
      collectTrainJoinStates(
        [
          { x: 0, width: 100 },
        ],
        0.5,
      ),
    ).toEqual([
      { joinLeft: false, joinRight: false },
    ])
  })

  it('returns right and left joins for attached trains', () => {
    expect(
      collectTrainJoinStates(
        [
          { x: 0, width: 100 },
          { x: 100, width: 80 },
        ],
        0.5,
      ),
    ).toEqual([
      { joinLeft: false, joinRight: true },
      { joinLeft: true, joinRight: false },
    ])
  })

  it('returns no joins when trains are separated by real gap', () => {
    expect(
      collectTrainJoinStates(
        [
          { x: 0, width: 100 },
          { x: 102, width: 80 },
        ],
        0.5,
      ),
    ).toEqual([
      { joinLeft: false, joinRight: false },
      { joinLeft: false, joinRight: false },
    ])
  })

  it('returns chained joins for continuous trains', () => {
    expect(
      collectTrainJoinStates(
        [
          { x: 0, width: 50 },
          { x: 50.1, width: 50 },
          { x: 100, width: 30 },
        ],
        0.5,
      ),
    ).toEqual([
      { joinLeft: false, joinRight: true },
      { joinLeft: true, joinRight: true },
      { joinLeft: true, joinRight: false },
    ])
  })

  it('returns joins when expected gap is configured', () => {
    expect(
      collectTrainJoinStates(
        [
          { x: 0, width: 100 },
          { x: 104, width: 80 },
        ],
        0.5,
        4,
      ),
    ).toEqual([
      { joinLeft: false, joinRight: true },
      { joinLeft: true, joinRight: false },
    ])
  })
})
