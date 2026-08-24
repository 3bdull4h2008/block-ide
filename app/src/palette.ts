/** Scratch-faithful palette structure — see docs/SCRATCH-BLOCKS-REFERENCE.md.
 *  Groups follow Scratch's category-section model; hexes are the scratch-blocks
 *  primaries adapted to C's needs (no Motion/Looks/Sound — we render code). */

export interface PaletteItem {
  name: string
  cat: string
  snippet: string
  /** reporter chips don't splice statements — they drop INTO sockets */
  reporter?: 'round' | 'bool'
  /** always splices at file scope (function definitions are not nestable) */
  toplevel?: boolean
}

export interface PaletteGroup {
  /** header label shown on the colored section bar */
  name: string
  /** Scratch category primary color (CSS hex) */
  color: string
  items: PaletteItem[]
}

/** Scratch Operators green (scratch-blocks #59C059) */
export const OPERATORS_COLOR = '#59C059'

export const PALETTE_GROUPS: PaletteGroup[] = [
  {
    name: 'Control',
    color: '#FFAB19',
    items: [
      { name: 'if', cat: 'control', snippet: 'if (cond) {\n}' },
      { name: 'if / else', cat: 'control', snippet: 'if (cond) {\n} else {\n}' },
    ],
  },
  {
    name: 'Loops',
    color: '#FFAB19',
    items: [
      { name: 'for', cat: 'loops', snippet: 'for (int i = 0; i < 10; i++) {\n}' },
      { name: 'while', cat: 'loops', snippet: 'while (cond) {\n}' },
      { name: 'do / while', cat: 'loops', snippet: 'do {\n} while (cond);' },
    ],
  },
  {
    name: 'Operators',
    color: OPERATORS_COLOR,
    items: [
      // round reporters -> arithmetic, fit ident/number sockets
      { name: 'a + b', cat: 'operators', snippet: '', reporter: 'round' },
      { name: 'a - b', cat: 'operators', snippet: '', reporter: 'round' },
      { name: 'a * b', cat: 'operators', snippet: '', reporter: 'round' },
      { name: 'a / b', cat: 'operators', snippet: '', reporter: 'round' },
      { name: 'a % b', cat: 'operators', snippet: '', reporter: 'round' },
      // hex reporters -> comparisons + logic, fit boolean sockets
      { name: 'a == b', cat: 'operators', snippet: '', reporter: 'bool' },
      { name: 'a != b', cat: 'operators', snippet: '', reporter: 'bool' },
      { name: 'a < b', cat: 'operators', snippet: '', reporter: 'bool' },
      { name: 'a > b', cat: 'operators', snippet: '', reporter: 'bool' },
      { name: 'a <= b', cat: 'operators', snippet: '', reporter: 'bool' },
      { name: 'a >= b', cat: 'operators', snippet: '', reporter: 'bool' },
      { name: 'a && b', cat: 'operators', snippet: '', reporter: 'bool' },
      { name: 'a || b', cat: 'operators', snippet: '', reporter: 'bool' },
      { name: 'not ok', cat: 'operators', snippet: '', reporter: 'bool' },
    ],
  },
  {
    name: 'Code',
    color: '#0891B2',
    items: [
      { name: 'printf', cat: 'statement', snippet: 'printf("hi\\n");' },
      { name: 'printf %d', cat: 'statement', snippet: 'printf("%d\\n", value);' },
      { name: 'scanf %d', cat: 'statement', snippet: 'scanf("%d", &value);' },
      { name: 'assign +=', cat: 'statement', snippet: 'value = value + 1;' },
      { name: 'return', cat: 'statement', snippet: 'return 0;' },
    ],
  },
  {
    name: 'Functions',
    color: '#7C5CE0',
    items: [
      { name: 'call fn', cat: 'functions', snippet: 'value = myfn(value);' },
      { name: 'call proc', cat: 'functions', snippet: 'myfn();' },
      // toplevel: always splices at file scope (nested definitions are not C)
      { name: 'define fn', cat: 'functions', snippet: 'int myfn(int x) {\n    return x;\n}', toplevel: true },
    ],
  },
  {
    name: 'Structs',
    color: '#EC4899',
    items: [{ name: 'struct field', cat: 'structs', snippet: 'p.x = 0;' }],
  },
  {
    name: 'Notes',
    color: '#FFE9A8',
    items: [{ name: '// note', cat: 'comment', snippet: '// note' }],
  },
]

/** Scratch Variables orange (data #FF8C1A) — deeper than Control amber. */
export const VARIABLES_COLOR = '#FF8C1A'

const IDENT = /^[A-Za-z_][A-Za-z0-9_]*$/

/** Scratch: variables are created ONLY via Make a Variable, never by a
 *  script at runtime. C identifiers additionally reject reserved words that
 *  would make the generated code unparseable. */
const RESERVED = new Set([
  'int', 'char', 'float', 'double', 'void', 'long', 'short', 'signed',
  'unsigned', 'const', 'static', 'struct', 'union', 'enum', 'return', 'if',
  'else', 'for', 'while', 'do', 'switch', 'case', 'break', 'continue',
  'sizeof', 'typedef', 'extern', 'register', 'volatile', 'goto', 'default',
])

export function validateVarName(raw: string): string | null {
  const name = raw.trim()
  if (!IDENT.test(name)) return null
  if (RESERVED.has(name)) return null
  return name
}

/** Per-variable chips, Scratch-style: the oval reporter (drops into slots)
 *  plus the two stack blocks that target it via C semantics. varName is the
 *  owning variable — labels differ per chip. */
export interface VarChip extends PaletteItem {
  varName: string
}

export function varChips(name: string): VarChip[] {
  return [
    { name, varName: name, cat: 'variables', snippet: '' }, // reporter — slot-drop only
    { name: `set ${name} = 0`, varName: name, cat: 'variables', snippet: `${name} = 0;` },
    { name: `change ${name} + 1`, varName: name, cat: 'variables', snippet: `${name} = ${name} + 1;` },
  ]
}

/** Scratch Lists map to C arrays: declare, set an item, and an element
 *  reporter `name[0]` that drops into slots. */
export function listChips(name: string): VarChip[] {
  return [
    { name: `${name}[0]`, varName: name, cat: 'variables', snippet: '' }, // element reporter
    { name: `new list ${name}[10]`, varName: name, cat: 'variables', snippet: `int ${name}[10];` },
    { name: `set ${name}[0] = 0`, varName: name, cat: 'variables', snippet: `${name}[0] = 0;` },
  ]
}

// ------------------------------------------------- slot value validation
/** identifier, optionally indexed: `total` or `score[0]` (list element) */
export const INDEXED_IDENT = /^[A-Za-z_][A-Za-z0-9_]*(\[\d+\])?$/
const NUMERIC = /^[+-]?(\d+\.?\d*|\.\d+)$/
/** arithmetic expression charset: operands, + - * / %, parens, indexing.
 *  Deliberately EXCLUDES = < > ! & | — those are boolean-only (hex sockets),
 *  mirroring Scratch's reporter/boolean shape split. */
const EXPR = /^[A-Za-z0-9_+*%/().[\]\- ]+$/
/** a bare token (no operator) must still be a valid operand */
const BARE = /^[A-Za-z0-9_]+(\[\d+\])?$/

function isArithmetic(v: string): boolean {
  if (!EXPR.test(v)) return false
  if (BARE.test(v.trim())) return true // single operand
  return /[+*%/\-]/.test(v) || v.includes('(') // operator-bearing expression
}

/** Scratch socket rules, C-typed: reporters (vars, list elements, arithmetic)
 *  fit any round socket; number sockets also take literals; strings auto-
 *  quote. Boolean sockets take any non-empty condition text — C expressions
 *  are too varied for lexical validation, and broken code must stay editable
 *  (Golden Rule 5); the parser + diagnostics surface real errors. */
export function validateSlotValue(type: string, raw: string): string | null {
  const v = raw.trim()
  if (v.length === 0) return null
  if (type === 'ident') return INDEXED_IDENT.test(v) || isArithmetic(v) ? v : null
  if (type === 'number') {
    return NUMERIC.test(v) || INDEXED_IDENT.test(v) || isArithmetic(v) ? v : null
  }
  if (type === 'bool') return v
  if (type === 'string') {
    return /^".*"$/s.test(v) ? v : `"${v.replace(/"/g, '\\"')}"`
  }
  return null // text parts are not editable sockets
}

/** Which socket shapes a reporter kind fits (Scratch: round vs hex). */
export function reporterFits(kind: 'round' | 'bool' | undefined, socket: string): boolean {
  if (kind === 'bool') return socket === 'bool'
  return socket === 'ident' || socket === 'number'
}
