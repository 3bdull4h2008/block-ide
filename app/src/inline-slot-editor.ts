import { validateSlotValue } from './palette'
import { blipSlot, blipError } from './utils/audio'
import { tourHooks } from './tour'
import type { BBlock } from './blocks'
import type { SlotHit, ViewMode } from './types'

export interface SlotEditorDeps {
  slotHits: () => SlotHit[]
  src: () => string
  setSrc: (s: string) => void
  canonicalize: () => Promise<void>
  hostEl: HTMLDivElement
  world: import('pixi.js').Container
  screenToWorld: (ox: number, oy: number) => { x: number; y: number }
  hitTestHeader: (roots: BBlock[], x: number, y: number) => BBlock | null
  roots: () => BBlock[]
  viewMode: () => ViewMode
  anchorToBlock: (b: BBlock) => void
}

let editingSlot: SlotHit | null = null

// index.html ships the `.slot-editor` wrapper div — mount the input inside
// it so the CSS contract (`.slot-editor input`, `.slot-editor.open`) applies
const wrapper = document.getElementById('slot-editor') as HTMLDivElement
const slotEditor = document.createElement('input')
wrapper.appendChild(slotEditor)

export function commitSlotValue(deps: SlotEditorDeps, s: SlotHit, raw: string): string | null {
  const final = validateSlotValue(s.part.type, raw)
  if (final === null) {
    return `${s.part.type} slot rejects ${JSON.stringify(raw)}`
  }
  if (final === s.part.text) return null
  const src = deps.src()
  deps.setSrc(src.slice(0, s.part.start) + final + src.slice(s.part.end))
  void deps.canonicalize()
  tourHooks.advance?.('edit')
  blipSlot()
  return null
}

function closeSlotEditor(deps: SlotEditorDeps, commit: boolean): void {
  const s = editingSlot
  editingSlot = null
  wrapper.classList.remove('open', 'bad')
  if (s && commit) {
    const err = commitSlotValue(deps, s, slotEditor.value)
    if (err !== null && s.part.type !== 'string') {
      openSlotEditor(deps, s, true) // keep the user's text so they can fix it
      wrapper.classList.add('bad')
      blipError()
    }
  }
}

function openSlotEditor(deps: SlotEditorDeps, s: SlotHit, preserveValue = false): void {
  editingSlot = s
  const r = deps.hostEl.getBoundingClientRect()
  const scale = deps.world.scale.x
  if (!preserveValue) {
    slotEditor.value =
      s.part.type === 'string' ? s.part.text.replace(/^"(.*)"$/s, '$1') : s.part.text
  }
  wrapper.classList.add('open')
  wrapper.style.left = `${r.left + s.x * scale + deps.world.x - 4}px`
  wrapper.style.top = `${r.top + s.y * scale + deps.world.y}px`
  wrapper.style.width = `${Math.max(60, s.w * scale + 8)}px`
  slotEditor.focus()
  slotEditor.select()
}

export function initSlotEditor(deps: SlotEditorDeps): void {
  slotEditor.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      closeSlotEditor(deps, true)
    } else if (e.key === 'Escape') {
      e.preventDefault()
      closeSlotEditor(deps, false)
    }
  })
  slotEditor.addEventListener('blur', () => {
    if (editingSlot) closeSlotEditor(deps, true)
  })
}

export function slotAt(deps: SlotEditorDeps, b: BBlock, wx: number, wy: number): SlotHit | null {
  for (const s of deps.slotHits()) {
    if (
      s.block.id === b.id &&
      wx >= s.x &&
      wx <= s.x + s.w &&
      wy >= s.y &&
      wy <= s.y + s.h
    ) {
      return s
    }
  }
  return null
}

export function getEditingSlot(): SlotHit | null { return editingSlot }
export { openSlotEditor }
