import { describe, expect, it } from 'vitest'
import { buildBlocks, flatten, layoutStack, type BBlock, type CTreeJSON } from '../src/blocks'
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
    int i = 0;
    if (i > 0) {
        i = 1;
    }
    while (i < 10)
        i = i + 1;
    switch (i) {
        case 1:
            break;
    }
    for (int k = 0; k < 5; k++) {
        i = k;
    }
    return 0;
}
`

describe('boolean hex condition sockets (1.12)', () => {
  it('if/while/switch headers carry one bool slot with the inner condition', () => {
    const roots = render(SRC)
    const iff = flatten(roots).find((b) => b.nodeKind === 'if_statement')!
    const bools = iff.parts.filter((p) => p.type === 'bool')
    expect(bools.length).toBe(1)
    expect(bools[0].text).toBe('i > 0') // parens stay OUT of the socket
    expect(SRC.slice(bools[0].start, bools[0].end)).toBe('i > 0')

    const wh = flatten(roots).find((b) => b.nodeKind === 'while_statement')!
    expect(wh.parts.filter((p) => p.type === 'bool').map((p) => p.text)).toEqual(['i < 10'])

    const sw = flatten(roots).find((b) => b.nodeKind === 'switch_statement')!
    expect(sw.parts.filter((p) => p.type === 'bool').map((p) => p.text)).toEqual(['i'])
  })

  it('for headers keep init/update granular; only the condition is hex', () => {
    const roots = render(SRC)
    const loop = flatten(roots).find((b) => b.nodeKind === 'for_statement')!
    const seq = loop.parts.map((p) => `${p.type}:${p.text}`)
    expect(seq).toEqual([
      'text:for ( int',
      'ident:k',
      'text:=',
      'number:0',
      'text:;',
      'bool:k < 5',
      'text:;',
      'ident:k',
      'text:++ )',
    ])
  })

  it('bool slot byte spans are exact — splice edit swaps the condition', () => {
    const roots = render(SRC)
    const wh = flatten(roots).find((b) => b.nodeKind === 'while_statement')!
    const b = wh.parts.find((p) => p.type === 'bool')!
    const edited = SRC.slice(0, b.start) + 'i < 3' + SRC.slice(b.end)
    const editedRoots = render(edited)
    const wh2 = flatten(editedRoots).find((x) => x.nodeKind === 'while_statement')!
    expect(wh2.parts.find((p) => p.type === 'bool')!.text).toBe('i < 3')
  })
})
