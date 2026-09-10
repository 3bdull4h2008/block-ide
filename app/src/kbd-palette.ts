import { blip, blipError, blipSuccess } from './utils/audio'
import { tourHooks } from './tour'
import { spliceInsert, insertTopLevel } from './ops'
import { pickAnchor, caretOffset } from './caret'
import type { PaletteItem } from './palette'
import type { BBlock } from './blocks'
import type { CaretAnchor } from './caret'

export interface KbdPaletteDeps {
  paletteEl: HTMLDivElement
  consoleEl: HTMLPreElement
  srcEl: HTMLTextAreaElement
  src: () => string
  setSrc: (s: string) => void
  roots: () => BBlock[]
  caretAnchor: () => CaretAnchor | null
  canonicalize: () => Promise<void>
}

let kbdIdx = -1

export function visibleChips(paletteEl: HTMLDivElement): HTMLElement[] {
  return Array.from(
    paletteEl.querySelectorAll<HTMLElement>('.pal, #make-var, #make-list'),
  ).filter((el) => !el.classList.contains('pal-hide'))
}

export function applyPalFilter(deps: KbdPaletteDeps): void {
  const { paletteEl } = deps
  const palFilter = document.getElementById('pal-filter') as HTMLInputElement
  const q = palFilter.value.trim().toLowerCase()
  const cat = (paletteEl.dataset.catFilter ?? '').toLowerCase()
  kbdIdx = -1
  for (const el of Array.from(
    paletteEl.querySelectorAll<HTMLElement>('.pal, #make-var, #make-list'),
  )) {
    el.classList.remove('pal-kbd')
    const textOk = q === '' || (el.textContent ?? '').toLowerCase().includes(q)
    const group = (el.dataset.group ?? el.dataset.cat ?? '').toLowerCase()
    const catOk = cat === '' || group === cat
    el.classList.toggle('pal-hide', !(textOk && catOk))
  }
  for (const head of Array.from(paletteEl.querySelectorAll<HTMLElement>('.pal-group'))) {
    let visible = 0
    let n = head.nextElementSibling as HTMLElement | null
    while (n && !n.classList.contains('pal-group') && n.id !== 'pal-cats') {
      if (!n.classList.contains('pal-hide')) visible++
      n = n.nextElementSibling as HTMLElement | null
    }
    const headGroup = (head.dataset.group ?? head.dataset.g ?? '').toLowerCase()
    const catHide = cat !== '' && headGroup !== cat
    head.classList.toggle('pal-hide', catHide || (q !== '' && visible === 0))
  }
}

export function keyboardActivateChip(deps: KbdPaletteDeps, el: HTMLElement): void {
  if (el.classList.contains('locked')) {
    deps.consoleEl.textContent = 'locked - complete more Academy levels to unlock this category'
    blipError()
    return
  }
  if (el.classList.contains('pal-dep')) {
    deps.consoleEl.textContent = el.title || 'this block needs its prerequisite first'
    blipError()
    return
  }
  if (el.id === 'make-var' || el.id === 'make-list') {
    ;(el as HTMLButtonElement).click()
    return
  }
  const item = (el as unknown as { __item?: PaletteItem }).__item
  if (!item) return
  if (item.reporter !== undefined) {
    deps.consoleEl.textContent = 'reporter chips drop INTO sockets — drag one onto a round or hex slot'
    blip(200, 0.06, 'square', 0.03)
    return
  }
  tourHooks.advance?.('edit')
  blipSuccess()
  if (item.top) {
    deps.setSrc(`${item.snippet}\n${deps.src()}`)
    void deps.canonicalize()
    return
  }
  if (item.toplevel) {
    deps.setSrc(insertTopLevel(deps.src(), deps.roots(), item.snippet))
    void deps.canonicalize()
    return
  }
  try {
    const anchor = deps.caretAnchor() ?? pickAnchor(deps.roots(), deps.src().length)
    const off = Math.max(0, Math.min(deps.src().length, caretOffset(deps.roots(), deps.src().length, anchor)))
    const next = spliceInsert(deps.src(), off, item.snippet)
    if (next !== null) {
      deps.setSrc(next)
      void deps.canonicalize()
      return
    }
  } catch {
    /* fall through to the hint */
  }
  deps.consoleEl.textContent = 'no insertion point here — click inside main first'
}

export function initKbdPalette(deps: KbdPaletteDeps): void {
  const palFilter = document.getElementById('pal-filter') as HTMLInputElement
  palFilter.addEventListener('input', () => applyPalFilter(deps))
  palFilter.addEventListener('keydown', (e) => {
    const chips = visibleChips(deps.paletteEl)
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      if (chips.length === 0) return
      kbdIdx =
        e.key === 'ArrowDown' ? Math.min(kbdIdx + 1, chips.length - 1) : Math.max(kbdIdx - 1, 0)
      chips.forEach((c, i) => c.classList.toggle('pal-kbd', i === kbdIdx))
      chips[kbdIdx].scrollIntoView({ block: 'nearest' })
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const el = chips[kbdIdx]
      if (el) keyboardActivateChip(deps, el)
    } else if (e.key === 'Escape') {
      e.preventDefault()
      palFilter.value = ''
      applyPalFilter(deps)
      deps.srcEl.focus({ preventScroll: true })
    }
  })
}
