import { blip } from './utils/audio'

export const tourHooks: { advance?: (ev: 'edit' | 'run' | 'check') => void } = {}

const TOUR_STEPS: { title: string; body: string; until?: 'edit' | 'run' | 'check' }[] = [
  {
    title: 'Welcome to Cade',
    body: 'Real code on disk is the truth. Blocks are a live view of it — break either one and they stay in sync.',
  },
  {
    title: 'Drag & edit blocks',
    body: 'Drag a chip from the palette into main, or double-click any block text and change it. This step closes when you do.',
    until: 'edit',
  },
  {
    title: 'Run & see',
    body: 'Press Ctrl+Enter to run YOUR program. Output lands in the console. This step closes when you run it.',
    until: 'run',
  },
  {
    title: 'Learn in the Academy',
    body: 'Pick a level, press Load, solve it, then press Check for XP. This step closes on your first Check.',
    until: 'check',
  },
]

export function startTour(): void {
  const overlay = document.getElementById('tour') as HTMLDivElement
  let step = 0
  const title = document.getElementById('tour-title') as HTMLHeadingElement
  const body = document.getElementById('tour-body') as HTMLParagraphElement
  const dots = document.getElementById('tour-dots') as HTMLSpanElement
  const next = document.getElementById('tour-next') as HTMLButtonElement
  const finish = (): void => {
    overlay.style.display = 'none'
    localStorage.setItem('tour-done', '1')
    tourHooks.advance = undefined
  }
  const show = (): void => {
    const s = TOUR_STEPS[step]
    ;[title.textContent, body.textContent] = [s.title, s.body]
    dots.textContent = `${step + 1} / ${TOUR_STEPS.length}`
    next.textContent = s.until ? `Skip — do it myself` : step === TOUR_STEPS.length - 1 ? 'Start coding' : 'Next'
  }
  const advanceTo = (n: number): void => {
    step = n
    if (step >= TOUR_STEPS.length) {
      finish()
      return
    }
    show()
  }
  overlay.style.display = 'flex'
  show()
  next.onclick = () => advanceTo(step + 1)
  tourHooks.advance = (ev) => {
    if (overlay.style.display === 'flex' && TOUR_STEPS[step]?.until === ev) {
      blip(880, 0.08, 'sine', 0.06)
      advanceTo(step + 1)
    }
  }
}
