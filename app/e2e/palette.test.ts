import { describe, expect, it } from 'vitest'
import {
  PALETTE_GROUPS,
  VARIABLES_COLOR,
  validateSlotValue,
  validateVarName,
  reporterFits,
  varChips,
  varTypes,
  listChips,
  type SourceLang,
} from '../src/palette'
import { buildBlocks, harvestVars, layoutStack, flatten } from '../src/blocks'
import { spliceInsert, insertTopLevel } from '../src/ops'
import { execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'

const ctree = (...p: string[]) => resolve(process.cwd(), '..', 'target', 'debug', ...p)
const parseClean = (src: string, lang: SourceLang = 'c'): boolean => {
  const exe = ctree('ctree_json.exe')
  if (!existsSync(exe)) throw new Error(`missing ${exe}`)
  // NOTE: execFileSync(file, args, options) — args is NOT an option key
  const out = JSON.parse(
    execFileSync(exe, lang === 'c' ? [] : [lang], { input: src, encoding: 'utf8' }),
  )
  return !out.has_errors
}
const parsesClean = (base: string, snippet: string, lang: SourceLang = 'c'): boolean => {
  const treeJson = JSON.parse(
    execFileSync(ctree('ctree_json.exe'), lang === 'c' ? [] : [lang], { input: base, encoding: 'utf8' }),
  )
  const roots = buildBlocks(treeJson.tree)
  layoutStack(roots, 40, 40)
  const fn = flatten(roots).find((b) => b.nodeKind === 'function_definition')!
  return parseClean(spliceInsert(base, fn.headerEnd + 1, snippet), lang)
}

describe('Scratch palette structure (1.10)', () => {
  it('has category groups with colors and non-empty item lists', () => {
    expect(PALETTE_GROUPS.length).toBeGreaterThanOrEqual(5)
    for (const g of PALETTE_GROUPS) {
      expect(g.color).toMatch(/^#[0-9A-Fa-f]{6}$/)
      expect(g.items.length).toBeGreaterThan(0)
      for (const item of g.items) {
        // reporters carry expressions, not splices
        expect(
          item.snippet.length > 0 || item.reporter !== undefined,
          `${g.name}/${item.name}`,
        ).toBe(true)
        expect(item.cat.length).toBeGreaterThan(0)
      }
    }
  })

  it('every group snippet produces parseable code in its intended context', () => {
    // Per-language authoring contexts for the dynamic/braceless languages.
    // stmt = snippet inside the entry body; cond = inside its prerequisite
    // (elif needs if); top = file scope. C/C++ keep the splice-based
    // machinery below (headerEnd insertion + prerequisite rewriting), which
    // additionally exercises ops.ts on every chip.
    const py = (s: string, pad = '    '): string =>
      s
        .split('\n')
        .map((l) => (l.trim() ? pad + l : l))
        .join('\n')
    const CTX: Record<
      'python' | 'javascript' | 'rust',
      { stmt: (s: string) => boolean; cond: (s: string) => boolean; top: (s: string) => boolean }
    > = {
      python: {
        stmt: (s) =>
          parseClean(`def main():\n    x = 1\n${py(s)}\n    return 0\n\n\nmain()\n`, 'python'),
        // elif/else arms FOLLOW their if at sibling level
        cond: (s) =>
          parseClean(
            `def main():\n    x = 1\n    if x:\n        x = 2\n${py(s)}\n    return 0\n\n\nmain()\n`,
            'python',
          ),
        top: (s) => parseClean(`def main():\n    return 0\n\n\nmain()\n\n\n${s}\n`, 'python'),
      },
      javascript: {
        stmt: (s) =>
          parseClean(
            `function main() {\n    let x = 1;\n    ${s}\n    return 0;\n}\n\nmain();\n`,
            'javascript',
          ),
        cond: (s) =>
          parseClean(
            `function main() {\n    let x = 1;\n    if (x) {\n        x = 2;\n    }\n    ${s}\n    return 0;\n}\n\nmain();\n`,
            'javascript',
          ),
        top: (s) =>
          parseClean(`function main() {\n    return 0;\n}\n\nmain();\n\n${s}\n`, 'javascript'),
      },
      rust: {
        stmt: (s) => parseClean(`fn main() {\n    let mut x = 1;\n    ${s}\n}\n`, 'rust'),
        cond: (s) =>
          parseClean(
            `fn main() {\n    let mut x = 1;\n    if x > 0 {\n        x += 1;\n    }\n    ${s}\n}\n`,
            'rust',
          ),
        top: (s) => parseClean(`fn main() {\n    let mut x = 1;\n}\n\n${s}\n`, 'rust'),
      },
    }
    const base = `#include <stdio.h>\n\nint main(void) {\n    return 0;\n}\n`
    const cppBase = `#include <iostream>\n\nint main() {\n    std::cout << "hi" << "\\n";\n    return 0;\n}\n`
    for (const g of PALETTE_GROUPS) {
      for (const item of g.items) {
        if (item.reporter !== undefined) continue // expressions: socket drops
        const lang = item.langs?.[0] ?? 'c'
        if (lang === 'c' || lang === 'cpp') {
          const ctxBase = lang === 'cpp' ? cppBase : base
          let snippet = item.snippet
          if (item.requires?.kind === 'if_statement') {
            // else must directly FOLLOW its if — build the whole context
            const whole = ctxBase.replace(
              /return (0|r);/,
              `if (c) {\n        return 1;\n    }\n    ${item.snippet}\n    return 0;`,
            )
            expect(parseClean(whole, lang), `${g.name}/${item.name}`).toBe(true)
            continue
          } else if (item.requires?.kind === 'switch_statement') {
            snippet = `switch (x) {\n${item.snippet}\n}`
          } else if (item.toplevel) {
            expect(
              parseClean(ctxBase + item.snippet + '\n', lang),
              `${g.name}/${item.name}`,
            ).toBe(true)
            continue
          }
          expect(parsesClean(ctxBase, snippet, lang), `${g.name}/${item.name}`).toBe(true)
        } else {
          const ctx = CTX[lang]
          const result = item.requires?.kind
            ? ctx.cond(item.snippet)
            : item.toplevel
              ? ctx.top(item.snippet)
              : ctx.stmt(item.snippet)
          expect(result, `${g.name}/${item.name} (${lang})`).toBe(true)
        }
      }
    }
  })

  it('Variables section uses the Scratch data orange', () => {
    expect(VARIABLES_COLOR.toLowerCase()).toBe('#ff8c1a')
  })
})

describe('Make a Variable (Scratch lifecycle)', () => {
  it('accepts C identifiers, rejects junk + reserved words', () => {
    expect(validateVarName('score')).toBe('score')
    expect(validateVarName('  player_2 ')).toBe('player_2')
    expect(validateVarName('_hidden')).toBe('_hidden')
    expect(validateVarName('2fast')).toBeNull()
    expect(validateVarName('my var')).toBeNull()
    expect(validateVarName('')).toBeNull()
    expect(validateVarName('int')).toBeNull()
    expect(validateVarName('return')).toBeNull()
    expect(validateVarName('for')).toBeNull()
  })

  it('per-variable chips: TYPED declaration + oval reporter + set/change', () => {
    const chips = varChips('score')
    expect(chips.length).toBe(4)
    expect(chips[0]).toMatchObject({
      snippet: 'int score = 0;',
      cat: 'variables',
    }) // typed declaration — C/C++ need the variable to EXIST first
    expect(chips[1].snippet).toBe('') // reporter — slot-drop only
    expect(chips[2].snippet).toBe('score = 0;')
    expect(chips[3].snippet).toBe('score = score + 1;')
    const dbl = varChips('score', 'double')
    expect(dbl[0].snippet).toBe('double score = 0;')
    const base = `#include <stdio.h>\n\nint main(void) {\n    return 0;\n}\n`
    expect(parsesClean(base, chips[0].snippet)).toBe(true)
    expect(parsesClean(base, chips[2].snippet)).toBe(true)
    expect(parsesClean(base, chips[3].snippet)).toBe(true)
    expect(varTypes('c')).toEqual(['int', 'double', 'bool'])
    expect(varTypes('cpp')).toEqual(['int', 'double', 'bool', 'string'])
    // dynamically-typed languages declare nothing (Variables UI hidden)
    expect(varTypes('python')).toEqual([])
    expect(varTypes('javascript')).toEqual([])
    expect(varTypes('rust')).toEqual([])
  })
})

describe('Lists -> C arrays (Scratch data subcategory)', () => {
  it('chips: element reporter + declare + set-item, all parse-clean', () => {
    const chips = listChips('grid')
    expect(chips.length).toBe(3)
    expect(chips[0]).toMatchObject({ snippet: '', varName: 'grid' })
    expect(chips[1].snippet).toBe('int grid[10];')
    expect(chips[2].snippet).toBe('grid[0] = 0;')
    const base = `#include <stdio.h>\n\nint main(void) {\n    return 0;\n}\n`
    expect(parsesClean(base, chips[1].snippet)).toBe(true)
    expect(parsesClean(base, chips[2].snippet)).toBe(true)
  })

  it('element reporters (`grid[0]`) fit ident AND number sockets', () => {
    expect(validateSlotValue('ident', 'grid[0]')).toBe('grid[0]')
    expect(validateSlotValue('number', 'grid[0]')).toBe('grid[0]')
    expect(validateSlotValue('number', 'total')).toBe('total')
    expect(validateSlotValue('number', '42')).toBe('42')
    expect(validateSlotValue('number', 'x=1')).toBeNull()
    expect(validateSlotValue('ident', 'a b')).toBeNull()
    expect(validateSlotValue('string', 'hi')).toBe('"hi"')
    // boolean hex sockets: any non-empty condition, empty rejected
    expect(validateSlotValue('bool', 'x < 5')).toBe('x < 5')
    expect(validateSlotValue('bool', 'ok')).toBe('ok')
    expect(validateSlotValue('bool', '   ')).toBeNull()
  })

  it('arithmetic expressions fit round sockets; boolean ops do NOT', () => {
    expect(validateSlotValue('number', 'a + b')).toBe('a + b')
    expect(validateSlotValue('number', 'total * (2 + 1)')).toBe('total * (2 + 1)')
    expect(validateSlotValue('number', 'a / b % 3')).toBe('a / b % 3')
    expect(validateSlotValue('ident', 'a - b')).toBe('a - b')
    // bare token pairs without operators are junk
    expect(validateSlotValue('number', 'a b')).toBeNull()
    // comparison/logic operators are boolean-only (hex sockets)
    expect(validateSlotValue('number', 'a == b')).toBeNull()
    expect(validateSlotValue('number', 'a && b')).toBeNull()
    expect(validateSlotValue('ident', '!x')).toBeNull()
    expect(validateSlotValue('bool', 'a == b')).toBe('a == b')
  })
})

describe('Operators category (Scratch green)', () => {
  it('exists with round arithmetic + hex comparison/logic reporters', () => {
    const ops = PALETTE_GROUPS.find((g) => g.name === 'Operators')
    expect(ops).toBeDefined()
    expect(ops!.color.toLowerCase()).toBe('#59c059')
    const round = ops!.items.filter((i) => i.reporter === 'round')
    const bool = ops!.items.filter((i) => i.reporter === 'bool')
    expect(round.map((i) => i.name)).toEqual([
      'a + b',
      'a - b',
      'a * b',
      'a / b',
      'a % b',
    ])
    // logic splits by language (D11): comparisons are universal (untagged),
    // symbolic logic serves c/cpp/js/rust, python gets wordy and/or/not
    const untagged = bool.filter((i) => i.langs === undefined)
    expect(untagged.map((i) => i.name)).toEqual([
      'a == b',
      'a != b',
      'a < b',
      'a > b',
      'a <= b',
      'a >= b',
    ])
    const symLogic = bool.filter((i) => (i.langs?.length ?? 0) > 1)
    expect(symLogic.map((i) => i.name)).toEqual(['a && b', 'a || b', 'not ok'])
    for (const s of symLogic) expect(s.langs).not.toContain('python')
    const words = bool.filter((i) => i.langs?.length === 1)
    expect(words.map((i) => i.name)).toEqual(['a and b', 'a or b', 'not ok'])
    for (const w of words) expect(w.langs).toEqual(['python'])
    for (const i of ops!.items) {
      expect(reporterFits(i.reporter, i.reporter === 'bool' ? 'bool' : 'number')).toBe(true)
      expect(reporterFits(i.reporter, i.reporter === 'bool' ? 'number' : 'bool')).toBe(false)
    }
  })

  it('define fn / namespace are toplevel; call chips are statements', () => {
    const fns = PALETTE_GROUPS.find((g) => g.name === 'Functions')!
    const toplevel = fns.items.filter((i) => i.toplevel)
    // one definition chip per language (+ cpp namespace), all file-scope
    expect(toplevel.map((i) => [i.name, i.langs?.[0] ?? 'c']).sort()).toEqual([
      ['def', 'python'],
      ['define fn', 'c'],
      ['fn', 'rust'],
      ['function', 'javascript'],
      ['namespace', 'cpp'],
    ])
    for (const i of fns.items) {
      if (!i.toplevel) expect(i.name.startsWith('call'), i.name).toBe(true)
    }
  })
})

describe('variable harvesting from the open file', () => {
  const parseTree = (src: string) =>
    JSON.parse(execFileSync(ctree('ctree_json.exe'), { input: src, encoding: 'utf8' })).tree.root
  it('collects declared variables: locals, globals, multi-declarators, arrays', () => {
    const src = `int global_a;\nint global_b = 2, global_c;\n\nint main(void) {\n    int total = 0;\n    int grid[10];\n    float f = 1.5;\n    total = grid[0];\n    return 0;\n}\n`
    const vars = harvestVars(parseTree(src))
    for (const v of ['global_a', 'global_b', 'global_c', 'total', 'grid', 'f']) {
      expect(vars, v).toContain(v)
    }
  })

  it('excludes function names, parameters, and struct fields', () => {
    const src = `struct Point { int x; int y; };\n\nint add(int a, int b) {\n    return a + b;\n}\n\nint main(void) {\n    int r = add(1, 2);\n    struct Point p;\n    return r;\n}\n`
    const vars = harvestVars(parseTree(src))
    expect(vars).not.toContain('add')
    expect(vars).not.toContain('main')
    expect(vars).not.toContain('a')
    expect(vars).not.toContain('b')
    expect(vars).not.toContain('x')
    expect(vars).not.toContain('y')
    expect(vars).toContain('r')
    expect(vars).toContain('p')
  })
})

describe('toplevel insert for function definitions', () => {
  const parseTree = (src: string) =>
    JSON.parse(execFileSync(ctree('ctree_json.exe'), { input: src, encoding: 'utf8' })).tree

  it('appends after the last top-level block, producing parseable C', () => {
    const base = `#include <stdio.h>\n\nint main(void) {\n    return 0;\n}\n`
    const roots = buildBlocks(parseTree(base))
    layoutStack(roots, 40, 40)
    const next = insertTopLevel(base, roots, 'int myfn(int x) {\n    return x;\n}')
    expect(next).toContain('int myfn(int x)')
    expect(next.indexOf('int myfn')).toBeGreaterThan(next.indexOf('int main'))
    expect(parseClean(next)).toBe(true)
  })

  it('handles an empty workspace (EOF insert)', () => {
    const next = insertTopLevel('', [], 'int solo(void) {\n    return 1;\n}\n')
    expect(parseClean(next)).toBe(true)
  })
})
