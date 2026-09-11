import {
  type MasteryState,
  type StreakState,
  nextMastery,
  masteryDue,
  masteryNextIn,
  previousLevel,
  updateStreak,
  checkBadges,
  BADGES,
} from './academy-extras'
import { readJsonStore, writeJsonStore, readSetting } from './utils/pure'

export interface ProfileOut {
  xp: number
  completed: string[]
  unlocked: string[]
}

export interface LevelInfo {
  id: string
  world: number
  title: string
  xp: number
  done: boolean
}

export interface AcademyDeps {
  invoke: <T>(cmd: string, args?: Record<string, unknown>) => Promise<T>
  consoleEl: HTMLPreElement
  paletteEl: HTMLDivElement
  setSrc: (s: string) => Promise<void>
  src: () => string
  savedSnapshot: (s?: string) => string | void
  caretAnchor: { id: number; edge: string; offset: number } | null
  tourHooks: { advance?: (ev: 'edit' | 'run' | 'check') => void }
  running: () => boolean
  blipError: () => void
  toast: (msg: string, kind?: 'error' | 'success' | 'info', durationMs?: number) => void
  writeJsonStore: (key: string, val: unknown) => void
  readJsonStore: <T>(key: string, fallback: T) => T
}

// ---------------------------------------------------------------------------
// internal state
// ---------------------------------------------------------------------------

let profile: ProfileOut | null = null
let hints: string[] = []
let hintTier = 0

const nowSec = (): number => Math.floor(Date.now() / 1000)
const levelSols = readJsonStore<Record<string, string>>('blockide-levelsol', {})
const mastery = readJsonStore<Record<string, MasteryState>>('blockide-mastery', {})
let streakState = readJsonStore<StreakState | undefined>('blockide-streak', undefined)
let badgesState = readJsonStore<string[]>('blockide-badges', [])
let appStats = readJsonStore<{ runs: number; fixes: number; loopsMastered: number }>(
  'blockide-stats',
  { runs: 0, fixes: 0, loopsMastered: 0 },
)
let levelsCache: LevelInfo[] = []
/** check-flow state feeding badge counters: fail→pass = a fixed program;
 *  distinct looping level ids passed = looping concepts mastered */
let failedLastCheck = false
const loopLevelsPassed = new Set<string>(readJsonStore<string[]>('blockide-looplevels', []))

// D7 mode split: sandbox | academy
type AppMode = 'sandbox' | 'academy'
const appElMode = document.getElementById('app') as HTMLDivElement
let appMode: AppMode = (localStorage.getItem('mode') as AppMode) ?? 'sandbox'

export function getAppMode(): AppMode { return appMode }
export function getProfile(): ProfileOut | null { return profile }

/** palette element ref, captured in initAcademy — setMode re-renders locks */
let modePaletteEl: HTMLDivElement | null = null

/** Academy chrome is Academy-exclusive — the sandbox shows none of it:
 *  XP badge, level/hint/check panel, and the mode switch back out.
 *  The badge additionally honors the Settings "Show XP" toggle. */
function applyModeChrome(): void {
  const academy = appMode === 'academy'
  const showXp = academy && readSetting<boolean>('showXp', true)
  document.getElementById('xp-badge')?.toggleAttribute('hidden', !showXp)
  document.getElementById('academy-section')?.classList.toggle('hidden', !academy)
  const modeToggle = document.getElementById('mode-toggle')
  if (modeToggle) modeToggle.style.display = academy ? '' : 'none'
}

export function refreshModeChrome(): void {
  applyModeChrome()
}

/** One-shot XP badge flourish — retrigger-safe via animationend cleanup. */
function pulseXpBadge(): void {
  const badge = document.getElementById('xp-badge')
  if (!badge || badge.hidden) return
  badge.classList.remove('pulse')
  void badge.offsetWidth // restart the animation if a pulse is mid-flight
  badge.classList.add('pulse')
  badge.addEventListener('animationend', () => badge.classList.remove('pulse'), { once: true })
}

export function setMode(m: AppMode): void {
  appMode = m
  localStorage.setItem('mode', m)
  appElMode.dataset.mode = m
  applyModeChrome()
  if (modePaletteEl) renderPaletteLocks(modePaletteEl, appMode, profile)
}

// ---------------------------------------------------------------------------
// pure helpers
// ---------------------------------------------------------------------------

export function renderPaletteLocks(
  paletteEl: HTMLDivElement,
  mode: AppMode,
  prof: ProfileOut | null,
): void {
  for (const chip of Array.from(paletteEl.children) as HTMLElement[]) {
    const cat = chip.dataset.cat ?? ''
    const locked = mode === 'academy' && prof !== null && !prof.unlocked.includes(cat)
    chip.classList.toggle('locked', locked)
    if (locked) chip.title = `Locked — complete ${cat} levels in the Academy`
    else chip.removeAttribute('title')
  }
}

// ---------------------------------------------------------------------------
// async data
// ---------------------------------------------------------------------------

export async function refreshProfile(deps: AcademyDeps): Promise<void> {
  try {
    profile = await deps.invoke<ProfileOut>('profile_get')
    const xpBadge = document.getElementById('xp-badge') as HTMLSpanElement
    xpBadge.textContent = `★ ${profile.xp} XP`
  } catch {
    /* profile optional */
  }
  renderPaletteLocks(deps.paletteEl, appMode, profile)
}

export async function refreshLevels(deps: AcademyDeps): Promise<void> {
  try {
    const levels = await deps.invoke<LevelInfo[]>('academy_levels')
    levelsCache = levels
    const levelSelect = document.getElementById('level-select') as HTMLSelectElement
    levelSelect.innerHTML = ''
    for (const l of levels) {
      const o = document.createElement('option')
      const due = masteryDue(mastery[l.id], nowSec()) ? ' ⟳review' : ''
      o.value = l.id
      o.textContent = `W${l.world}${l.done ? ' ✓' : ''} · ${l.title} (${l.xp}xp)${due}`
      levelSelect.appendChild(o)
    }
  } catch {
    /* academy dir may be missing */
  }
}

// ---------------------------------------------------------------------------
// hint button helper
// ---------------------------------------------------------------------------

function updateHintBtn(hintsArr: string[], tier: number): void {
  const hintBtn = document.getElementById('hint-btn') as HTMLButtonElement
  hintBtn.textContent =
    hintsArr.length === 0
      ? 'Hint'
      : `Hint (${Math.min(tier + 1, hintsArr.length)}/${hintsArr.length})`
  hintBtn.disabled = hintsArr.length === 0 || tier >= hintsArr.length
}

// ---------------------------------------------------------------------------
// initAcademy — wires up all DOM handlers
// ---------------------------------------------------------------------------

export function initAcademy(deps: AcademyDeps): void {
  const { invoke, consoleEl, paletteEl, setSrc, savedSnapshot, tourHooks, running, toast } = deps

  // load level button
  document.getElementById('level-load')?.addEventListener('click', async () => {
    const levelSelect = document.getElementById('level-select') as HTMLSelectElement
    const id = levelSelect.value
    if (!id) return
    try {
      const l = await invoke<{ starter: string; hints: string[] }>('academy_load', {
        levelId: id,
      })
      // ownership chaining: seed from the student's own previous solution
      const prev = previousLevel(levelsCache, id)
      const chained = prev ? levelSols[prev.id] : undefined
      deps.caretAnchor = null
      setSrc(chained?.trim() ? chained : l.starter)
      savedSnapshot(deps.src()) // the seeded buffer is the clean baseline
      hints = l.hints
      hintTier = 0
      updateHintBtn(hints, hintTier)
      consoleEl.textContent = chained?.trim()
        ? `[academy] ${id} loaded — starting from YOUR "${prev!.id}" solution (ownership chaining). ${hints.length} hints available.`
        : `[academy] ${id} loaded — ${hints.length} hints available. Write code, press Check!`
      if (masteryDue(mastery[id], nowSec())) {
        consoleEl.textContent +=
          '\n[academy] ⟳ spaced review: you solved this before — again cements it.'
      }
    } catch (e) {
      consoleEl.textContent = String(e)
    }
  })

  // hint button
  const hintBtn = document.getElementById('hint-btn') as HTMLButtonElement
  hintBtn?.addEventListener('click', () => {
    if (hintTier >= hints.length) return
    consoleEl.textContent += `\n[hint ${hintTier + 1}/${hints.length}] ${hints[hintTier]}`
    consoleEl.scrollTop = consoleEl.scrollHeight
    hintTier++
    updateHintBtn(hints, hintTier)
  })

  // check button
  document.getElementById('check-btn')?.addEventListener('click', async () => {
    const levelSelect = document.getElementById('level-select') as HTMLSelectElement
    const id = levelSelect.value
    if (!id || running()) return
    consoleEl.textContent = '[academy] checking…'
    try {
      const r = await invoke<{
        passed: boolean
        results: { index: number; ok: boolean }[]
        xp_awarded: number
        total_xp: number
      }>('academy_check', { levelId: id, src: deps.src() })

      if (r.passed) {
        tourHooks.advance?.('check')

        // record THIS solution (ownership chaining seeds the next level)
        levelSols[id] = deps.src()
        writeJsonStore('blockide-levelsol', levelSols)

        // a pass right after a failure = a bug fixed (bug_squasher feed)
        if (failedLastCheck) appStats.fixes++
        failedLastCheck = false
        // distinct looping levels passed = looping concepts mastered
        if (/loop/i.test(id)) loopLevelsPassed.add(id)
        appStats.loopsMastered = loopLevelsPassed.size
        writeJsonStore('blockide-looplevels', [...loopLevelsPassed])

        // promote the spaced-mastery box
        mastery[id] = nextMastery(mastery[id], nowSec())
        writeJsonStore('blockide-mastery', mastery)

        const review = masteryNextIn(mastery[id])

        const oldStreak = streakState?.currentStreak ?? 0
        streakState = updateStreak(streakState, Date.now())
        writeJsonStore('blockide-streak', streakState)

        appStats.runs++
        const newBadges = checkBadges(badgesState, streakState, appStats)
        if (newBadges.length > 0) {
          badgesState.push(...newBadges)
          writeJsonStore('blockide-badges', badgesState)
          const badgeNames = newBadges
            .map((bid) => BADGES.find((b) => b.id === bid)?.name)
            .filter(Boolean)
            .join(', ')
          toast(`New badges unlocked: ${badgeNames}`, 'success', 5000)
        }
        writeJsonStore('blockide-stats', appStats)

        const streakMsg =
          streakState.currentStreak > oldStreak
            ? ` — ${streakState.currentStreak}-day streak!`
            : ` (streak: ${streakState.currentStreak})`

        consoleEl.textContent =
          r.xp_awarded > 0
            ? `[academy] PASSED ✓  +${r.xp_awarded} XP (total ${r.total_xp}) · solution saved — the next level starts from it · next ⟳review in ${review}... ${streakMsg}`
            : `[academy] PASSED ✓  (already completed before — no extra XP) · next ⟳review in ${review}... ${streakMsg}`

        await refreshProfile(deps)
        if (r.xp_awarded > 0) pulseXpBadge()
        await refreshLevels(deps)
      } else {
        tourHooks.advance?.('check')
        const bad = r.results.filter((x) => !x.ok).map((x) => `test[${x.index}]`)
        consoleEl.textContent = `[academy] failed hidden tests: ${bad.join(', ')} — take a hint?`
        failedLastCheck = true // next pass on this level counts as a fix
      }
    } catch (e) {
      consoleEl.textContent = String(e)
    }
  })

  // mode toggle
  const modeToggle = document.getElementById('mode-toggle') as HTMLButtonElement | null
  modeToggle?.addEventListener('click', () => {
    setMode(appMode === 'sandbox' ? 'academy' : 'sandbox')
  })

  // initial render
  modePaletteEl = paletteEl
  appElMode.dataset.mode = appMode
  applyModeChrome()
  renderPaletteLocks(paletteEl, appMode, profile)
  updateHintBtn(hints, hintTier)
  refreshProfile(deps)
  refreshLevels(deps)
}
