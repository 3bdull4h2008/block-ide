/** Scratch-faithful palette structure — see docs/SCRATCH-BLOCKS-REFERENCE.md.
 *  Groups follow Scratch's category-section model; hexes are the scratch-blocks
 *  primaries adapted to C's needs (no Motion/Looks/Sound — we render code). */

export interface PaletteItem {
  name: string
  cat: string
  snippet: string
}

export interface PaletteGroup {
  /** header label shown on the colored section bar */
  name: string
  /** Scratch category primary color (CSS hex) */
  color: string
  items: PaletteItem[]
}

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
    name: 'Code',
    color: '#0891B2',
    items: [
      { name: 'printf', cat: 'statement', snippet: 'printf("hi\\n");' },
      { name: 'assign +=', cat: 'statement', snippet: 'value = value + 1;' },
      { name: 'return', cat: 'statement', snippet: 'return 0;' },
    ],
  },
  {
    name: 'Functions',
    color: '#7C5CE0',
    items: [{ name: 'call fn', cat: 'functions', snippet: 'value = myfn(value);' }],
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
