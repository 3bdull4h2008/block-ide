import { flatten, type BBlock } from './blocks'
import { langOf } from './utils/pure'
import type { SlotHit } from './types'

export interface DebugDeps {
  hostEl: HTMLDivElement
  roots: () => BBlock[]
  slotHits: () => SlotHit[]
  running: () => boolean
  activeLang: () => string
  screenToWorld: (sx: number, sy: number) => { x: number; y: number }
  hitTestHeader: (roots: BBlock[], x: number, y: number) => BBlock | null
  commitSlotValue: (s: SlotHit, v: string) => string | null
  validateVarName: (raw: string) => string | null
  knownVars: string[]
  knownLists: string[]
  saveVars: () => void
  renderPalette: () => void
}

export function initDebugHooks(deps: DebugDeps): void {
  const w = window as unknown as Record<string, unknown>
  w.__hitAt = (cx: number, cy: number): string | null => {
    const r = deps.hostEl.getBoundingClientRect()
    const pos = deps.screenToWorld(cx - r.left, cy - r.top)
    const hit = deps.hitTestHeader(deps.roots(), pos.x, pos.y)
    return hit ? hit.label || hit.nodeKind : null
  }
  w.__blocksShape = () =>
    flatten(deps.roots()).map((b) => ({
      kind: b.nodeKind,
      container: b.container,
      kids: b.children.length,
    }))
  w.__slots = () =>
    deps.slotHits().map((s) => ({ type: s.part.type, text: s.part.text }))
  w.__commitSlot = (i: number, v: string) => {
    const s = deps.slotHits()[i]
    if (!s) return 'no such slot'
    return deps.commitSlotValue(s, v)
  }
  w.__makeVar = (raw: string) => {
    const name = deps.validateVarName(raw)
    if (name === null) return 'invalid'
    if (!deps.knownVars.includes(name)) deps.knownVars.push(name)
    deps.saveVars()
    deps.renderPalette()
    return null
  }
  w.__makeList = (raw: string) => {
    const name = deps.validateVarName(raw)
    if (name === null) return 'invalid'
    if (!deps.knownLists.includes(name)) deps.knownLists.push(name)
    deps.saveVars()
    deps.renderPalette()
    return null
  }
  w.__langOf = (path: string) => langOf(path)
  w.__activeLang = () => deps.activeLang()
  w.__labels = () => flatten(deps.roots()).map((b) => b.label)
  w.__runState = () => ({ running: deps.running(), polls: (w as { __polls?: number }).__polls })
}
