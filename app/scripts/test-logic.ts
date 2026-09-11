/**
 * External logic tests — run OUTSIDE the app with plain Node:
 *
 *   node --import ./scripts/register-ts.mjs scripts/test-logic.ts
 *
 * These import the REAL TS sources (no bundler, no DOM, no Tauri) and
 * assert the core logic contracts, including regressions for every bug
 * fixed in the 2026-09-11 logic pass. Exit code 1 on any failure.
 */
import assert from 'node:assert/strict'

import { spliceInsert, spliceMove, applyEdit, insertTopLevel, overlaps } from '../src/ops.ts'
import { History } from '../src/history.ts'
import {
  buildBlocks, layoutStack, flatten, findDropTarget, hitTestHeader,
  harvestVars, measure,
  type CNodeJSON, type CTreeJSON,
} from '../src/blocks.ts'
import { pickAnchor, caretOffset } from '../src/caret.ts'
import {
  byteIndexTable, byteToIndex, normalizeTreeOffsets, normalizeDiagOffsets,
} from '../src/utils/offsets.ts'
import {
  nextMastery, masteryDue, masteryNextIn, previousLevel, updateStreak, checkBadges,
} from '../src/academy-extras.ts'
import { interpretC, type TraceStep } from '../src/tracer.ts'
import { validateSlotValue, reporterFits } from '../src/palette.ts'
import { indentLines, splitLine, toggleCommentLines } from '../src/utils/edit-ops.ts'
import { langOf, trimmedEndsWithOpener, baseName, dirName, normSlashes } from '../src/utils/pure.ts'

// ── micro harness ──────────────────────────────────────────────────────────
let passed = 0
const failures: string[] = []
const sections = new Map<string, number>()
function check(name: string, section: string, fn: () => void): void {
  try {
    fn()
    passed++
    sections.set(section, (sections.get(section) ?? 0) + 1)
  } catch (e) {
    failures.push(`${section} › ${name}: ${(e as Error).message}`)
  }
}

// ── tree fixture helper ────────────────────────────────────────────────────
let nextId = 1
function node(kind: string, opts: Partial<CNodeJSON> & { children?: CNodeJSON[] } = {}): CNodeJSON {
  const children = opts.children ?? []
  return {
    id: nextId++,
    kind,
    field: opts.field ?? null,
    named: opts.named ?? true,
    missing: false,
    start: opts.start ?? 0,
    end: opts.end ?? 0,
    pre: '',
    text: opts.text ?? null,
    children,
  }
}
function tree(root: CNodeJSON, lang = 'c'): CTreeJSON {
  return { root, tail: '', lang }
}

// ═══════════════════════════════ 1. BYTE→CHAR OFFSETS ═════════════════════
const SRC = '// café 你好 🎉\nint x = 1;\n'

check('byteIndexTable round-trips every index', 'offsets', () => {
  const t = byteIndexTable(SRC)
  assert.equal(t.length, SRC.length + 1)
  assert.equal(t[0], 0)
  assert.equal(t[SRC.length], Buffer.byteLength(SRC, 'utf8'))
  for (let i = 0; i <= SRC.length; i++) {
    assert.equal(byteToIndex(t, t[i]), i, `index ${i}`)
  }
})

check('byteToIndex clamps mid-codepoint offsets', 'offsets', () => {
  const t = byteIndexTable('é') // 2 bytes, 1 unit
  assert.equal(byteToIndex(t, 0), 0)
  assert.equal(byteToIndex(t, 1), 0) // inside the é → floor to 0
  assert.equal(byteToIndex(t, 2), 1)
  assert.equal(byteToIndex(t, 99), 1) // clamp past end
})

check('normalizeTreeOffsets rewrites nested spans once', 'offsets', () => {
  // tree built against the BYTE offsets of the declaration line
  const declBytes = Buffer.byteLength('// café 你好 🎉\n', 'utf8')
  const t = tree(node('translation_unit', {
    children: [
      node('primitive_type', { text: 'int' }),
      node('declaration', {
        start: declBytes, end: declBytes + 10,
        children: [node('init_declarator', { start: declBytes + 4, end: declBytes + 10 })],
      }),
    ],
  }))
  normalizeTreeOffsets(t, SRC)
  const decl = t.root.children[1]
  assert.equal(decl.start, SRC.indexOf('int x = 1;'))
  assert.equal(decl.end, SRC.indexOf('int x = 1;') + 10)
  assert.equal(decl.children[0].start, SRC.indexOf('x = 1;'))
})

check('normalizeDiagOffsets converts diag positions', 'offsets', () => {
  const at = SRC.indexOf('x = 1;')
  const byteOff = Buffer.byteLength(SRC.slice(0, at), 'utf8') + 2
  const diags = [{ offset: byteOff, severity: 'error', message: 'x', line: 2, col: 3, node_id: 1, node_kind: 'x' }]
  normalizeDiagOffsets(diags as never, SRC)
  assert.equal(diags[0].offset, at + 2)
})

// ═══════════════════════════════ 2. SPLICE PRIMITIVES ═════════════════════
check('autoIndent drop PRESERVES the target line (was: deleted it)', 'ops', () => {
  const text = 'if x:\n    do_thing()'
  // dropping a block at EOF — the last statement's text must survive
  const next = spliceInsert(text, text.length, 'new_block()', true)
  assert.ok(next.includes('    do_thing()'), `lost line: ${JSON.stringify(next)}`)
  assert.ok(next.includes('new_block()'))
})

check('autoIndent on an indented empty offset keeps following text', 'ops', () => {
  const text = 'if x:\n    do_thing()\n    more()'
  const at = text.indexOf('    more()')
  const next = spliceInsert(text, at, 'inserted()', true)
  assert.ok(next.includes('do_thing()'))
  assert.ok(next.includes('    more()'))
  assert.ok(next.includes('inserted()'))
})

check('plain insert adds exactly one newline on each side as needed', 'ops', () => {
  assert.equal(spliceInsert('ab', 1, 'X'), 'a\nX\nb')
  assert.equal(spliceInsert('a\n', 2, 'X'), 'a\nX\n') // EOF insert normalizes trailing newline
  assert.equal(spliceInsert('\na', 0, 'X'), 'X\na')
})

check('spliceMove: null inside range, offset adjusted past cut', 'ops', () => {
  const text = 'aaa\nbbb\nccc'
  const move = { start: 4, end: 7 }
  assert.equal(spliceMove(text, move, 5), null) // inside the moved block
  assert.ok(overlaps(5, move))
  // move to end (offset 11 = EOF): the cut leaves a blank line — cleanup
  // is canonicalize's job, not the splice's
  assert.equal(spliceMove(text, move, 11), 'aaa\n\nccc\nbbb\n')
  // move to top (offset 0 = file start): the cut leaves a blank line,
  // which canonicalize owns
  assert.equal(spliceMove(text, move, 0), 'bbb\naaa\n\nccc')
})

check('applyEdit replaces [start, headerEnd) only', 'ops', () => {
  const b = { start: 2, headerEnd: 5 }
  assert.equal(applyEdit(b, 'NEW')('0123456789'), '01NEW56789')
})

check('insertTopLevel: EOF on empty, after last root otherwise', 'ops', () => {
  assert.equal(insertTopLevel('code', [], 'X'), 'code\nX\n')
  assert.equal(insertTopLevel('aaaa\nbbbb', [{ end: 4 }], 'X'), 'aaaa\nX\nbbbb')
  assert.equal(insertTopLevel('aaaa', [{ end: 99 }], 'X'), 'aaaa\nX\n') // clamp
})

// ═══════════════════════════════ 3. HISTORY ═══════════════════════════════
check('undo/redo symmetry and future-clearing on push', 'history', () => {
  const h = new History()
  h.push('A', 'op')
  h.push('B', 'op')
  assert.equal(h.undo('C'), 'B')
  assert.equal(h.undo('B'), 'A')
  assert.equal(h.undo('A'), null)
  assert.equal(h.redo('A'), 'B')
  assert.equal(h.redo('B'), 'C')
  h.push('Z', 'op')
  assert.equal(h.redo('Z'), null) // future cleared
})

check('type coalescing merges one typing run into a single entry', 'history', () => {
  const h = new History()
  let now = 1000
  const realNow = Date.now
  Date.now = () => now
  h.push('A', 'op')     // baseline
  now += 100
  h.push('A', 'type')   // edit A→AB: first keystroke pushes prev = A
  now += 100
  h.push('AB', 'type')  // coalesced
  now += 100
  h.push('ABC', 'type') // coalesced — whole run = one entry
  assert.equal(h.undo('ABC'), 'A')
  assert.equal(h.undo('A'), 'A') // the op's own baseline prev
  assert.equal(h.undo('A'), null)
  now += 5000
  h.push('ABC', 'type') // outside the window → fresh entry
  assert.equal(h.undo('ABC'), 'ABC') // pops the fresh prev
  Date.now = realNow
})

check('REGRESSION: undo breaks type-coalescing (redo keeps the NEW branch)', 'history', () => {
  const h = new History()
  let now = 1000
  const realNow = Date.now
  Date.now = () => now
  h.push('A', 'op')
  h.push('A', 'type'); now += 50
  h.push('AB', 'type'); now += 50
  h.push('ABC', 'type'); now += 50
  assert.equal(h.undo('ABC'), 'A')
  // user retypes within 900ms of the last push: the OLD code coalesced this
  // into the pre-undo run AND kept the stale future — redo resurrected the
  // abandoned 'ABC' branch instead of the new edit
  h.push('A', 'type'); now += 50 // edit A→AX, prev = A
  assert.equal(h.undo('AX'), 'A')
  assert.equal(h.redo('A'), 'AX')
  Date.now = realNow
})

check('cap 200: oldest entries drop, stacks stay bounded', 'history', () => {
  const h = new History()
  for (let i = 0; i < 250; i++) h.push(`v${i}`, 'op')
  let cur = 'v249'
  let steps = 0
  for (let u = h.undo(cur); u !== null; u = h.undo(cur)) { cur = u; steps++ }
  assert.equal(steps, 200)
})

// ═══════════════════════════════ 4. BLOCKS MODEL ══════════════════════════
check('C if/else: else_clause unwraps into sibling rows', 'blocks', () => {
  const t = tree(node('translation_unit', {
    children: [node('if_expression', {
      field: 'body',
      children: [
        node('if', { named: false, text: 'if' }),
        node('condition', { field: 'condition', text: '(a)' }),
        node('compound_statement', { field: 'body', children: [node('expression_statement', { text: 'x = 1;' })] }),
        node('else_clause', { field: 'alternative', children: [node('compound_statement', { children: [node('expression_statement', { text: 'y = 2;' })] })] }),
      ],
    })],
  }))
  const roots = buildBlocks(t)
  assert.equal(roots.length, 1)
  const iff = roots[0]
  assert.ok(iff.container)
  assert.equal(iff.children.length, 2) // then + else rows
  assert.match(iff.label, /if/)
  assert.ok(!iff.label.includes('}'), 'braces must not leak into header')
})

check('REGRESSION: bodyless control no longer throws on headerEnd', 'blocks', () => {
  // tree-sitter error recovery: `while` with no body field and no `{`
  const t = tree(node('translation_unit', {
    children: [node('while_expression', {
      children: [node('condition', { field: 'condition', text: '(x' })],
    })],
  }))
  const roots = buildBlocks(t) // must not throw
  assert.equal(roots[0].headerEnd, roots[0].end)
})

check('REGRESSION: python try header free of except/finally tokens', 'blocks', () => {
  const t = tree({
    ...node('module', {
      children: [node('try_statement', {
        children: [
          node('try', { named: false, text: 'try' }),
          node(':', { named: false, text: ':' }),
          node('block', { field: 'body', text: 'a()' }),
          node('except_clause', { field: 'handler', text: 'except ValueError as e:' }),
          node('finally_clause', { field: 'finalbody', text: 'cleanup()' }),
        ],
      })],
    }),
    lang: 'python',
  })
  const roots = buildBlocks(t)
  const tr = roots.find((r) => r.label.includes('try'))
  assert.ok(tr, 'try block exists')
  assert.ok(!tr.label.includes('except'), `header leak: ${tr.label}`)
  assert.ok(!tr.label.includes('finally'), `header leak: ${tr.label}`)
  assert.ok(!tr.parts.some((p) => p.text.includes('except')))
})

check('REGRESSION: harvestVars ignores initializer expressions', 'blocks', () => {
  // int x = y;  → declares x; y is only read
  const decl = (kind: string, text: string): CNodeJSON =>
    node('declaration', { children: [
      node('primitive_type', { text: 'int' }),
      node('init_declarator', { children: [
        node('identifier', { text: kind, named: true }),
        node('identifier', { text, named: true }),
      ] }),
    ] })
  const t = tree(node('translation_unit', { children: [decl('x', 'y')] }))
  assert.deepEqual(harvestVars(t.root), ['x'])
})

check('harvestVars: multi declarators and array/pointer chains', 'blocks', () => {
  const t = tree(node('translation_unit', {
    children: [node('declaration', { children: [
      node('primitive_type', { text: 'int' }),
      node('init_declarator', { children: [node('identifier', { text: 'a' })] }),
      node('init_declarator', { children: [
        node('array_declarator', { children: [node('identifier', { text: 'b' }), node('number_literal', { text: '2' })] }),
      ] }),
      node('pointer_declarator', { children: [node('identifier', { text: 'p' })] }),
    ] })],
  }))
  const vars = harvestVars(t.root).sort()
  assert.deepEqual(vars, ['a', 'b', 'p'])
})

check('layoutStack: siblings non-overlapping, return = max bottom', 'blocks', () => {
  const t = tree(node('translation_unit', { children: [
    node('expression_statement', { text: 'a = 1;' }),
    node('if_expression', {
      children: [
        node('condition', { field: 'condition' }),
        node('compound_statement', { field: 'body', children: [
          node('expression_statement', { text: 'b = 2;' }),
          node('expression_statement', { text: 'c = 3;' }),
        ] }),
      ],
    }),
  ] }))
  const roots = buildBlocks(t)
  const bottom = layoutStack(roots, 40, 40)
  assert.equal(roots[0].x, 40)
  assert.ok(roots[1].y >= roots[0].y + roots[0].h, 'stacked below')
  const inner = roots[1].children
  assert.ok(inner[1].y > inner[0].y, 'children stacked')
  assert.ok(bottom >= roots[1].y + roots[1].h)
})

check('flatten: pre-order, parents before children', 'blocks', () => {
  const t = tree(node('translation_unit', { children: [
    node('if_expression', { children: [
      node('condition', { field: 'condition' }),
      node('compound_statement', { field: 'body', children: [node('expression_statement', { text: 'x;' })] }),
    ] }),
  ] }))
  const flat = flatten(buildBlocks(t))
  assert.equal(flat.length, 2) // if container + one body row, pre-order
  assert.ok(flat[0].container)
})

check('findDropTarget: smallest container wins; offsets correct', 'blocks', () => {
  const t = tree(node('translation_unit', { children: [
    node('if_expression', { children: [
      node('condition', { field: 'condition' }),
      node('compound_statement', { field: 'body', children: [
        node('while_statement', { children: [
          node('condition', { field: 'condition' }),
          node('compound_statement', { field: 'body', children: [node('expression_statement', { text: 'x;' })] }),
        ] }),
      ] }),
    ] }),
  ] }))
  const roots = buildBlocks(t)
  layoutStack(roots, 40, 40)
  // point deep inside the while body → while (smallest) is the target
  const deep = roots[0].children[0].children[0]
  const tgt = findDropTarget(roots, deep.x + 10, deep.y + deep.h + 4)
  assert.ok(tgt, 'target found inside canvas')
  assert.equal(tgt!.container.nodeKind, 'while_statement')
  // null far outside everything
  assert.equal(findDropTarget(roots, 100000, 100000), null)
})

check('hitTestHeader: innermost header wins', 'blocks', () => {
  const t = tree(node('translation_unit', { children: [
    node('if_expression', { children: [
      node('condition', { field: 'condition' }),
      node('compound_statement', { field: 'body', children: [node('expression_statement', { text: 'x = 1;' })] }),
    ] }),
  ] }))
  const roots = buildBlocks(t)
  layoutStack(roots, 40, 40)
  const row = roots[0].children[0]
  assert.equal(hitTestHeader(roots, row.x + 10, row.y + 4), row)
})

check('measure floors at 90px and grows with text', 'blocks', () => {
  assert.ok(measure('') >= 90)
  assert.ok(measure('x') >= 90)
  assert.ok(measure('a'.repeat(50)) > measure('a'.repeat(10)))
})

// ═══════════════════════════════ 5. CARET MAPPING ═════════════════════════
check('caret: anchors map to block EDGES (start before mid, end after)', 'caret', () => {
  const t = tree(node('translation_unit', { children: [
    node('expression_statement', { text: 'alpha = 1;', start: 0, end: 10 }),
    node('expression_statement', { text: 'beta = 2;', start: 11, end: 20 }),
  ] }))
  const roots = buildBlocks(t)
  // within the first block: before midpoint → start edge → 0; after → 10
  assert.equal(caretOffset(roots, 20, pickAnchor(roots, 4)), 0)
  assert.equal(caretOffset(roots, 20, pickAnchor(roots, 9)), 10)
  // second block resolves via id (same parse)
  assert.equal(caretOffset(roots, 20, pickAnchor(roots, 15)), 11)
  // same-kind twins resolve by kind+text even with a recycled id
  assert.equal(
    caretOffset(roots, 20, { id: 99, edge: 'end', offset: 15, kind: 'expression_statement', text: 'beta = 2;' }),
    20,
  )
})

check('REGRESSION: caret spans stay char-based after multibyte prefixes', 'caret', () => {
  const prefix = '// café 你好\n' // 10 UTF-16 units — 13 UTF-8 bytes
  const stmtStart = prefix.length
  const t = tree(node('translation_unit', { children: [
    node('expression_statement', { text: 'gamma = 3;', start: stmtStart, end: stmtStart + 10 }),
  ] }))
  const roots = buildBlocks(t)
  assert.equal(roots[0].start, stmtStart, 'normalized span')
  // midpoint in UTF-16 units (15): 14 stays 'start', 18 flips to 'end'
  assert.equal(caretOffset(roots, stmtStart + 10, pickAnchor(roots, stmtStart + 4)), stmtStart)
  assert.equal(caretOffset(roots, stmtStart + 10, pickAnchor(roots, stmtStart + 8)), stmtStart + 10)
})

check('caret: clamps out-of-range offsets, survives empty forest', 'caret', () => {
  assert.equal(caretOffset([], 5, { id: 99, edge: 'start', offset: 42 }), 5)
  const t = tree(node('translation_unit', { children: [
    node('expression_statement', { text: 'x = 1;', start: 0, end: 6 }),
  ] }))
  const roots = buildBlocks(t)
  assert.equal(caretOffset(roots, 6, { id: 999, edge: 'end', offset: 99 }), 6)
})

// ═══════════════════════════════ 6. ACADEMY LOGIC ═════════════════════════
check('REGRESSION: streak survives the day boundary in ANY timezone', 'academy', () => {
  // local noon makes `today` deterministic regardless of the machine TZ
  const noon = (y: number, m: number, d: number) => new Date(y, m - 1, d, 12).getTime()
  const s = { currentStreak: 4, longestStreak: 6, lastActivityDate: '2026-09-10' }
  const next = updateStreak(s, noon(2026, 9, 11))
  assert.equal(next.currentStreak, 5, 'yesterday → +1 (old code: reset to 1 on UTC<0)')
  assert.equal(next.longestStreak, 6)
  const afterGap = updateStreak(s, noon(2026, 9, 12))
  assert.equal(afterGap.currentStreak, 1, 'two-day gap → reset')
  assert.equal(updateStreak(next, noon(2026, 9, 11)), next, 'same-day is a no-op')
})

check('mastery: promotion and due boundaries', 'academy', () => {
  assert.deepEqual(nextMastery(undefined, 100), { box: 1, last: 100 })
  assert.deepEqual(nextMastery({ box: 4, last: 0 }, 100), { box: 5, last: 100 })
  const DAY = 86400
  assert.equal(masteryDue({ box: 1, last: 1000 }, 1000 + DAY), true, 'box1 due after 1d')
  assert.equal(masteryDue({ box: 1, last: 1000 }, 1000 + DAY - 1), false)
  assert.equal(masteryDue({ box: 2, last: 1000 }, 1000 + 3 * DAY), true, 'box2 due after 3d')
  assert.equal(masteryDue({ box: 2, last: 1000 }, 1000 + 3 * DAY - 1), false)
  assert.equal(masteryDue({ box: 5, last: 0 }, Number.MAX_SAFE_INTEGER / 2), false, 'box5 = mastered')
  assert.equal(masteryDue(undefined, 1e12), false)
  assert.equal(masteryNextIn({ box: 3, last: 0 }), '7 days')
  assert.equal(masteryNextIn({ box: 5, last: 0 }), 'mastered')
})

check('previousLevel chains authored order; null at the start', 'academy', () => {
  const levels = [{ id: 'a' }, { id: 'b' }, { id: 'c' }]
  assert.equal(previousLevel(levels, 'b')?.id, 'a')
  assert.equal(previousLevel(levels, 'a'), null)
  assert.equal(previousLevel(levels, 'zzz'), null)
})

check('checkBadges gates on thresholds and prior unlocks', 'academy', () => {
  const streak = { currentStreak: 1, longestStreak: 7, lastActivityDate: '2026-09-10' }
  const got = checkBadges(['first_run'], { ...streak }, { runs: 5, fixes: 2, loopsMastered: 3 })
  assert.deepEqual(got.sort(), ['bug_squasher', 'loop_master', 'streak_3', 'streak_7'])
  const quiet = { currentStreak: 1, longestStreak: 1, lastActivityDate: '2026-09-10' }
  assert.deepEqual(checkBadges([], quiet, { runs: 0, fixes: 0, loopsMastered: 0 }), [])
})

// ═══════════════════════════════ 7. SLOT VALIDATION ═══════════════════════
check('validateSlotValue: types, quoting, rejection', 'slots', () => {
  assert.equal(validateSlotValue('number', '42'), '42')
  assert.equal(validateSlotValue('number', 'abc'), 'abc') // identifiers fit number sockets
  assert.equal(validateSlotValue('number', 'x[2]'), 'x[2]') // indexed idents too
  assert.equal(validateSlotValue('number', 'a + 1'), 'a + 1') // arithmetic passthrough
  assert.equal(validateSlotValue('number', 'a b'), null) // two tokens: junk
  assert.equal(validateSlotValue('ident', 'my_var'), 'my_var')
  assert.equal(validateSlotValue('ident', '9bad'), null)
  assert.equal(validateSlotValue('string', 'hi'), '"hi"')
  assert.equal(validateSlotValue('string', 'a"b'), '"a\\"b"')
  assert.equal(validateSlotValue('bool', 'x > 1'), 'x > 1') // bool = any non-empty
  assert.equal(validateSlotValue('bool', ''), null)
})

check('reporterFits: round vs hex socket compatibility', 'slots', () => {
  assert.equal(reporterFits('round', 'ident'), true)
  assert.equal(reporterFits('round', 'number'), true)
  assert.equal(reporterFits('round', 'bool'), false)
  assert.equal(reporterFits('bool', 'bool'), true)
  assert.equal(reporterFits('bool', 'ident'), false)
})

// ═══════════════════════════════ 8. EDIT-OPS (editor-keys transforms) ═════
check('indentLines: caret insert, shift dedent, block indent/outdent', 'edit-ops', () => {
  assert.deepEqual(indentLines('abc', 1, 1, false), { text: 'a  bc', caret: 3 })
  const indented = '  deep()'
  assert.deepEqual(indentLines(indented, 5, 5, true), { text: 'deep()', caret: 3 })
  // shift with no leading spaces is a no-op
  assert.deepEqual(indentLines('x = 1;', 3, 3, true), { text: 'x = 1;', caret: 3 })
  // selection: every line gains/loses indentation, caret tracks line 1
  const sel = 'a\nb\nc'
  const out = indentLines(sel, 0, 5, false)
  assert.equal(out.text, '  a\n  b\n  c')
  assert.equal(out.caret, 2)
  const back = indentLines(out.text, 0, 11, true)
  assert.equal(back.text, sel)
})

check('splitLine: indent continuation, opener deepening, paired brace', 'edit-ops', () => {
  assert.deepEqual(splitLine('    keep();', 11, 11), { text: '    keep();\n    ', caret: 16 })
  // opener deepens by 4 and pulls the } onto its own line (pos 8 = after '{')
  const res = splitLine('if (x) {}', 8, 8)
  assert.equal(res.text, 'if (x) {\n    \n}')
  assert.equal(res.caret, 13)
})

check('toggleCommentLines: single line and block, both directions', 'edit-ops', () => {
  const code = 'a = 1;\nb = 2;'
  // single-line comment
  assert.deepEqual(toggleCommentLines(code, 0, 0, '// '), { text: '// a = 1;\nb = 2;', caret: 3 })
  // single-line uncomment (prefix after indent)
  assert.deepEqual(toggleCommentLines('// a = 1;', 5, 5, '// '), { text: 'a = 1;', caret: 2 })
  // block: mixed lines → comment all non-blank
  const mixed = 'a;\n\nb;'
  assert.equal(toggleCommentLines(mixed, 0, 6, '// ').text, '// a;\n\n// b;') // blank line untouched
  // block: all commented → uncomment all
  assert.equal(toggleCommentLines('// a;\n// b;', 0, 10, '// ').text, 'a;\nb;')
  // python prefix
  assert.deepEqual(toggleCommentLines('x = 1', 0, 0, '# '), { text: '# x = 1', caret: 2 })
})

// ═══════════════════════════════ 9. PATH UTILS ════════════════════════════
check('langOf extension map incl. multi-extension families', 'paths', () => {
  assert.equal(langOf('a.c'), 'c')
  assert.equal(langOf('a.cpp'), 'cpp')
  assert.equal(langOf('a.cc'), 'cpp')
  assert.equal(langOf('a.hpp'), 'cpp')
  assert.equal(langOf('a.ts'), 'typescript')
  assert.equal(langOf('a.py'), 'python')
  assert.equal(langOf('a.unknown'), 'c')
})

check('path helpers: opener detection, basenames, slashes', 'paths', () => {
  assert.equal(trimmedEndsWithOpener('if (x) {'), true)
  assert.equal(trimmedEndsWithOpener('def f():'), true)
  assert.equal(trimmedEndsWithOpener('if (x'), false) // ( is not an opener
  assert.equal(trimmedEndsWithOpener('do_thing();'), false)
  assert.equal(baseName('src/main.c'), 'main.c')
  assert.equal(dirName('src/main.c'), 'src')
  assert.equal(dirName('main.c'), '.')
  assert.equal(normSlashes('a\\b\\c'), 'a/b/c')
})

check('REGRESSION: go if/for render as containers via fielded bodies', 'blocks', () => {
  const t = tree(node('source_file', {
      children: [node('if_statement', {
        children: [
          node('if', { named: false, text: 'if' }),
          node('binary_expression', { field: 'condition', text: 'x > 0' }),
          node('block', { field: 'consequence', children: [node('short_var_declaration', { text: 'y := 1' })] }),
        ],
      })],
    }), 'go')
  const roots = buildBlocks(t)
  assert.equal(roots.length, 1)
  assert.ok(roots[0].container, 'go if is a container')
  assert.equal(roots[0].children.length, 1)
  assert.ok(!roots[0].label.includes(':='))
})

check('REGRESSION: java methods expand; class bodies via class_body kind', 'blocks', () => {
  const method = node('method_declaration', {
    children: [
      node(' modifiers', { named: false, text: 'public' }),
      node('void_type', { text: 'void' }),
      node('identifier', { field: 'name', text: 'run' }),
      node('formal_parameters', { field: 'parameters', text: '()' }),
      node('block', { field: 'body', children: [node('expression_statement', { text: 'count++;' })] }),
    ],
  })
  const klass = node('class_declaration', {
    children: [
      node('class', { named: false, text: 'class' }),
      node('identifier', { field: 'name', text: 'Main' }),
      node('class_body', { field: 'body', children: [method] }),
    ],
  })
  const t = tree(node('program', { children: [klass] }), 'java')
  const roots = buildBlocks(t)
  assert.equal(roots.length, 1)
  assert.ok(roots[0].container, 'java class is a container')
  const m = roots[0].children[0]
  assert.ok(m.container, 'java method is a container')
  assert.equal(m.cat, 'function')
  assert.ok(m.label.includes('void'), 'header includes return type')
  assert.ok(!m.label.includes('count++'), 'body must not leak into header')
})

check('REGRESSION: typescript uses the JS shape (statement_block bodies)', 'blocks', () => {
  const t = tree(node('program', {
      children: [node('function_declaration', {
        children: [
          node('function', { named: false, text: 'function' }),
          node('identifier', { field: 'name', text: 'greet' }),
          node('statement_block', { field: 'body', children: [node('expression_statement', { text: 'return 1;' })] }),
        ],
      })],
    }), 'typescript')
  const roots = buildBlocks(t)
  assert.ok(roots[0].container)
  assert.equal(roots[0].cat, 'function')
  assert.ok(roots[0].label.includes('greet'))
})

// ═══════════════════════════════ 9. C INTERPRETER (tracer) ════════════════
// fixture helpers over the tracer's CNodeJSON trees
const tn = (kind: string, opts: Partial<CNodeJSON> & { children?: CNodeJSON[] } = {}): CNodeJSON => ({
  id: nextId++, kind, field: opts.field ?? null, named: opts.named ?? true, missing: false,
  start: 0, end: 0, pre: '', text: opts.text ?? null, children: opts.children ?? [],
})
const ident = (name: string, field?: string): CNodeJSON => tn('identifier', { text: name, field })
const num = (v: number): CNodeJSON => tn('number_literal', { text: String(v) })
const bin = (l: CNodeJSON, op: string, r: CNodeJSON): CNodeJSON =>
  tn('binary_expression', { children: [l, tn(op, { named: false, text: op }), r] })
const declInit = (name: string, val: CNodeJSON): CNodeJSON =>
  tn('declaration', { children: [tn('primitive_type', { text: 'int' }), tn('init_declarator', { children: [ident(name), val] })] })
const update = (name: string, op: '++' | '--', postfix: boolean): CNodeJSON =>
  tn('update_expression', { children: postfix ? [ident(name), tn(op, { named: false, text: op })] : [tn(op, { named: false, text: op }), ident(name)] })
const assign = (name: string, val: CNodeJSON, op = '='): CNodeJSON =>
  tn('assignment_expression', { children: [ident(name), tn(op, { named: false, text: op }), val] })

function runTrace(root: CNodeJSON): { vars: Record<string, unknown>; error?: string } {
  const res = interpretC('int i = 0;\nint sum = 0;\n', root)
  const last: TraceStep | undefined = res.steps[res.steps.length - 1]
  return { vars: last?.vars ?? {}, error: last?.error }
}

check('REGRESSION: continue skips an iteration instead of ending the loop', 'tracer', () => {
  // while (i < 3) { i++; if (i == 2) continue; sum += i; }  → sum === 4
  const program = tn('translation_unit', { children: [
    declInit('i', num(0)),
    declInit('sum', num(0)),
    tn('while_statement', { children: [
      Object.assign(bin(ident('i'), '<', num(3)), { field: 'condition' }),
      tn('compound_statement', { field: 'body', children: [
        tn('expression_statement', { children: [update('i', '++', true)] }),
        tn('if_statement', { children: [
          Object.assign(bin(ident('i'), '==', num(2)), { field: 'condition' }),
          tn('compound_statement', { field: 'consequence', children: [tn('continue_statement')] }),
        ] }),
        tn('expression_statement', { children: [assign('sum', bin(ident('sum'), '+', ident('i')))] }),
      ] }),
    ] }),
  ] })
  const { vars, error } = runTrace(program)
  assert.equal(error, undefined, error)
  assert.equal(vars.sum, 4, `continue broke the loop: sum = ${vars.sum}`)
  assert.equal(vars.i, 3)
})

check('REGRESSION: i++ evaluates to the OLD value; ++i to the new', 'tracer', () => {
  // int i = 5; int x = i++;  → x === 5, i === 6 (was: x === 6, and ++i returned 0)
  const post = tn('translation_unit', { children: [
    declInit('i', num(5)),
    declInit('x', update('i', '++', true)),
  ] })
  const r1 = runTrace(post)
  assert.equal(r1.vars.x, 5, `postfix returned ${r1.vars.x}`)
  assert.equal(r1.vars.i, 6)

  const pre = tn('translation_unit', { children: [
    declInit('i', num(5)),
    declInit('x', update('i', '++', false)),
  ] })
  const r2 = runTrace(pre)
  assert.equal(r2.vars.x, 6, `prefix returned ${r2.vars.x} (was 0 before the fix)`)
  assert.equal(r2.vars.i, 6)
})

check('REGRESSION: unbraced if consequence executes (field consequence)', 'tracer', () => {
  // int y = 0; if (1) y = 7;  → y === 7 (was: silently skipped)
  const program = tn('translation_unit', { children: [
    declInit('y', num(0)),
    tn('if_statement', { children: [
      Object.assign(num(1), { field: 'condition' }),
      tn('expression_statement', { field: 'consequence', children: [assign('y', num(7))] }),
    ] }),
  ] })
  const { vars } = runTrace(program)
  assert.equal(vars.y, 7)
})

check('REGRESSION: <<= shifts instead of corrupting the variable', 'tracer', () => {
  // int x = 3; x <<= 2;  → x === 12 (was: x === 2, the RHS)
  const program = tn('translation_unit', { children: [
    declInit('x', num(3)),
    tn('expression_statement', { children: [assign('x', num(2), '<<=')] }),
  ] })
  const { vars } = runTrace(program)
  assert.equal(vars.x, 12)
})

check('run errors surface in the last step (undefined variable)', 'tracer', () => {
  // a compound op READS the old value — ghost is undefined → error
  const program = tn('translation_unit', { children: [
    tn('expression_statement', { children: [assign('ghost', num(1), '+=')] }),
  ] })
  const { error } = runTrace(program)
  assert.match(error ?? '', /undefined variable/)
})

// ── report ────────────────────────────────────────────────────────────────
console.log(`\nexternal logic tests: ${passed} passed, ${failures.length} failed`)
for (const [s, n] of [...sections.entries()].sort()) console.log(`  ✓ ${s} (${n})`)
if (failures.length > 0) {
  console.error('\nFAILURES:')
  for (const f of failures) console.error(`  ✗ ${f}`)
  process.exit(1)
}
