import { describe, expect, it } from 'vitest'
import {
  PALETTE_GROUPS,
  VARIABLES_COLOR,
  validateSlotValue,
  validateVarName,
  varChips,
  listChips,
} from '../src/palette'
import { buildBlocks, harvestVars, layoutStack, flatten } from '../src/blocks'
import { spliceInsert } from '../src/ops'
import { execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'

const ctree = (...p: string[]) => resolve(process.cwd(), '..', 'target', 'debug', ...p)
const parseClean = (src: string): boolean => {
  const exe = ctree('ctree_json.exe')
  if (!existsSync(exe)) throw new Error(`missing ${exe}`)
  return !JSON.parse(execFileSync(exe, { input: src, encoding: 'utf8' })).has_errors
}
const parsesClean = (base: string, snippet: string): boolean => {
  const roots = buildBlocks(JSON.parse(execFileSync(ctree('ctree_json.exe'), { input: base, encoding: 'utf8' })).tree)
  layoutStack(roots, 40, 40)
  const fn = flatten(roots).find((b) => b.nodeKind === 'function_definition')!
  return parseClean(spliceInsert(base, fn.headerEnd + 1, snippet))
}

describe('Scratch palette structure (1.10)', () => {
  it('has category groups with colors and non-empty item lists', () => {
    expect(PALETTE_GROUPS.length).toBeGreaterThanOrEqual(5)
    for (const g of PALETTE_GROUPS) {
      expect(g.color).toMatch(/^#[0-9A-Fa-f]{6}$/)
      expect(g.items.length).toBeGreaterThan(0)
      for (const item of g.items) {
        expect(item.snippet.length).toBeGreaterThan(0)
        expect(item.cat.length).toBeGreaterThan(0)
      }
    }
  })

  it('every group snippet produces parseable C when dropped into main', () => {
    const base = `#include <stdio.h>\n\nint main(void) {\n    return 0;\n}\n`
    for (const g of PALETTE_GROUPS) {
      for (const item of g.items) {
        // comment snippets are comments; everything else must compile-parse
        expect(parsesClean(base, item.snippet), `${g.name}/${item.name}`).toBe(true)
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

  it('per-variable chips: oval reporter + set/change stacks with C snippets', () => {
    const chips = varChips('score')
    expect(chips.length).toBe(3)
    expect(chips[0].snippet).toBe('') // reporter — slot-drop only
    expect(chips[1].snippet).toBe('score = 0;')
    expect(chips[2].snippet).toBe('score = score + 1;')
    const base = `#include <stdio.h>\n\nint main(void) {\n    return 0;\n}\n`
    expect(parsesClean(base, chips[1].snippet)).toBe(true)
    expect(parsesClean(base, chips[2].snippet)).toBe(true)
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
