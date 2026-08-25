/** Research gap-closers from docs/COMPETITOR-RESEARCH.md, as pure logic:
 *  - ownership chaining: level N starts from the student's OWN level N-1
 *    solution (Blockly's finding: ownership beats fill-in-the-blank)
 *  - spaced mastery: Leitner-style boxes over passed levels (MakeCode's
 *    criticized hole — exploration without retention design)
 * UI wiring lives in main.ts; this module is unit-tested. */

export interface MasteryState {
  /** Leitner box 1..5; 5 = mastered */
  box: number
  /** unix seconds of last pass */
  last: number
}

export const MASTERY_INTERVALS_DAYS: readonly number[] = [1, 3, 7, 14, 30]

/** Record a pass: promote the box, stamp the time. */
export function nextMastery(m: MasteryState | undefined, nowSec: number): MasteryState {
  return { box: Math.min((m?.box ?? 0) + 1, MASTERY_INTERVALS_DAYS.length), last: nowSec }
}

/** A level is due for spaced review once its current interval has elapsed
 *  since the last pass. Box 5 never comes due (mastered). */
export function masteryDue(m: MasteryState | undefined, nowSec: number): boolean {
  if (!m || m.box < 1 || m.box >= MASTERY_INTERVALS_DAYS.length) return false
  return nowSec - m.last >= MASTERY_INTERVALS_DAYS[m.box - 1] * 86400
}

/** Human phrasing for the console: how soon the next review lands. */
export function masteryNextIn(m: MasteryState): string {
  if (m.box >= MASTERY_INTERVALS_DAYS.length) return 'mastered'
  return `${MASTERY_INTERVALS_DAYS[m.box - 1]} day${MASTERY_INTERVALS_DAYS[m.box - 1] === 1 ? '' : 's'}`
}

export interface ChainLevel {
  id: string
}

/** The level immediately BEFORE `id` in the authored order — the one whose
 *  solution seeds this level's starter (null for the first level / unknown). */
export function previousLevel<T extends ChainLevel>(levels: T[], id: string): T | null {
  const i = levels.findIndex((l) => l.id === id)
  return i > 0 ? levels[i - 1] : null
}
