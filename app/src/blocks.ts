export interface CNodeJSON {
  id: number
  kind: string
  field: string | null
  named: boolean
  missing: boolean
  start: number
  end: number
  pre: string
  text: string | null
  children: CNodeJSON[]
}

export interface CTreeJSON {
  root: CNodeJSON
  tail: string
}

export type Cat = 'function' | 'control' | 'statement' | 'comment' | 'error'

export interface BBlock {
  nodeKind: string
  label: string
  cat: Cat
  sticky: boolean
  container: boolean
  children: BBlock[]
  start: number
  end: number
  /** Byte where the container's body starts (= compound `{` end); else = end. */
  headerEnd: number
  x: number
  y: number
  w: number
  h: number
}

const CONTROL_KINDS = new Set([
  'if_statement',
  'for_statement',
  'while_statement',
  'do_statement',
  'switch_statement',
])

export function isBrace(n: CNodeJSON): boolean {
  return !n.named && (n.text === '{' || n.text === '}')
}

function leafText(n: CNodeJSON): string {
  if (n.text !== null) return n.pre + n.text
  return n.children.map(leafText).join('')
}

function collapse(s: string): string {
  return s.replace(/\s+/g, ' ').trim()
}

function findCompound(n: CNodeJSON): CNodeJSON | null {
  for (const c of n.children) {
    if (c.kind === 'compound_statement') return c
    const deep = findCompound(c)
    if (deep) return deep
  }
  return null
}

function labelWithoutCompounds(n: CNodeJSON): string {
  const parts: string[] = []
  function walk(m: CNodeJSON): void {
    if (m.kind === 'compound_statement' || m.kind === 'comment') return
    parts.push(leafText(m))
  }
  walk(n)
  return collapse(parts.join(' '))
}

function categorize(kind: string): Cat {
  if (kind === 'ERROR' || kind === 'MISSING') return 'error'
  if (kind === 'function_definition') return 'function'
  if (CONTROL_KINDS.has(kind)) return 'control'
  if (kind === 'comment') return 'comment'
  if (
    kind.endsWith('_statement') ||
    kind === 'declaration' ||
    kind === 'expression_statement'
  )
    return 'statement'
  return 'statement'
}

function toBlock(n: CNodeJSON): BBlock {
  const cat = categorize(n.kind)
  const compound = findCompound(n)
  const container = compound !== null && n.kind !== 'comment'
  return {
    nodeKind: n.kind,
    label:
      cat === 'error'
        ? collapse(leafText(n)) || '(incomplete)'
        : container
          ? labelWithoutCompounds(n)
          : collapse(leafText(n)),
    cat,
    sticky: cat === 'comment',
    container,
    children: container ? stackFrom(compound as CNodeJSON) : [],
    start: n.start,
    end: n.end,
    headerEnd: container ? (compound as CNodeJSON).start : n.end,
    x: 0,
    y: 0,
    w: 0,
    h: 0,
  }
}

function stackFrom(parent: CNodeJSON): BBlock[] {
  const out: BBlock[] = []
  for (const c of parent.children) {
    if (isBrace(c)) continue
    out.push(toBlock(c))
  }
  return out
}

export function buildBlocks(tree: CTreeJSON): BBlock[] {
  return stackFrom(tree.root)
}

const CHAR_W = 8.4
export const PAD = 14
export const ROW_H = 34
const GAP_Y = 10
const INDENT = 30

const widthCache = new Map<string, number>()

export function measure(label: string): number {
  let w = widthCache.get(label)
  if (w === undefined) {
    w = Math.max(90, label.length * CHAR_W + PAD * 2)
    widthCache.set(label, w)
  }
  return w
}

export function layoutStack(blocks: BBlock[], x: number, y: number): number {
  let cursorY = y
  let maxBottom = y
  for (const b of blocks) {
    b.x = x
    b.y = cursorY
    if (b.container) {
      layoutStack(b.children, x + INDENT, cursorY + ROW_H + GAP_Y)
      let innerW = 0
      for (const c of b.children) innerW = Math.max(innerW, c.w)
      let innerBottom = cursorY + ROW_H + GAP_Y
      if (b.children.length > 0) {
        innerBottom = b.children[b.children.length - 1].y + b.children[b.children.length - 1].h
      }
      b.w = Math.max(measure(b.label), innerW > 0 ? innerW + INDENT : measure(b.label)) + PAD
      b.h = ROW_H + GAP_Y + Math.max(GAP_Y, innerBottom - (cursorY + ROW_H + GAP_Y)) + GAP_Y
    } else {
      b.w = b.sticky ? measure(b.label) + 20 : measure(b.label)
      b.h = ROW_H
    }
    maxBottom = Math.max(maxBottom, b.y + b.h)
    cursorY += b.h + GAP_Y
  }
  return maxBottom
}

export function flatten(blocks: BBlock[]): BBlock[] {
  const out: BBlock[] = []
  for (const b of blocks) {
    out.push(b)
    if (b.container) out.push(...flatten(b.children))
  }
  return out
}

export interface DropTarget {
  container: BBlock
  index: number
  offset: number
}

/** Deepest container under point; insertion index by child midpoints. */
export function findDropTarget(
  roots: BBlock[],
  wx: number,
  wy: number,
): DropTarget | null {
  let best: { t: DropTarget; area: number } | null = null
  function visit(list: BBlock[]): void {
    for (const b of list) {
      if (!b.container) continue
      const inX = wx >= b.x && wx <= b.x + b.w
      const bottom = b.y + b.h
      if (inX && wy >= b.y && wy <= bottom + GAP_Y / 2) {
        const area = b.w * b.h
        if (!best || area < best.area) {
          let index = b.children.length
          for (let i = 0; i < b.children.length; i++) {
            const c = b.children[i]
            if (wy < c.y + c.h / 2) {
              index = i
              break
            }
          }
          best = { t: { container: b, index, offset: 0 }, area }
        }
      }
      visit(b.children)
    }
  }
  visit(roots)
  if (!best) return null
  const { container, index } = (best as { t: DropTarget }).t
  let offset: number
  if (container.children.length === 0) {
    offset = container.end - 1
  } else if (index >= container.children.length) {
    const last = container.children[container.children.length - 1]
    offset = last.end
  } else {
    offset = container.children[index].start
  }
  return { container, index, offset }
}

/** Block whose header row contains the world point (topmost last). */
export function hitTestHeader(roots: BBlock[], wx: number, wy: number): BBlock | null {
  const all = flatten(roots)
  let hit: BBlock | null = null
  for (const b of all) {
    if (wx >= b.x && wx <= b.x + b.w && wy >= b.y && wy <= b.y + Math.min(ROW_H, b.h)) {
      hit = b
    }
  }
  return hit
}

/** Scratch-style hue coding, harmonized to the sea-blue family.
 *  statement = sea blue (the main color), control = play orange,
 *  function = violet, comment = sand. BORDER holds a darker shade of
 *  each fill for the chunky 3px clay outline. */
export const COLORS: Record<Cat, number> = {
  function: 0x7c5ce0,
  control: 0xff9f1a,
  statement: 0x0891b2,
  comment: 0xffe9a8,
  error: 0x94a3b8,
}

export const BORDER: Record<Cat, number> = {
  function: 0x5a3fc0,
  control: 0xd97e06,
  statement: 0x066a85,
  comment: 0xd9b25a,
  error: 0x64748b,
}
