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

export interface StreakState {
  currentStreak: number
  longestStreak: number
  lastActivityDate: string // YYYY-MM-DD local time
}

export function updateStreak(s: StreakState | undefined, nowMs: number): StreakState {
  const d = new Date(nowMs)
  const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

  if (!s) return { currentStreak: 1, longestStreak: 1, lastActivityDate: today }
  if (s.lastActivityDate === today) return s // already practiced today

  // parse the stored date's COMPONENTS — `new Date('YYYY-MM-DD')` is UTC
  // midnight, and on negative-UTC-offset machines its local getters report
  // the PREVIOUS day, silently resetting every yesterday-streak
  const [ly, lm, ld] = s.lastActivityDate.split('-').map(Number)
  const utcToday = Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())
  const utcLast = Date.UTC(ly, (lm ?? 1) - 1, ld ?? 1)

  const diffDays = Math.round((utcToday - utcLast) / (1000 * 60 * 60 * 24))

  const currentStreak = diffDays === 1 ? s.currentStreak + 1 : 1
  return {
    currentStreak,
    longestStreak: Math.max(s.longestStreak, currentStreak),
    lastActivityDate: today
  }
}

export interface Badge {
  id: string
  name: string
  description: string
}

export const BADGES: Badge[] = [
  { id: 'first_run', name: 'Hello World', description: 'Run your first program successfully.' },
  { id: 'loop_master', name: 'Loop Master', description: 'Master 3 different looping concepts.' },
  { id: 'bug_squasher', name: 'Bug Squasher', description: 'Fix a program that failed a hidden test.' },
  { id: 'streak_3', name: '3-Day Streak', description: 'Practice for 3 days in a row.' },
  { id: 'streak_7', name: '7-Day Streak', description: 'Practice for a full week.' }
]

export interface BadgeState {
  unlocked: string[] // list of badge IDs
}

export function checkBadges(currentUnlocks: string[], streak: StreakState, stats: { runs: number, fixes: number, loopsMastered: number }): string[] {
  const newlyUnlocked: string[] = []
  
  if (!currentUnlocks.includes('first_run') && stats.runs > 0) newlyUnlocked.push('first_run')
  if (!currentUnlocks.includes('loop_master') && stats.loopsMastered >= 3) newlyUnlocked.push('loop_master')
  if (!currentUnlocks.includes('bug_squasher') && stats.fixes > 0) newlyUnlocked.push('bug_squasher')
  if (!currentUnlocks.includes('streak_3') && streak.longestStreak >= 3) newlyUnlocked.push('streak_3')
  if (!currentUnlocks.includes('streak_7') && streak.longestStreak >= 7) newlyUnlocked.push('streak_7')
  
  return newlyUnlocked
}
