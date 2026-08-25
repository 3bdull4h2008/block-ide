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
  /** language pack the tree was parsed with (block maps key on it) */
  lang: string
}

export type Cat = 'function' | 'control' | 'statement' | 'variables' | 'comment' | 'error' | 'structs'

/** One renderable chunk of a block header: literal text or an editable,
 *  type-constrained input slot (Scratch-style rounded field). `bool` renders
 *  as a hexagonal socket (Scratch's boolean input shape). */
export type PartType = 'text' | 'ident' | 'number' | 'string' | 'bool'
export interface BlockPart {
  type: PartType
  /** display text (strings keep their quotes); byte range refers to src */
  text: string
  start: number
  end: number
}

export interface BBlock {
  /** Stable node id from the parse — the semantic anchor for cursor mapping
   *  and diagnostics; survives re-layouts, changes when code is edited. */
  id: number
  nodeKind: string
  label: string
  /** header chunks: literal text + typed input slots (Scratch-style fields) */
  parts: BlockPart[]
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

/** Per-language shape maps (D11): the block renderer is language-generic —
 *  only the NODE KINDS differ. body = the kind that holds statement rows
 *  (C braces, python indentation blocks, JS/Rust braces). */
interface LangShape {
  body: string
  controls: Set<string>
  fns: Set<string>
  classes: Set<string>
  /** comment node kind (all five use "comment") */
}

const C_CONTROLS = new Set([
  'if_statement',
  'for_statement',
  'while_statement',
  'do_statement',
  'switch_statement',
])

const LANG_SHAPES: Record<string, LangShape> = {
  c: {
    body: 'compound_statement',
    controls: C_CONTROLS,
    fns: new Set(['function_definition']),
    classes: new Set(),
  },
  cpp: {
    body: 'compound_statement',
    controls: C_CONTROLS,
    fns: new Set(['function_definition']),
    classes: new Set(['class_specifier', 'struct_specifier']),
  },
  python: {
    body: 'block',
    controls: new Set([
      'if_statement',
      'for_statement',
      'while_statement',
      'try_statement',
      'with_statement',
    ]),
    fns: new Set(['function_definition']),
    classes: new Set(['class_definition']),
  },
  javascript: {
    body: 'statement_block',
    controls: new Set([
      'if_statement',
      'for_statement',
      'for_in_statement',
      'while_statement',
      'do_statement',
      'switch_statement',
      'try_statement',
    ]),
    fns: new Set(['function_declaration', 'generator_function_declaration']),
    classes: new Set(['class_declaration']),
  },
  rust: {
    body: 'block',
    controls: new Set([
      'if_expression',
      'if_let_expression',
      'match_expression',
      'loop_expression',
      'while_expression',
      'while_let_expression',
      'for_expression',
    ]),
    fns: new Set(['function_item']),
    classes: new Set(['struct_item', 'enum_item']),
  },
}

/** Active shape — set per buildBlocks call (render is single-threaded). */
let SHAPE: LangShape = LANG_SHAPES.c

/** tree-sitter-c field names that hold a control statement's nested bodies */
const BODY_FIELDS = new Set(['body', 'consequence', 'alternative'])

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
    if (c.kind === SHAPE.body) return c
    const deep = findCompound(c)
    if (deep) return deep
  }
  return null
}

/** Body subtrees of a control statement (then/else/loop body), whether or
 *  not they are braced. Everything else in the node is header. */
function fieldedBodies(n: CNodeJSON): CNodeJSON[] {
  return n.children.filter((c) => c.field !== null && BODY_FIELDS.has(c.field))
}

/** Leaf tokens of the HEADER region only — body subtrees, braces, and
 *  comments excluded. This is what gets rendered as text + input slots. */
/** Leaf nodes that become typed input slots — checked BEFORE recursion
 *  because string literals contain child tokens (quotes + content). */
const SLOT_KINDS: Record<string, PartType> = {
  identifier: 'ident',
  number_literal: 'number',
  string_literal: 'string',
}

function headerLeaves(n: CNodeJSON, skip: Set<CNodeJSON>): CNodeJSON[] {
  const out: CNodeJSON[] = []
  const visit = (m: CNodeJSON): void => {
    if (skip.has(m) || m.kind === 'comment' || m.kind === SHAPE.body) return
    if (!m.named && m.text !== null && m.text.trim() === '') return // stray ws token
    const slot = SLOT_KINDS[m.kind]
    if (slot !== undefined || m.children.length === 0) {
      out.push(m)
      return
    }
    for (const c of m.children) visit(c)
  }
  visit(n)
  return out
}

function partTypeOf(kind: string): PartType {
  return SLOT_KINDS[kind] ?? 'text'
}

/** The control statement's condition as a HEX slot (Scratch boolean socket).
 *  if/while/switch wrap their condition in a parenthesized_expression (parens
 *  included) — the slot spans the INNER expression so the '(' ')' tokens
 *  render as text around it. for/do expose a bare expression node. */
function conditionSlot(n: CNodeJSON): { part: BlockPart; node: CNodeJSON } | null {
  const cond = n.children.find((c) => c.field === 'condition')
  if (!cond) return null
  if (cond.kind === 'parenthesized_expression' && cond.children.length >= 3) {
    const inner = cond.children.slice(1, -1)
    const text = collapse(inner.map(leafText).join(' '))
    if (text.length === 0) return null
    return {
      part: { type: 'bool', text, start: inner[0].start, end: inner[inner.length - 1].end },
      node: cond,
    }
  }
  const text = collapse(leafText(cond))
  if (text.length === 0) return null
  return { part: { type: 'bool', text, start: cond.start, end: cond.end }, node: cond }
}

function buildHeader(
  n: CNodeJSON,
  skip: Set<CNodeJSON>,
  barrier?: { start: number; end: number },
): { parts: BlockPart[]; label: string } {
  const raw = headerLeaves(n, skip).map((m) => ({
    type: partTypeOf(m.kind),
    // leafText, not m.text: composite leaves like string_literal carry
    // their content in CHILDREN (quotes + string_content), with text=null
    text: leafText(m).trim(),
    start: m.start,
    end: m.end,
  }))
  const parts: BlockPart[] = []
  for (const p of raw) {
    if (p.text.length === 0) continue
    const last = parts[parts.length - 1]
    const crossesBarrier =
      barrier !== undefined &&
      last !== undefined &&
      last.end <= barrier.start &&
      p.start >= barrier.end
    if (p.type === 'text' && last !== undefined && last.type === 'text' && !crossesBarrier) {
      last.text += ' ' + p.text
      last.end = p.end
    } else {
      parts.push({ ...p })
    }
  }
  return { parts, label: collapse(parts.map((p) => p.text).join(' ')) }
}

function categorize(kind: string): Cat {
  if (kind === 'ERROR' || kind === 'MISSING') return 'error'
  if (SHAPE.fns.has(kind) || kind === 'namespace_definition') return 'function'
  if (SHAPE.controls.has(kind)) return 'control'
  if (SHAPE.classes.has(kind)) return 'structs'
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
  const bodies = fieldedBodies(n)
  const compound = findCompound(n)
  // Control statements are ALWAYS Scratch C-mouths — braced or not. Other
  // containers (functions/classes) keep the body-based rule.
  const container = SHAPE.controls.has(n.kind) || (compound !== null && n.kind !== 'comment')
  // children: expanded bodies for controls, raw body rows for functions
  let kids: BBlock[] = []
  if (container) {
    if (bodies.length > 0) {
      for (const b of bodies) {
        // `else` arrives wrapped in an else_clause node — the statement
        // inside is the actual body row
        const inner =
          b.kind === 'else_clause'
            ? (b.children.find((c) => c.kind !== 'else') ?? b)
            : b
        if (isBrace(inner)) continue
        if (inner.kind === SHAPE.body) kids.push(...stackFrom(inner))
        else kids.push(toBlock(inner))
      }
    } else if (compound !== null) {
      kids = stackFrom(compound)
    }
  }
  const skip = new Set<CNodeJSON>(bodies)
  const cond = SHAPE.controls.has(n.kind) ? conditionSlot(n) : null
  if (cond) skip.add(cond.node)
  let { parts, label } =
    cat === 'error' || cat === 'comment'
      ? { parts: [] as BlockPart[], label: '' }
      : buildHeader(n, skip, cond ? { start: cond.part.start, end: cond.part.end } : undefined)
  // hex condition socket splices into the token stream at byte order
  if (cond) {
    parts = [...parts, cond.part].sort((a, b) => a.start - b.start)
    label = collapse(parts.map((p) => p.text).join(' '))
  }
  return {
    id: n.id,
    nodeKind: n.kind,
    label:
      cat === 'error'
        ? collapse(leafText(n)) || '(incomplete)'
        : label,
    parts,
    cat,
    sticky: cat === 'comment',
    container,
    children: kids,
    start: n.start,
    end: n.end,
    headerEnd:
      container
        ? bodies.length > 0
          ? Math.min(...bodies.map((b) => b.start))
          : (compound as CNodeJSON).start
        : n.end,
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
  SHAPE = LANG_SHAPES[tree.lang] ?? LANG_SHAPES.c
  return stackFrom(tree.root)
}

/** Variables DECLARED in the current file (Scratch-faithful: the palette's
 *  variable section reflects the program's own data). Collects identifiers
 *  that act as declarators under `declaration` nodes — function names,
 *  parameters, and struct fields use different node kinds and are excluded. */
export function harvestVars(root: CNodeJSON): string[] {
  const out = new Set<string>()
  const fromDeclarator = (m: CNodeJSON): void => {
    if (m.kind === 'identifier') {
      if (m.text !== null && m.text.length > 0) out.add(m.text)
      return
    }
    if (
      m.kind === 'init_declarator' ||
      m.kind === 'array_declarator' ||
      m.kind === 'pointer_declarator'
    ) {
      for (const c of m.children) fromDeclarator(c)
    }
  }
  const visit = (n: CNodeJSON): void => {
    if (n.kind === 'declaration') {
      for (const c of n.children) fromDeclarator(c)
    }
    for (const c of n.children) visit(c)
  }
  visit(root)
  return [...out]
}

const CHAR_W = 8.4
export const PAD = 14
export const ROW_H = 34
const GAP_Y = 10
export const INDENT = 30

const widthCache = new Map<string, number>()

export function measure(label: string): number {
  let w = widthCache.get(label)
  if (w === undefined) {
    w = Math.max(90, label.length * CHAR_W + PAD * 2)
    widthCache.set(label, w)
  }
  return w
}

/** Raw glyph-run width — NO minimum. measure()'s 90 px floor is for whole
 *  blocks; applying it per header part is why rows used to stretch into
 *  ribbons around every `=` and `;`. */
function glyphWidth(s: string): number {
  return Math.max(6, s.length * CHAR_W)
}

/** Slots draw as rounded input boxes — wider than their text, with a
 *  minimum click target (Scratch fields never collapse to nothing).
 *  Boolean sockets are hexagonal and need extra room for the points. */
export function partWidth(p: BlockPart): number {
  if (p.type === 'text') return glyphWidth(p.text) + 6
  if (p.type === 'bool') return Math.min(260, Math.max(48, glyphWidth(p.text) + 26))
  return Math.min(240, Math.max(36, glyphWidth(p.text) + 18))
}

/** Width of the header row: parts laid out left→right plus padding. */
export function headerWidth(b: BBlock, gap = 7): number {
  if (b.parts.length === 0) return measure(b.label || b.nodeKind)
  let w = PAD
  for (const p of b.parts) w += partWidth(p) + gap
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
      b.w = Math.max(headerWidth(b), innerW > 0 ? innerW + INDENT : headerWidth(b)) + PAD
      b.h = ROW_H + GAP_Y + Math.max(GAP_Y, innerBottom - (cursorY + ROW_H + GAP_Y)) + GAP_Y
    } else {
      b.w = b.sticky ? measure(b.label) + 20 : headerWidth(b) + PAD
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
  control: 0xffab19,
  statement: 0x0891b2,
  variables: 0xff8c1a,
  comment: 0xffe9a8,
  error: 0x94a3b8,
  structs: 0xec4899,
}

export const BORDER: Record<Cat, number> = {
  function: 0x5a3fc0,
  control: 0xd97e06,
  statement: 0x066a85,
  variables: 0xcc6d10,
  comment: 0xd9b25a,
  error: 0x64748b,
  structs: 0xbe2e6f,
}
