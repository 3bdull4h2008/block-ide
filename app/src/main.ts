import { Application, Container, Graphics, Text } from 'pixi.js'
import { invoke as tauriInvoke } from '@tauri-apps/api/core'

// IPC observability (temporary diagnostics, RUN 43): count calls/pending per
// command so hangs are attributable from the page itself.
const ipcStats: Record<string, { calls: number; pending: number; errs: number }> = {}
;(window as unknown as { __ipc?: unknown }).__ipc = ipcStats
const ipcLog: string[] = []
;(window as unknown as { __ipcLog?: unknown }).__ipcLog = ipcLog
function invoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  const rec = (ipcStats[cmd] ??= { calls: 0, pending: 0, errs: 0 })
  rec.calls++
  rec.pending++
  const t0 = Math.round(performance.now())
  ipcLog.push(`+${t0}ms call ${cmd}`)
  const p = tauriInvoke<T>(cmd, args)
  p.then(
    () => {
      rec.pending--
      ipcLog.push(`+${Math.round(performance.now())}ms ok   ${cmd} (${Math.round(performance.now()) - t0}ms)`)
    },
    () => {
      rec.pending--
      rec.errs++
      ipcLog.push(`+${Math.round(performance.now())}ms ERR  ${cmd}`)
    },
  )
  return p
}
import { open as openDialog, save as saveDialog, ask } from '@tauri-apps/plugin-dialog'
import { getCurrentWindow } from '@tauri-apps/api/window'
import {
  buildBlocks,
  harvestVars,
  layoutStack,
  findDropTarget,
  hitTestHeader,
  flatten,
  COLORS,
  BORDER,
  PAD,
  ROW_H,
  INDENT,
  measure,
  partWidth,
  type BBlock,
  type BlockPart,
  type CNodeJSON,
  type CTreeJSON,
} from './blocks'
import { History } from './history'
import { spliceInsert, spliceMove, applyEdit, insertTopLevel } from './ops'
import { pickAnchor, caretOffset, type CaretAnchor } from './caret'
import {
  PALETTE_GROUPS,
  VARIABLES_COLOR,
  validateSlotValue,
  validateVarName,
  type SourceLang,
  reporterFits,
  varChips,
  varTypes,
  listChips,
  type PaletteItem,
} from './palette'
import {
  nextMastery,
  masteryDue,
  masteryNextIn,
  previousLevel,
  type MasteryState,
} from './academy-extras'
import './style.css'

interface DragPayload {
  label: string
  snippet?: string
  cat?: string
  move?: { start: number; end: number }
  /** reporter expression: dropped INTO a socket, not onto the canvas */
  slotValue?: string
  /** which socket shape the reporter fits (Scratch round vs hex) */
  slotKind?: 'round' | 'bool'
  /** always splices at file scope (function definitions) */
  toplevel?: boolean
  /** splice at the very top of the file (#include chips) */
  insertTop?: boolean
}

const SAMPLE = `#include <stdio.h>

int main(void) {
    printf("hello\\n");
    int total = 0;
    for (int i = 0; i < 5; i++) {
        total = total + i;
    }
    return 0;
}
`

const NEW_TEMPLATE = `#include <stdio.h>

int main(void) {
    printf("hi\\n");
    return 0;
}
`

/** C++ mirror of SAMPLE — same statement shape (total/for/return) so the
 *  scripted gate assertions hold for either launch language. */
const CPP_SAMPLE = `#include <iostream>

int main() {
    std::cout << "hello\\n";
    int total = 0;
    for (int i = 0; i < 5; i++) {
        total = total + i;
    }
    std::cout << total << "\\n";
    return 0;
}
`

const CPP_TEMPLATE = `#include <iostream>

int main() {
    std::cout << "hi\\n";
    return 0;
}
`

const srcEl = document.getElementById('src') as HTMLTextAreaElement
const statusEl = document.getElementById('status') as HTMLSpanElement
const hostEl = document.getElementById('canvas-host') as HTMLDivElement
const consoleEl = document.getElementById('console') as HTMLPreElement
const consoleInputRow = document.getElementById('console-input-row') as HTMLDivElement
const consoleInput = document.getElementById('console-input') as HTMLInputElement
const paletteEl = document.getElementById('palette') as HTMLDivElement
const tabsEl = document.getElementById('tabs') as HTMLDivElement
const filesEl = document.getElementById('files') as HTMLDivElement

const app = new Application()
await app.init({ resizeTo: hostEl, background: '#dff3fa', antialias: true })
hostEl.appendChild(app.canvas)
const world = new Container()
app.stage.addChild(world)
const overlay = new Container()
app.stage.addChild(overlay)
const snapLayer = new Container()

interface Diag {
  line: number
  col: number
  severity: string
  message: string
  offset: number
  node_id: number
  node_kind: string
}

const dropbar = document.createElement('div')
dropbar.id = 'dropbar'
document.body.appendChild(dropbar)
const ghost = document.createElement('div')
ghost.id = 'ghost'
ghost.style.display = 'none'
document.body.appendChild(ghost)

// ------------------------------------------------------------- tiny sounds
// Synthesized Web Audio blips - no assets, offline-first. The context is
// created lazily on the first user gesture (autoplay policy).
let actx: AudioContext | null = null
function blip(freq: number, dur = 0.06, type: OscillatorType = 'sine', gain = 0.07): void {
  try {
    actx ??= new AudioContext()
    if (actx.state === 'suspended') void actx.resume()
    const o = actx.createOscillator()
    const g = actx.createGain()
    o.type = type
    o.frequency.value = freq
    g.gain.setValueAtTime(gain, actx.currentTime)
    g.gain.exponentialRampToValueAtTime(0.0001, actx.currentTime + dur)
    o.connect(g)
    g.connect(actx.destination)
    o.start()
    o.stop(actx.currentTime + dur)
  } catch {
    /* audio is best-effort */
  }
}

let workspace: string | null = null
/** Buffer content as last LOADED or explicitly SAVED — the dirty baseline
 *  for title dots, discard guards, and the close-time checkpoint. */
let savedSnapshot = ''
let activePath: string | null = null
const savedCache = new Map<string, string>()
const fileCache = new Map<string, string>()
let files: string[] = []

// Multi-language packs (D11): language rides with the FILE
type Lang = SourceLang
function langOf(path: string | null): Lang {
  const ext = (path ?? '').toLowerCase().split('.').pop() ?? ''
  if (['cpp', 'cc', 'cxx', 'hpp', 'hh'].includes(ext)) return 'cpp'
  if (ext === 'py' || ext === 'pyw') return 'python'
  if (['js', 'mjs', 'cjs'].includes(ext)) return 'javascript'
  if (ext === 'rs') return 'rust'
  return 'c'
}
let activeLang: Lang = 'c'

const SAMPLES: Record<Lang, string> = {
  c: SAMPLE,
  cpp: CPP_SAMPLE,
  python: `print("hello")

total = 0
for i in range(5):
    total = total + i

print(total)
`,
  javascript: `let total = 0;

for (let i = 0; i < 5; i++) {
    total = total + i;
}

console.log("hello");
console.log(total);
`,
  rust: `fn main() {
    let mut total = 0;

    for i in 0..5 {
        total = total + i;
    }

    println!("hello");
    println!("{}", total);
}
`,
}

const NEW_TEMPLATES: Record<Lang, string> = {
  c: NEW_TEMPLATE,
  cpp: CPP_TEMPLATE,
  python: `def main():
    print("hi")


main()
`,
  javascript: `function main() {
    console.log("hi");
}

main();
`,
  rust: `fn main() {
    println!("hi");
}
`,
}

let src = SAMPLE
let roots: BBlock[] = []
const hist = new History()

/** Editable slot hit-boxes in world coords, rebuilt on every render. */
interface SlotHit {
  block: BBlock
  part: BlockPart
  x: number
  y: number
  w: number
  h: number
}
let slotHits: SlotHit[] = []

function markDirty(): void {
  const dirty = activePath !== null && savedCache.get(activePath) !== src
  for (const t of Array.from(tabsEl.children) as HTMLElement[]) {
    if (t.dataset.path === activePath) t.classList.toggle('dirty', dirty)
    t.classList.toggle('active', t.dataset.path === activePath)
  }
  updateTitle()
}

// Context-aware instructions (Blockly's proven rule: a popup only closes
// when the learner actually PERFORMS the action). The tour registers an
// advance hook; real user actions fire events — never timers.
const tourHooks: { advance?: (ev: 'edit' | 'run' | 'check') => void } = {}

function setSrc(next: string, kind: 'op' | 'type' = 'op'): Promise<void> {
  hist.push(src, kind)
  src = next
  srcEl.value = next
  const p = render(next)
  markDirty()
  return p
}

// Latest-wins rendering (IMPROVEMENT-PLAN #1): edits that land while a parse
// is in flight bump the generation; the stale render aborts instead of
// painting an older program than the textarea shows, and the finally-clause
// re-renders the newest buffer so nothing is ever silently skipped.
let renderGen = 0

async function render(source: string): Promise<void> {
  const gen = ++renderGen
  try {
    const out = await invoke<{ tree: CTreeJSON; has_errors: boolean }>('parse_c', {
      src: source,
      lang: activeLang,
    })
    if (gen !== renderGen) return // superseded — a newer parse owns the canvas
    roots = buildBlocks(out.tree)
    layoutStack(roots, 40, 40)
    // palette reflects the program: harvested vars + node kinds/includes
    // (dependency-gated chips re-evaluate when the signature changes)
    const kinds = new Set<string>()
    const includes = new Set<string>()
    const walkSig = (n: { kind: string; children: unknown[]; text: string | null; pre: string }): string => {
      kinds.add(n.kind)
      let acc = n.pre + (n.text ?? '')
      for (const c of n.children as never[]) walkSig(c as never)
      return acc
    }
    const walkInc = (n: CNodeJSON): void => {
      if (n.kind === 'preproc_include') {
        includes.add(
          n.children
            .map((c) => c.text ?? '')
            .join('')
            .trim(),
        )
      }
      for (const c of n.children) walkInc(c)
    }
    walkInc(out.tree.root)
    const sig = `${[...kinds].sort().join(',')}|${[...includes].sort().join(',')}`
    const nextHarvest = harvestVars(out.tree.root)
    const nextSig = `${sig}|${nextHarvest.join('\u0000')}`
    if (nextSig !== paletteSignature) {
      paletteSignature = nextSig
      programKinds = kinds
      programIncludes = includes
      harvestedVars = nextHarvest
      renderPalette()
    }
    world.removeChildren()
    slotHits = []
    for (const b of roots) drawBlock(b)
    world.addChild(overlay)
    world.addChild(snapLayer)
    statusEl.textContent = out.has_errors
      ? `parsed with errors (${activeLang.toUpperCase()})`
      : `parsed clean (${activeLang.toUpperCase()})`
    statusEl.className = out.has_errors ? 'warn' : 'ok'
  } catch (e) {
    if (gen !== renderGen) return
    statusEl.textContent = String(e)
    statusEl.className = 'warn'
  } finally {
    if (gen === renderGen) {
      const newest = srcEl.value
      if (newest !== source && newest === src) void render(newest)
    }
  }
}

async function canonicalize(): Promise<void> {
  try {
    const clean = await invoke<string>('canonicalize_c', { src, lang: activeLang })
    if (clean !== src) {
      // Formatting rewrites the buffer UNDER the user — map the caret onto
      // the freshly parsed tree WITHOUT stealing focus from wherever they went.
      const anchor = pickAnchor(roots, srcEl.selectionStart ?? 0)
      await setSrc(clean)
      requestAnimationFrame(() => {
        try {
          const pos = Math.max(0, Math.min(src.length, caretOffset(roots, src.length, anchor)))
          srcEl.setSelectionRange(pos, pos)
        } catch {
          /* anchor no longer resolvable — leave caret */
        }
      })
    }
  } catch {
    /* keep as-is */
  }
  void refreshDiags()
}

function drawDiagOverlay(ds: Diag[]): void {
  overlay.removeChildren()
  if (ds.length === 0 || roots.length === 0) return
  const all = flatten(roots)
  const g = new Graphics()
  for (const d of ds) {
    const candidates = all.filter(
      (b) =>
        (b.start <= d.offset && d.offset < b.end) ||
        (b.start === d.offset && b.end === d.offset),
    )
    if (candidates.length === 0) continue
    const smallest = candidates.reduce((a, b) => (a.w * a.h <= b.w * b.h ? a : b))
    g.roundRect(
      smallest.x - 2,
      smallest.y - 2,
      smallest.w + 4,
      Math.min(ROW_H, smallest.h) + 4,
      8,
    )
    g.stroke({ width: 2.5, color: d.severity.includes('error') ? 0xe5484d : 0xffc93c })
  }
  overlay.addChild(g)
}

async function refreshDiags(): Promise<void> {
  try {
    const ds = await invoke<Diag[]>('diag_c', { src, lang: activeLang })
    drawDiagOverlay(ds)
    if (ds.length > 0) {
      consoleEl.textContent =
        ds.map((d) => `[${d.severity}] line ${d.line}:${d.col} — ${d.message}`).join('\n') + '\n'
    }
  } catch {
    /* diagnostics are best-effort */
  }
}

function mixWhite(c: number, f: number): number {
  const r = (c >> 16) & 255
  const g = (c >> 8) & 255
  const b = c & 255
  const m = (v: number) => Math.round(v + (255 - v) * f)
  return (m(r) << 16) | (m(g) << 8) | m(b)
}

// Scratch puzzle geometry: a mouth recess on the top edge receives the tab
// protruding from the bottom of the block above.
const NX = 10 // mouth/tab x offset
const TW = 18 // tab width
const TD = 4.5 // tab depth
const BR = 8 // corner radius

function statementPath(g: Graphics, ox: number, oy: number, w: number, h: number): void {
  g.moveTo(ox, oy + BR)
  g.quadraticCurveTo(ox, oy, ox + BR, oy)
  g.lineTo(ox + NX, oy)
  g.lineTo(ox + NX + 3, oy + TD)
  g.lineTo(ox + NX + TW - 3, oy + TD)
  g.lineTo(ox + NX + TW, oy)
  g.lineTo(ox + w - BR, oy)
  g.quadraticCurveTo(ox + w, oy, ox + w, oy + BR)
  g.lineTo(ox + w, oy + h - BR)
  g.quadraticCurveTo(ox + w, oy + h, ox + w - BR, oy + h)
  g.lineTo(ox + NX + TW, oy + h)
  g.lineTo(ox + NX + TW - 3, oy + h + TD)
  g.lineTo(ox + NX + 3, oy + h + TD)
  g.lineTo(ox + NX, oy + h)
  g.lineTo(ox + BR, oy + h)
  g.quadraticCurveTo(ox, oy + h, ox, oy + h - BR)
  g.closePath()
}

function cHeaderPath(g: Graphics, ox: number, oy: number, w: number, h: number): void {
  g.moveTo(ox, oy + BR)
  g.quadraticCurveTo(ox, oy, ox + BR, oy)
  g.lineTo(ox + NX, oy)
  g.lineTo(ox + NX + 3, oy + TD)
  g.lineTo(ox + NX + TW - 3, oy + TD)
  g.lineTo(ox + NX + TW, oy)
  g.lineTo(ox + w - BR, oy)
  g.quadraticCurveTo(ox + w, oy, ox + w, oy + BR)
  g.lineTo(ox + w, oy + h)
  g.lineTo(ox, oy + h)
  g.closePath()
}

function cBodyPath(g: Graphics, ox: number, oy: number, w: number, top: number, h: number, close: boolean): void {
  const y0 = oy + top
  const y1 = oy + h
  g.moveTo(ox + w, y0)
  g.lineTo(ox + w, y1 - BR)
  g.quadraticCurveTo(ox + w, y1, ox + w - BR, y1)
  g.lineTo(ox + NX + TW, y1)
  g.lineTo(ox + NX + TW - 3, y1 + TD)
  g.lineTo(ox + NX + 3, y1 + TD)
  g.lineTo(ox + NX, y1)
  g.lineTo(ox + BR, y1)
  g.quadraticCurveTo(ox, y1, ox, y1 - BR)
  g.lineTo(ox, y0)
  if (close) g.closePath()
}

function drawBlock(b: BBlock): void {
  const g = new Graphics()
  const fill = COLORS[b.cat] ?? COLORS.statement
  const edge = BORDER[b.cat] ?? BORDER.statement
  if (b.sticky) {    g.roundRect(b.x, b.y, b.w, b.h, 8)
    g.fill({ color: fill })
    g.roundRect(b.x, b.y, b.w, b.h, 8)
    g.stroke({ width: 3, color: edge })
    const t = new Text({
      text: b.label,
      style: {
        fontFamily: "'Baloo 2', 'Segoe UI', sans-serif",
        fontSize: 13,
        fontWeight: '600',
        fill: '#6b4d00',
      },
    })
    t.x = b.x + PAD
    t.y = b.y + (ROW_H - t.height) / 2
    t.eventMode = 'static'
    attachHeaderEvents(t, b)
    world.addChild(g, t)
    return
  }
  // clay drop shadow (silhouette approximation, offset down-right)
  g.roundRect(b.x + 2, b.y + 4, b.w, b.h + TD, b.container ? 12 : 9)
  g.fill({ color: 0x0c3543, alpha: 0.18 })

  if (b.container) {
    // Scratch C-block: mouth header + light body + tabbed floor
    g.roundRect(b.x + 2, b.y + 4, b.w, b.h + TD, 12)
    g.fill({ color: 0x0c3543, alpha: 0.18 })
    cBodyPath(g, b.x, b.y, b.w, ROW_H, b.h, true)
    g.fill({ color: mixWhite(fill, 0.62) })
    cHeaderPath(g, b.x, b.y, b.w, ROW_H)
    g.fill({ color: fill })
    g.roundRect(b.x + 3, b.y + 3, Math.max(0, b.w - 6), 3, 2)
    g.fill({ color: 0xffffff, alpha: 0.4 })
    cHeaderPath(g, b.x, b.y, b.w, ROW_H)
    g.stroke({ width: 3, color: edge })
    cBodyPath(g, b.x, b.y, b.w, ROW_H, b.h, false)
    g.stroke({ width: 3, color: edge })
  } else {
    g.roundRect(b.x + 2, b.y + 4, b.w, b.h + TD, 9)
    g.fill({ color: 0x0c3543, alpha: 0.18 })
    statementPath(g, b.x, b.y, b.w, b.h)
    g.fill({ color: fill })
    g.roundRect(b.x + 3, b.y + 3, Math.max(0, b.w - 6), 3, 2)
    g.fill({ color: 0xffffff, alpha: 0.35 })
    statementPath(g, b.x, b.y, b.w, b.h)
    g.stroke({ width: 3, color: edge })
  }
  // header content: literal text chunks + typed input slots (Scratch fields)
  const whiteLabel = {
    fontFamily: "'Baloo 2', 'Segoe UI', sans-serif",
    fontSize: 13,
    fontWeight: '600',
    fill: '#ffffff',
  } as const
  const darkLabel = {
    fontFamily: "'Baloo 2', 'Segoe UI', sans-serif",
    fontSize: 13,
    fontWeight: '600',
    fill: '#0c3543',
  } as const
  const header: (Text | Graphics)[] = []
  if (b.parts.length === 0) {
    const t = new Text({ text: b.label || b.nodeKind, style: whiteLabel })
    t.x = b.x + PAD
    t.y = b.y + (ROW_H - t.height) / 2
    header.push(t)
  } else {
    let cx = b.x + PAD + 5 // clear the category notch
    for (const p of b.parts) {
      const w = partWidth(p)
      if (p.type === 'text') {
        const t = new Text({ text: p.text, style: whiteLabel })
        t.x = cx
        t.y = b.y + (ROW_H - t.height) / 2
        header.push(t)
      } else if (p.type === 'bool') {
        // Scratch boolean socket: hexagonal, pointed ends
        const w = partWidth(p)
        const y0 = b.y + 6
        const h = ROW_H - 12
        const pt = 9
        const box = new Graphics()
        box.moveTo(cx + pt, y0)
        box.lineTo(cx + w - pt, y0)
        box.lineTo(cx + w, y0 + h / 2)
        box.lineTo(cx + w - pt, y0 + h)
        box.lineTo(cx + pt, y0 + h)
        box.lineTo(cx, y0 + h / 2)
        box.closePath()
        box.fill({ color: 0xf6fbff })
        box.moveTo(cx + pt, y0)
        box.lineTo(cx + w - pt, y0)
        box.lineTo(cx + w, y0 + h / 2)
        box.lineTo(cx + w - pt, y0 + h)
        box.lineTo(cx + pt, y0 + h)
        box.lineTo(cx, y0 + h / 2)
        box.closePath()
        box.stroke({ width: 2, color: edge, alpha: 0.5 })
        const t = new Text({ text: p.text, style: darkLabel })
        t.x = cx + (w - t.width) / 2
        t.y = b.y + (ROW_H - t.height) / 2
        header.push(box, t)
        slotHits.push({ block: b, part: p, x: cx, y: y0, w, h })
      } else {
        const box = new Graphics()
        box.roundRect(cx, b.y + 6, w, ROW_H - 12, 7)
        box.fill({ color: 0xf6fbff })
        box.roundRect(cx, b.y + 6, w, ROW_H - 12, 7)
        box.stroke({ width: 2, color: edge, alpha: 0.5 })
        const t = new Text({ text: p.text, style: darkLabel })
        t.x = cx + (w - t.width) / 2
        t.y = b.y + (ROW_H - t.height) / 2
        header.push(box, t)
        slotHits.push({ block: b, part: p, x: cx, y: b.y + 6, w, h: ROW_H - 12 })
      }
      cx += w + 7
    }
  }

  // category notch sits on the header row
  g.roundRect(b.x + 5, b.y + 5, 5, Math.min(ROW_H - 10, b.h - 10), 2)
  g.fill({ color: 0x000000, alpha: 0.22 })
  world.addChild(g, ...header)
  g.eventMode = 'static'
  attachHeaderEvents(g, b)
  for (const c of b.children) drawBlock(c)
}

function screenToWorld(ox: number, oy: number): { x: number; y: number } {
  return { x: (ox - world.x) / world.scale.x, y: (oy - world.y) / world.scale.y }
}

let drag: DragPayload | null = null

function startHtmlDrag(e: PointerEvent, payload: DragPayload): void {
  drag = payload
  ghost.textContent = payload.label
  ghost.style.display = 'block'
  ghost.style.left = `${e.clientX + 12}px`
  ghost.style.top = `${e.clientY - 14}px`
  blip(520, 0.05, 'triangle', 0.05)
  window.addEventListener('pointermove', onDragMove)
  window.addEventListener('pointerup', onDragEnd, { once: true })
}

function catColor(cat: string | undefined, fallback = COLORS.statement): number {
  switch (cat) {
    case 'control':
    case 'loops':
      return COLORS.control
    case 'variables':
      return COLORS.variables
    case 'functions':
      return COLORS.function
    case 'structs':
      return 0xec4899
    case 'comment':
      return COLORS.comment
    default:
      return fallback
  }
}

function clearSnapGhost(): void {
  snapLayer.removeChildren()
}

function drawSnapGhost(
  gx: number,
  gy: number,
  w: number,
  h: number,
  cat: string | undefined,
  label: string,
): void {
  const fill = catColor(cat)
  const g = new Graphics()
  g.roundRect(gx, gy, w, Math.max(ROW_H, h), 9)
  g.fill({ color: fill, alpha: 0.3 })
  g.roundRect(gx, gy, w, Math.max(ROW_H, h), 9)
  g.stroke({ width: 2, color: fill, alpha: 0.65 })
  const t = new Text({
    text: label,
    style: {
      fontFamily: "'Baloo 2', 'Segoe UI', sans-serif",
      fontSize: 13,
      fontWeight: '600',
      fill: '#ffffff',
    },
  })
  t.alpha = 0.55
  t.x = gx + PAD
  t.y = gy + (ROW_H - t.height) / 2
  snapLayer.addChild(g, t)
}

function slotUnderWorldPoint(wx: number, wy: number): SlotHit | null {
  for (const s of slotHits) {
    if (wx >= s.x && wx <= s.x + s.w && wy >= s.y && wy <= s.y + s.h) return s
  }
  return null
}

/** Nearest compatible socket on the block under the point — forgiving drop
 *  target: kids drop a variable ON the block, not pixel-perfect on a socket. */
function nearestCompatibleSlot(
  wx: number,
  wy: number,
  kind: 'round' | 'bool' | undefined,
): SlotHit | null {
  const blk = hitTestHeader(roots, wx, wy) ?? null
  if (!blk) return null
  let best: SlotHit | null = null
  let bestD = Infinity
  for (const s of slotHits) {
    if (s.block.id !== blk.id || !reporterFits(kind, s.part.type)) continue
    const d = (s.x + s.w / 2 - wx) ** 2 + (s.y + s.h / 2 - wy) ** 2
    if (d < bestD) {
      bestD = d
      best = s
    }
  }
  return best
}

function onDragMove(e: PointerEvent): void {
  ghost.style.left = `${e.clientX + 12}px`
  ghost.style.top = `${e.clientY - 14}px`
  const r = hostEl.getBoundingClientRect()
  const inside =
    e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom
  if (inside && drag) {
    const w = screenToWorld(e.clientX - r.left, e.clientY - r.top)

    // reporter chips: highlight the matching-shape socket they would fill
    // (Scratch: round reporters fit round sockets, hex fits hex)
    if (drag.slotValue) {
      const s = slotUnderWorldPoint(w.x, w.y) ?? nearestCompatibleSlot(w.x, w.y, drag.slotKind)
      clearSnapGhost()
      dropbar.style.display = 'none'
      if (s && reporterFits(drag.slotKind, s.part.type)) {
        const g = new Graphics()
        const hex = s.part.type === 'bool'
        const hl = (x: number, y: number, ww: number, hh: number): void => {
          if (!hex) {
            g.roundRect(x, y, ww, hh, 9)
            return
          }
          const pt = 9
          g.moveTo(x + pt, y)
          g.lineTo(x + ww - pt, y)
          g.lineTo(x + ww, y + hh / 2)
          g.lineTo(x + ww - pt, y + hh)
          g.lineTo(x + pt, y + hh)
          g.lineTo(x, y + hh / 2)
          g.closePath()
        }
        g.moveTo(0, 0) // no-op keeps Graphics sane before first path
        hl(s.x - 3, s.y - 3, s.w + 6, s.h + 6)
        g.fill({ color: 0xff8c1a, alpha: 0.25 })
        hl(s.x - 3, s.y - 3, s.w + 6, s.h + 6)
        g.stroke({ width: 3, color: 0xff8c1a })
        snapLayer.addChild(g)
        ghost.style.opacity = '1'
        return
      }
      ghost.style.opacity = '0.5'
      return
    }

    const target = findDropTarget(roots, w.x, w.y)
    if (target && !(drag.move && isInsideRange(target.container, drag.move))) {
      const kids = target.container.children
      const y =
        target.index < kids.length
          ? kids[target.index].y
          : kids.length > 0
            ? kids[kids.length - 1].y + kids[kids.length - 1].h + TD
            : target.container.y + ROW_H
      const rr = hostEl.getBoundingClientRect()
      dropbar.style.display = 'block'
      dropbar.style.left = `${rr.left + (target.container.x + 4) * world.scale.x + world.x}px`
      dropbar.style.top = `${rr.top + (y - 3) * world.scale.y + world.y}px`
      dropbar.style.width = `${Math.max(0, (target.container.w - 8) * world.scale.x)}px`

      // translucent snap preview at the exact insertion slot
      clearSnapGhost()
      const d = drag
      let bw: number
      let bh: number
      let cat: string | undefined
      if (d.move) {
        const src = flatten(roots).find(
          (b) => b.start === d.move!.start && b.end === d.move!.end,
        )
        bw = src?.w ?? 120
        bh = src?.h ?? ROW_H
        cat = src?.cat
      } else {
        bw = Math.max(90, measure(d.label))
        bh = ROW_H
        cat = d.cat
      }
      drawSnapGhost(
        target.container.x + INDENT,
        y,
        bw,
        bh,
        cat ?? (drag.move ? undefined : 'statement'),
        drag.label,
      )
      return
    }
  }
  dropbar.style.display = 'none'
  clearSnapGhost()
}

function isInsideRange(inner: BBlock, outer: { start: number; end: number }): boolean {
  return inner.start >= outer.start && inner.end <= outer.end
}

async function onDragEnd(e: PointerEvent): Promise<void> {
  window.removeEventListener('pointermove', onDragMove)
  ghost.style.display = 'none'
  ghost.style.opacity = '1'
  dropbar.style.display = 'none'
  clearSnapGhost()
  const d = drag
  drag = null
  if (!d) return
  const r = hostEl.getBoundingClientRect()
  const inside =
    e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom
  if (!inside) return
  const w = screenToWorld(e.clientX - r.left, e.clientY - r.top)

  // reporter chips -> shape-checked socket fill
  if (d.slotValue) {
    const s = slotUnderWorldPoint(w.x, w.y) ?? nearestCompatibleSlot(w.x, w.y, d.slotKind)
    if (!s) return
    if (!reporterFits(d.slotKind, s.part.type)) {
      blip(200, 0.08, 'square', 0.04)
      consoleEl.textContent = `that block fits a ${
        d.slotKind === 'bool' ? 'hex condition' : 'round'
      } socket — wrong shape here`
      return
    }
    const err = commitSlotValue(s, d.slotValue)
    if (err !== null) {
      blip(200, 0.08, 'square', 0.04)
      consoleEl.textContent = err
    }
    return
  }

  // function definitions splice at FILE SCOPE (never nested in C)
  if (d.toplevel) {
    setSrc(insertTopLevel(src, roots, d.snippet ?? ''))
    void canonicalize()
    tourHooks.advance?.('edit')
    blip(740, 0.07, 'sine', 0.08)
    return
  }

  // includes splice at the VERY TOP of the file
  if (d.insertTop) {
    setSrc(`${d.snippet ?? ''}\n${src}`)
    void canonicalize()
    tourHooks.advance?.('edit')
    blip(740, 0.07, 'sine', 0.08)
    return
  }

  const target = findDropTarget(roots, w.x, w.y)
  if (!target) return
  if (d.move && isInsideRange(target.container, d.move)) return

  const text = src
  let next: string | null
  if (d.move) {
    next = spliceMove(text, d.move, target.offset)
  } else {
    next = spliceInsert(text, target.offset, d.snippet ?? '')
  }
  if (next === null) return
  blip(740, 0.07, 'sine', 0.08)
  setTimeout(() => blip(980, 0.05, 'sine', 0.05), 60)
  setSrc(next)
  void canonicalize()
  tourHooks.advance?.('edit')
}

function attachHeaderEvents(
  obj: { on: (ev: string, fn: (e: unknown) => void) => void },
  b: BBlock,
): void {
  obj.on('pointerdown', (e) => {
    const pe = e as {
      global: { x: number; y: number }
      button?: number
      stopPropagation?: () => void
    }
    if (pe.button !== undefined && pe.button !== 0) return // right-click opens menu
    pe.stopPropagation?.()
    const r = hostEl.getBoundingClientRect()
    startHtmlDrag(
      { clientX: r.left + pe.global.x, clientY: r.top + pe.global.y } as PointerEvent,
      { label: b.label || b.nodeKind, cat: b.cat, move: { start: b.start, end: b.end } },
    )
  })
}

// ----------------------------------------------------- inline slot editor
// Scratch-style: click a typed field inside a block, type a replacement,
// Enter/blur commits through the same text-splice seam as every other edit.
// Socket rules live in palette.ts (reporters fit any round socket).
function commitSlotValue(s: SlotHit, raw: string): string | null {
  const final = validateSlotValue(s.part.type, raw)
  if (final === null) {
    return `${s.part.type} slot rejects ${JSON.stringify(raw)}`
  }
  if (final === s.part.text) return null
  setSrc(src.slice(0, s.part.start) + final + src.slice(s.part.end))
  void canonicalize()
  tourHooks.advance?.('edit')
  blip(660, 0.05, 'sine', 0.06)
  return null
}

const slotEditor = document.createElement('input')
slotEditor.id = 'slot-editor'
slotEditor.style.display = 'none'
document.body.appendChild(slotEditor)
let editingSlot: SlotHit | null = null

function closeSlotEditor(commit: boolean): void {
  const s = editingSlot
  editingSlot = null
  slotEditor.style.display = 'none'
  slotEditor.classList.remove('bad')
  if (s && commit) {
    const err = commitSlotValue(s, slotEditor.value)
    if (err !== null && s.part.type !== 'string') {
      // reopen on invalid input so the user can fix it (strings self-quote)
      openSlotEditor(s)
      slotEditor.classList.add('bad')
      blip(200, 0.08, 'square', 0.04)
    }
  }
}

function openSlotEditor(s: SlotHit): void {
  editingSlot = s
  const r = hostEl.getBoundingClientRect()
  const scale = world.scale.x
  slotEditor.value =
    s.part.type === 'string' ? s.part.text.replace(/^"(.*)"$/s, '$1') : s.part.text
  slotEditor.style.display = 'block'
  slotEditor.style.left = `${r.left + s.x * scale + world.x - 4}px`
  slotEditor.style.top = `${r.top + s.y * scale + world.y}px`
  slotEditor.style.width = `${Math.max(60, s.w * scale + 8)}px`
  slotEditor.focus()
  slotEditor.select()
}

slotEditor.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault()
    closeSlotEditor(true)
  } else if (e.key === 'Escape') {
    e.preventDefault()
    closeSlotEditor(false)
  }
})
slotEditor.addEventListener('blur', () => {
  if (editingSlot) closeSlotEditor(true)
})

function slotAt(b: BBlock, wx: number, wy: number): SlotHit | null {
  for (const s of slotHits) {
    if (
      s.block.id === b.id &&
      wx >= s.x &&
      wx <= s.x + s.w &&
      wy >= s.y &&
      wy <= s.y + s.h
    ) {
      return s
    }
  }
  return null
}

hostEl.addEventListener('dblclick', (e) => {
  const me = e as MouseEvent
  const w = screenToWorld(me.offsetX, me.offsetY)
  const hit = hitTestHeader(roots, w.x, w.y)
  if (!hit || hit.sticky) return
  anchorToBlock(hit)
  const s = hit.cat === 'error' ? null : slotAt(hit, w.x, w.y)
  if (s) {
    openSlotEditor(s)
    return
  }
  const replacement = window.prompt('Edit statement:', hit.label)
  if (replacement === null) return
  setSrc(applyEdit(hit, replacement)(src))
  void canonicalize()
})

document.getElementById('run')?.addEventListener('click', () => {
  void startRun()
})

// ------------------------------------------------------- stage panel + run
const stageCanvas = document.getElementById('stage') as HTMLCanvasElement
const stageCtx = stageCanvas.getContext('2d') as CanvasRenderingContext2D
const stopBtn = document.getElementById('stage-stop') as HTMLButtonElement
const fpsEl = document.getElementById('stage-fps') as HTMLSpanElement

let running = false
let lastFrame = 0
let pollTimer = 0
let fpsFrames = 0
let fpsT0 = 0
const u32max = 4294967295
const downKeys = new Set<number>()

interface StageFrameOut {
  frame: number
  w: number
  h: number
  b64: string
}

function keyToCode(e: KeyboardEvent): number | null {
  switch (e.key) {
    case 'ArrowLeft':
      return 1
    case 'ArrowUp':
      return 2
    case 'ArrowRight':
      return 3
    case 'ArrowDown':
      return 4
  }
  if (e.key.length === 1) {
    const c = e.key.toUpperCase().charCodeAt(0)
    if (c >= 32 && c <= 126) return c
  }
  return null
}

window.addEventListener('keydown', (e) => {
  if (!running) return
  const code = keyToCode(e)
  if (code !== null) {
    e.preventDefault()
    void invoke('stage_keys', { down: Array.from(downKeys.add(code)) })
  }
})
window.addEventListener('keyup', (e) => {
  if (!running) return
  const code = keyToCode(e)
  if (code !== null) {
    e.preventDefault()
    downKeys.delete(code)
    void invoke('stage_keys', { down: Array.from(downKeys) })
  }
})

async function paintStage(): Promise<void> {
  try {
    const f = await invoke<StageFrameOut | null>('stage_frame', { last: lastFrame })
    if (f) {
      lastFrame = f.frame
      const bin = atob(f.b64)
      const bytes = new Uint8ClampedArray(bin.length)
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
      const img = new ImageData(bytes, f.w, f.h)
      const off = new OffscreenCanvas(f.w, f.h)
      off.getContext('2d')?.putImageData(img, 0, 0)
      stageCtx.imageSmoothingEnabled = false
      stageCtx.drawImage(off, 0, 0, stageCanvas.width, stageCanvas.height)
      fpsFrames++
      const now = performance.now()
      if (now - fpsT0 > 500) {
        fpsEl.textContent = `${Math.round((fpsFrames * 1000) / (now - fpsT0))} fps`
        fpsFrames = 0
        fpsT0 = now
      }
    }
  } catch {
    /* child not up yet */
  }
}

function finishRun(r: {
  stdout: string
  stderr: string
  exit: number
  timed_out: boolean
}): void {
  let out = ''
  if (r.stdout) out += r.stdout
  if (r.stderr) out += (out ? '\n[stderr] ' : '[stderr] ') + r.stderr
  out += `\n[exit ${r.exit}${r.timed_out ? ', timed out' : ''}]`
  consoleEl.textContent = out.trim() || '(no output)'
  // Off-ramp ladder (Blockly playbook — show the REAL code after every run):
  // blocks-only users get split view revealed the moment their program ends,
  // so the text they generated is always on screen.
  if (viewMode === 'blocks') {
    setView('split')
    statusEl.textContent = 'run finished — that output came from THIS code →'
  }
}

async function startRun(): Promise<void> {
  consoleEl.textContent = 'running…'
  tourHooks.advance?.('run')
  lastFrame = u32max
  downKeys.clear()
  running = true
  stopBtn.style.display = 'block'
  consoleInputRow.style.display = 'flex' // cin / scanf / input() need typing
  fpsT0 = performance.now()
  fpsFrames = 0
  const tracing = memTraceEl.checked
  lastMemState = { boxes: [], edges: [], live: false }
  memListEl.style.display = tracing ? 'block' : 'none'
  // Launch failures must be LOUD and RECOVERABLE — never an eternal spinner.
  try {
    await invoke('run_start', { src, traceMem: tracing, lang: activeLang })
    ;(window as unknown as { __runStarted?: boolean }).__runStarted = true
  } catch (e) {
    running = false
    stopBtn.style.display = 'none'
    consoleInputRow.style.display = 'none'
    consoleEl.textContent = `[launch] ${String(e)}`
    blip(200, 0.1, 'square', 0.05)
    return
  }
  if (tracing) {
    void invoke<boolean>('mem_attach').then((ok) => {
      if (ok) startMemPoll()
    })
  }
  // attach while the child boots, then pump frames until run_poll lands
  void invoke<[number, number] | null>('stage_attach')
  requestAnimationFrame(async function loop() {
    if (!running) return
    await paintStage()
    requestAnimationFrame(loop)
  })
  clearInterval(pollTimer)
  ;(window as unknown as { __polls?: number }).__polls = 0
  pollTimer = window.setInterval(() => {
    ;(window as unknown as { __polls?: number }).__polls =
      ((window as unknown as { __polls?: number }).__polls ?? 0) + 1
    void invoke<unknown>('run_poll')
      .then((r) => {
        if (r) {
          running = false
          clearInterval(pollTimer)
          stopBtn.style.display = 'none'
          consoleInputRow.style.display = 'none'
          fpsEl.textContent = ''
          finishRun(r as Parameters<typeof finishRun>[0])
          reportLeaks()
        }
      })
      .catch((e) => {
        running = false
        clearInterval(pollTimer)
        stopBtn.style.display = 'none'
        consoleInputRow.style.display = 'none'
        consoleEl.textContent = `[poll] ${String(e)}`
      })
  }, 120)
}

// ------------------------------------------------------- console stdin box
async function sendConsoleLine(): Promise<void> {
  const line = consoleInput.value
  if (line.length === 0) return
  consoleInput.value = ''
  consoleEl.textContent += `\n> ${line}`
  consoleEl.scrollTop = consoleEl.scrollHeight
  try {
    await invoke('run_stdin', { line })
  } catch (e) {
    consoleEl.textContent += `\n${String(e)}`
  }
}

consoleInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault()
    void sendConsoleLine()
  }
})
document.getElementById('console-send')?.addEventListener('click', () => {
  void sendConsoleLine()
})

// ------------------------------------------------------------- memory view
interface MemBox {
  addr: string
  size: number
  line: number
}
interface MemEdge {
  from: string
  offset: number
  to: string
}
interface MemState {
  boxes: MemBox[]
  edges: MemEdge[]
  live: boolean
}

const memTraceEl = document.getElementById('mem-trace') as HTMLInputElement
const memListEl = document.getElementById('mem-list') as HTMLDivElement
let lastMemState: MemState | null = null
let memTimer = 0

function renderMemView(): void {
  const s = lastMemState
  if (!s) return
  const svgNs = 'http://www.w3.org/2000/svg'
  const svgId = 'mem-arrows'
  let rows = ''
  for (const b of s.boxes.slice(0, 48)) {
    const w = Math.min(100, Math.max(8, Math.sqrt(b.size) * 2))
    rows += `<div class="heap-box" data-addr="${b.addr}" title="${b.addr} · ${b.size} B · line ${b.line}"><i style="width:${w}%"></i><span>line ${b.line} · ${b.size} B</span></div>`
  }
  if (s.boxes.length === 0) rows = '<span class="m-free">(heap empty)</span>'
  memListEl.innerHTML = `<svg id="${svgId}"></svg>` + rows

  const svg = document.getElementById(svgId) as unknown as SVGSVGElement
  const idx = new Map<string, number>()
  s.boxes.slice(0, 48).forEach((b, i) => idx.set(b.addr, i))
  const boxEls = memListEl.querySelectorAll('.heap-box')
  const W = Math.max(memListEl.clientWidth, 200)
  const H = memListEl.scrollHeight || 1
  svg.setAttribute('width', String(W))
  svg.setAttribute('height', String(H))
  svg.innerHTML =
    '<defs><marker id="arr" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="#f5e0dc"/></marker></defs>'
  for (const e of s.edges) {
    const fi = idx.get(e.from)
    const ti = idx.get(e.to)
    if (fi === undefined || ti === undefined) continue
    const fe = boxEls[fi] as HTMLElement | undefined
    const te = boxEls[ti] as HTMLElement | undefined
    if (!fe || !te) continue
    const y1 = fe.offsetTop + fe.offsetHeight / 2
    const y2 = te.offsetTop + te.offsetHeight / 2
    const x1 = W - 4
    const x2 = 4
    const mx = (x1 + x2) / 2
    const p = document.createElementNS(svgNs, 'path')
    p.setAttribute(
      'd',
      `M ${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}`,
    )
    p.setAttribute('fill', 'none')
    p.setAttribute('stroke', '#f5e0dc')
    p.setAttribute('stroke-width', '1.5')
    p.setAttribute('marker-end', 'url(#arr)')
    p.setAttribute('opacity', '0.85')
    svg.appendChild(p)
  }
}

function startMemPoll(): void {
  clearInterval(memTimer)
  memTimer = window.setInterval(() => {
    void invoke<MemState>('mem_state')
      .then((s) => {
        lastMemState = s
        renderMemView()
      })
      .catch(() => {})
  }, 150)
}

function reportLeaks(): void {
  clearInterval(memTimer)
  if (!memTraceEl.checked) return
  const boxes = lastMemState?.boxes ?? []
  let bytes = 0
  for (const b of boxes) bytes += b.size
  const head =
    boxes.length === 0
      ? '[memory] heap fully freed — no leaks ✓'
      : `[memory] ${boxes.length} live allocation(s), ${bytes} B not freed`
  consoleEl.textContent += `\n${head}`
  let i = 0
  for (const b of boxes) {
    if (i++ >= 8) {
      consoleEl.textContent += `\n[memory] … ${boxes.length - 8} more`
      break
    }
    consoleEl.textContent += `\n[memory]   leak: ${b.size} B from line ${b.line}`
  }
}

stopBtn.addEventListener('click', () => {
  void invoke('stage_stop')
})

// ------------------------------------------------------------ context menu
const ctxMenu = document.createElement('div')
ctxMenu.id = 'ctx-menu'
ctxMenu.style.display = 'none'
document.body.appendChild(ctxMenu)
let ctxBlock: BBlock | null = null

function hideCtxMenu(): void {
  ctxMenu.style.display = 'none'
  ctxBlock = null
}

hostEl.addEventListener('contextmenu', (e) => {
  const me = e as MouseEvent
  const w = screenToWorld(me.offsetX, me.offsetY)
  const hit = hitTestHeader(roots, w.x, w.y)
  if (!hit || hit.sticky) {
    hideCtxMenu()
    return
  }
  e.preventDefault()
  ctxBlock = hit
  anchorToBlock(hit)
  ctxMenu.innerHTML =
    '<div class="mi" data-act="dup">Duplicate</div><div class="mi danger" data-act="del">Delete</div>'
  ctxMenu.style.display = 'block'
  ctxMenu.style.left = `${Math.min(me.clientX, window.innerWidth - 170)}px`
  ctxMenu.style.top = `${Math.min(me.clientY, window.innerHeight - 90)}px`
  blip(420, 0.04, 'triangle', 0.04)
})

ctxMenu.addEventListener('click', async (e) => {
  const act = (e.target as HTMLElement).dataset?.act
  const b = ctxBlock
  hideCtxMenu()
  if (!act || !b) return
  if (act === 'dup') {
    const slice = src.slice(b.start, b.end)
    setSrc(src.slice(0, b.end) + '\n' + slice + src.slice(b.end))
    void canonicalize()
    blip(740, 0.07, 'sine', 0.08)
  } else if (act === 'del') {
    const lineStart = src.lastIndexOf('\n', b.start - 1) + 1
    let end = b.end
    if (src[end] === '\n') end++
    setSrc(src.slice(0, lineStart) + src.slice(end))
    void canonicalize()
    blip(170, 0.12, 'square', 0.06)
  }
})

window.addEventListener('pointerdown', (e) => {
  if (!ctxMenu.contains(e.target as Node)) hideCtxMenu()
})
window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') hideCtxMenu()
})


// ------------------------------------------------------------- workspace/tabs
// Documents are either workspace-RELATIVE (a folder is open) or ABSOLUTE
// (standalone file via New/Open/Save As). One path shape per doc; fsRead/
// fsWrite route on which shape the path is.
const isWinPath = (p: string): boolean => /^[A-Za-z]:[\\/]/.test(p) || p.startsWith('/')
const baseName = (p: string): string => p.split(/[\\/]/).pop() ?? p
const dirName = (p: string): string => {
  const parts = p.split(/[\\/]/)
  parts.pop()
  return parts.length > 0 ? parts.join('\\') : '.'
}
const normSlashes = (p: string): string => p.replace(/\\/g, '/')
const asRelInWorkspace = (abs: string): string | null => {
  if (workspace === null) return null
  const w = normSlashes(workspace).replace(/\/$/, '').toLowerCase() + '/'
  const n = normSlashes(abs)
  return n.toLowerCase().startsWith(w) ? n.slice(w.length) : null
}
async function fsRead(p: string): Promise<string> {
  return workspace !== null && !isWinPath(p)
    ? invoke<string>('read_file', { root: workspace, rel: p })
    : invoke<string>('read_abs', { path: p })
}
async function fsWrite(p: string, c: string): Promise<void> {
  if (workspace !== null && !isWinPath(p)) {
    await invoke('write_file', { root: workspace, rel: p, content: c })
  } else {
    await invoke('write_abs', { path: p, content: c })
  }
}

async function refreshFiles(): Promise<void> {
  if (!workspace) return
  files = await invoke<string[]>('list_c_files', { root: workspace })
  filesEl.innerHTML = ''
  for (const f of files) {
    const el = document.createElement('div')
    el.className = 'file'
    el.textContent = f
    el.addEventListener('click', () => void guardedOpenTab(f))
    filesEl.appendChild(el)
  }
}

function createTab(path: string, content: string): void {
  fileCache.set(path, content)
  savedCache.set(path, content)
  const tab = document.createElement('div')
  tab.className = 'tab'
  tab.dataset.path = path
  tab.textContent = baseName(path)
  tab.addEventListener('click', () => void guardedOpenTab(path))
  tabsEl.appendChild(tab)
  activateTab(path)
}

/** Unsaved-changes gate for every navigation that would REPLACE the single
 *  buffer (tab/file/recent/folder/new/open). Commercial rule: never lose
 *  work silently, never nag when clean. */
async function confirmDiscard(): Promise<boolean> {
  if (activePath === null || src === savedSnapshot || src.trim().length === 0) return true
  return await ask(`"${baseName(activePath)}" has unsaved changes.\n\nDiscard them?`, {
    title: 'Unsaved changes',
    kind: 'warning',
  })
}

async function guardedOpenTab(path: string): Promise<void> {
  if (!(await confirmDiscard())) return
  await openTab(path)
}

async function openTab(rel: string): Promise<void> {
  if (Array.from(tabsEl.children).some((t) => (t as HTMLElement).dataset.path === rel)) {
    activateTab(rel)
    return
  }
  const content = fileCache.get(rel) ?? (await fsRead(rel))
  createTab(rel, content)
  if (workspace !== null && !isWinPath(rel)) pushRecent(workspace, rel)
  else if (isWinPath(rel)) pushRecent(dirName(rel), baseName(rel))
}

function activateTab(rel: string): void {
  if (activePath === rel) return
  hist.reset()
  caretAnchor = null // different buffer — old node ids are meaningless here
  activePath = rel
  activeLang = langOf(rel)
  src = fileCache.get(rel) ?? ''
  savedSnapshot = src // fresh load = clean baseline
  srcEl.value = src
  void render(src)
  markDirty()
  setView(tabViews.get(rel) ?? 'split')
}

document.getElementById('open-folder')?.addEventListener('click', async () => {
  if (!(await confirmDiscard())) return
  const dir = await openDialog({ directory: true })
  if (typeof dir !== 'string') return
  workspace = dir
  tabsEl.innerHTML = ''
  fileCache.clear()
  savedCache.clear()
  activePath = null
  await refreshFiles()
  consoleEl.textContent = `workspace: ${dir}`
})

// Standalone documents: New File and Open File work with NO folder open —
// a native dialog picks the location (VS Code-style), the doc opens as its
// own tab, and recents remember it.
document.getElementById('open-file')?.addEventListener('click', async () => {
  if (!(await confirmDiscard())) return
  const picked = await openDialog({
    multiple: false,
    filters: [
      { name: 'Source files', extensions: ['c', 'cpp', 'cc', 'cxx', 'hpp', 'hh', 'py', 'js', 'mjs', 'rs'] },
      { name: 'All files', extensions: ['*'] },
    ],
  })
  if (typeof picked !== 'string' || !picked) return
  const rel = asRelInWorkspace(picked)
  await openTab(rel ?? normSlashes(picked))
})

document.getElementById('new-file')?.addEventListener('click', async () => {
  if (!(await confirmDiscard())) return
  const name = window.prompt('New file name:', 'main.c')
  if (!name) return
  const withExt = /\.[a-z]+$/i.test(name) ? name : `${name}.c`
  if (workspace !== null) {
    const content = NEW_TEMPLATES[langOf(withExt)]
    await invoke('write_file', { root: workspace, rel: withExt, content })
    await refreshFiles()
    await openTab(withExt)
  } else {
    const picked = await saveDialog({
      title: 'Save new file',
      defaultPath: withExt,
      filters: [{ name: 'Source files', extensions: ['c', 'cpp', 'cc', 'cxx', 'hh', 'py', 'js', 'mjs', 'rs'] }],
    })
    if (typeof picked !== 'string' || !picked) return
    const content = NEW_TEMPLATES[langOf(picked)]
    await invoke('write_abs', { path: picked, content })
    await openTab(normSlashes(picked))
  }
})

document.getElementById('save')?.addEventListener('click', () => void saveActive())

let statusFlashTimer = 0
function statusFlash(msg: string): void {
  statusEl.textContent = msg
  statusEl.className = 'ok'
  clearTimeout(statusFlashTimer)
  statusFlashTimer = window.setTimeout(() => {
    statusEl.textContent = ''
  }, 2500)
}

function updateTitle(): void {
  const dirty = activePath !== null && src !== savedSnapshot ? ' •' : ''
  const name = activePath ? baseName(activePath) : 'Cade'
  document.title = `${name}${dirty} - Cade`
  getCurrentWindow()
    .setTitle(`${name}${dirty} - Cade`)
    .catch(() => {})
}

async function saveActive(saveAs = false): Promise<void> {
  if (activePath === null && !saveAs) {
    // nothing open yet — Save behaves like "save this new document"
    consoleEl.textContent = 'nothing to save — no file open (New File creates one)'
    return
  }

  let target = activePath
  if (saveAs) {
    const initName = activePath ? baseName(activePath) : 'main.c'
    const initDir =
      workspace ?? (activePath && isWinPath(activePath) ? dirName(activePath) : '')
    const picked = await saveDialog({
      title: 'Save As',
      defaultPath: initDir ? `${initDir}\\${initName}` : initName,
      filters: [{ name: 'Source files', extensions: ['c', 'cpp', 'cc', 'cxx', 'hh', 'py', 'js', 'mjs', 'rs'] }],
    })
    if (typeof picked !== 'string' || !picked) return
    target = asRelInWorkspace(picked) ?? normSlashes(picked)
  }
  if (target === null) return

  try {
    await fsWrite(target, src)
  } catch (e) {
    consoleEl.textContent = `save failed: ${String(e)}`
    blip(200, 0.1, 'square', 0.05)
    return
  }

  const switched = target !== activePath
  if (switched) {
    const old = Array.from(tabsEl.children).find(
      (t) => (t as HTMLElement).dataset.path === activePath,
    )
    old?.remove()
    tabViews.delete(activePath ?? '')
    activePath = target
    activeLang = langOf(target)
    createTab(target, src)
  } else {
    savedCache.set(target, src)
  }
  savedSnapshot = src // explicit save = clean baseline
  markDirty()
  void invoke('journal_clear')
  if (workspace !== null && !isWinPath(target)) pushRecent(workspace, target)
  else if (isWinPath(target)) pushRecent(dirName(target), baseName(target))
  statusFlash('Saved ✓')
  blip(880, 0.07, 'sine', 0.05)
}

window.addEventListener('keydown', (e) => {
  const ctrl = e.ctrlKey || e.metaKey
  if (!ctrl) return
  if (e.key.toLowerCase() === 's') {
    e.preventDefault()
    void saveActive(e.shiftKey) // Ctrl+Shift+S = Save As
  } else if (e.key === 'z' && !e.shiftKey) {
    e.preventDefault()
    const prev = hist.undo(src)
    if (prev !== null) {
      src = prev
      srcEl.value = prev
      void render(prev)
      markDirty()
    }
  } else if ((e.key === 'y' || (e.key === 'z' && e.shiftKey)) === true) {
    e.preventDefault()
    const next = hist.redo(src)
    if (next !== null) {
      src = next
      srcEl.value = next
      void render(next)
      markDirty()
    }
  }
})

srcEl.addEventListener('input', () => {
  hist.push(src, 'type')
  src = srcEl.value
  void render(src)
  markDirty()
})
srcEl.addEventListener('scroll', () => {
  if (viewMode !== 'split') return
  const max = srcEl.scrollHeight - srcEl.clientHeight
  if (max <= 0) return
  const f = srcEl.scrollTop / max
  let maxY = 40
  for (const b of flatten(roots)) maxY = Math.max(maxY, b.y + b.h)
  world.y = 48 - f * Math.max(0, maxY + 80 - 48)
})
srcEl.addEventListener('blur', () => void canonicalize())

// ------------------------------------------- text editor key handling (#8)
// Tab must indent code, NEVER steal focus; Shift+Tab outdents (selection or
// line); Enter keeps the previous line's indentation and expands braces /
// python colons — the basics a "real editor" is judged by.
function editTextArea(next: string, caret: number): void {
  srcEl.value = next
  srcEl.setSelectionRange(caret, caret)
  srcEl.dispatchEvent(new Event('input'))
}

srcEl.addEventListener('keydown', (e) => {
  if (e.key !== 'Tab' && e.key !== 'Enter') return
  const start = srcEl.selectionStart ?? 0
  const end = srcEl.selectionEnd ?? 0
  const value = srcEl.value
  if (e.key === 'Tab') {
    e.preventDefault()
    if (start === end) {
      if (e.shiftKey) {
        // outdent the current line by up to two spaces
        const lineStart = value.lastIndexOf('\n', start - 1) + 1
        const cut = Math.min(2, /^ {1,2}/.exec(value.slice(lineStart))?.[0].length ?? 0)
        if (cut > 0) editTextArea(value.slice(0, lineStart) + value.slice(lineStart + cut), Math.max(lineStart, start - cut))
      } else {
        editTextArea(value.slice(0, start) + '  ' + value.slice(end), start + 2)
      }
      return
    }
    // selection spans lines: indent/outdent every touched line
    const lineStart = value.lastIndexOf('\n', start - 1) + 1
    const nlAt = value.indexOf('\n', end)
    const lineEnd = nlAt === -1 ? value.length : nlAt
    const block = value.slice(lineStart, lineEnd)
    const shiftedBlock = e.shiftKey
      ? block.replace(/^ {1,2}/gm, '')
      : block.replace(/^/gm, '  ')
    const firstDelta =
      shiftedBlock.split('\n')[0].length - block.split('\n')[0].length
    editTextArea(
      value.slice(0, lineStart) + shiftedBlock + value.slice(lineEnd),
      Math.max(lineStart, start + firstDelta),
    )
    return
  }
  if (e.key === 'Enter') {
    e.preventDefault()
    const pos = start
    const lineStart = value.lastIndexOf('\n', pos - 1) + 1
    const prevLine = value.slice(lineStart, pos).trimEnd()
    let indent = /^[ \t]*/.exec(prevLine)?.[0] ?? ''
    const opens = trimmedEndsWithOpener(prevLine)
    if (opens) indent += '    '
    if (opens && value[pos] === '}') {
      // brace-expand: {\n<indent+4>\n<indent>}
      editTextArea(
        value.slice(0, pos) + '\n' + indent + '\n' + indent.slice(0, -4) + value.slice(pos),
        pos + 1 + indent.length,
      )
      return
    }
    editTextArea(value.slice(0, pos) + '\n' + indent + value.slice(end), pos + 1 + indent.length)
  }
})

function trimmedEndsWithOpener(line: string): boolean {
  const t = line.trimEnd()
  return t.endsWith('{') || t.endsWith(':')
}

// ------------------------------------------------------------------ pan/zoom
let panning = false
let lastX = 0
let lastY = 0
app.stage.eventMode = 'static'
app.stage.hitArea = app.screen
app.stage.on('pointerdown', (e) => {
  if ((e as { button?: number }).button !== undefined && (e as { button?: number }).button !== 0)
    return
  // e.global is already canvas-relative — do NOT subtract the host rect
  const w = screenToWorld(e.global.x, e.global.y)
  if (hitTestHeader(roots, w.x, w.y)) return
  panning = true
  lastX = e.global.x
  lastY = e.global.y
})
app.stage.on('pointermove', (e) => {
  if (!panning) return
  world.x += e.global.x - lastX
  world.y += e.global.y - lastY
  lastX = e.global.x
  lastY = e.global.y
})
window.addEventListener('pointerup', () => (panning = false))
hostEl.addEventListener(
  'wheel',
  (e) => {
    e.preventDefault()
    const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1
    const mx = e.offsetX
    const my = e.offsetY
    const wx = (mx - world.x) / world.scale.x
    const wy = (my - world.y) / world.scale.y
    world.scale.set(world.scale.x * factor)
    world.x = mx - wx * world.scale.x
    world.y = my - wy * world.scale.y
  },
  { passive: false },
)

// ------------------------------------------------------- Scratch palette
// Category rail + colored sections (docs/SCRATCH-BLOCKS-REFERENCE.md);
// Variables section owns Make-a-Variable / Make-a-List and per-var chips.
const knownVars: string[] = JSON.parse(localStorage.getItem('blockide-vars') ?? '[]')
const knownLists: string[] = JSON.parse(localStorage.getItem('blockide-lists') ?? '[]')
/** declared type per variable (C/C++ need the declaration to exist first) */
const varTypesMap: Record<string, string> = (() => {
  try {
    return JSON.parse(localStorage.getItem('blockide-vartypes') ?? '{}') as Record<string, string>
  } catch {
    return {}
  }
})()
let harvestedVars: string[] = [] // declared in the open file (file is truth)
let paletteSignature = ''
let programKinds = new Set<string>()
let programIncludes = new Set<string>()

function saveVars(): void {
  localStorage.setItem('blockide-vars', JSON.stringify(knownVars))
  localStorage.setItem('blockide-lists', JSON.stringify(knownLists))
  localStorage.setItem('blockide-vartypes', JSON.stringify(varTypesMap))
}

function isReporterChip(item: PaletteItem & { varName?: string }): boolean {
  return item.snippet === ''
}

/** Operator/function reporter chips: oval (round) or hex (bool) pills that
 *  drop their EXPRESSION into a matching socket. */
function makeReporterChip(item: PaletteItem): HTMLDivElement {
  const el = document.createElement('div')
  const hex = item.reporter === 'bool'
  el.className = `pal pal-${item.cat}${hex ? ' pal-hex' : ' pal-reporter'}`
  el.dataset.cat = item.cat
  el.textContent = item.name
  ;(el as unknown as { __item?: PaletteItem }).__item = item
  el.title = `Drop into a ${hex ? 'hex condition' : 'round'} socket, then click it to edit the operands`
  el.addEventListener('pointerdown', (e) => {
    if (el.classList.contains('locked')) {
      e.preventDefault()
      return
    }
    e.preventDefault()
    startHtmlDrag(e, {
      label: item.name,
      slotValue: item.name,
      slotKind: item.reporter,
      cat: item.cat,
    })
  })
  return el
}

function makeVarChip(item: PaletteItem & { varName?: string }, list = false): HTMLDivElement {
  const el = document.createElement('div')
  el.className = `pal pal-variables${isReporterChip(item) ? ' pal-reporter' : ''}${list ? ' pal-list' : ''}`
  el.dataset.cat = 'variables'
  ;(el as unknown as { __item?: PaletteItem }).__item = item
  el.dataset.var = item.varName ?? item.name
  el.textContent = item.name
  el.addEventListener('pointerdown', (e) => {
    if (el.classList.contains('locked')) {
      e.preventDefault()
      return
    }
    e.preventDefault()
    if (isReporterChip(item)) {
      // oval reporter: fits INTO round slots, never onto the canvas
      startHtmlDrag(e, {
        label: item.name,
        slotValue: item.name,
        slotKind: 'round',
        cat: 'variables',
      })
    } else {
      startHtmlDrag(e, { label: item.name, snippet: item.snippet, cat: 'variables' })
    }
  })
  el.addEventListener('contextmenu', (e) => {
    // Scratch: right-click a variable reporter -> rename/delete
    e.preventDefault()
    const varName = item.varName ?? item.name
    if (!knownVars.includes(varName) && !knownLists.includes(varName)) {
      consoleEl.textContent = `"${varName}" is declared in the file — rename or delete it in the code`
      return
    }
    openVarMenu(e, varName)
  })
  return el
}

// rename/delete menu (Scratch's variable right-click actions)
const varMenu = document.createElement('div')
varMenu.id = 'var-menu'
varMenu.style.display = 'none'
document.body.appendChild(varMenu)
let varMenuTarget: string | null = null

function openVarMenu(e: MouseEvent, varName: string): void {
  varMenuTarget = varName
  varMenu.innerHTML = `<div class="mi" data-act="rename">Rename</div><div class="mi danger" data-act="delete">Delete</div>`
  varMenu.style.display = 'block'
  varMenu.style.left = `${Math.min(e.clientX, window.innerWidth - 150)}px`
  varMenu.style.top = `${Math.min(e.clientY, window.innerHeight - 80)}px`
}

varMenu.addEventListener('click', (e) => {
  const act = (e.target as HTMLElement).dataset?.act
  const old = varMenuTarget
  hideVarMenu()
  if (!act || !old) return
  if (act === 'rename') {
    const raw = window.prompt(`Rename "${old}" to:`, old)
    if (raw === null) return
    const next = validateVarName(raw)
    if (next === null || knownVars.includes(next) || knownLists.includes(next)) {
      consoleEl.textContent = `cannot rename to "${raw}"`
      blip(200, 0.08, 'square', 0.04)
      return
    }
    if (knownVars.includes(old)) knownVars[knownVars.indexOf(old)] = next
    if (knownLists.includes(old)) knownLists[knownLists.indexOf(old)] = next
    saveVars()
    blip(740, 0.06, 'sine', 0.05)
  } else if (act === 'delete') {
    if (!window.confirm(`Delete "${old}"? (code is untouched)`)) return
    const vi = knownVars.indexOf(old)
    if (vi >= 0) knownVars.splice(vi, 1)
    const li = knownLists.indexOf(old)
    if (li >= 0) knownLists.splice(li, 1)
    saveVars()
    blip(170, 0.1, 'square', 0.05)
  }
  renderPalette()
})

function hideVarMenu(): void {
  varMenu.style.display = 'none'
  varMenuTarget = null
}
window.addEventListener('pointerdown', (e) => {
  if (!varMenu.contains(e.target as Node)) hideVarMenu()
})

function renderPalette(): void {
  const st = paletteEl.scrollTop
  paletteEl.innerHTML = ''

  // Scratch's category rail: colored dots, click jumps to the section
  const rail = document.createElement('div')
  rail.id = 'pal-rail'
  const dots: { dot: HTMLSpanElement; name: string }[] = []
  paletteEl.appendChild(rail)

  const addGroupHeader = (name: string, color: string): HTMLDivElement => {
    const head = document.createElement('div')
    head.className = 'pal-group'
    head.dataset.g = name.toLowerCase()
    head.textContent = name
    head.style.background = color
    if (name === 'Notes') head.style.color = '#6b4d00'
    paletteEl.appendChild(head)
    return head
  }
  const addChip = (item: PaletteItem): void => {
    // per-language palette (D3): chips declare which languages they serve
    if (item.langs !== undefined && !item.langs.includes(activeLang)) return
    if (item.reporter !== undefined) {
      paletteEl.appendChild(makeReporterChip(item))
      return
    }
    // Scratch's dependency rule: some blocks need another block to exist
    // (else needs if, cout needs <iostream>…)
    const depOk =
      item.requires === undefined ||
      ((item.requires.kind === undefined || programKinds.has(item.requires.kind)) &&
        (item.requires.include === undefined ||
          [...programIncludes].some((inc) => inc.includes(item.requires!.include!))))
    const el = document.createElement('div')
    el.className = `pal pal-${item.cat}${depOk ? '' : ' pal-dep'}`
    el.dataset.cat = item.cat
    el.textContent = item.name
    ;(el as unknown as { __item?: PaletteItem }).__item = item
    if (!depOk) {
      const need = item.requires!.kind ?? item.requires!.include!
      el.title = `Needs ${need} in the program first`
    }
    el.addEventListener('pointerdown', (e) => {
      if (el.classList.contains('locked')) {
        e.preventDefault()
        return
      }
      if (!depOk) {
        e.preventDefault()
        blip(200, 0.08, 'square', 0.04)
        consoleEl.textContent = `"${item.name}" needs ${item.requires!.kind ?? item.requires!.include!} in the program first`
        return
      }
      e.preventDefault()
      startHtmlDrag(e, {
        label: item.name,
        snippet: item.snippet,
        cat: item.cat,
        toplevel: item.toplevel,
        insertTop: item.top,
      })
    })
    paletteEl.appendChild(el)
  }

  for (const g of PALETTE_GROUPS) {
    const head = addGroupHeader(g.name, g.color)
    const dot = document.createElement('span')
    dot.className = 'rail-dot'
    dot.title = g.name
    dot.style.background = g.color
    dot.addEventListener('click', () =>
      paletteEl.scrollTo({ top: head.offsetTop - 26, behavior: 'smooth' }),
    )
    rail.appendChild(dot)
    dots.push({ dot, name: g.name })
    for (const item of g.items) addChip(item)
  }

  // ---- Variables section (Scratch data category) — C/C++ only: typed
  // declarations are meaningless in dynamically-typed languages, so Make a
  // Variable/List and their chips stay hidden there (D11) ----
  if (activeLang === 'c' || activeLang === 'cpp') {
    const vhead = addGroupHeader('Variables', VARIABLES_COLOR)
    const vdot = document.createElement('span')
    vdot.className = 'rail-dot'
    vdot.title = 'Variables'
    vdot.style.background = VARIABLES_COLOR
    vdot.addEventListener('click', () =>
      paletteEl.scrollTo({ top: vhead.offsetTop - 26, behavior: 'smooth' }),
    )
    rail.appendChild(vdot)
    dots.push({ dot: vdot, name: 'Variables' })

    const mk = document.createElement('button')
    mk.id = 'make-var'
    mk.dataset.cat = 'variables' // lock-gated with the section in academy mode
    mk.textContent = 'Make a Variable'
    mk.addEventListener('click', () => {
      if (mk.classList.contains('locked')) return
      const raw = window.prompt('Variable name:', 'score')
      if (raw === null) return
      const name = validateVarName(raw)
      if (name === null) {
        consoleEl.textContent = `"${raw}" is not a valid C variable name`
        blip(200, 0.08, 'square', 0.04)
        return
      }
      // C/C++ variables need a DECLARED TYPE — second step of the dialog
      const types = varTypes(activeLang)
      const traw = window.prompt(`Type for "${name}" (${types.join('/')}):`, varTypesMap[name] ?? 'int')
      if (traw === null) return
      const type = traw.trim().toLowerCase()
      if (!types.includes(type)) {
        consoleEl.textContent = `"${type}" is not a type I know — use ${types.join('/')}`
        blip(200, 0.08, 'square', 0.04)
        return
      }
      if (!knownVars.includes(name)) knownVars.push(name)
      varTypesMap[name] = type
      saveVars()
      renderPalette()
      blip(740, 0.07, 'sine', 0.06)
    })
    paletteEl.appendChild(mk)

    const allVars = [...new Set([...knownVars, ...harvestedVars])]
    for (const v of allVars) {
      for (const chip of varChips(v, varTypesMap[v] ?? 'int')) {
        paletteEl.appendChild(makeVarChip(chip))
      }
    }

    // ---- Lists subcategory (Scratch Lists -> C arrays) ----
    const mkList = document.createElement('button')
    mkList.id = 'make-list'
    mkList.dataset.cat = 'variables'
    mkList.textContent = 'Make a List'
    mkList.addEventListener('click', () => {
      if (mkList.classList.contains('locked')) return
      const raw = window.prompt('List name (C array):', 'grid')
      if (raw === null) return
      const name = validateVarName(raw)
      if (name === null) {
        consoleEl.textContent = `"${raw}" is not a valid C array name`
        blip(200, 0.08, 'square', 0.04)
        return
      }
      if (!knownLists.includes(name)) knownLists.push(name)
      saveVars()
      renderPalette()
      blip(740, 0.07, 'sine', 0.06)
    })
    paletteEl.appendChild(mkList)

    // list chips: user-created lists always; file-indexed vars discovered live
    const listVars = new Set<string>(knownLists)
    for (const v of allVars) {
      if (src.includes(`${v}[`)) listVars.add(v)
    }
    for (const v of listVars) {
      for (const chip of listChips(v)) paletteEl.appendChild(makeVarChip(chip, true))
    }
  }

  // active rail dot follows scroll
  paletteEl.onscroll = () => {
    let active = dots[0]?.name
    for (const d of dots) {
      const head = paletteEl.querySelector(`.pal-group[data-g="${d.name.toLowerCase()}"]`) as HTMLElement | null
      if (head && head.offsetTop - 30 <= paletteEl.scrollTop) active = d.name
    }
    for (const d of dots) d.dot.classList.toggle('active', d.name === active)
  }

  applyPalFilter()
  paletteEl.scrollTop = st
  renderPaletteLocks()
}

// ------------------------------------------ keyboard-first palette (research:
// frame-based editing papers — blocks must scale past mouse-only dragging)
const palFilter = document.getElementById('pal-filter') as HTMLInputElement
let kbdIdx = -1

function visibleChips(): HTMLElement[] {
  return Array.from(
    paletteEl.querySelectorAll<HTMLElement>('.pal, #make-var, #make-list'),
  ).filter((el) => !el.classList.contains('pal-hide'))
}

/** Type-to-filter: hide non-matching chips, collapse emptied sections. */
function applyPalFilter(): void {
  const q = palFilter.value.trim().toLowerCase()
  kbdIdx = -1
  for (const el of Array.from(
    paletteEl.querySelectorAll<HTMLElement>('.pal, #make-var, #make-list'),
  )) {
    el.classList.remove('pal-kbd')
    el.classList.toggle('pal-hide', q !== '' && !(el.textContent ?? '').toLowerCase().includes(q))
  }
  for (const head of Array.from(paletteEl.querySelectorAll<HTMLElement>('.pal-group'))) {
    let visible = 0
    let n = head.nextElementSibling as HTMLElement | null
    while (n && !n.classList.contains('pal-group')) {
      if (!n.classList.contains('pal-hide')) visible++
      n = n.nextElementSibling as HTMLElement | null
    }
    head.classList.toggle('pal-hide', q !== '' && visible === 0)
  }
}

/** Enter on a highlighted chip splices it through the same seams as a drag:
 *  includes → top, toplevel → file scope, statements → at your caret. */
function keyboardActivateChip(el: HTMLElement): void {
  if (el.id === 'make-var' || el.id === 'make-list') {
    ;(el as HTMLButtonElement).click()
    return
  }
  const item = (el as unknown as { __item?: PaletteItem }).__item
  if (!item) return
  if (item.reporter !== undefined) {
    consoleEl.textContent = 'reporter chips drop INTO sockets — drag one onto a round or hex slot'
    blip(200, 0.06, 'square', 0.03)
    return
  }
  tourHooks.advance?.('edit')
  blip(740, 0.07, 'sine', 0.08)
  if (item.top) {
    setSrc(`${item.snippet}\n${src}`)
    void canonicalize()
    return
  }
  if (item.toplevel) {
    setSrc(insertTopLevel(src, roots, item.snippet))
    void canonicalize()
    return
  }
  try {
    const anchor = caretAnchor ?? pickAnchor(roots, src.length)
    const off = Math.max(0, Math.min(src.length, caretOffset(roots, src.length, anchor)))
    const next = spliceInsert(src, off, item.snippet)
    if (next !== null) {
      setSrc(next)
      void canonicalize()
      return
    }
  } catch {
    /* fall through to the hint */
  }
  consoleEl.textContent = 'no insertion point here — click inside main first'
}

palFilter.addEventListener('input', applyPalFilter)
palFilter.addEventListener('keydown', (e) => {
  const chips = visibleChips()
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    e.preventDefault()
    if (chips.length === 0) return
    kbdIdx =
      e.key === 'ArrowDown' ? Math.min(kbdIdx + 1, chips.length - 1) : Math.max(kbdIdx - 1, 0)
    chips.forEach((c, i) => c.classList.toggle('pal-kbd', i === kbdIdx))
    chips[kbdIdx].scrollIntoView({ block: 'nearest' })
  } else if (e.key === 'Enter') {
    e.preventDefault()
    const el = chips[kbdIdx]
    if (el) keyboardActivateChip(el)
  } else if (e.key === 'Escape') {
    e.preventDefault()
    palFilter.value = ''
    applyPalFilter()
    srcEl.focus({ preventScroll: true })
  }
})

// ---------------------------------------------------------------- academy
interface ProfileOut {
  xp: number
  completed: string[]
  unlocked: string[]
}
interface LevelInfo {
  id: string
  world: number
  title: string
  xp: number
  done: boolean
}

const xpBadge = document.getElementById('xp-badge') as HTMLSpanElement
const levelSelect = document.getElementById('level-select') as HTMLSelectElement
const hintBtn = document.getElementById('hint-btn') as HTMLButtonElement
let profile: ProfileOut | null = null
let hints: string[] = []
let hintTier = 0

// Research gap-closers (docs/COMPETITOR-RESEARCH.md): OWNERSHIP CHAINING —
// level N starts from the student's own N-1 solution, not a fresh starter —
// and SPACED MASTERY — passed levels resurface for review on a Leitner
// ladder (1/3/7/14-day intervals). Both offline in localStorage.
const nowSec = (): number => Math.floor(Date.now() / 1000)
const levelSols = JSON.parse(
  localStorage.getItem('blockide-levelsol') ?? '{}',
) as Record<string, string>
const mastery = JSON.parse(
  localStorage.getItem('blockide-mastery') ?? '{}',
) as Record<string, MasteryState>
let levelsCache: LevelInfo[] = []

// --------------------------------------------- D7 mode split: sandbox|academy
type AppMode = 'sandbox' | 'academy'
const appElMode = document.getElementById('app') as HTMLDivElement
const modeBtns = Array.from(document.querySelectorAll<HTMLButtonElement>('.mm'))
let appMode: AppMode = (localStorage.getItem('mode') as AppMode) ?? 'sandbox'

function setMode(m: AppMode): void {
  appMode = m
  localStorage.setItem('mode', m)
  appElMode.dataset.mode = m
  modeBtns.forEach((b) => b.classList.toggle('active', b.dataset.mode === m))
  renderPaletteLocks() // sandbox = everything unlocked, always
}

modeBtns.forEach((b) =>
  b.addEventListener('click', () => setMode(b.dataset.mode as AppMode)),
)

function renderPaletteLocks(): void {
  for (const chip of Array.from(paletteEl.children) as HTMLElement[]) {
    const cat = chip.dataset.cat ?? ''
    const locked =
      appMode === 'academy' && profile !== null && !profile.unlocked.includes(cat)
    chip.classList.toggle('locked', locked)
    if (locked) chip.title = `Locked — complete ${cat} levels in the Academy`
    else chip.removeAttribute('title')
  }
}

async function refreshProfile(): Promise<void> {
  try {
    profile = await invoke<ProfileOut>('profile_get')
    xpBadge.textContent = `★ ${profile.xp} XP`
  } catch {
    /* profile optional */
  }
  renderPaletteLocks()
}

async function refreshLevels(): Promise<void> {
  try {
    const levels = await invoke<LevelInfo[]>('academy_levels')
    levelsCache = levels
    levelSelect.innerHTML = ''
    for (const l of levels) {
      const o = document.createElement('option')
      const due = masteryDue(mastery[l.id], nowSec()) ? ' ⟳review' : ''
      o.value = l.id
      o.textContent = `W${l.world}${l.done ? ' ✓' : ''} · ${l.title} (${l.xp}xp)${due}`
      levelSelect.appendChild(o)
    }
  } catch {
    /* academy dir may be missing */
  }
}

document.getElementById('level-load')?.addEventListener('click', async () => {
  const id = levelSelect.value
  if (!id) return
  try {
    const l = await invoke<{ starter: string; hints: string[] }>('academy_load', { levelId: id })
    // ownership chaining: seed from the student's own previous solution
    const prev = previousLevel(levelsCache, id)
    const chained = prev ? levelSols[prev.id] : undefined
    caretAnchor = null
    setSrc(chained?.trim() ? chained : l.starter)
    savedSnapshot = src // the seeded buffer is the clean baseline
    hints = l.hints
    hintTier = 0
    updateHintBtn()
    consoleEl.textContent = chained?.trim()
      ? `[academy] ${id} loaded — starting from YOUR "${prev!.id}" solution (ownership chaining). ${hints.length} hints available.`
      : `[academy] ${id} loaded — ${hints.length} hints available. Write code, press Check!`
    if (masteryDue(mastery[id], nowSec())) {
      consoleEl.textContent += '\n[academy] ⟳ spaced review: you solved this before — again cements it.'
    }
  } catch (e) {
    consoleEl.textContent = String(e)
  }
})

function updateHintBtn(): void {
  hintBtn.textContent =
    hints.length === 0 ? 'Hint' : `Hint (${Math.min(hintTier + 1, hints.length)}/${hints.length})`
  hintBtn.disabled = hints.length === 0 || hintTier >= hints.length
}

hintBtn?.addEventListener('click', () => {
  if (hintTier >= hints.length) return
  consoleEl.textContent += `\n[hint ${hintTier + 1}/3] ${hints[hintTier]}`
  consoleEl.scrollTop = consoleEl.scrollHeight
  hintTier++
  updateHintBtn()
})

document.getElementById('check-btn')?.addEventListener('click', async () => {
  const id = levelSelect.value
  if (!id || running) return
  consoleEl.textContent = '[academy] checking…'
  try {
    const r = await invoke<{ passed: boolean; results: { index: number; ok: boolean }[]; xp_awarded: number; total_xp: number }>(
      'academy_check',
      { levelId: id, src },
    )
    if (r.passed) {
      tourHooks.advance?.('check')
      // record THIS solution (ownership chaining seeds the next level) and
      // promote the spaced-mastery box
      levelSols[id] = src
      localStorage.setItem('blockide-levelsol', JSON.stringify(levelSols))
      mastery[id] = nextMastery(mastery[id], nowSec())
      localStorage.setItem('blockide-mastery', JSON.stringify(mastery))
      const review = masteryNextIn(mastery[id])
      consoleEl.textContent =
        r.xp_awarded > 0
          ? `[academy] PASSED ✓  +${r.xp_awarded} XP (total ${r.total_xp}) · solution saved — the next level starts from it · next ⟳review in ${review}`
          : `[academy] PASSED ✓  (already completed before — no extra XP) · next ⟳review in ${review}`
      await refreshProfile()
      await refreshLevels()
    } else {
      tourHooks.advance?.('check')
      const bad = r.results.filter((x) => !x.ok).map((x) => `test[${x.index}]`)
      consoleEl.textContent = `[academy] failed hidden tests: ${bad.join(', ')} — take a hint?`
    }
  } catch (e) {
    consoleEl.textContent = String(e)
  }
})

// debug/verification hooks (harmless in production)
;(window as unknown as { __hitAt?: unknown }).__hitAt = (cx: number, cy: number): string | null => {
  const r = hostEl.getBoundingClientRect()
  const w = screenToWorld(cx - r.left, cy - r.top)
  const hit = hitTestHeader(roots, w.x, w.y)
  return hit ? hit.label || hit.nodeKind : null
}
;(window as unknown as { __blocksShape?: unknown }).__blocksShape = () =>
  flatten(roots).map((b) => ({
    kind: b.nodeKind,
    container: b.container,
    kids: b.children.length,
  }))
;(window as unknown as { __slots?: unknown }).__slots = () =>
  slotHits.map((s) => ({ type: s.part.type, text: s.part.text }))
;(window as unknown as { __commitSlot?: unknown }).__commitSlot = (i: number, v: string) => {
  const s = slotHits[i]
  if (!s) return 'no such slot'
  return commitSlotValue(s, v)
}
;(window as unknown as { __makeVar?: unknown }).__makeVar = (raw: string) => {
  const name = validateVarName(raw)
  if (name === null) return 'invalid'
  if (!knownVars.includes(name)) knownVars.push(name)
  saveVars()
  renderPalette()
  return null
}
;(window as unknown as { __makeList?: unknown }).__makeList = (raw: string) => {
  const name = validateVarName(raw)
  if (name === null) return 'invalid'
  if (!knownLists.includes(name)) knownLists.push(name)
  saveVars()
  renderPalette()
  return null
}
;(window as unknown as { __langOf?: unknown }).__langOf = (path: string) => langOf(path)
;(window as unknown as { __activeLang?: unknown }).__activeLang = () => activeLang
;(window as unknown as { __labels?: unknown }).__labels = () => flatten(roots).map((b) => b.label)
;(window as unknown as { __runState?: unknown }).__runState = () => ({ running, polls: (window as unknown as { __polls?: number }).__polls })

void refreshProfile()
void refreshLevels()
setMode(appMode) // apply persisted sandbox/academy split (D7)
renderPalette() // Scratch-style grouped palette (1.10)

// ------------------------------------------------------- semantic caret map
// P1.2 residual: cursor survives Blocks/Split/Text switches by anchoring to
// the deepest node under the caret (node id + edge), re-derived from the
// current parse on every restore — never a raw byte offset.
let caretAnchor: CaretAnchor | null = null

function captureCaret(): void {
  if (viewMode !== 'text' && viewMode !== 'split') return
  caretAnchor = pickAnchor(roots, srcEl.selectionStart ?? 0)
}

function restoreCaret(): void {
  const a = caretAnchor
  if (!a) return
  const pos = caretOffset(roots, src.length, a)
  srcEl.focus({ preventScroll: true })
  srcEl.setSelectionRange(pos, pos)
  // keep the caret line in the middle of the viewport
  const line = src.slice(0, pos).split('\n').length - 1
  const lh = parseFloat(getComputedStyle(srcEl).lineHeight || '19') || 19
  srcEl.scrollTop = Math.max(0, line * lh - srcEl.clientHeight / 2)
}

srcEl.addEventListener('keyup', captureCaret)
srcEl.addEventListener('mouseup', captureCaret)
srcEl.addEventListener('input', captureCaret)
srcEl.addEventListener('focus', captureCaret)

/** Anchor the caret to a block the user interacted with (edit/menu) and,
 *  when the text pane is visible, highlight its span there too. */
function anchorToBlock(b: BBlock): void {
  caretAnchor = { id: b.id, edge: 'start', offset: b.start }
  if (viewMode === 'split') srcEl.setSelectionRange(b.start, Math.min(b.end, b.start + 512))
}

// ------------------------------------------------------------- view modes
type ViewMode = 'split' | 'blocks' | 'text'
const viewBtns = Array.from(document.querySelectorAll<HTMLButtonElement>('.vm'))
const appEl = document.getElementById('app') as HTMLDivElement
let viewMode: ViewMode = 'split'
const tabViews = new Map<string, ViewMode>()

function setView(v: ViewMode): void {
  if (viewMode === 'text' || viewMode === 'split') captureCaret()
  viewMode = v
  appEl.dataset.view = v
  viewBtns.forEach((b) => b.classList.toggle('active', b.dataset.view === v))
  window.dispatchEvent(new Event('resize'))
  if (v === 'text' || v === 'split') requestAnimationFrame(restoreCaret)
  if (activePath) tabViews.set(activePath, v)
}

viewBtns.forEach((b) =>
  b.addEventListener('click', () => setView(b.dataset.view as ViewMode)),
)

// The off-ramp made visible (research: tools whose text mode has "dignity"
// keep their graduates — GML Visual's lesson inverted). One click switches
// to the real-code view; blocks stay one Ctrl+1 away, forever.
document.getElementById('graduate')?.addEventListener('click', () => {
  setView('text')
  blip(880, 0.09, 'sine', 0.07)
  consoleEl.textContent =
    '[graduate] You are writing REAL code now — the same file the blocks were showing. Ctrl+1 brings the blocks back anytime.'
})

// ------------------------------------------------------- theme + keybinds
const themeBtn = document.getElementById('theme-toggle') as HTMLButtonElement

function setTheme(t: 'dark' | 'light'): void {
  document.documentElement.dataset.theme = t
  themeBtn.textContent = t === 'dark' ? '☾' : '☀'
  localStorage.setItem('theme', t)
  app.renderer.background.color = t === 'dark' ? 0x0c3543 : 0xdff3fa
  world.emit('blockide:theme', t)
}

setTheme((localStorage.getItem('theme') as 'dark' | 'light') ?? 'light')
themeBtn.addEventListener('click', () =>
  setTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'),
)

// --------------------------------------------------- launch splash (Blender-style)
// Language choice + recent files at every launch; C starts automatically when
// nobody interacts (countdown bar). Chosen language loads its sample/blocks.
interface RecentEntry {
  root: string
  rel: string
  ts: number
}

function recentList(): RecentEntry[] {
  try {
    return JSON.parse(localStorage.getItem('blockide-recent') ?? '[]') as RecentEntry[]
  } catch {
    return []
  }
}

function pushRecent(root: string, rel: string): void {
  const list = recentList().filter((r) => !(r.root === root && r.rel === rel))
  list.unshift({ root, rel, ts: Date.now() })
  localStorage.setItem('blockide-recent', JSON.stringify(list.slice(0, 6)))
}

async function beginSession(lang: Lang): Promise<void> {
  activeLang = lang
  src = SAMPLES[lang]
  savedSnapshot = src // fresh sample session = clean baseline
  activePath = null
  caretAnchor = null
  // unsaved work from a previous session overrides the sample (its language
  // rides with the journaled path when there is one)
  let restored = false
  try {
    const j = await invoke<{ path: string; content: string; age_secs: number } | null>(
      'journal_read',
    )
    if (j && j.content.trim()) {
      if (Object.values(SAMPLES).includes(j.content) || j.content === NEW_TEMPLATE) {
        void invoke('journal_clear')
      } else {
        src = j.content
        if (j.path) activeLang = langOf(j.path)
        consoleEl.textContent = `[recovery] unsaved work from ${Math.round(j.age_secs)}s ago restored${j.path ? ` (${j.path})` : ''} - Ctrl+S to keep it`
        restored = true
      }
    }
  } catch {
    /* no journal */
  }
  if (!restored) {
    // live journal missing — salvage the newest backup snapshot (rotation
    // keeps five; Tynker's "lost my progress" must be structurally impossible)
    try {
      const b = await invoke<{ path: string; content: string; age_secs: number } | null>(
        'journal_restore_backup',
        { slot: 1 },
      )
      if (
        b &&
        b.content.trim() &&
        !Object.values(SAMPLES).includes(b.content) &&
        b.content !== NEW_TEMPLATE
      ) {
        src = b.content
        if (b.path) activeLang = langOf(b.path)
        consoleEl.textContent = `[recovery] no live journal - restored BACKUP snapshot (${Math.round(b.age_secs / 60)} min old)${b.path ? ` (${b.path})` : ''} - Ctrl+S to keep it`
      }
    } catch {
      /* no backups either */
    }
  }
  splashEl.style.display = 'none'
  srcEl.value = src
  void render(src)
  void refreshDiags()
  markDirty()
  updateTitle()
  if (!localStorage.getItem('tour-done')) setTimeout(startTour, 600)
}

async function beginFromRecent(entry: RecentEntry): Promise<void> {
  if (!(await confirmDiscard())) return
  workspace = entry.root
  await refreshFiles()
  try {
    await openTab(entry.rel) // sets activeLang from the extension + renders
  } catch {
    consoleEl.textContent = `recent file missing: ${entry.rel}`
    return
  }
  splashEl.style.display = 'none'
  if (!localStorage.getItem('tour-done')) setTimeout(startTour, 600)
}

const splashEl = document.getElementById('splash') as HTMLDivElement
function wireSplash(): void {
  // Blender-style recent files: bold name + dim path, hover highlight
  const list = document.getElementById('recent-list') as HTMLDivElement
  const recents = recentList().slice(0, 6)
  list.innerHTML = ''
  if (recents.length === 0) {
    list.innerHTML = '<span class="m-free">no recent files yet — open a folder to begin</span>'
  }
  for (const r of recents) {
    const el = document.createElement('div')
    el.className = 'recent-item'
    const name = document.createElement('b')
    name.textContent = r.rel.split('/').pop() ?? r.rel
    const path = document.createElement('span')
    path.textContent = r.root
    el.append(name, path)
    el.addEventListener('click', () => void beginFromRecent(r))
    list.appendChild(el)
  }
  // language cards — the ONLY way past the splash (no timer)
  splashEl.querySelectorAll<HTMLButtonElement>('.splash-lang').forEach((b) => {
    b.addEventListener('click', () => {
      blip(740, 0.07, 'sine', 0.06)
      void beginSession(b.dataset.lang as Lang)
    })
  })
  // footer: Open Folder… (same dialog as the toolbar button)
  document.getElementById('splash-open')?.addEventListener('click', () => {
    void beginSession('c').then(() => {
      window.setTimeout(() => {
        document.getElementById('open-folder')?.click()
      }, 150)
    })
  })
}

wireSplash()
// module-eval-complete signal for headless drivers: static splash markup
// exists BEFORE this line (top-level pixi await), so DOM presence alone
// does not mean the click handlers are wired yet
;(window as unknown as { __bootDone?: boolean }).__bootDone = true

// about dialog: toolbar brand logo opens the horizontal lockup card; any
// click on the overlay closes it
const aboutEl = document.getElementById('about') as HTMLDivElement
document.getElementById('brand-logo')?.addEventListener('click', () => {
  blip(660, 0.06, 'sine', 0.05)
  aboutEl.style.display = 'flex'
})
aboutEl.addEventListener('click', () => {
  aboutEl.style.display = 'none'
})

// Close-time crash checkpoint ONLY (not autosave): one journal write when
// the window goes away with unsaved work, so a hard kill mid-session still
// recovers. Normal editing never touches the journal — explicit Save is the
// workflow; discard guards cover navigation.
window.addEventListener('beforeunload', () => {
  if (activePath !== null && src.trim() && src !== savedSnapshot) {
    void invoke('journal_write', { path: activePath ?? '', content: src })
  }
})

// keybindings: Ctrl+Enter / F5 run, Ctrl+B sidebar toggle
window.addEventListener('keydown', (e) => {
  if (e.key === 'F5' || (e.ctrlKey && e.key === 'Enter')) {
    e.preventDefault()
    if (!running) void startRun()
    return
  }
  if (e.ctrlKey && e.key.toLowerCase() === 'b') {
    e.preventDefault()
    const sb = document.getElementById('sidebar') as HTMLElement
    sb.style.display = sb.style.display === 'none' ? 'flex' : 'none'
    window.dispatchEvent(new Event('resize'))
    return
  }
  if (e.ctrlKey && e.key === '1') {
    e.preventDefault()
    setView('blocks')
  } else if (e.ctrlKey && e.key === '2') {
    e.preventDefault()
    setView('split')
  } else if (e.ctrlKey && e.key === '3') {
    e.preventDefault()
    setView('text')
  } else if (e.key === '/' && !e.ctrlKey && !e.metaKey) {
    // keyboard-first palette: / focuses the block filter from anywhere
    const t = e.target as HTMLElement | null
    if (t && (t.tagName === 'TEXTAREA' || t.tagName === 'INPUT')) return
    e.preventDefault()
    palFilter.focus()
    palFilter.select()
  }
})

// --------------------------------------------------------- onboarding tour
// Context-aware instructions (Blockly's proven pattern: nobody reads
// instructions — popups must VERIFY the action before closing). Steps with
// an `until` event close themselves when the learner actually does the
// thing; Next always remains as an escape hatch.
const TOUR_STEPS: { title: string; body: string; until?: 'edit' | 'run' | 'check' }[] = [
  {
    title: 'Welcome to Cade',
    body: 'Real code on disk is the truth. Blocks are a live view of it — break either one and they stay in sync.',
  },
  {
    title: 'Drag & edit blocks',
    body: 'Drag a chip from the palette into main, or double-click any block text and change it. This step closes when you do.',
    until: 'edit',
  },
  {
    title: 'Run & see',
    body: 'Press Ctrl+Enter to run YOUR program. Output lands in the console. This step closes when you run it.',
    until: 'run',
  },
  {
    title: 'Learn in the Academy',
    body: 'Pick a level, press Load, solve it, then press Check for XP. This step closes on your first Check.',
    until: 'check',
  },
]

function startTour(): void {
  const overlay = document.getElementById('tour') as HTMLDivElement
  let step = 0
  const title = document.getElementById('tour-title') as HTMLHeadingElement
  const body = document.getElementById('tour-body') as HTMLParagraphElement
  const dots = document.getElementById('tour-dots') as HTMLSpanElement
  const next = document.getElementById('tour-next') as HTMLButtonElement
  const finish = (): void => {
    overlay.style.display = 'none'
    localStorage.setItem('tour-done', '1')
    tourHooks.advance = undefined
  }
  const show = (): void => {
    const s = TOUR_STEPS[step]
    ;[title.textContent, body.textContent] = [s.title, s.body]
    dots.textContent = `${step + 1} / ${TOUR_STEPS.length}`
    next.textContent = s.until ? `Skip — do it myself` : step === TOUR_STEPS.length - 1 ? 'Start coding' : 'Next'
  }
  const advanceTo = (n: number): void => {
    step = n
    if (step >= TOUR_STEPS.length) {
      finish()
      return
    }
    show()
  }
  overlay.style.display = 'flex'
  show()
  next.onclick = () => advanceTo(step + 1)
  tourHooks.advance = (ev) => {
    if (overlay.style.display === 'flex' && TOUR_STEPS[step]?.until === ev) {
      blip(880, 0.08, 'sine', 0.06)
      advanceTo(step + 1)
    }
  }
}
// tour is triggered by beginSession (after the splash) — not on a timer

