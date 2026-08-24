import { flatten, type BBlock } from './blocks'

/** Semantic cursor: the text caret is anchored to a NODE plus an edge,
 *  never to a raw byte offset. Resolution prefers kind + collapsed-text
 *  twins (stable across edits and re-parses), then the exact node id
 *  (valid within one parse — ids are dense pre-order per parse, see
 *  canonical.rs), then the nearest surviving edge. This approximates node
 *  identity until the incremental changed-ranges engine (P0.5.1) lands. */
export interface CaretAnchor {
  id: number
  edge: 'start' | 'end'
  /** byte offset captured with the anchor */
  offset: number
  /** discriminator for re-finding the node after an unrelated edit */
  kind?: string
  /** whitespace-collapsed body text at capture time */
  text?: string
}

export const NO_ANCHOR: CaretAnchor = { id: -1, edge: 'start', offset: 0 }

function nearestByDistance(blocks: BBlock[], off: number): BBlock {
  let best = blocks[0]
  let bestD = Infinity
  for (const b of blocks) {
    const d = Math.min(Math.abs(b.start - off), Math.abs(b.end - off))
    if (d < bestD) {
      bestD = d
      best = b
    }
  }
  return best
}

function resolve(blocks: BBlock[], a: CaretAnchor): { hit: BBlock; exact: boolean } {
  const all = flatten(blocks)
  // 1. same kind + same normalized text (survives byte shifts AND the id
  // churn of re-parses — ids are dense pre-order, so they get recycled by
  // any structural edit and must NEVER be trusted across parses)
  if (a.kind && a.text !== undefined) {
    const twins = all.filter((b) => b.nodeKind === a.kind && b.label === a.text)
    if (twins.length > 0) return { hit: nearestByDistance(twins, a.offset), exact: true }
  }
  // 2. exact node identity — meaningful only within ONE parse (pure view
  // switches); covers nodes whose label changed since capture. Across
  // parses this is best-effort: a recycled id resolves to *a* real node,
  // never a fabricated one.
  const byId = all.find((b) => b.id === a.id)
  if (byId) return { hit: byId, exact: true }
  // 3. nearest surviving block edge
  return { hit: nearestByDistance(all, a.offset), exact: false }
}

/** Map a raw caret offset to the deepest (narrowest-span) block containing
 *  it; falls back to the block whose span edge is closest. Zero-width
 *  (missing-token) spans count as containing their exact offset. */
export function pickAnchor(blocks: BBlock[], off: number): CaretAnchor {
  if (blocks.length === 0) return { ...NO_ANCHOR, offset: off }
  const all = flatten(blocks)
  let deep: BBlock | null = null
  for (const b of all) {
    if ((b.start <= off && off <= b.end) || (b.start === off && b.end === off)) {
      if (!deep || b.end - b.start <= deep.end - deep.start) deep = b
    }
  }
  const hit = deep ?? nearestByDistance(all, off)
  const mid = (hit.start + hit.end) / 2
  return {
    id: hit.id,
    edge: off > mid ? 'end' : 'start',
    offset: off,
    kind: hit.nodeKind,
    text: hit.label,
  }
}

/** Inverse map: anchor → byte offset against the CURRENT parse, clamped to
 *  [0, len]. Exact resolutions honor the captured edge; when the node is
 *  gone entirely, the endpoint of the nearest survivor closest to the old
 *  caret wins. Empty forests degrade to the clamped raw offset. */
export function caretOffset(blocks: BBlock[], len: number, a: CaretAnchor): number {
  if (blocks.length === 0) return Math.max(0, Math.min(a.offset, len))
  const { hit, exact } = resolve(blocks, a)
  const pos = exact
    ? a.edge === 'end'
      ? hit.end
      : hit.start
    : Math.abs(hit.start - a.offset) <= Math.abs(hit.end - a.offset)
      ? hit.start
      : hit.end
  return Math.max(0, Math.min(pos, len))
}
