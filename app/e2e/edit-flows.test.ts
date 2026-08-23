import { describe, expect, it } from 'vitest'
import { execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import type { CTreeJSON } from '../src/blocks'
import {
  buildBlocks,
  findDropTarget,
  hitTestHeader,
  layoutStack,
  flatten,
  measure,
} from '../src/blocks'
import { spliceInsert, spliceMove, applyEdit } from '../src/ops'

const target = (...p: string[]) => resolve(process.cwd(), '..', 'target', 'debug', ...p)

function parse(src: string): { tree: CTreeJSON; has_errors: boolean } {
  const exe = target('ctree_json.exe')
  if (!existsSync(exe)) throw new Error(`missing ${exe} — run cargo build first`)
  return JSON.parse(execFileSync(exe, { input: src, encoding: 'utf8' }))
}

function canonicalize(src: string): string {
  return execFileSync(target('canon_c.exe'), { input: src, encoding: 'utf8' })
}

function renderBlocks(src: string) {
  const out = parse(src)
  const roots = buildBlocks(out.tree)
  layoutStack(roots, 40, 40)
  return { out, roots }
}

const MINIMAL = `#include <stdio.h>

int main(void) {
    return 0;
}
`

const BODY_PROBE = { x: 105, y: 89 }

describe('G-EDIT-E2E scripted authoring flows', () => {
  it('builds a loop program entirely via block drops', () => {
    let state = renderBlocks(MINIMAL)
    const main = state.roots.find((b) => b.nodeKind === 'function_definition')!
    expect(main.container).toBe(true)
    let target = findDropTarget(state.roots, BODY_PROBE.x, BODY_PROBE.y)!
    expect(target.container.nodeKind).toBe('function_definition')
    let next = spliceInsert(MINIMAL, target.offset, 'for (int i = 0; i < 3; i++) {\n}')
    expect(parse(next).has_errors).toBe(false)

    state = renderBlocks(next)
    const forBlock = flatten(state.roots).find((b) => b.nodeKind === 'for_statement')!
    expect(forBlock.container).toBe(true)
    const probe = { x: forBlock.x + 35 + 5, y: forBlock.y + 34 + 10 + 5 }
    target = findDropTarget(state.roots, probe.x, probe.y)!
    expect(target.container.nodeKind).toBe('for_statement')
    expect(target.container.start).toBeGreaterThanOrEqual(forBlock.start)
    next = spliceInsert(next, target.offset, 'printf("%d\\n", i);')
    expect(parse(next).has_errors).toBe(false)

    const canon = canonicalize(next)
    expect(canonicalize(canon)).toBe(canon)
    expect(canon).toContain('for (int i = 0; i < 3; i++)')
    expect(canon).toContain('printf("%d\\n", i);')
  })

  it('moves a statement between positions with no corruption', () => {
    const src = `int main(void) {
    int a = 1;
    int b = 2;
    return a;
}
`
    const state = renderBlocks(src)
    const fn = state.roots.find((b) => b.nodeKind === 'function_definition')!
    const body = fn
    expect(body.children.length).toBe(3)
    const first = body.children[0]
    const last = body.children[body.children.length - 1]
    const moved = spliceMove(src, { start: first.start, end: first.end }, last.end)!
    expect(parse(moved).has_errors).toBe(false)
    expect(moved.indexOf('int a = 1;')).toBeGreaterThan(moved.indexOf('int b = 2;'))
    expect(spliceMove(src, { start: first.start, end: first.end }, first.end)).toBeNull()
  })

  it('finds and fixes a broken program via the block layer', () => {
    const broken = `int main(void) {
    return 0;
}
}
}
`
    const parsed = parse(broken)
    expect(parsed.has_errors).toBe(true)

    const state = renderBlocks(broken)
    const errBlock = flatten(state.roots).find((b) => b.cat === 'error')
    expect(errBlock).toBeDefined()

    // double-click flow: hit-test locates it, edit replaces its header slice
    const hit = hitTestHeader(state.roots, errBlock!.x + 5, errBlock!.y + 5)
    expect(hit?.cat).toBe('error')
    const fixed = applyEdit(hit!, '')(broken)
    expect(parse(fixed).has_errors).toBe(false)
    expect(canonicalize(fixed)).toBe(canonicalize(`int main(void) {\n    return 0;\n}\n`))
  })

  it('lays out deterministically and measures monotonically', () => {
    const f1 = flatten(renderBlocks(MINIMAL).roots).map((b) => [b.x, b.y, b.w, b.h])
    const f2 = flatten(renderBlocks(MINIMAL).roots).map((b) => [b.x, b.y, b.w, b.h])
    expect(f1).toEqual(f2)
    expect(measure('x')).toBeLessThan(measure('xxxxxxxxxxxxxxxxxxxx'))
  })
})
