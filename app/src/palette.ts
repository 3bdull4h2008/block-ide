/** Scratch-faithful palette structure — see docs/SCRATCH-BLOCKS-REFERENCE.md.
 *  Groups follow Scratch's category-section model; hexes are the scratch-blocks
 *  primaries adapted to C's needs (no Motion/Looks/Sound — we render code). */

export type SourceLang = 'c' | 'cpp' | 'python' | 'javascript' | 'rust'

export interface PaletteItem {
  name: string
  cat: string
  snippet: string
  /** reporter chips don't splice statements — they drop INTO sockets */
  reporter?: 'round' | 'bool'
  /** always splices at file scope (function definitions are not nestable) */
  toplevel?: boolean
  /** splice at the very top of the file (includes) */
  top?: boolean
  /** only shown for these languages (default: both) */
  langs?: SourceLang[]
  /** chip stays disabled until the program contains this node kind
   *  and/or this #include — Scratch's "blocks depend on others" rule */
  requires?: { kind?: string; include?: string }
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
      { name: 'if', cat: 'control', snippet: 'if (cond) {\n}', langs: ['c', 'cpp'] },
      {
        name: 'else',
        cat: 'control',
        snippet: 'else {\n}',
        langs: ['c', 'cpp'],
        requires: { kind: 'if_statement' },
      },
      {
        name: 'case + break',
        cat: 'control',
        snippet: 'case 1:\n    break;',
        langs: ['c', 'cpp'],
        requires: { kind: 'switch_statement' },
      },
      { name: 'try / catch', cat: 'control', snippet: 'try {\n} catch (...) {\n}', langs: ['cpp'] },
      // python
      { name: 'if', cat: 'control', snippet: 'if cond:\n    pass', langs: ['python'] },
      {
        name: 'elif',
        cat: 'control',
        snippet: 'elif cond:\n    pass',
        langs: ['python'],
        requires: { kind: 'if_statement' },
      },
      {
        name: 'else',
        cat: 'control',
        snippet: 'else:\n    pass',
        langs: ['python'],
        requires: { kind: 'if_statement' },
      },
      { name: 'for i in range', cat: 'control', snippet: 'for i in range(10):\n    pass', langs: ['python'] },
      { name: 'while', cat: 'control', snippet: 'while cond:\n    pass', langs: ['python'] },
      { name: 'try / except', cat: 'control', snippet: 'try:\n    pass\nexcept:\n    pass', langs: ['python'] },
      // javascript
      { name: 'if', cat: 'control', snippet: 'if (cond) {\n}', langs: ['javascript'] },
      {
        name: 'else',
        cat: 'control',
        snippet: 'else {\n}',
        langs: ['javascript'],
        requires: { kind: 'if_statement' },
      },
      { name: 'for-of', cat: 'control', snippet: 'for (const x of items) {\n}', langs: ['javascript'] },
      { name: 'while', cat: 'control', snippet: 'while (cond) {\n}', langs: ['javascript'] },
      { name: 'try / catch', cat: 'control', snippet: 'try {\n} catch (e) {\n}', langs: ['javascript'] },
      // rust
      { name: 'if', cat: 'control', snippet: 'if cond {\n}', langs: ['rust'] },
      {
        name: 'else',
        cat: 'control',
        snippet: 'else {\n}',
        langs: ['rust'],
        requires: { kind: 'if_expression' },
      },
      { name: 'loop', cat: 'control', snippet: 'loop {\n}', langs: ['rust'] },
      { name: 'while', cat: 'control', snippet: 'while cond {\n}', langs: ['rust'] },
      { name: 'for-in', cat: 'control', snippet: 'for x in 0..10 {\n}', langs: ['rust'] },
      { name: 'match', cat: 'control', snippet: 'match value {\n    _ => {}\n}', langs: ['rust'] },
    ],
  },
  {
    name: 'Loops',
    color: '#FFAB19',
    items: [
      { name: 'for', cat: 'loops', snippet: 'for (int i = 0; i < 10; i++) {\n}', langs: ['c', 'cpp'] },
      { name: 'while', cat: 'loops', snippet: 'while (cond) {\n}', langs: ['c', 'cpp'] },
      { name: 'do / while', cat: 'loops', snippet: 'do {\n} while (cond);', langs: ['c', 'cpp'] },
      { name: 'for i in range', cat: 'loops', snippet: 'for i in range(10):\n    pass', langs: ['python'] },
      { name: 'while', cat: 'loops', snippet: 'while cond:\n    pass', langs: ['python'] },
      { name: 'for', cat: 'loops', snippet: 'for (let i = 0; i < 10; i++) {\n}', langs: ['javascript'] },
      { name: 'while', cat: 'loops', snippet: 'while (cond) {\n}', langs: ['javascript'] },
      { name: 'for-in', cat: 'loops', snippet: 'for x in 0..10 {\n}', langs: ['rust'] },
      { name: 'while', cat: 'loops', snippet: 'while cond {\n}', langs: ['rust'] },
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
      // logic: python words vs symbolic (D11 split)
      { name: 'a && b', cat: 'operators', snippet: '', reporter: 'bool', langs: ['c', 'cpp', 'javascript', 'rust'] },
      { name: 'a || b', cat: 'operators', snippet: '', reporter: 'bool', langs: ['c', 'cpp', 'javascript', 'rust'] },
      { name: 'not ok', cat: 'operators', snippet: '', reporter: 'bool', langs: ['c', 'cpp', 'javascript', 'rust'] },
      { name: 'a and b', cat: 'operators', snippet: '', reporter: 'bool', langs: ['python'] },
      { name: 'a or b', cat: 'operators', snippet: '', reporter: 'bool', langs: ['python'] },
      { name: 'not ok', cat: 'operators', snippet: '', reporter: 'bool', langs: ['python'] },
    ],
  },
  {
    name: 'Code',
    color: '#0891B2',
    items: [
      {
        name: '#include <stdio.h>',
        cat: 'statement',
        snippet: '#include <stdio.h>',
        top: true,
        langs: ['c'],
      },
      {
        name: '#include <iostream>',
        cat: 'statement',
        snippet: '#include <iostream>',
        top: true,
        langs: ['cpp'],
      },
      {
        name: 'printf',
        cat: 'statement',
        snippet: 'printf("hi\\n");',
        langs: ['c'],
        requires: { include: 'stdio.h' },
      },
      {
        name: 'printf %d',
        cat: 'statement',
        snippet: 'printf("%d\\n", value);',
        langs: ['c'],
        requires: { include: 'stdio.h' },
      },
      {
        name: 'scanf %d',
        cat: 'statement',
        snippet: 'scanf("%d", &value);',
        langs: ['c'],
        requires: { include: 'stdio.h' },
      },
      {
        name: 'cout text',
        cat: 'statement',
        snippet: 'std::cout << "text" << "\\n";',
        langs: ['cpp'],
        requires: { include: 'iostream' },
      },
      {
        name: 'cout value',
        cat: 'statement',
        snippet: 'std::cout << value << "\\n";',
        langs: ['cpp'],
        requires: { include: 'iostream' },
      },
      {
        name: 'cin >> value',
        cat: 'statement',
        snippet: 'std::cin >> value;',
        langs: ['cpp'],
        requires: { include: 'iostream' },
      },
      {
        name: 'using namespace std',
        cat: 'statement',
        snippet: 'using namespace std;',
        langs: ['cpp'],
      },
      { name: 'assign +=', cat: 'statement', snippet: 'value = value + 1;', langs: ['c', 'cpp', 'javascript', 'rust'] },
      { name: 'return', cat: 'statement', snippet: 'return 0;', langs: ['c', 'cpp', 'javascript', 'rust'] },
      // python
      { name: 'print text', cat: 'statement', snippet: 'print("hi")', langs: ['python'] },
      { name: 'print value', cat: 'statement', snippet: 'print(value)', langs: ['python'] },
      { name: 'input', cat: 'statement', snippet: 'value = input()', langs: ['python'] },
      { name: 'int input', cat: 'statement', snippet: 'value = int(input())', langs: ['python'] },
      { name: 'assign', cat: 'statement', snippet: 'value = value + 1', langs: ['python'] },
      // javascript
      { name: 'console.log text', cat: 'statement', snippet: 'console.log("hi");', langs: ['javascript'] },
      { name: 'console.log value', cat: 'statement', snippet: 'console.log(value);', langs: ['javascript'] },
      { name: 'let', cat: 'statement', snippet: 'let value = 0;', langs: ['javascript'] },
      { name: 'assign +=', cat: 'statement', snippet: 'value = value + 1;', langs: ['javascript'] },
      { name: 'return', cat: 'statement', snippet: 'return 0;', langs: ['javascript'] },
      // rust
      { name: 'println! text', cat: 'statement', snippet: 'println!("hi");', langs: ['rust'] },
      { name: 'println! value', cat: 'statement', snippet: 'println!("{}", value);', langs: ['rust'] },
      { name: 'let mut', cat: 'statement', snippet: 'let mut value = 0;', langs: ['rust'] },
      { name: 'assign +=', cat: 'statement', snippet: 'value = value + 1;', langs: ['rust'] },
      { name: 'return', cat: 'statement', snippet: 'return 0;', langs: ['rust'] },
    ],
  },
  {
    name: 'Functions',
    color: '#7C5CE0',
    items: [
      { name: 'call fn', cat: 'functions', snippet: 'value = myfn(value);', langs: ['c', 'cpp', 'javascript', 'rust'] },
      { name: 'call proc', cat: 'functions', snippet: 'myfn();', langs: ['c', 'cpp', 'javascript', 'rust'] },
      // toplevel: always splices at file scope (nested definitions are not C)
      { name: 'define fn', cat: 'functions', snippet: 'int myfn(int x) {\n    return x;\n}', toplevel: true, langs: ['c', 'cpp'] },
      {
        name: 'namespace',
        cat: 'functions',
        snippet: 'namespace myns {\n}',
        toplevel: true,
        langs: ['cpp'],
      },
      { name: 'def', cat: 'functions', snippet: 'def myfn(x):\n    return x', toplevel: true, langs: ['python'] },
      { name: 'function', cat: 'functions', snippet: 'function myfn(x) {\n    return x;\n}', toplevel: true, langs: ['javascript'] },
      { name: 'fn', cat: 'functions', snippet: 'fn myfn(x: i32) -> i32 {\n    x\n}', toplevel: true, langs: ['rust'] },
    ],
  },
  {
    name: 'Structs',
    color: '#EC4899',
    items: [
      { name: 'struct field', cat: 'structs', snippet: 'p.x = 0;', langs: ['c', 'cpp'] },
      { name: 'define class', cat: 'structs', snippet: 'class MyClass {\n};', toplevel: true, langs: ['cpp'] },
      { name: 'def class', cat: 'structs', snippet: 'class MyClass:\n    pass', toplevel: true, langs: ['python'] },
      { name: 'define class', cat: 'structs', snippet: 'class MyClass {\n}', toplevel: true, langs: ['javascript'] },
      { name: 'struct', cat: 'structs', snippet: 'struct MyClass {\n    x: i32,\n}', toplevel: true, langs: ['rust'] },
    ],
  },
  {
    name: 'Notes',
    color: '#FFE9A8',
    items: [
      { name: '// note', cat: 'comment', snippet: '// note', langs: ['c', 'cpp', 'javascript', 'rust'] },
      { name: '# note', cat: 'comment', snippet: '# note', langs: ['python'] },
    ],
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

/** Per-variable chips, Scratch-style: a TYPED declaration chip (C/C++ need
 *  the variable to exist before use — Scratch doesn't, C does), the oval
 *  reporter, and the set/change stacks. varName is the owning variable. */
export interface VarChip extends PaletteItem {
  varName: string
}

/** Types offered by Make a Variable — C/C++ only (D11: dynamically-typed
 *  languages need no declaration, so the whole Variables section is
 *  C/C++-gated in the renderer). */
export function varTypes(lang: SourceLang): string[] {
  if (lang === 'cpp') return ['int', 'double', 'bool', 'string']
  if (lang === 'c') return ['int', 'double', 'bool']
  return []
}

export function varChips(name: string, type = 'int'): VarChip[] {
  return [
    {
      name: `new ${type} ${name}`,
      varName: name,
      cat: 'variables',
      snippet: `${type} ${name} = 0;`,
    },
    { name, varName: name, cat: 'variables', snippet: '', reporter: 'round' }, // oval reporter
    { name: `set ${name} = 0`, varName: name, cat: 'variables', snippet: `${name} = 0;` },
    {
      name: `change ${name} + 1`,
      varName: name,
      cat: 'variables',
      snippet: `${name} = ${name} + 1;`,
    },
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
