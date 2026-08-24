import { describe, expect, it } from 'vitest'
import {
  PALETTE_GROUPS,
  VARIABLES_COLOR,
  validateVarName,
  varChips,
} from '../src/palette'
import { buildBlocks, layoutStack, flatten } from '../src/blocks'
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
