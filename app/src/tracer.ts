/**
 * Visual Code Execution Tracer
 * Interprets C source line-by-line and captures execution steps
 * for visual debugging in the trace panel.
 */

import type { CNodeJSON } from './blocks'

export interface TraceStep {
  line: number
  col: number
  kind: string
  vars: Record<string, unknown>
  output: string
  done: boolean
  error?: string
}

export interface TraceResult {
  steps: TraceStep[]
  totalLines: number
}

type Env = Record<string, unknown>

class BreakSignal {
  val?: unknown
  constructor(val?: unknown) { this.val = val }
}
class ContinueSignal {}
class ReturnSignal {
  val?: unknown
  constructor(val?: unknown) { this.val = val }
}

export class CInterpreter {
  private lineStarts: number[]
  private env: Env = {}
  private fns: Map<string, CNodeJSON> = new Map()
  private builtins: Set<string> = new Set([
    'printf', 'scanf', 'puts', 'putchar', 'getchar',
    'malloc', 'calloc', 'free', 'strlen', 'strcmp', 'strcpy',
    'abs', 'fabs', 'sqrt', 'pow', 'sin', 'cos', 'tan',
    'round', 'floor', 'ceil',
  ])
  private steps: TraceStep[] = []
  private stdout = ''
  private stepLimit: number

  constructor(src: string, stepLimit = 5000) {
    this.lineStarts = this.computeLineStarts(src)
    this.stepLimit = stepLimit
  }

  private computeLineStarts(s: string): number[] {
    const starts = [0]
    for (let i = 0; i < s.length; i++) {
      if (s[i] === '\n') starts.push(i + 1)
    }
    return starts
  }

  private lineCol(byteOffset: number): [number, number] {
    let lo = 0, hi = this.lineStarts.length - 1
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1
      if (this.lineStarts[mid] <= byteOffset) lo = mid; else hi = mid - 1
    }
    return [lo + 1, byteOffset - this.lineStarts[lo] + 1]
  }

  private snap(kind: string, node: CNodeJSON, done = false, error?: string): TraceStep {
    const [line, col] = this.lineCol(node.start)
    const step: TraceStep = {
      line, col, kind,
      vars: { ...this.env },
      output: this.stdout,
      done,
    }
    if (error !== undefined) step.error = error
    this.steps.push(step)
    return step
  }

  private get(name: string): unknown {
    if (name in this.env) return this.env[name]
    throw new Error(`undefined variable: ${name}`)
  }

  private setVar(name: string, val: unknown): void {
    this.env[name] = val
  }

  private txt(n: CNodeJSON): string {
    return n.text ?? ''
  }

  /* ─── Statement execution ─── */

  private exec(n: CNodeJSON): void {
    if (this.steps.length >= this.stepLimit) {
      throw new Error(`step limit ${this.stepLimit} reached — possible infinite loop`)
    }

    const k = n.kind

    switch (k) {
      case 'translation_unit':
      case 'compound_statement':
        this.execBlock(n); break
      case 'declaration':
        this.execDecl(n); break
      case 'init_declarator':
        this.execInitDecl(n); break
      case 'expression_statement':
        this.execExprStmt(n); break
      case 'if_statement':
        this.execIf(n); break
      case 'while_statement':
        this.execWhile(n); break
      case 'for_statement':
        this.execFor(n); break
      case 'do_statement':
        this.execDoWhile(n); break
      case 'return_statement':
        this.execReturn(n); break
      case 'break_statement':
        this.snap('break', n); throw new BreakSignal()
      case 'continue_statement':
        this.snap('continue', n); throw new ContinueSignal()
      case 'function_definition':
        this.execFnDef(n); break
      case 'preproc_include':
      case 'preproc_def':
      case 'preproc_ifdef':
      case 'preproc_ifndef':
      case 'preproc_if':
      case 'preproc_endif':
      case 'preproc_else':
      case 'preproc_elif':
      case 'comment':
        break
      case '#include_directive':
        break
      default:
        this.snap(k, n)
    }
  }

  private execBlock(n: CNodeJSON): void {
    for (const c of n.children) {
      if (c.named && !c.missing) this.exec(c)
    }
  }

  private execDecl(n: CNodeJSON): void {
    this.snap('declaration', n)
    for (const c of n.children) {
      if (c.kind === 'init_declarator') this.execInitDecl(c)
      else if (c.kind === 'identifier' || c.kind === 'array_declarator') {
        const name = this.findIdent(c)
        if (name) this.setVar(name, 0)
      }
    }
  }

  private execInitDecl(n: CNodeJSON): void {
    let name = ''
    let val: unknown = 0
    for (const c of n.children) {
      if (c.kind === 'identifier') name = this.txt(c)
      else if (c.kind !== 'type_descriptor' && c.kind !== 'primitive_type'
        && c.kind !== 'type_identifier' && c.kind !== 'struct_specifier'
        && c.kind !== 'sized_type_specifier') {
        val = this.eval(c)
      }
    }
    if (name) this.setVar(name, val)
    this.snap('assign', n)
  }

  private findIdent(n: CNodeJSON): string {
    if (n.kind === 'identifier') return this.txt(n)
    for (const c of n.children) {
      const r = this.findIdent(c)
      if (r) return r
    }
    return ''
  }

  private execExprStmt(n: CNodeJSON): void {
    for (const c of n.children) {
      if (c.named && !c.missing) {
        this.eval(c)
        break
      }
    }
    this.snap('expression', n)
  }

  private execIf(n: CNodeJSON): void {
    this.snap('if', n)
    const cond = this.evalChild(n, 'condition')
    if (this.truthy(cond)) {
      // tree-sitter-c names the taken branch 'consequence'; the generic
      // 'body'/'compound' fallbacks cover dialects and error recovery
      const body = this.childByField(n, 'consequence') || this.childByField(n, 'body')
        || this.childByKind(n, 'compound_statement')
      if (body) this.exec(body)
    } else {
      const alt = this.childByField(n, 'alternative')
        || this.childByKind(n, 'else_clause')
      if (alt) {
        const body = this.childByField(alt, 'body') || this.childByKind(alt, 'compound_statement')
          || alt.children.find(c => c.named && c.kind !== 'else')
          || alt
        this.exec(body)
      }
    }
  }

  private execWhile(n: CNodeJSON): void {
    this.snap('while', n)
    for (let i = 0; i < 10000; i++) {
      const cond = this.evalChild(n, 'condition')
      if (!this.truthy(cond)) break
      const body = this.childByField(n, 'body') || this.childByKind(n, 'compound_statement')
      if (body) {
        try { this.exec(body) }
        catch (e) {
          if (e instanceof BreakSignal) break
          if (e instanceof ContinueSignal) continue
          if (e instanceof ReturnSignal) throw e
          throw e
        }
      }
    }
    if (this.truthy(this.evalChild(n, 'condition')))
      throw new Error('iteration limit reached in loop (10000)')
  }

  private execFor(n: CNodeJSON): void {
    this.snap('for', n)
    const init = this.childByField(n, 'init') || this.childByKind(n, 'declaration')
    if (init) this.exec(init)

    let capped = true
    for (let i = 0; i < 10000; i++) {
      const cond = this.childByField(n, 'condition')
      if (cond && !this.truthy(this.eval(cond))) { capped = false; break }

      const body = this.childByField(n, 'body') || this.childByKind(n, 'compound_statement')
      if (body) {
        try { this.exec(body) }
        catch (e) {
          // ContinueSignal falls through: a C `for` still runs the update
          if (e instanceof BreakSignal) { capped = false; break }
          if (e instanceof ReturnSignal) throw e
          if (!(e instanceof ContinueSignal)) throw e
        }
      }

      const update = this.childByField(n, 'update')
      if (update) this.eval(update)
    }
    // exhausted the cap without a false condition → the loop would run forever
    if (capped && this.truthy(this.evalChild(n, 'condition')))
      throw new Error('iteration limit reached in loop (10000)')
  }

  private execDoWhile(n: CNodeJSON): void {
    this.snap('do_while', n)
    const body = this.childByField(n, 'body') || this.childByKind(n, 'compound_statement')
    const cond = this.childByField(n, 'condition')
    for (let i = 0; i < 10000; i++) {
      if (body) {
        try { this.exec(body) }
        catch (e) {
          if (e instanceof BreakSignal) break
          if (e instanceof ReturnSignal) throw e
          if (!(e instanceof ContinueSignal)) throw e
        }
      }
      if (cond && !this.truthy(this.eval(cond))) break
    }
    if (cond && this.truthy(this.eval(cond)))
      throw new Error('iteration limit reached in loop (10000)')
  }

  private execReturn(n: CNodeJSON): void {
    this.snap('return', n)
    const expr = this.childByField(n, 'value') || this.childByKind(n, 'expression')
    const val = expr ? this.eval(expr) : undefined
    throw new ReturnSignal(val)
  }

  private execFnDef(n: CNodeJSON): void {
    let name = ''
    for (const c of n.children) {
      if (c.kind === 'function_declarator' || c.kind === 'identifier') {
        name = this.findIdent(c) || this.txt(c)
        break
      }
    }
    if (name) this.fns.set(name, n)
  }

  /* ─── Expression evaluation ─── */

  private eval(n: CNodeJSON): unknown {
    const k = n.kind
    if (k === 'number_literal') return Number(this.txt(n))
    if (k === 'char_literal') {
      const t = this.txt(n)
      return t.length === 3 ? t.charCodeAt(1) : 0
    }
    if (k === 'string_literal') {
      const t = this.txt(n)
      return t.slice(1, -1).replace(/\\n/g, '\n').replace(/\\t/g, '\t')
        .replace(/\\0/g, '\0').replace(/\\\\/g, '\\').replace(/\\"/g, '"')
    }
    if (k === 'true') return 1
    if (k === 'false') return 0
    if (k === 'null') return 0
    if (k === 'identifier') {
      const name = this.txt(n)
      if (name === 'NULL') return 0
      if (name === 'true') return 1
      if (name === 'false') return 0
      if (name === 'M_PI') return Math.PI
      return this.get(name)
    }
    if (k === 'parenthesized_expression') {
      const inner = n.children.find(c => c.named && c.kind !== 'lparen' && c.kind !== 'rparen')
      return inner ? this.eval(inner) : 0
    }
    if (k === 'binary_expression') return this.evalBin(n)
    if (k === 'unary_expression') return this.evalUnary(n)
    if (k === 'update_expression') return this.evalUpdate(n)
    if (k === 'assignment_expression') return this.evalAssign(n)
    if (k === 'conditional_expression') return this.evalTernary(n)
    if (k === 'call_expression') return this.evalCall(n)
    if (k === 'subscript_expression') return this.evalSubscript(n)
    if (k === 'field_expression') return this.evalField(n)
    if (k === 'cast_expression') {
      const inner = n.children.find(c => c.named && c.kind !== 'type_descriptor'
        && c.kind !== 'type_identifier' && c.kind !== 'primitive_type'
        && c.kind !== 'sized_type_specifier' && c.kind !== 'struct_specifier')
      return inner ? this.eval(inner) : 0
    }
    if (k === 'sizeof_expression') return 4
    if (k === 'pointer_expression') return this.eval(n.children.find(c => c.named) ?? n)
    if (k === 'array_initializer') {
      const vals: unknown[] = []
      for (const c of n.children) {
        if (c.named && c.kind !== 'l_brace' && c.kind !== 'r_brace' && c.kind !== 'comma')
          vals.push(this.eval(c))
      }
      return vals
    }
    return 0
  }

  private evalBin(n: CNodeJSON): unknown {
    const [l, r] = this.binChildren(n)
    const op = this.binOp(n)
    if (op === '&&') return this.truthy(this.eval(l)) && this.truthy(this.eval(r)) ? 1 : 0
    if (op === '||') return this.truthy(this.eval(l)) || this.truthy(this.eval(r)) ? 1 : 0
    const lv = this.eval(l), rv = this.eval(r)
    const a = typeof lv === 'number' ? lv : 0, b = typeof rv === 'number' ? rv : 0
    switch (op) {
      case '+': return a + b
      case '-': return a - b
      case '*': return a * b
      case '/': return b !== 0 ? Math.trunc(a / b) : 0
      case '%': return b !== 0 ? a % b : 0
      case '<': return a < b ? 1 : 0
      case '>': return a > b ? 1 : 0
      case '<=': return a <= b ? 1 : 0
      case '>=': return a >= b ? 1 : 0
      case '==': return a === b ? 1 : 0
      case '!=': return a !== b ? 1 : 0
      case '&': return a & b
      case '|': return a | b
      case '^': return a ^ b
      case '<<': return a << b
      case '>>': return a >> b
      default: return 0
    }
  }

  private evalUnary(n: CNodeJSON): unknown {
    const op = this.txt(n.children[0] ?? n)
    const inner = n.children.find(c => c.named && c.kind !== 'lparen' && c.kind !== 'rparen')
    if (!inner) return 0
    if (op === '-' || op === '+') { const v = this.eval(inner); return typeof v === 'number' ? -v : 0 }
    if (op === '!') { const v = this.eval(inner); return this.truthy(v) ? 0 : 1 }
    if (op === '~') { const v = this.eval(inner); return typeof v === 'number' ? ~v : 0 }
    return this.eval(inner)
  }

  private evalUpdate(n: CNodeJSON): unknown {
    // the operator's POSITION decides: prefix `++i` has it first, postfix
    // `i++` last (tree-sitter-c has no separate postfix_expression kind)
    const opIdx = n.children.findIndex(c => c.text === '++' || c.text === '--')
    if (opIdx === -1) return 0
    const isPost = opIdx > 0
    const op = this.txt(n.children[opIdx])
    const operand = n.children.find(c => c.named)
    if (!operand) return 0
    const name = this.findIdent(operand)
    if (!name) return 0
    const old = typeof this.get(name) === 'number' ? (this.get(name) as number) : 0
    const delta = op === '++' ? 1 : -1
    this.setVar(name, old + delta)
    this.snap('assign', n)
    return isPost ? old : old + delta
  }

  private evalAssign(n: CNodeJSON): unknown {
    const children = n.children.filter(c => c.named)
    if (children.length < 2) return 0
    const target = children[0], src_ = children[1]
    const opNode = n.children.find(c => !c.named && c.text && /[+\-*/&|^]=?|<<=|>>=/.test(c.text))
    const op = opNode?.text ?? '='
    const name = this.findIdent(target)
    if (!name) return this.eval(src_)

    let newVal: unknown
    if (op === '=' || op === undefined) {
      newVal = this.eval(src_)
    } else {
      const baseOp = op.charAt(0)
      const lv = typeof this.get(name) === 'number' ? (this.get(name) as number) : 0
      const rv = typeof this.eval(src_) === 'number' ? (this.eval(src_) as number) : 0
      switch (baseOp) {
        case '+': newVal = lv + rv; break
        case '-': newVal = lv - rv; break
        case '*': newVal = lv * rv; break
        case '/': newVal = rv !== 0 ? Math.trunc(lv / rv) : 0; break
        case '%': newVal = rv !== 0 ? lv % rv : 0; break
        case '&': newVal = lv & rv; break
        case '|': newVal = lv | rv; break
        case '^': newVal = lv ^ rv; break
        case '<': newVal = lv << rv; break // <<=
        case '>': newVal = lv >> rv; break // >>=
        default: newVal = this.eval(src_)
      }
    }
    this.setVar(name, newVal)
    this.snap('assign', n)
    return newVal
  }

  private evalTernary(n: CNodeJSON): unknown {
    const children = n.children.filter(c => c.named)
    if (children.length < 3) return 0
    return this.truthy(this.eval(children[0])) ? this.eval(children[1]) : this.eval(children[2])
  }

  private evalCall(n: CNodeJSON): unknown {
    const callee = n.children[0]
    const fnName = this.findIdent(callee)
    const args = this.getCallArgs(n)
    if (fnName === 'printf' || fnName === 'fprintf' || fnName === 'sprintf') {
      return this.doPrintf(args)
    }
    if (fnName === 'scanf') return this.doScanf(args)
    if (fnName === 'puts') {
      const s = args.length > 0 ? String(args[0]) : ''
      this.stdout += s + '\n'
      return 0
    }
    if (fnName === 'putchar') {
      const c = args.length > 0 ? Number(args[0]) : 0
      this.stdout += String.fromCharCode(c)
      return 0
    }
    if (fnName === 'abs' || fnName === 'fabs') {
      return args.length > 0 ? Math.abs(Number(args[0])) : 0
    }
    if (fnName === 'sqrt') return args.length > 0 ? Math.sqrt(Number(args[0])) : 0
    if (fnName === 'pow') return args.length >= 2 ? Math.pow(Number(args[0]), Number(args[1])) : 0
    if (fnName === 'sin') return args.length > 0 ? Math.sin(Number(args[0])) : 0
    if (fnName === 'cos') return args.length > 0 ? Math.cos(Number(args[0])) : 0
    if (fnName === 'tan') return args.length > 0 ? Math.tan(Number(args[0])) : 0
    if (fnName === 'round') return args.length > 0 ? Math.round(Number(args[0])) : 0
    if (fnName === 'floor') return args.length > 0 ? Math.floor(Number(args[0])) : 0
    if (fnName === 'ceil') return args.length > 0 ? Math.ceil(Number(args[0])) : 0
    if (fnName === 'strlen') return args.length > 0 ? String(args[0]).length : 0
    if (fnName === 'strcmp') {
      return args.length >= 2 ? String(args[0]).localeCompare(String(args[1])) : 0
    }
    if (fnName === 'strcpy') {
      if (args.length >= 2) this.setVar(String(args[0]), String(args[1]))
      return args.length > 0 ? args[0] : 0
    }
    if (fnName === 'malloc' || fnName === 'calloc') return 0x1000
    if (fnName === 'free') return 0
    if (fnName && this.fns.has(fnName)) return this.callUserFn(fnName, args)
    if (fnName && this.builtins.has(fnName)) return 0
    throw new Error(`undefined function: ${fnName}`)
  }

  private getCallArgs(callNode: CNodeJSON): unknown[] {
    const argsNode = callNode.children.find(c => c.kind === 'argument_list')
    if (!argsNode) return []
    const result: unknown[] = []
    for (const c of argsNode.children) {
      if (c.named && c.kind !== 'lparen' && c.kind !== 'rparen' && c.kind !== 'comma')
        result.push(this.eval(c))
    }
    return result
  }

  private callUserFn(name: string, args: unknown[]): unknown {
    const fnNode = this.fns.get(name)!
    const params: string[] = []
    const paramsNode = fnNode.children.find(c => c.kind === 'function_declarator')
    if (paramsNode) {
      const paramList = paramsNode.children.find(c => c.kind === 'parameter_list')
      if (paramList) {
        for (const p of paramList.children) {
          if (p.named && p.kind !== 'lparen' && p.kind !== 'rparen' && p.kind !== 'comma') {
            const id = this.findIdent(p)
            if (id) params.push(id)
          }
        }
      }
    }
    const saved = { ...this.env }
    for (let i = 0; i < params.length; i++) {
      this.setVar(params[i], i < args.length ? args[i] : 0)
    }
    const body = fnNode.children.find(c => c.kind === 'compound_statement')
    let result: unknown = 0
    if (body) {
      try { this.exec(body) }
      catch (e) { if (e instanceof ReturnSignal) result = e.val ?? 0; else throw e }
    }
    this.env = saved
    return result
  }

  private doPrintf(args: unknown[]): number {
    if (args.length === 0) return 0
    let fmt = String(args[0])
    let argIdx = 1
    const out = fmt.replace(/%d|%i|%u|%x|%X|%o|%c|%s|%f|%e|%E|%g|%G|%p|%%/g,
      (match) => {
        if (match === '%%') return '%'
        if (match === '%c') return args[argIdx++] !== undefined ? String.fromCharCode(Number(args[argIdx - 1])) : ''
        if (match === '%s') return args[argIdx++] !== undefined ? String(args[argIdx - 1]) : '(null)'
        if (match === '%d' || match === '%i' || match === '%u' || match === '%x' || match === '%X' || match === '%o')
          return args[argIdx++] !== undefined ? String(Number(args[argIdx - 1])) : '0'
        if (match === '%f' || match === '%e' || match === '%E' || match === '%g' || match === '%G')
          return args[argIdx++] !== undefined ? String(Number(args[argIdx - 1])) : '0'
        if (match === '%p') return args[argIdx++] !== undefined ? '0x' + Number(args[argIdx - 1]).toString(16) : '0x0'
        return match
      })
    this.stdout += out
    return out.length
  }

  private doScanf(args: unknown[]): number {
    if (args.length < 2) return 0
    const buf = prompt?.('scanf input:') ?? '0'
    const name = this.findIdent(args[1] as CNodeJSON)
    if (name) this.setVar(name, Number(buf) || 0)
    return 1
  }

  private evalSubscript(n: CNodeJSON): unknown {
    const children = n.children.filter(c => c.named && c.kind !== 'l_bracket' && c.kind !== 'r_bracket')
    if (children.length < 2) return 0
    const arr = this.eval(children[0])
    const idx = Number(this.eval(children[1]))
    if (Array.isArray(arr)) return arr[idx] ?? 0
    return 0
  }

  private evalField(n: CNodeJSON): unknown {
    const children = n.children.filter(c => c.named)
    if (children.length < 2) return 0
    return this.eval(children[0])
  }

  /* ─── Helpers ─── */

  private binChildren(n: CNodeJSON): [CNodeJSON, CNodeJSON] {
    const named = n.children.filter(c => c.named)
    return [named[0] ?? n, named[1] ?? n]
  }

  private binOp(n: CNodeJSON): string {
    const op = n.children.find(c => !c.named && c.text && !c.missing)
    return op?.text ?? ''
  }

  private truthy(v: unknown): boolean {
    if (typeof v === 'number') return v !== 0
    if (typeof v === 'string') return v.length > 0
    if (typeof v === 'boolean') return v
    return v != null
  }

  private childByField(n: CNodeJSON, field: string): CNodeJSON | undefined {
    return n.children.find(c => c.field === field)
  }

  private childByKind(n: CNodeJSON, kind: string): CNodeJSON | undefined {
    return n.children.find(c => c.kind === kind)
  }

  private evalChild(n: CNodeJSON, field: string): unknown {
    const child = this.childByField(n, field) || this.childByKind(n, field)
    return child ? this.eval(child) : 0
  }

  /* ─── Public API ─── */

  run(tree: CNodeJSON): TraceResult {
    try {
      this.exec(tree)
      this.snap('return', tree, true)
    } catch (e) {
      if (!(e instanceof ReturnSignal)) {
        const msg = e instanceof Error ? e.message : String(e)
        const last = this.steps[this.steps.length - 1]
        if (last) last.error = msg
        else this.snap('error', tree, true, msg)
      } else {
        this.snap('return', tree, true)
      }
    }
    return { steps: this.steps, totalLines: this.lineStarts.length }
  }
}

export function interpretC(src: string, tree: CNodeJSON, limit?: number): TraceResult {
  const interp = new CInterpreter(src, limit)
  return interp.run(tree)
}
