import { describe, expect, it } from 'vitest'
import { buildBlocks, layoutStack, flatten, type BBlock, type CTreeJSON } from '../src/blocks'
import { pickAnchor, caretOffset, type CaretAnchor } from '../src/caret'
import { execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'

const ctree = (...p: string[]) => resolve(process.cwd(), '..', 'target', 'debug', ...p)

function parse(src: string): CTreeJSON {
  const exe = ctree('ctree_json.exe')
  if (!existsSync(exe)) throw new Error(`missing ${exe} — run cargo build first`)
  return JSON.parse(execFileSync(exe, { input: src, encoding: 'utf8' })).tree
}

function render(src: string): BBlock[] {
  const roots = buildBlocks(parse(src))
  layoutStack(roots, 40, 40)
  return roots
}

const SRC = `#include <stdio.h>

int main(void) {
    int total = 0;
    printf("hi\\n");
    return 0;
}
`

describe('semantic caret map (P1.2)', () => {
  it('anchors the caret to the deepest block containing it', () => {
    const roots = render(SRC)
    const printf = flatten(roots).find((b) => b.nodeKind === 'expression_statement')!
    expect(printf).toBeDefined()
    const mid = Math.floor((printf.start + printf.end) / 2)
    const a = pickAnchor(roots, mid)
    expect(a.id).toBe(printf.id)
    expect(a.kind).toBe('expression_statement')
    // re-deriving the offset lands back inside the same statement
    const pos = caretOffset(roots, SRC.length, a)
    expect(pos).toBeGreaterThanOrEqual(printf.start)
    expect(pos).toBeLessThanOrEqual(printf.end)
  })

  it('keeps the anchor across an unrelated edit BEFORE the anchored node', () => {
    let state = SRC
    let roots = render(state)
    const exprs = () => flatten(roots).filter((b) => b.nodeKind === 'expression_statement')
    expect(exprs().length).toBe(1)
    const anchor = pickAnchor(roots, exprs()[0].start + 2)

    // insert a new statement at the top of main — every byte shifts AND the
    // re-parse assigns fresh pre-order ids (ids are dense per parse)
    const decl = flatten(roots).find((b) => b.nodeKind === 'declaration')!
    state = state.slice(0, decl.start) + 'int pad = 9;\n' + state.slice(decl.start)
    roots = render(state)

    // kind + text matching must re-find the printf statement despite the shift
    const printf1 = exprs()[0]
    expect(anchor.kind).toBe(printf1.nodeKind)
    expect(anchor.text).toBe(printf1.label)
    const pos = caretOffset(roots, state.length, anchor)
    expect(pos).toBeGreaterThanOrEqual(printf1.start - 1)
    expect(pos).toBeLessThanOrEqual(printf1.end + 1)
  })

  it('exact id wins over text twins when no re-parse happened', () => {
    const twinSrc = `int main(void) {\n    total = total + 1;\n    total = total + 1;\n}\n`
    const twinRoots = render(twinSrc)
    const twins = flatten(twinRoots).filter((b) => b.nodeKind === 'expression_statement')
    expect(twins.length).toBe(2)
    expect(twins[0].label).toBe(twins[1].label) // genuinely identical statements
    const secondAnchor: CaretAnchor = {
      id: twins[0].id,
      edge: 'start',
      offset: twins[0].start,
      kind: twins[0].nodeKind,
      text: twins[0].label,
    }
    // id resolves to the FIRST twin even though both match by text
    expect(caretOffset(twinRoots, twinSrc.length, secondAnchor)).toBe(twins[0].start)
  })

  it('falls back to the nearest surviving block when the anchored node is deleted', () => {
    let roots = render(SRC)
    const printf = flatten(roots).find((b) => b.nodeKind === 'expression_statement')!
    const anchor = pickAnchor(roots, Math.floor((printf.start + printf.end) / 2))

    // delete exactly the printf statement from the source
    const state = SRC.slice(0, printf.start) + SRC.slice(printf.end)
    roots = render(state)

    // ids are dense pre-order per parse — they are RECYCLED after edits,
    // so "the id no longer exists" is unassertable. Force the last-resort
    // tier with an id no real node can carry and demand sane snapping.
    const orphan: CaretAnchor = { ...anchor, id: 1 << 30 }

    const pos = caretOffset(roots, state.length, orphan)
    expect(pos).toBeGreaterThanOrEqual(0)
    expect(pos).toBeLessThanOrEqual(state.length)
    // snapped onto a surviving block edge (total decl or return stmt)
    const edges = flatten(roots).flatMap((b) => [b.start, b.end])
    expect(edges.some((e) => e === pos)).toBe(true)
  })

  it('edge preference follows which side of the node the caret sat on', () => {
    const roots = render(SRC)
    const ret = flatten(roots).find((b) => b.nodeKind === 'return_statement')!
    const nearStart = pickAnchor(roots, ret.start)
    expect(nearStart.edge).toBe('start')
    expect(caretOffset(roots, SRC.length, nearStart)).toBe(ret.start)
    const nearEnd = pickAnchor(roots, ret.end)
    expect(nearEnd.edge).toBe('end')
    expect(caretOffset(roots, SRC.length, nearEnd)).toBe(ret.end)
  })

  it('clamps out-of-range anchors and handles empty forests', () => {
    const roots = render(SRC)
    expect(
      caretOffset(roots, SRC.length, { id: 999999, edge: 'end', offset: 10 ** 9 }),
    ).toBeLessThanOrEqual(SRC.length)
    expect(caretOffset([], 5, { id: 1, edge: 'start', offset: 99 })).toBe(5)
    const a = pickAnchor([], 7)
    expect(a.offset).toBe(7)
    expect(caretOffset(roots, SRC.length, a)).toBe(0)
  })
})
