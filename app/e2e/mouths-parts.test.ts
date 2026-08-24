import { describe, expect, it } from 'vitest'
import {
  buildBlocks,
  flatten,
  headerWidth,
  layoutStack,
  partWidth,
  type BBlock,
  type CTreeJSON,
} from '../src/blocks'
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

const SRC = `int main(void) {
    int total = 0;
    printf("hi\\n");
    for (int i = 0; i < 3; i++) {
        total = total + i;
    }
    return 0;
}
`

describe('loop C-mouths (1.7)', () => {
  it('braced loops are containers whose kids live INSIDE the mouth', () => {
    const roots = render(SRC)
    const fn = roots.find((b) => b.nodeKind === 'function_definition')!
    expect(fn.container).toBe(true)
    // function body rows do NOT include the for-loop's inner statement
    const kinds = fn.children.map((c) => c.nodeKind)
    expect(kinds).toEqual(['declaration', 'expression_statement', 'for_statement', 'return_statement'])
    const loop = fn.children[2]
    expect(loop.container).toBe(true)
    expect(loop.children.length).toBe(1)
    expect(loop.children[0].nodeKind).toBe('expression_statement')
    // the loop HEADER label must not contain the body text
    expect(loop.label).not.toContain('total')
    expect(loop.label).toContain('i < 3')
  })

  it('braceless loop bodies still become mouths (clang-format never adds braces)', () => {
    const src = `int main(void) {\n    int t = 0;\n    while (t > 0)\n        t = t - 1;\n}\n`
    const roots = render(src)
    const loop = flatten(roots).find((b) => b.nodeKind === 'while_statement')!
    expect(loop.container).toBe(true)
    expect(loop.children.length).toBe(1)
    expect(loop.children[0].nodeKind).toBe('expression_statement')
    expect(loop.label).toBe('while ( t > 0 )')
  })

  it('else clauses appear as siblings inside the if-mouth', () => {
    const src = `int main(void) {\n    if (a)\n        b = 1;\n    else\n        b = 2;\n}\n`
    const roots = render(src)
    const iff = flatten(roots).find((b) => b.nodeKind === 'if_statement')!
    expect(iff.container).toBe(true)
    expect(iff.children.map((c) => c.nodeKind)).toEqual([
      'expression_statement',
      'expression_statement',
    ])
  })
})

describe('typed inline parts (1.9)', () => {
  it('splits headers into text chunks + ident/number/string slots with real byte spans', () => {
    const roots = render(SRC)
    const decl = flatten(roots).find((b) => b.nodeKind === 'declaration')!
    expect(decl.parts.map((p) => `${p.type}:${p.text}`)).toEqual([
      'text:int',
      'ident:total',
      'text:=',
      'number:0',
      'text:;',
    ])
    for (const p of decl.parts) {
      expect(p.end).toBeGreaterThan(p.start)
      expect(SRC.slice(p.start, p.end).trim().length).toBeGreaterThan(0)
    }
  })

  it('string slots keep their quotes and span the literal', () => {
    const roots = render(SRC)
    const pr = flatten(roots).find((b) => b.label.startsWith('printf'))!
    const str = pr.parts.find((p) => p.type === 'string')!
    expect(str.text).toBe('"hi\\n"')
    expect(SRC.slice(str.start, str.end)).toBe('"hi\\n"')
  })

  it('slot widths never collapse (click target >= 36px), text tokens stay compact', () => {
    const roots = render(`int main(void) {\n    x = 0;\n}\n`)
    const stmt = flatten(roots).find((b) => b.nodeKind === 'expression_statement')!
    const slots = stmt.parts.filter((p) => p.type !== 'text')
    expect(slots.length).toBe(2)
    for (const s of slots) expect(partWidth(s)).toBeGreaterThanOrEqual(36)
    // the `=`/`;` text tokens must be glyph-sized, not 90px floor-inflated
    const texts = stmt.parts.filter((p) => p.type === 'text')
    for (const t of texts) expect(partWidth(t)).toBeLessThan(30)
    // header = padding + parts + gaps, nothing more
    expect(headerWidth(stmt)).toBeLessThan(220)
  })
})
