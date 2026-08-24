import { describe, expect, it } from 'vitest'
import { buildBlocks, flatten, layoutStack, type CTreeJSON } from '../src/blocks'
import { execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'

const ctree = (...p: string[]) => resolve(process.cwd(), '..', 'target', 'debug', ...p)

function parseCpp(src: string): CTreeJSON {
  const exe = ctree('ctree_json.exe')
  if (!existsSync(exe)) throw new Error(`missing ${exe} — run cargo build first`)
  return JSON.parse(execFileSync(exe, { input: src, encoding: 'utf8', args: ['cpp'] })).tree
}

const CPP = `#include <iostream>

class Greeter {
public:
    void greet(int times) {
        for (int i = 0; i < times; i++) {
            std::cout << "hi" << "\\n";
        }
    }
};

int main() {
    Greeter g;
    g.greet(2);
    return 0;
}
`

describe('C++ subset pack (D3 amendment)', () => {
  it('classes render as containers; methods and loops nest inside', () => {
    const roots = buildBlocks(parseCpp(CPP))
    layoutStack(roots, 40, 40)
    // `class Greeter { ... };` parses as a DECLARATION wrapping the class —
    // the declaration becomes the mouth (same rule as C structs)
    const cls = flatten(roots).find(
      (b) => b.container && b.label.replace(/\s+/g, ' ').includes('class Greeter'),
    )
    expect(cls).toBeDefined()
    expect(cls!.children.length).toBeGreaterThan(0)
    const loop = flatten(roots).find((b) => b.nodeKind === 'for_statement')
    expect(loop!.container).toBe(true)
  })

  it('functions (incl. methods) categorize; iostream program has no mystery top level', () => {
    const roots = buildBlocks(parseCpp(CPP))
    const kinds = roots.map((b) => b.nodeKind)
    expect(kinds).toContain('function_definition')
    expect(roots.every((b) => b.cat !== 'error')).toBe(true)
  })
})
