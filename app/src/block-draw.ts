import { Graphics, Container, Text } from 'pixi.js'
import { PAD, ROW_H, TD, type BBlock, palColors } from './blocks'
import { mixWhite, statementPath, cHeaderPath, cBodyPath } from './utils/drawing'
import { WHITE_LABEL, DARK_LABEL } from './utils/styles'
import { partWidth } from './blocks'
import type { SlotHit } from './types'

export interface BlockDrawDeps {
  world: Container
  slotHits: SlotHit[]
  attachHeaderEvents: (obj: import('pixi.js').Container, b: BBlock) => void
  onSlotHit: (s: SlotHit) => void
}

/** Light-theme fills whose ink label beats white (control 2.1:1, variables
 *  2.0:1, comment 1.2:1 with white; ink clears 7:1 on all three). */
const LIGHT_INK = new Set(['control', 'variables', 'comment'])

export function drawBlock(deps: BlockDrawDeps, b: BBlock): void {
  const { world, slotHits, attachHeaderEvents, onSlotHit } = deps
  const g = new Graphics()
  const { fill: fills, edge: edges, dark } = palColors()
  const fill = fills[b.cat] ?? fills.statement
  const edge = edges[b.cat] ?? edges.statement
  // White dies on the warm dark fills (2.0:1 on control) and on pale sand —
  // ink labels clear 3.7:1 everywhere. Light theme keeps Scratch-style white
  // on the saturated cool fills.
  const labelStyle = dark || LIGHT_INK.has(b.cat) ? DARK_LABEL : WHITE_LABEL
  if (b.sticky) {
    g.roundRect(b.x, b.y, b.w, b.h, 8)
    g.fill({ color: fill })
    g.roundRect(b.x, b.y, b.w, b.h, 8)
    g.stroke({ width: 3, color: edge })
    const t = new Text({
      text: b.label,
      style: {
        fontFamily: "'Baloo 2', 'Segoe UI', sans-serif",
        fontSize: 13,
        fontWeight: '600',
        fill: '#6b4d00',
      },
    })
    t.x = b.x + PAD
    t.y = b.y + (ROW_H - t.height) / 2
    t.eventMode = 'static'
    attachHeaderEvents(t, b)
    world.addChild(g, t)
    return
  }
  g.roundRect(b.x + 2, b.y + 4, b.w, b.h + TD, b.container ? 12 : 9)
  g.fill({ color: 0x0c3543, alpha: 0.18 })

  if (b.container) {
    cBodyPath(g, b.x, b.y, b.w, ROW_H, b.h, true)
    g.fill({ color: mixWhite(fill, 0.62) })
    cHeaderPath(g, b.x, b.y, b.w, ROW_H)
    g.fill({ color: fill })
    g.roundRect(b.x + 3, b.y + 3, Math.max(0, b.w - 6), 3, 2)
    g.fill({ color: 0xffffff, alpha: 0.4 })
    cHeaderPath(g, b.x, b.y, b.w, ROW_H)
    g.stroke({ width: 3, color: edge })
    cBodyPath(g, b.x, b.y, b.w, ROW_H, b.h, false)
    g.stroke({ width: 3, color: edge })
  } else {
    statementPath(g, b.x, b.y, b.w, b.h)
    g.fill({ color: fill })
    g.roundRect(b.x + 3, b.y + 3, Math.max(0, b.w - 6), 3, 2)
    g.fill({ color: 0xffffff, alpha: 0.35 })
    statementPath(g, b.x, b.y, b.w, b.h)
    g.stroke({ width: 3, color: edge })
  }
  const header: (Text | Graphics)[] = []
  if (b.parts.length === 0) {
    const t = new Text({ text: b.label || b.nodeKind, style: labelStyle })
    t.x = b.x + PAD
    t.y = b.y + (ROW_H - t.height) / 2
    header.push(t)
  } else {
    let cx = b.x + PAD + 5
    for (const p of b.parts) {
      const w = partWidth(p)
      if (p.type === 'text') {
        const t = new Text({ text: p.text, style: labelStyle })
        t.x = cx
        t.y = b.y + (ROW_H - t.height) / 2
        header.push(t)
      } else if (p.type === 'bool') {
        const w = partWidth(p)
        const y0 = b.y + 6
        const h = ROW_H - 12
        const pt = 9
        const box = new Graphics()
        box.moveTo(cx + pt, y0)
        box.lineTo(cx + w - pt, y0)
        box.lineTo(cx + w, y0 + h / 2)
        box.lineTo(cx + w - pt, y0 + h)
        box.lineTo(cx + pt, y0 + h)
        box.lineTo(cx, y0 + h / 2)
        box.closePath()
        box.fill({ color: 0xf6fbff })
        box.moveTo(cx + pt, y0)
        box.lineTo(cx + w - pt, y0)
        box.lineTo(cx + w, y0 + h / 2)
        box.lineTo(cx + w - pt, y0 + h)
        box.lineTo(cx + pt, y0 + h)
        box.lineTo(cx, y0 + h / 2)
        box.closePath()
        box.stroke({ width: 2, color: edge, alpha: 0.5 })
        const t = new Text({ text: p.text, style: DARK_LABEL })
        t.x = cx + (w - t.width) / 2
        t.y = b.y + (ROW_H - t.height) / 2
        header.push(box, t)
        const hit: SlotHit = { block: b, part: p, x: cx, y: y0, w, h }
        slotHits.push(hit)
        onSlotHit(hit)
      } else {
        const box = new Graphics()
        box.roundRect(cx, b.y + 6, w, ROW_H - 12, 7)
        box.fill({ color: 0xf6fbff })
        box.roundRect(cx, b.y + 6, w, ROW_H - 12, 7)
        box.stroke({ width: 2, color: edge, alpha: 0.5 })
        const t = new Text({ text: p.text, style: DARK_LABEL })
        t.x = cx + (w - t.width) / 2
        t.y = b.y + (ROW_H - t.height) / 2
        header.push(box, t)
        const hit: SlotHit = { block: b, part: p, x: cx, y: b.y + 6, w, h: ROW_H - 12 }
        slotHits.push(hit)
        onSlotHit(hit)
      }
      cx += w + 7
    }
  }

  g.roundRect(b.x + 5, b.y + 5, 5, Math.min(ROW_H - 10, b.h - 10), 2)
  g.fill({ color: 0x000000, alpha: 0.22 })
  world.addChild(g, ...header)
  g.eventMode = 'static'
  attachHeaderEvents(g, b)
  for (const c of b.children) drawBlock(deps, c)
}
