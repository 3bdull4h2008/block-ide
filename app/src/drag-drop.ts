import { Graphics, Text, Container } from 'pixi.js'
import { blip, blipError, blipSuccess, blipDrop } from './utils/audio'
import { WHITE_LABEL } from './utils/styles'
import { statementPath, catColor, isInsideRange } from './utils/drawing'
import { spliceInsert, spliceMove, insertTopLevel } from './ops'
import { reporterFits } from './palette'
import {
  BORDER,
  PAD,
  ROW_H,
  TD,
  INDENT,
  measure,
  flatten,
  findDropTarget,
  type BBlock,
  type Cat,
} from './blocks'
import type { SlotHit } from './types'

export interface DragPayload {
  label: string
  snippet?: string
  cat?: string
  move?: { start: number; end: number }
  slotValue?: string
  slotKind?: 'round' | 'bool'
  toplevel?: boolean
  insertTop?: boolean
}

export interface DragDropDeps {
  hostEl: HTMLDivElement
  world: import('pixi.js').Container
  snapLayer: import('pixi.js').Container
  ghost: HTMLDivElement
  dropbar: HTMLDivElement
  consoleEl: HTMLPreElement
  screenToWorld: (ox: number, oy: number) => { x: number; y: number }
  slotHits: () => SlotHit[]
  roots: () => BBlock[]
  src: () => string
  setSrc: (s: string) => void
  canonicalize: () => Promise<void>
  activeLang: () => string
  commitSlotValue: (s: SlotHit, raw: string) => string | null
  tourHooks: { advance?: (ev: 'edit' | 'run' | 'check') => void }
}

let dragState: DragPayload | null = null

function clearSnapGhost(snapLayer: import('pixi.js').Container): void {
  snapLayer.removeChildren()
}

function drawSnapGhost(
  snapLayer: import('pixi.js').Container,
  gx: number,
  gy: number,
  w: number,
  h: number,
  cat: string | undefined,
  label: string,
): void {
  const fill = catColor(cat)
  const hh = Math.max(ROW_H, h)
  const g = new Graphics()
  g.roundRect(gx + 2, gy + 4, w, hh + TD, 9)
  g.fill({ color: 0x0c3543, alpha: 0.18 })
  statementPath(g, gx, gy, w, hh)
  g.fill({ color: fill, alpha: 0.45 })
  g.roundRect(gx + 3, gy + 3, Math.max(0, w - 6), 3, 2)
  g.fill({ color: 0xffffff, alpha: 0.25 })
  statementPath(g, gx, gy, w, hh)
  g.stroke({ width: 3, color: fill, alpha: 0.6 })
  const t = new Text({ text: label, style: WHITE_LABEL })
  t.alpha = 0.55
  t.x = gx + PAD
  t.y = gy + (ROW_H - t.height) / 2
  snapLayer.addChild(g, t)
}

function slotUnderWorldPoint(slotHits: SlotHit[], wx: number, wy: number): SlotHit | null {
  for (const s of slotHits) {
    if (wx >= s.x && wx <= s.x + s.w && wy >= s.y && wy <= s.y + s.h) return s
  }
  return null
}

function nearestCompatibleSlot(
  slotHits: SlotHit[],
  roots: BBlock[],
  wx: number,
  wy: number,
  kind: 'round' | 'bool' | undefined,
): SlotHit | null {
  const hitTestHeader = (roots: BBlock[], x: number, y: number): BBlock | null => {
    for (const b of flatten(roots)) {
      if (!b.container && x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + ROW_H) return b
    }
    return null
  }
  const blk = hitTestHeader(roots, wx, wy) ?? null
  if (!blk) return null
  let best: SlotHit | null = null
  let bestD = Infinity
  for (const s of slotHits) {
    if (s.block.id !== blk.id || !reporterFits(kind, s.part.type)) continue
    const d = (s.x + s.w / 2 - wx) ** 2 + (s.y + s.h / 2 - wy) ** 2
    if (d < bestD) {
      bestD = d
      best = s
    }
  }
  return best
}

export function startHtmlDrag(deps: DragDropDeps, e: PointerEvent, payload: DragPayload): void {
  dragState = payload
  deps.ghost.innerHTML = ''
  const fill = catColor(payload.cat)
  const w = Math.max(90, measure(payload.label))
  const h = Math.max(ROW_H, 34)
  const g = new Graphics()
  g.roundRect(2, 4, w, h + TD, 9)
  g.fill({ color: 0x0c3543, alpha: 0.18 })
  statementPath(g, 0, 0, w, h)
  g.fill({ color: fill })
  g.roundRect(3, 3, Math.max(0, w - 6), 3, 2)
  g.fill({ color: 0xffffff, alpha: 0.35 })
  statementPath(g, 0, 0, w, h)
  g.stroke({ width: 3, color: BORDER[(payload.cat as Cat) ?? 'statement'] ?? BORDER.statement })
  const t = new Text({ text: payload.label, style: WHITE_LABEL })
  t.x = PAD
  t.y = (ROW_H - 13) / 2
  const container = new Container()
  container.addChild(g)
  container.addChild(t)
  container.x = 0
  container.y = 0
  deps.snapLayer.addChild(container)
  deps.ghost.innerHTML = ''
  deps.ghost.style.display = 'block'
  deps.ghost.style.left = `${e.clientX + 12}px`
  deps.ghost.style.top = `${e.clientY - 14}px`
  deps.ghost.style.opacity = '0.5'
  blip(520, 0.05, 'triangle', 0.05)

  function onDragMove(ev: PointerEvent): void {
    deps.ghost.style.left = `${ev.clientX + 12}px`
    deps.ghost.style.top = `${ev.clientY - 14}px`
    const r = deps.hostEl.getBoundingClientRect()
    const inside =
      ev.clientX >= r.left && ev.clientX <= r.right && ev.clientY >= r.top && ev.clientY <= r.bottom
    const slotHits = deps.slotHits()
    const roots = deps.roots()
    if (inside && dragState) {
      const w = deps.screenToWorld(ev.clientX - r.left, ev.clientY - r.top)
      if (dragState.slotValue) {
        const s = slotUnderWorldPoint(slotHits, w.x, w.y) ?? nearestCompatibleSlot(slotHits, roots, w.x, w.y, dragState.slotKind)
        clearSnapGhost(deps.snapLayer)
        deps.dropbar.style.display = 'none'
        if (s && reporterFits(dragState.slotKind, s.part.type)) {
          const g = new Graphics()
          const hex = s.part.type === 'bool'
          const hl = (x: number, y: number, ww: number, hh: number): void => {
            if (!hex) { g.roundRect(x, y, ww, hh, 9); return }
            const pt = 9
            g.moveTo(x + pt, y); g.lineTo(x + ww - pt, y); g.lineTo(x + ww, y + hh / 2)
            g.lineTo(x + ww - pt, y + hh); g.lineTo(x + pt, y + hh); g.lineTo(x, y + hh / 2)
            g.closePath()
          }
          g.moveTo(0, 0)
          hl(s.x - 3, s.y - 3, s.w + 6, s.h + 6)
          g.fill({ color: 0xff8c1a, alpha: 0.25 })
          hl(s.x - 3, s.y - 3, s.w + 6, s.h + 6)
          g.stroke({ width: 3, color: 0xff8c1a })
          deps.snapLayer.addChild(g)
          deps.ghost.style.opacity = '1'
          return
        }
        deps.ghost.style.opacity = '0.5'
        return
      }
      const target = findDropTarget(roots, w.x, w.y)
      if (target && !(dragState.move && isInsideRange(target.container, dragState.move))) {
        const kids = target.container.children
        const y = target.index < kids.length
          ? kids[target.index].y
          : kids.length > 0
            ? kids[kids.length - 1].y + kids[kids.length - 1].h + TD
            : target.container.y + ROW_H
        const rr = deps.hostEl.getBoundingClientRect()
        deps.dropbar.style.display = 'block'
        deps.dropbar.style.left = `${rr.left + (target.container.x + 4) * deps.world.scale.x + deps.world.x}px`
        deps.dropbar.style.top = `${rr.top + (y - 3) * deps.world.scale.y + deps.world.y}px`
        deps.dropbar.style.width = `${Math.max(0, (target.container.w - 8) * deps.world.scale.x)}px`
        clearSnapGhost(deps.snapLayer)
        const d = dragState
        let bw: number; let bh: number; let cat: string | undefined
        if (d.move) {
          const src = flatten(roots).find((b) => b.start === d.move!.start && b.end === d.move!.end)
          bw = src?.w ?? 120; bh = src?.h ?? ROW_H; cat = src?.cat
        } else { bw = Math.max(90, measure(d.label)); bh = ROW_H; cat = d.cat }
        drawSnapGhost(deps.snapLayer, target.container.x + INDENT, y, bw, bh, cat ?? (dragState.move ? undefined : 'statement'), dragState.label)
        return
      }
    }
    deps.dropbar.style.display = 'none'
    clearSnapGhost(deps.snapLayer)
  }

  async function onDragEnd(ev: PointerEvent): Promise<void> {
    window.removeEventListener('pointermove', onDragMove)
    deps.ghost.style.display = 'none'
    deps.ghost.style.opacity = '1'
    deps.dropbar.style.display = 'none'
    clearSnapGhost(deps.snapLayer)
    const d = dragState
    dragState = null
    if (!d) return
    const r = deps.hostEl.getBoundingClientRect()
    const inside =
      ev.clientX >= r.left && ev.clientX <= r.right && ev.clientY >= r.top && ev.clientY <= r.bottom
    if (!inside) return
    const w = deps.screenToWorld(ev.clientX - r.left, ev.clientY - r.top)
    if (d.slotValue) {
      const s = slotUnderWorldPoint(deps.slotHits(), w.x, w.y) ?? nearestCompatibleSlot(deps.slotHits(), deps.roots(), w.x, w.y, d.slotKind)
      if (!s) return
      if (!reporterFits(d.slotKind, s.part.type)) {
        blipError()
        deps.consoleEl.textContent = `that block fits a ${d.slotKind === 'bool' ? 'hex condition' : 'round'} socket — wrong shape here`
        return
      }
      const err = deps.commitSlotValue(s, d.slotValue)
      if (err !== null) { blipError(); deps.consoleEl.textContent = err }
      return
    }
    if (d.toplevel) {
      deps.setSrc(insertTopLevel(deps.src(), deps.roots(), d.snippet ?? ''))
      void deps.canonicalize()
      deps.tourHooks.advance?.('edit')
      blipSuccess()
      return
    }
    if (d.insertTop) {
      deps.setSrc(`${d.snippet ?? ''}\n${deps.src()}`)
      void deps.canonicalize()
      deps.tourHooks.advance?.('edit')
      blipSuccess()
      return
    }
    let target = findDropTarget(deps.roots(), w.x, w.y)
    if (!target) {
      const virtualRoot = deps.roots().find(r => r.container && r.children.length === 0) || deps.roots()[0]
      if (virtualRoot) { target = { container: virtualRoot, index: 0, offset: virtualRoot.start + 1 } }
      else { deps.setSrc(d.snippet ?? ''); void deps.canonicalize(); deps.tourHooks.advance?.('edit'); blipSuccess(); return }
    }
    if (d.move && isInsideRange(target.container, d.move)) return
    const text = deps.src()
    let next: string | null
    const needsIndent = deps.activeLang() === 'python' && !d.move
    if (d.move) { next = spliceMove(text, d.move, target.offset) }
    else { next = spliceInsert(text, target.offset, d.snippet ?? '', needsIndent) }
    if (next === null) return
    blipDrop()
    deps.setSrc(next)
    void deps.canonicalize()
    deps.tourHooks.advance?.('edit')
  }

  window.addEventListener('pointermove', onDragMove)
  window.addEventListener('pointerup', onDragEnd, { once: true })
}

export function getDragState(): DragPayload | null { return dragState }
