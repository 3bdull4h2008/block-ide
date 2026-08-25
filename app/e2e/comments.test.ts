import { describe, expect, it } from 'vitest'
import { buildBlocks, flatten } from '../src/blocks'
import type { CTreeJSON } from '../src/blocks'
import { execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'

const exe = resolve(process.cwd(), '..', 'target', 'debug', 'ctree_json.exe')

function parseC(src: string): CTreeJSON {
  if (!existsSync(exe)) throw new Error(`missing ${exe} — run cargo build first`)
  return JSON.parse(execFileSync(exe, { input: src, encoding: 'utf8' })).tree
}

describe('comment + error blocks carry their raw text (Rule 5)', () => {
  it('comment stickies show the comment text, not a blank card', () => {
    const src = `int main(void) {\n    return 0;\n}\n// lagcheck-marker\n`
    const roots = buildBlocks(parseC(src))
    const labels = flatten(roots).map((b) => b.label)
    const comment = labels.find((l) => l.includes('lagcheck-marker'))
    expect(comment, 'comment text visible').toBeTruthy()
  })

  it('in-statement errors surface their raw tokens on the enclosing block', () => {
    const src = `int main(void) {\n    ret urn 0;\n}\n`
    const tree = JSON.parse(execFileSync(exe, { input: src, encoding: 'utf8' }))
    expect(tree.has_errors).toBe(true)
    const labels = flatten(buildBlocks(tree.tree)).map((b) => b.label).join('|')
    // broken code stays legible: the raw tokens are ON the block
    expect(labels).toContain('ret')
    expect(labels).toContain('urn')
  })

  it('top-level garbage renders a LABELED mystery block (not blank)', () => {
    const src = `int main(void) {\n    return 0;\n}\n@@junk@@\n`
    const tree = JSON.parse(execFileSync(exe, { input: src, encoding: 'utf8' }))
    expect(tree.has_errors).toBe(true)
    const err = flatten(buildBlocks(tree.tree)).find((b) => b.cat === 'error')
    expect(err).toBeDefined()
    expect(err!.label.toLowerCase()).toContain('junk')
  })
})
