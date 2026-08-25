import { describe, expect, it } from 'vitest'
import {
  MASTERY_INTERVALS_DAYS,
  masteryDue,
  masteryNextIn,
  nextMastery,
  previousLevel,
} from '../src/academy-extras'

describe('spaced mastery (Leitner boxes)', () => {
  it('first pass lands in box 1; passes promote up to mastered', () => {
    expect(nextMastery(undefined, 1000)).toEqual({ box: 1, last: 1000 })
    expect(nextMastery({ box: 1, last: 1000 }, 2000)).toEqual({ box: 2, last: 2000 })
    expect(nextMastery({ box: 4, last: 1 }, 2).box).toBe(5)
    expect(nextMastery({ box: 5, last: 1 }, 2).box).toBe(5) // capped
  })

  it('due exactly when the CURRENT box interval has elapsed; box 5 never', () => {
    const day = 86400
    expect(masteryDue(undefined, 999999)).toBe(false)
    expect(masteryDue({ box: 1, last: 0 }, day - 1)).toBe(false)
    expect(masteryDue({ box: 1, last: 0 }, day)).toBe(true)
    expect(masteryDue({ box: 3, last: 0 }, 7 * day - 1)).toBe(false)
    expect(masteryDue({ box: 3, last: 0 }, 7 * day)).toBe(true)
    expect(MASTERY_INTERVALS_DAYS[2]).toBe(7)
    expect(masteryDue({ box: 5, last: 0 }, Number.MAX_SAFE_INTEGER)).toBe(false)
  })

  it('phrases the next review window', () => {
    expect(masteryNextIn({ box: 1, last: 0 })).toBe('1 day')
    expect(masteryNextIn({ box: 3, last: 0 })).toBe('7 days')
    expect(masteryNextIn({ box: 5, last: 0 })).toBe('mastered')
  })
})

describe('ownership chaining', () => {
  const levels = [{ id: 'w1-01' }, { id: 'w1-02' }, { id: 'w1-03' }]
  it('returns the immediately preceding level', () => {
    expect(previousLevel(levels, 'w1-02')?.id).toBe('w1-01')
    expect(previousLevel(levels, 'w1-03')?.id).toBe('w1-02')
  })
  it('first level and unknown ids have no predecessor', () => {
    expect(previousLevel(levels, 'w1-01')).toBeNull()
    expect(previousLevel(levels, 'nope')).toBeNull()
  })
})
