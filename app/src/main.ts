import { Application, Container } from 'pixi.js'
import { invoke as tauriInvoke } from '@tauri-apps/api/core'
import { EditorView } from '@codemirror/view'
import { createCodeMirrorEditor, type CadeEditor } from './editor'
import { blip, blipError, blipSuccess } from './utils/audio'
import { interpretC, type TraceStep } from './tracer'
import { installPerfHooks } from './perf-audit'
import { initExtensions } from './extensions'

// Debug log overlay — gated, capped, non-recursive.
const DEBUG_LOG_MAX = 200
let debugLogLines = 0

function appendDebugLine(msg: string): void {
  const el = document.getElementById('debug-log-content')
  const overlay = document.getElementById('debug-log')
  if (!el || !overlay) return
  if (overlay.style.display !== 'block' && !overlay.classList.contains('open')) return
  const line = document.createElement('div')
  line.textContent = msg
  el.appendChild(line)
  debugLogLines++
  while (debugLogLines > DEBUG_LOG_MAX && el.firstChild) {
    el.removeChild(el.firstChild)
    debugLogLines--
  }
  el.scrollTop = el.scrollHeight
}

const origLog = console.log.bind(console)
const origError = console.error.bind(console)
console.log = (...args) => {
  origLog(...args)
  appendDebugLine(args.map(a => (typeof a === 'object' ? safeJson(a) : String(a))).join(' '))
}
console.error = (...args) => {
  origError(...args)
  appendDebugLine('ERROR: ' + args.map(a => (typeof a === 'object' ? safeJson(a) : String(a))).join(' '))
}

function safeJson(a: unknown): string {
  try { return JSON.stringify(a) } catch { return String(a) }
}

// IPC observability (temporary diagnostics, RUN 43): count calls/pending per
// command so hangs are attributable from the page itself. Ring-capped.
const IPC_LOG_MAX = 400
const ipcStats: Record<string, { calls: number; pending: number; errs: number }> = {}
;(window as unknown as { __ipc?: unknown }).__ipc = ipcStats
const ipcLog: string[] = []
;(window as unknown as { __ipcLog?: unknown }).__ipcLog = ipcLog
function ipcPush(line: string): void {
  ipcLog.push(line)
  if (ipcLog.length > IPC_LOG_MAX) ipcLog.splice(0, ipcLog.length - IPC_LOG_MAX)
}
function invoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  const rec = (ipcStats[cmd] ??= { calls: 0, pending: 0, errs: 0 })
  rec.calls++
  rec.pending++
  const t0 = Math.round(performance.now())
  ipcPush(`+${t0}ms call ${cmd}`)
  const p = tauriInvoke<T>(cmd, args)
  p.then(
    () => {
      rec.pending--
      ipcPush(`+${Math.round(performance.now())}ms ok   ${cmd} (${Math.round(performance.now()) - t0}ms)`)
    },
    () => {
      rec.pending--
      rec.errs++
      ipcPush(`+${Math.round(performance.now())}ms ERR  ${cmd}`)
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
  hitTestHeader,
  flatten,
  type BBlock,
  type CNodeJSON,
  type CTreeJSON,
} from './blocks'
import { History } from './history'
import { applyEdit } from './ops'
import { pickAnchor, caretOffset, type CaretAnchor } from './caret'
import { type ViewMode, type Diag, type SlotHit } from './types'
import { initPanZoom } from './pan-zoom'
import { initExitAlert } from './exit-alert'
import { initKeybindings } from './keybindings'
import { initFileDrop } from './file-drop'
import { initStageRun } from './stage-run'
import { renderPaletteFull } from './palette-render'
import { renderDiagList as renderDiagListMod, refreshDiags as refreshDiagsMod, getLastDiags } from './diagnostics'
import { scheduleAutoSave as scheduleAutoSaveImpl, recoverSession as recoverSessionImpl } from './autosave'
import { startHtmlDrag as startHtmlDragImpl, type DragPayload } from './drag-drop'
import { initDebugHooks } from './debug-hooks'
import { drawBlock as drawBlockImpl } from './block-draw'
import { normalizeTreeOffsets, normalizeDiagOffsets } from './utils/offsets'
import { initSlotEditor, commitSlotValue as commitSlotValueFn, slotAt as slotAtFn, openSlotEditor as openSlotEditorImpl } from './inline-slot-editor'
import { initKbdPalette, applyPalFilter } from './kbd-palette'
import { initAcademy, renderPaletteLocks, getAppMode, getProfile, setMode } from './academy'
import {
  validateVarName,
  type SourceLang,
} from './palette'
import { registerCommands, togglePalette } from './palette-cmd'
import './style.css'
import { registerContextMenuProvider, initContextMenu } from './context-menu'
import { initResizers } from './resize'
import { initConsole } from './ui/console'
import { initDialogs } from './ui/dialogs'
import { icons } from './ui/icons'
import {
  langOf,
  isWinPath,
  baseName,
  dirName,
  normSlashes,
  esc,
  readJsonStore,
  writeJsonStore,
  readSetting,
} from './utils/pure'
import { SAMPLES, NEW_TEMPLATES } from './lang-data'
import { startTour, tourHooks } from './tour'
import { restoreWindowState, debouncedSaveState } from './window-state'
import { wireSplash, type RecentEntry } from './splash'
import { initEditorKeys } from './editor-keys'

const srcEl = document.getElementById('src') as HTMLTextAreaElement
const statusEl = document.getElementById('status') as HTMLSpanElement
const hostEl = document.getElementById('canvas-host') as HTMLDivElement
const consoleEl = document.getElementById('console') as HTMLPreElement
const consoleInputRow = document.getElementById('console-input-row') as HTMLDivElement
const consoleInput = document.getElementById('console-input') as HTMLInputElement
const paletteEl = document.getElementById('palette') as HTMLDivElement
const tabsEl = document.getElementById('tabs') as HTMLDivElement
const filesEl = document.getElementById('files') as HTMLDivElement
const cmContainer = document.getElementById('cm-editor') as HTMLDivElement

// ---- CodeMirror 6 editor ----
let editor: CadeEditor | null = null

function initEditor(): void {
  const dark = document.documentElement.getAttribute('data-theme') === 'dark'
  editor = createCodeMirrorEditor(cmContainer, src, activeLang, dark)
  editor.onUpdate = (newSrc: string) => {
    if (srcSetting) return
    src = newSrc
    srcEl.value = newSrc
    hist.push(prevSrcForUndo, 'type')
    prevSrcForUndo = newSrc
    lastPaintedSrc = null
    void scheduleRender(newSrc)
    markDirty()
    scheduleAutoSave()
  }
}
let prevSrcForUndo = ''

const app = new Application()
await app.init({ resizeTo: hostEl, background: '#dff3fa', antialias: true })
hostEl.appendChild(app.canvas)
const world = new Container()
app.stage.addChild(world)
const overlay = new Container()
app.stage.addChild(overlay)
const snapLayer = new Container()

// Handle window maximize/restore - force PixiJS resize
let resizeTimer = 0
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer)
  resizeTimer = window.setTimeout(() => {
    app.renderer.resize(hostEl.clientWidth, hostEl.clientHeight)
    void render(src)
  }, 50)
})

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

// Toast notification system — standard desktop app feedback
import { toast } from './ui/toasts'

const fileCache = new Map<string, string>()
const savedCache = new Map<string, string>()
let files: string[] = []
let workspace: string | null = null
/** Buffer content as last LOADED or explicitly SAVED — the dirty baseline
 *  for title dots, discard guards, and the close-time checkpoint. */
let savedSnapshot = ''
let activePath: string | null = null

// ---- Auto-save: debounced persist to localStorage every 2s (extracted to autosave.ts) ----
const autosaveDeps = {
  activePath: () => activePath,
  src: () => src,
  setSrc: (s: string) => setSrc(s),
  activeLang: () => activeLang,
  setActiveLang: (l: SourceLang) => { activeLang = l },
  get editor() { return editor },
  render: (s: string) => render(s),
  markDirty,
  isClean: () => !isMeaningfullyDirty(),
}
function scheduleAutoSave(): void { scheduleAutoSaveImpl(autosaveDeps) }
function recoverSession(): void { recoverSessionImpl(autosaveDeps) }

initExitAlert({
  src: () => src,
  activePath: () => activePath,
  savedSnapshot: () => savedSnapshot,
  activeLang: () => activeLang,
})

// Multi-language packs (D11): language rides with the FILE
type Lang = SourceLang

/** Apply all saved settings to the editor on startup */
function applySettings(): void {
  srcEl.style.fontSize = `${readSetting('fontSize', '13')}px`
  srcEl.style.fontFamily = `'${readSetting('fontFamily', 'Consolas')}', monospace`
  srcEl.style.lineHeight = readSetting('lineHeight', '1.5')
  srcEl.style.whiteSpace = readSetting('wordWrap', false) ? 'pre-wrap' : 'pre'
  srcEl.style.tabSize = String(readSetting('tabSize', '4'))
  // Line numbers, bracket matching, etc. are visual-only in a textarea —
  // they take effect when the palette/settings panel renders next.
}
let activeLang: Lang = 'c'

let src = SAMPLES[activeLang]
let roots: BBlock[] = []
const hist = new History()

// ── trace mode state ──
let traceMode = false
let traceSteps: TraceStep[] = []
let traceIdx = -1
let tracePlayTimer: ReturnType<typeof setInterval> | null = null

let slotHits: SlotHit[] = []
/** Per-root draw cache: unchanged top-level statements reuse their Pixi
 *  subtree across renders (Text rasterization is the dominant per-keystroke
 *  cost); replaced subtrees are destroyed instead of leaked. */
interface RootDrawEntry { wrap: Container; hits: SlotHit[] }
let rootDrawCache = new Map<string, RootDrawEntry>()

function markDirty(): void {
  const dirty = activePath !== null && isMeaningfullyDirty()
  for (const t of Array.from(tabsEl.children) as HTMLElement[]) {
    if (t.dataset.path === activePath) t.classList.toggle('dirty', dirty)
    t.classList.toggle('active', t.dataset.path === activePath)
  }
  updateTitle()
  updateTabsHeight()
}

/** True when the buffer differs from its load/save baseline in a way that
 *  matters. Trailing-newline / indent-only drift does not count. The
 *  empty-buffer and sample exemptions exist for the scratch buffer — a real
 *  file that was emptied (or legitimately equals a sample) IS dirty. */
function isMeaningfullyDirty(): boolean {
  if (activePath === null && (src.trim().length === 0 || src === SAMPLES[activeLang])) return false
  const baseline =
    activePath !== null
      ? (savedCache.get(activePath) ?? savedSnapshot)
      : savedSnapshot
  if (src === baseline) return false
  if (src.trimEnd() === baseline.trimEnd()) return false
  return true
}

function updateTabsHeight(): void {
  const mainCol = document.getElementById('main-col')
  if (mainCol) mainCol.style.setProperty('--tabs-h', `${tabsEl.offsetHeight}px`)
}

let srcSetting = false // guard: prevents input listener from double-counting undo
function setSrc(next: string, kind: 'op' | 'type' = 'op'): Promise<void> {
  hist.push(src, kind)
  src = next
  srcSetting = true
  srcEl.value = next
  editor?.setSource(next)
  srcSetting = false
  lastPaintedSrc = null
  const p = scheduleRender(next)
  markDirty()
  scheduleAutoSave() // formatting/programmatic rewrites persist too
  return p
}

// Latest-wins rendering (IMPROVEMENT-PLAN #1): edits that land while a parse
// is in flight bump the generation; the stale render aborts instead of
// painting an older program than the textarea shows, and the finally-clause
// re-renders the newest buffer so nothing is ever silently skipped.
// Bursty keystrokes are coalesced onto one rAF; identical buffers skip paint.
let renderGen = 0
let lastPaintedSrc: string | null = null
let renderRaf = 0
let pendingRenderSrc: string | null = null

/** While a rAF is pending, every caller awaits the SAME final render —
 *  the old early-return resolved immediately, so `await setSrc(...)` in
 *  canonicalize resumed before the new tree existed (caret raced the parse). */
let renderSettling: Promise<void> = Promise.resolve()

function scheduleRender(source: string): Promise<void> {
  pendingRenderSrc = source
  if (renderRaf) return renderSettling
  renderSettling = new Promise((resolve) => {
    renderRaf = requestAnimationFrame(() => {
      renderRaf = 0
      const next = pendingRenderSrc
      pendingRenderSrc = null
      if (next === null) { resolve(); return }
      void render(next).then(resolve)
    })
  })
  return renderSettling
}

async function render(source: string): Promise<void> {
  if (source === lastPaintedSrc) return
  const gen = ++renderGen
  try {
    const out = await invoke<{ tree: CTreeJSON; has_errors: boolean }>('parse_c', {
      src: source,
      lang: activeLang,
    })
    if (gen !== renderGen) return // superseded — a newer parse owns the canvas
    // parser speaks UTF-8 bytes; the whole edit surface speaks UTF-16 units
    normalizeTreeOffsets(out.tree, source)
    roots = buildBlocks(out.tree)
    layoutStack(roots, 40, 40)
    // palette reflects the program: harvested vars + node kinds/includes
    // (dependency-gated chips re-evaluate when the signature changes)
    const kinds = new Set<string>()
    const includes = new Set<string>()
    const walkSig = (n: { kind: string; children: unknown[] }): void => {
      kinds.add(n.kind)
      for (const c of n.children as never[]) walkSig(c as never)
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
    walkSig(out.tree.root as never)
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
    const themeTag = document.documentElement.dataset.theme === 'dark' ? 'd' : 'l'
    const nextCache = new Map<string, RootDrawEntry>()
    let drew = false
    try {
      for (const b of roots) {
        // container/nodeKind participate: a same-span parse can flip the
        // body rule, and reused slot hits must rebind to THIS parse's node
        const key = `${themeTag}|${activeLang}|${b.cat}|${b.sticky ? 's' : 'b'}|${b.container ? 'C' : 'S'}|${b.nodeKind}|${b.start}:${b.end}:${b.x}:${b.y}|${source.slice(b.start, b.end)}`
        const reuse = rootDrawCache.get(key)
        if (reuse) {
          world.addChild(reuse.wrap)
          slotHits.push(...reuse.hits.map((h) => ({ ...h, block: b })))
          nextCache.set(key, reuse)
        } else {
          const wrap = new Container()
          const hits: SlotHit[] = []
          drawBlockImpl({ world: wrap, slotHits: hits, attachHeaderEvents, onSlotHit: () => {} }, b)
          world.addChild(wrap)
          nextCache.set(key, { wrap, hits })
        }
      }
      drew = true
    } finally {
      if (drew) {
        for (const [k, e] of rootDrawCache) {
          if (!nextCache.has(k)) e.wrap.destroy({ children: true })
        }
        rootDrawCache = nextCache
      } else {
        // mid-loop throw: destroy freshly created wraps (they were attached
        // to world but are unknown to rootDrawCache — the next render's diff
        // would leak them); reused entries stay live for the next render
        for (const [k, e] of nextCache) {
          if (!rootDrawCache.has(k)) e.wrap.destroy({ children: true })
        }
      }
    }
    world.addChild(overlay)
    world.addChild(snapLayer)
    lastPaintedSrc = source
    document.getElementById('canvas-empty')?.toggleAttribute('hidden', roots.length > 0)
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
    // snapshot the buffer+lang: a blur-triggered canonicalize that resolves
    // after a tab/lang switch must NOT write into the NEW document
    const buf = src
    const lang = activeLang
    const clean = await invoke<string>('canonicalize_c', { src: buf, lang })
    if (clean !== buf || src !== buf || activeLang !== lang) {
      if (src !== buf) return // buffer moved on — nothing to format anymore
      // Formatting rewrites the buffer UNDER the user — map the caret onto
      // the freshly parsed tree WITHOUT stealing focus from wherever they went.
      // caret source of truth is CodeMirror (the hidden textarea's
      // selection is permanently 0 for CM users)
      const caretPos = editor ? editor.view.state.selection.main.head : (srcEl.selectionStart ?? 0)
      const anchor = pickAnchor(roots, caretPos)
      await setSrc(clean) // resolves AFTER the new tree is laid out
      // roots now reflect the formatted source — map the caret immediately
      try {
        const pos = Math.max(0, Math.min(src.length, caretOffset(roots, src.length, anchor)))
        srcEl.setSelectionRange(pos, pos)
        editor?.view.dispatch({ selection: { anchor: pos } })
      } catch {
        /* anchor no longer resolvable — leave caret */
      }
    }
  } catch {
    /* keep as-is */
  }
  void refreshDiags()
}

// ------------------------------------------------ diagnostics panel (#10)
function renderDiagList(ds: Diag[]): void {
  renderDiagListMod({ roots: () => roots, overlay, src: () => src, srcEl, activeLang: () => activeLang, setView, invoke }, ds)
}

async function refreshDiags(): Promise<void> {
  await refreshDiagsMod({
    roots: () => roots,
    overlay,
    src: () => src,
    srcEl,
    activeLang: () => activeLang,
    setView,
    // diagnostics arrive in byte offsets like the parse tree — convert at
    // the boundary so jump/overlay math runs in UTF-16 units
    invoke: async <T>(cmd: string, args?: Record<string, unknown>): Promise<T> => {
      const res = await invoke<T>(cmd, args as never)
      if (cmd === 'diag_c') normalizeDiagOffsets(res as Diag[], src)
      return res
    },
  })
}

function screenToWorld(ox: number, oy: number): { x: number; y: number } {
  return { x: (ox - world.x) / world.scale.x, y: (oy - world.y) / world.scale.y }
}

// ---- Drag-and-drop (extracted to drag-drop.ts) ----
const dragDropDeps = {
  hostEl,
  world,
  snapLayer,
  ghost,
  dropbar,
  consoleEl,
  screenToWorld,
  slotHits: () => slotHits,
  roots: () => roots,
  src: () => src,
  setSrc: (s: string) => setSrc(s),
  canonicalize: () => canonicalize(),
  activeLang: () => activeLang,
  commitSlotValue,
  renderSettled: () => lastPaintedSrc === src,
  tourHooks,
}
function startHtmlDrag(e: PointerEvent, payload: DragPayload): void {
  startHtmlDragImpl(dragDropDeps, e, payload)
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
const slotEditorDeps = {
  slotHits: () => slotHits,
  src: () => src,
  // the REAL setSrc: the old inline clone bypassed history/dirty/render
  setSrc: (s: string) => { void setSrc(s, 'type') },
  canonicalize: () => canonicalize(),
  hostEl,
  world,
  screenToWorld,
  roots: () => roots,
  renderSettled: () => lastPaintedSrc === src,
}
initSlotEditor(slotEditorDeps)

function commitSlotValue(s: SlotHit, raw: string): string | null {
  return commitSlotValueFn(slotEditorDeps, s, raw)
}

function openSlotEditor(s: SlotHit): void {
  openSlotEditorImpl(slotEditorDeps, s)
}

function slotAt(b: BBlock, wx: number, wy: number): SlotHit | null {
  return slotAtFn(slotEditorDeps, b, wx, wy)
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
  if (lastPaintedSrc !== src) return // stale tree — offsets not trustworthy
  setSrc(applyEdit(hit, replacement)(src))
  void canonicalize()
})

document.getElementById('run')?.addEventListener('click', () => {
  if (traceMode) {
    void startTraceRun()
  } else {
    void startRun()
  }
})

// ── trace panel wiring ──
const tracePanelEl = document.getElementById('trace-panel') as HTMLDivElement
const traceStepInfo = document.getElementById('trace-step-info') as HTMLSpanElement
const tracePlayBtn = document.getElementById('trace-play') as HTMLButtonElement
const traceStepBtn = document.getElementById('trace-step') as HTMLButtonElement
const traceResetBtn = document.getElementById('trace-reset') as HTMLButtonElement
const traceVarsEl = document.getElementById('trace-vars') as HTMLDivElement
const traceOutputEl = document.getElementById('trace-output') as HTMLPreElement
const traceSpeedSlider = document.getElementById('trace-speed-slider') as HTMLInputElement
const traceSpeedLabel = document.getElementById('trace-speed-label') as HTMLSpanElement
const traceCheckEl = document.getElementById('trace-check') as HTMLInputElement

function traceShowStep(idx: number): void {
  if (idx < 0 || idx >= traceSteps.length) return
  traceIdx = idx
  const step = traceSteps[idx]
  const total = traceSteps.length
  traceStepInfo.textContent = step.error
    ? `Error: ${step.error} (line ${step.line})`
    : `Step ${idx + 1}/${total} · line ${step.line} · ${step.kind}`
  traceStepInfo.style.color = step.error ? '#e06c75' : ''

  // highlight current line in editor
  if (editor && step.line > 0) {
    const line = editor.view.state.doc.line(step.line)
    editor.view.dispatch({
      selection: { anchor: line.from },
      effects: EditorView.scrollIntoView(line.from, { y: 'center' }),
    })
  }

  // update variable display
  const prevVars = traceIdx > 0 ? traceSteps[traceIdx - 1].vars : {}
  const keys = Object.keys(step.vars).sort()
  let varsHtml = ''
  for (const k of keys) {
    const val = step.vars[k]
    const changed = traceIdx > 0 && k in prevVars && prevVars[k] !== val
    const valStr = typeof val === 'number'
      ? (Number.isInteger(val) ? String(val) : val.toFixed(4).replace(/0+$/, '').replace(/\.$/, '.0'))
      : String(val)
    varsHtml += `<div class="trace-var-row"><span class="trace-var-name">${esc(k)}</span><span class="trace-var-val${changed ? ' trace-var-changed' : ''}">${esc(valStr)}</span></div>`
  }
  traceVarsEl.innerHTML = varsHtml || '<div style="color:var(--fg-dim);padding:4px 0">no variables</div>'

  // update output display
  if (step.output) {
    traceOutputEl.textContent = step.output
    traceOutputEl.scrollTop = traceOutputEl.scrollHeight
  }
}

function traceStop(): void {
  if (tracePlayTimer !== null) { clearInterval(tracePlayTimer); tracePlayTimer = null }
  tracePlayBtn.innerHTML = icons.play
}

function tracePlay(): void {
  if (tracePlayTimer !== null) { traceStop(); return }
  tracePlayBtn.innerHTML = icons.pause
  const delay = Math.max(20, 520 - Number(traceSpeedSlider.value) * 50)
  tracePlayTimer = setInterval(() => {
    if (traceIdx >= traceSteps.length - 1) { traceStop(); return }
    traceShowStep(traceIdx + 1)
  }, delay)
}

function traceReset(): void {
  traceStop()
  traceIdx = -1
  traceSteps = []
  traceStepInfo.textContent = 'Ready'
  traceVarsEl.innerHTML = ''
  traceOutputEl.textContent = ''
}

tracePlayBtn.addEventListener('click', tracePlay)
traceStepBtn.addEventListener('click', () => { traceStop(); if (traceIdx < traceSteps.length - 1) traceShowStep(traceIdx + 1) })
traceResetBtn.addEventListener('click', traceReset)
traceSpeedSlider.addEventListener('input', () => {
  traceSpeedLabel.textContent = traceSpeedSlider.value
  if (tracePlayTimer !== null) { traceStop(); tracePlay() }
})

traceCheckEl.addEventListener('change', () => {
  traceMode = traceCheckEl.checked
  tracePanelEl.style.display = traceMode ? 'flex' : 'none'
  window.dispatchEvent(new Event('resize'))
  if (!traceMode) traceReset()
})

async function startTraceRun(): Promise<void> {
  consoleEl.textContent = 'tracing...'
  traceReset()
  const parsed = await invoke<{ tree: CTreeJSON; has_errors: boolean }>('parse_c', { src, lang: activeLang })
  const result = interpretC(src, parsed.tree.root)
  traceSteps = result.steps
  if (traceSteps.length === 0) {
    traceStepInfo.textContent = 'No steps captured'
    consoleEl.textContent = 'trace: no execution steps'
    return
  }
  consoleEl.textContent = `trace: ${traceSteps.length} steps`
  traceShowStep(0)
}

// ------------------------------------------------------- stage panel + run (extracted to stage-run.ts)
const stageCanvas = document.getElementById('stage') as HTMLCanvasElement
const stageCtx = stageCanvas.getContext('2d') as CanvasRenderingContext2D
const stopBtn = document.getElementById('stage-stop') as HTMLButtonElement
const fpsEl = document.getElementById('stage-fps') as HTMLSpanElement
const { startRun, stopRun, getRunning } = initStageRun({
  consoleEl,
  consoleInputRow,
  stopBtn,
  fpsEl,
  stageCanvas,
  stageCtx,
  src: () => src,
  activeLang: () => activeLang,
  viewMode: () => viewMode,
  setView,
  statusEl,
  tourHooks,
})

// ------------------------------------------------------- console stdin box
initConsole(consoleEl, consoleInput)

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
    blipSuccess()
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

// ---- generic context menu providers (context-menu.ts) ----
registerContextMenuProvider((target) => {
  if (!target.closest('#canvas-host')) return []
  return [
    { label: 'Undo', shortcut: 'Ctrl+Z', action: () => { const p = hist.undo(src); if (p !== null) { src = p; srcEl.value = p; srcSetting = true; editor?.setSource(p); srcSetting = false; void render(p); markDirty(); scheduleAutoSave() } } },
    { label: 'Redo', shortcut: 'Ctrl+Y', action: () => { const n = hist.redo(src); if (n !== null) { src = n; srcEl.value = n; srcSetting = true; editor?.setSource(n); srcSetting = false; void render(n); markDirty(); scheduleAutoSave() } } },
    { divider: true, label: '' },
    { label: 'Select All', shortcut: 'Ctrl+A', action: () => { /* select all blocks */ } },
  ]
})

registerContextMenuProvider((target) => {
  if (!target.closest('#editor-wrap') && !target.closest('#cm-editor')) return []
  return [
    { label: 'Cut', shortcut: 'Ctrl+X', action: () => document.execCommand('cut') },
    { label: 'Copy', shortcut: 'Ctrl+C', action: () => document.execCommand('copy') },
    { label: 'Paste', shortcut: 'Ctrl+V', action: () => document.execCommand('paste') },
    { divider: true, label: '' },
    { label: 'Undo', shortcut: 'Ctrl+Z', action: () => document.execCommand('undo') },
    { label: 'Redo', shortcut: 'Ctrl+Y', action: () => document.execCommand('redo') },
  ]
})


// ------------------------------------------------------------- workspace/tabs
// Documents are either workspace-RELATIVE (a folder is open) or ABSOLUTE
// (standalone file via New/Open/Save As). One path shape per doc; fsRead/
// fsWrite route on which shape the path is.
const asRelInWorkspace = (abs: string): string | null => {
  if (workspace === null) return null
  const w = normSlashes(workspace).replace(/\/$/, '').toLowerCase() + '/'
  const n = normSlashes(abs)
  return n.toLowerCase().startsWith(w) ? n.slice(w.length) : null
}
async function fsRead(p: string): Promise<string> {
  try {
    return workspace !== null && !isWinPath(p)
      ? await invoke<string>('read_file', { root: workspace, rel: p })
      : await invoke<string>('read_abs', { path: p })
  } catch (err) {
    console.error('[fsRead] ERROR:', err)
    throw err
  }
}
async function fsWrite(p: string, c: string): Promise<void> {
  if (workspace !== null && !isWinPath(p)) {
    await invoke('write_file', { root: workspace, rel: p, content: c })
  } else {
    await invoke('write_abs', { path: p, content: c })
  }
}

async function refreshFiles(): Promise<void> {
  const filesSection = document.getElementById('files-section')
  if (!workspace) {
    filesSection?.classList.add('is-empty')
    return
  }
  filesSection?.classList.remove('is-empty')
  console.log('[refreshFiles] workspace:', workspace)
  filesEl.innerHTML = '<div class="file-dir" style="color:var(--c-accent);">Loading...</div>'
  try {
    files = await invoke<string[]>('list_c_files', { root: workspace })
    console.log('[refreshFiles] files:', files)
  } catch (err) {
    console.error('[refreshFiles] ERROR:', err)
    files = []
  }
  filesEl.innerHTML = ''

  if (files.length === 0) {
    const emptyEl = document.createElement('div')
    emptyEl.className = 'file-dir'
    emptyEl.style.cssText = 'color:var(--fg-dim);font-style:italic;padding:8px 14px;'
    emptyEl.textContent = 'No source files found'
    filesEl.appendChild(emptyEl)
    return
  }

  // Group files by directory for tree view
  const fileMap = new Map<string, string[]>()
  for (const f of files) {
    const dir = f.includes('/') ? f.substring(0, f.lastIndexOf('/')) : ''
    if (!fileMap.has(dir)) fileMap.set(dir, [])
    fileMap.get(dir)!.push(f)
  }

  // Sort directories (root first, then alphabetically)
  const sortedDirs = Array.from(fileMap.keys()).sort((a, b) => {
    if (a === '') return -1
    if (b === '') return 1
    return a.localeCompare(b)
  })

  for (const dir of sortedDirs) {
    const dirFiles = fileMap.get(dir)!.sort()
    if (dir) {
      const dirEl = document.createElement('div')
      dirEl.className = 'file-dir'
      dirEl.style.cssText = 'padding:4px 8px;font-size:11px;color:var(--fg-dim);font-weight:600;text-transform:uppercase;letter-spacing:0.5px;border-bottom:1px solid var(--border);margin-top:8px'
      dirEl.textContent = dir
      filesEl.appendChild(dirEl)
    }
    for (const f of dirFiles) {
      const el = document.createElement('div')
      el.className = 'file'
      el.textContent = f
      el.dataset.path = f
      if (activePath === f) el.classList.add('active')
      el.addEventListener('click', () => void guardedOpenTab(f))
      filesEl.appendChild(el)
    }
  }
}

function createTab(path: string, content: string): void {
  // Save-As onto an already-open path must not duplicate the tab element
  const dup = Array.from(tabsEl.children).find((t) => (t as HTMLElement).dataset.path === path)
  dup?.remove()
  fileCache.set(path, content)
  savedCache.set(path, content)
  // cache cap (#7): open docs are the hot set — evict the coldest entries,
  // but never an entry backing an open tab: activateTab falls back to ''
  // on a miss, which would show an empty buffer marked as clean
  const openPaths = new Set(
    Array.from(tabsEl.children).map((t) => (t as HTMLElement).dataset.path),
  )
  for (const key of fileCache.keys()) {
    if (fileCache.size <= 64) break
    if (key !== path && key !== activePath && !openPaths.has(key)) {
      fileCache.delete(key)
      savedCache.delete(key)
    }
  }
  const tab = document.createElement('div')
  tab.className = 'tab'
  tab.dataset.path = path
  tab.title = path
  const label = document.createElement('span')
  label.className = 'tab-label'
  label.textContent = baseName(path)
  const x = document.createElement('span')
  x.className = 'tab-x'
  x.textContent = '×'
  x.title = 'Close (Ctrl+W)'
  x.addEventListener('click', (e) => {
    e.stopPropagation()
    void closeTab(path)
  })
  tab.append(label, x)
  tab.addEventListener('click', () => void guardedOpenTab(path))
  tab.addEventListener('auxclick', (e) => {
    if ((e as MouseEvent).button === 1) {
      e.preventDefault()
      void closeTab(path) // middle-click close (#9)
    }
  })
  tabsEl.appendChild(tab)
  activateTab(path)
}

/** Close a doc tab: discard-guard the ACTIVE one, evict its caches, and
 *  fall back to a fresh scratch buffer when no documents remain. */
async function closeTab(path: string): Promise<void> {
  const isActive = activePath === path
  if (isActive && !(await confirmDiscard())) return
  const el = Array.from(tabsEl.children).find((t) => (t as HTMLElement).dataset.path === path)
  el?.remove()
  fileCache.delete(path)
  savedCache.delete(path)
  localStorage.removeItem(`blockide-autosave:${path}`)
  tabViews.delete(path)
  if (!isActive) return
  const next = tabsEl.querySelector('.tab') as HTMLElement | null
  if (next?.dataset.path) {
    activateTab(next.dataset.path)
    return
  }
  activePath = null
  hist.reset()
  caretAnchor = null
  src = NEW_TEMPLATES[activeLang]
  savedSnapshot = src
  srcEl.value = src
  editor?.setSource(src)
  prevSrcForUndo = src
  hist.reset()
  // a pristine template is not a recovery candidate — the pending autosave
  // tick would otherwise persist it and resurrect a spurious toast on boot
  localStorage.removeItem('blockide-autosave:scratch')
  void render(src)
  markDirty()
  consoleEl.textContent = 'closed — New File or Open Folder to continue'
  // Clear file explorer active highlight
  filesEl.querySelectorAll('.file.active').forEach(el => el.classList.remove('active'))
}

/** Unsaved-changes gate for every navigation that would REPLACE the buffer.
 *  Uses the same meaningful-dirty rule as the title dots — cursor moves and
 *  whitespace-only drift never nag. */
async function confirmDiscard(): Promise<boolean> {
  if (!isMeaningfullyDirty()) return true
  return await ask(`"${activePath ? baseName(activePath) : 'Untitled'}" has unsaved changes.\n\nDiscard them?`, {
    title: 'Unsaved changes',
    kind: 'warning',
  })
}

async function guardedOpenTab(path: string): Promise<void> {
  console.log('[guardedOpenTab] path:', path)
  if (!(await confirmDiscard())) {
    console.log('[guardedOpenTab] discard cancelled')
    return
  }
  await openTab(path)
}

async function openTab(rel: string): Promise<void> {
  console.log('[openTab] rel:', rel, 'existing tabs:', Array.from(tabsEl.children).map(t => (t as HTMLElement).dataset.path))
  if (Array.from(tabsEl.children).some((t) => (t as HTMLElement).dataset.path === rel)) {
    console.log('[openTab] tab exists, activating')
    activateTab(rel)
    return
  }
  try {
    const content = fileCache.get(rel) ?? (await fsRead(rel))
    createTab(rel, content)
    if (workspace !== null && !isWinPath(rel)) pushRecent(workspace, rel)
    else if (isWinPath(rel)) pushRecent(dirName(rel), baseName(rel))
  } catch (err) {
    console.error('[openTab] ERROR:', err)
    toast(`Failed to open file: ${err}`, 'error')
  }
}

function activateTab(rel: string): void {
  console.log('[activateTab] rel:', rel, 'activePath:', activePath)
  if (activePath === rel) return
  hist.reset()
  caretAnchor = null // different buffer — old node ids are meaningless here
  activePath = rel
  activeLang = langOf(rel) as Lang
  editor?.setLang(activeLang)
  src = fileCache.get(rel) ?? ''
  savedSnapshot = src // fresh load = clean baseline
  srcSetting = true // suppress onUpdate from setSource (false dirty / undo push)
  srcEl.value = src
  editor?.setSource(src)
  srcSetting = false
  prevSrcForUndo = src // a fresh buffer — the previous tab's doc must never become its undo target
  renderPalette()
  lastPaintedSrc = null
  void scheduleRender(src)
  markDirty()
  setView(tabViews.get(rel) ?? 'split')
  filesEl.querySelectorAll('.file.active').forEach(el => el.classList.remove('active'))
  const activeFileEl = filesEl.querySelector(`.file[data-path="${rel}"]`)
  if (activeFileEl) activeFileEl.classList.add('active')
}

// ---- Open… toolbar menu ----
const openMenu = document.getElementById('open-menu')
const openBtn = document.getElementById('open-btn') as HTMLButtonElement | null
const openPop = openMenu?.querySelector<HTMLDivElement>('.menu-pop') ?? null

function setOpenMenu(open: boolean): void {
  if (!openPop || !openBtn) return
  openPop.classList.toggle('open', open)
  openBtn.setAttribute('aria-expanded', String(open))
}
openBtn?.addEventListener('click', () => {
  setOpenMenu(!openPop?.classList.contains('open'))
})
document.addEventListener('click', (e) => {
  if (openMenu && !openMenu.contains(e.target as Node)) setOpenMenu(false)
})
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') setOpenMenu(false)
})
openPop?.querySelectorAll('.menu-item').forEach((item) => {
  item.addEventListener('click', () => setOpenMenu(false))
})

document.getElementById('open-folder')?.addEventListener('click', async () => {
  console.log('[open-folder] clicked')
  try {
    if (!(await confirmDiscard())) return
    const dir = await openDialog({
      directory: true,
      multiple: false,
      title: 'Open Folder',
      recursive: true,
    })
    console.log('[open-folder] selected dir:', dir)
    if (typeof dir !== 'string' || !dir) return
    workspace = normSlashes(dir)
    tabsEl.innerHTML = ''
    fileCache.clear()
    savedCache.clear()
    activePath = null
    await refreshFiles()
    consoleEl.textContent = `workspace: ${workspace}`
    toast(`Opened ${baseName(workspace)}`, 'success')
  } catch (err) {
    console.error('[open-folder] ERROR:', err)
    toast(`Open Folder failed: ${err}`, 'error')
  }
})

// Standalone documents: New File and Open File work with NO folder open —
// a native dialog picks the location (VS Code-style), the doc opens as its
// own tab, and recents remember it.
document.getElementById('open-file')?.addEventListener('click', async () => {
  if (!(await confirmDiscard())) return
  const picked = await openDialog({
    multiple: false,
    filters: [
      { name: 'Source files', extensions: ['c', 'cpp', 'cc', 'cxx', 'hpp', 'hh', 'py', 'js', 'mjs', 'ts', 'tsx', 'rs', 'go', 'java'] },
      { name: 'All files', extensions: ['*'] },
    ],
  })
  if (typeof picked !== 'string' || !picked) return
  const rel = asRelInWorkspace(picked)
  await openTab(rel ?? normSlashes(picked))
})

let untitledSeq = 0

document.getElementById('new-file')?.addEventListener('click', async () => {
  try {
    if (!(await confirmDiscard())) return
    const lang = await new Promise<string | null>((resolve) => {
      const modal = document.createElement('div')
      modal.className = 'dialog-overlay open'
      modal.setAttribute('role', 'dialog')
      modal.setAttribute('aria-modal', 'true')
      modal.setAttribute('aria-label', 'New file language')
      modal.innerHTML = `
        <div class="dialog" style="width: 340px;">
          <div class="dialog-header"><span class="dialog-title">New File</span></div>
          <div class="dialog-body">
            <label class="settings-label" for="new-lang" style="display:block;margin-bottom:var(--sp-2);">Language</label>
            <select id="new-lang" class="select">
              <option value="c">C</option><option value="cpp">C++</option>
              <option value="python">Python</option><option value="javascript">JavaScript</option>
              <option value="rust">Rust</option><option value="go">Go</option>
              <option value="java">Java</option><option value="typescript">TypeScript</option>
            </select>
          </div>
          <div class="dialog-footer">
            <button id="lang-cancel" type="button" class="btn">Cancel</button>
            <button id="lang-ok" type="button" class="btn btn-primary">Create</button>
          </div>
        </div>
      `
      document.body.appendChild(modal)
      const select = modal.querySelector('#new-lang') as HTMLSelectElement
      const okBtn = modal.querySelector('#lang-ok') as HTMLButtonElement
      const cancelBtn = modal.querySelector('#lang-cancel') as HTMLButtonElement
      const cleanup = () => modal.remove()
      cancelBtn.onclick = () => { cleanup(); resolve(null) }
      okBtn.onclick = () => { cleanup(); resolve(select.value) }
      modal.onclick = (e) => { if (e.target === modal) { cleanup(); resolve(null) } }
      select.focus()
    })
    if (!lang) return
    const extMap: Record<string, string> = { c: '.c', cpp: '.cpp', python: '.py', javascript: '.js', rust: '.rs', go: '.go', java: '.java', typescript: '.ts' }
    const content = NEW_TEMPLATES[lang as SourceLang]
    const path = `untitled-${++untitledSeq}${extMap[lang] ?? '.c'}`
    activeLang = lang as Lang
    editor?.setLang(activeLang)
    renderPalette()
    createTab(path, content)
    savedSnapshot = content
    markDirty()
    statusFlash('New untitled buffer — Save to write it to disk')
  } catch (err) {
    console.error('[new-file] ERROR:', err)
    toast(`New File failed: ${err}`, 'error')
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

let lastWindowTitle = ''
function updateTitle(): void {
  const dirty = activePath !== null && isMeaningfullyDirty() ? ' •' : ''
  const name = activePath ? baseName(activePath) : 'Cade'
  const title = `${name}${dirty} - Cade`
  if (title === lastWindowTitle) return
  lastWindowTitle = title
  document.title = title
  getCurrentWindow().setTitle(title).catch(() => {})
}

function extForLang(lang: Lang): string {
  const map: Record<string, string> = {
    c: '.c', cpp: '.cpp', python: '.py', javascript: '.js',
    rust: '.rs', go: '.go', java: '.java', typescript: '.ts',
  }
  return map[lang] ?? '.c'
}

async function saveActive(saveAs = false): Promise<void> {
  const isUntitled = activePath === null || activePath.startsWith('untitled-')
  if (isUntitled) saveAs = true

  let target = activePath
  if (saveAs) {
    const initName = activePath && !isUntitled ? baseName(activePath) : `main${extForLang(activeLang)}`
    const initDir = workspace ?? (activePath && isWinPath(activePath) ? dirName(activePath) : '')
    try {
      const picked = await saveDialog({
        title: 'Save As',
        defaultPath: initDir ? `${initDir}\\${initName}` : initName,
        filters: [{ name: 'Source files', extensions: ['c', 'cpp', 'cc', 'cxx', 'hh', 'py', 'js', 'mjs', 'ts', 'tsx', 'rs', 'go', 'java'] }],
      })
      if (typeof picked !== 'string' || !picked) return
      target = asRelInWorkspace(picked) ?? normSlashes(picked)
    } catch (err) {
      console.error('[saveActive] dialog ERROR:', err)
      toast(`Save failed: ${err}`, 'error')
      return
    }
  }
  if (target === null || target.startsWith('untitled-')) return

  try {
    await fsWrite(target, src)
  } catch (e) {
    consoleEl.textContent = `save failed: ${String(e)}`
    toast(`Save failed: ${String(e)}`, 'error')
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
    if (activePath?.startsWith('untitled-')) {
      fileCache.delete(activePath)
      savedCache.delete(activePath)
    }
    activePath = target
    activeLang = langOf(target) as Lang
    editor?.setLang(activeLang)
    createTab(target, src)
    // createTab → activateTab early-returns (path already active), so the
    // post-switch housekeeping a real tab switch gets is redone here
    renderPalette()
    tabViews.set(target, viewMode)
  } else {
    savedCache.set(target, src)
  }
  savedSnapshot = src
  if (activePath !== null) localStorage.removeItem(`blockide-autosave:${activePath}`)
  else localStorage.removeItem('blockide-autosave:scratch')
  markDirty()
  void invoke('journal_clear')
  if (workspace !== null && !isWinPath(target)) pushRecent(workspace, target)
  else if (isWinPath(target)) pushRecent(dirName(target), baseName(target))
  if (workspace !== null && !isWinPath(target)) void refreshFiles()
  statusFlash('Saved ✓')
  toast('Saved', 'success')
  blip(880, 0.07, 'sine', 0.05)
}

window.addEventListener('keydown', (e) => {
  // CodeMirror owns shortcuts inside the editor (Ctrl+Z among them) and
  // calls preventDefault — without this guard one Ctrl+Z ran BOTH history
  // systems: a double undo plus an unguarded setSource that re-pushed the
  // edit as a new entry, making undo/redo toggle in place
  if (e.defaultPrevented) return
  const ctrl = e.ctrlKey || e.metaKey
  if (!ctrl) return
  if (e.key.toLowerCase() === 's') {
    e.preventDefault()
    void saveActive(e.shiftKey) // Ctrl+Shift+S = Save As
  } else if (e.key.toLowerCase() === 'w') {
    // close active tab (Ctrl+W) — discard-guarded like every navigation
    e.preventDefault()
    if (activePath !== null) void closeTab(activePath)
  } else if (e.key === '/') {
    e.preventDefault()
    // Toggle keyboard shortcuts dialog
    const sd = document.getElementById('shortcuts-dialog') as HTMLDivElement
    if (sd.style.display === 'flex') {
      sd.style.display = 'none'
    } else {
      sd.style.display = 'flex'
    }
  } else if (e.key === 'z' && !e.shiftKey) {
    e.preventDefault()
    const prev = hist.undo(src)
    if (prev !== null) {
      src = prev
      srcEl.value = prev
      srcSetting = true
      editor?.setSource(prev)
      srcSetting = false
      void render(prev)
      markDirty()
      scheduleAutoSave()
    }
  } else if (e.key === 'y' || (e.key === 'z' && e.shiftKey)) {
    e.preventDefault()
    const next = hist.redo(src)
    if (next !== null) {
      src = next
      srcEl.value = next
      srcSetting = true
      editor?.setSource(next)
      srcSetting = false
      void render(next)
      markDirty()
      scheduleAutoSave()
    }
  } else if (e.key.toLowerCase() === 'd' && e.shiftKey) {
    e.preventDefault()
    const overlay = document.getElementById('debug-log') as HTMLDivElement
    if (overlay) overlay.style.display = overlay.style.display === 'none' ? 'block' : 'none'
  }
})

srcEl.addEventListener('input', () => {
  if (srcSetting) return // setSrc already pushed to history — don't double-count
  hist.push(src, 'type')
  src = srcEl.value
  void render(src)
  markDirty()
  scheduleAutoSave()
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
initEditorKeys({ srcEl, editor: () => editor, activeLang: () => activeLang })

// ------------------------------------------------------------------ pan/zoom
initPanZoom({ app, hostEl, world, roots: () => roots, screenToWorld, hitTestHeader })

// ------------------------------------------------------- Scratch palette
// Category rail + colored sections (docs/SCRATCH-BLOCKS-REFERENCE.md);
// Variables section owns Make-a-Variable / Make-a-List and per-var chips.
// One corrupted localStorage key must never take the whole app down.
const knownVars: string[] = readJsonStore<string[]>('blockide-vars', [])
const knownLists: string[] = readJsonStore<string[]>('blockide-lists', [])
/** declared type per variable (C/C++ need the declaration to exist first) */
const varTypesMap: Record<string, string> = readJsonStore<Record<string, string>>('blockide-vartypes', {})
let harvestedVars: string[] = [] // declared in the open file (file is truth)
let paletteSignature = ''
let programKinds = new Set<string>()
let programIncludes = new Set<string>()

function saveVars(): void {
  localStorage.setItem('blockide-vars', JSON.stringify(knownVars))
  localStorage.setItem('blockide-lists', JSON.stringify(knownLists))
  localStorage.setItem('blockide-vartypes', JSON.stringify(varTypesMap))
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
      blipError()
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
  renderPaletteFull({
    paletteEl,
    consoleEl,
    activeLang: () => activeLang,
    knownVars,
    knownLists,
    harvestedVars,
    varTypesMap,
    src: () => src,
    startHtmlDrag,
    openVarMenu,
    programKinds,
    programIncludes,
    renderPaletteLocks,
    getAppMode,
    getProfile,
    applyPalFilter,
    kbdPaletteDeps,
  })
}

// ------------------------------------------ keyboard-first palette (extracted to kbd-palette.ts)
const palFilter = document.getElementById('pal-filter') as HTMLInputElement
const kbdPaletteDeps = {
  paletteEl,
  consoleEl,
  srcEl,
  src: () => src,
  setSrc: (s: string) => { src = s; srcEl.value = s; editor?.setSource(s) },
  roots: () => roots,
  caretAnchor: () => caretAnchor,
  canonicalize: () => canonicalize(),
}
initKbdPalette(kbdPaletteDeps)

// ---------------------------------------------------------------- academy
// Module extracted to src/academy.ts — initAcademy wires all handlers

// debug/verification hooks (harmless in production)
initDebugHooks({
  hostEl,
  roots: () => roots,
  slotHits: () => slotHits,
  running: () => getRunning(),
  activeLang: () => activeLang,
  screenToWorld,
  hitTestHeader,
  commitSlotValue,
  validateVarName,
  knownVars,
  knownLists,
  saveVars,
  renderPalette,
})

initAcademy({
  invoke,
  consoleEl,
  paletteEl,
  setSrc: (s: string) => setSrc(s),
  src: () => src,
  savedSnapshot: (s?: string) => { if (s !== undefined) savedSnapshot = s; return savedSnapshot },
  caretAnchor: null, // will be set dynamically via deps getter
  tourHooks,
  running: () => getRunning(),
  blipError,
  toast,
  writeJsonStore,
  readJsonStore,
})
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
  if (themeBtn) {
    themeBtn.innerHTML = t === 'dark' ? icons.sun : icons.moon
    themeBtn.setAttribute('aria-label', t === 'dark' ? 'Switch to light theme' : 'Switch to dark theme')
  }
  localStorage.setItem('theme', t)
  app.renderer.background.color = t === 'dark' ? 0x0c3543 : 0xdff3fa
  editor?.setTheme(t === 'dark')
  lastPaintedSrc = null // block colors are theme-dependent — force a repaint
  void scheduleRender(src)
  world.emit('blockide:theme', t)
}

const storedTheme = localStorage.getItem('theme') ?? 'light'
const resolvedTheme = storedTheme === 'auto'
  ? (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
  : storedTheme as 'dark' | 'light'
setTheme(resolvedTheme)
themeBtn.addEventListener('click', () =>
  setTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'),
)

// ---- splash helpers (kept here — coupled to main.ts state) ----
function recentList(): RecentEntry[] {
  try {
    return JSON.parse(localStorage.getItem('blockide-recent') ?? '[]') as RecentEntry[]
  } catch {
    return []
  }
}

function pushRecent(root: string, rel: string): void {
  const list = recentList().filter((r) => !(r.root === root && r.rel === rel))
  list.unshift({ root, rel, ts: Date.now(), mode: getAppMode() })
  localStorage.setItem('blockide-recent', JSON.stringify(list.slice(0, 8)))
}

async function beginSession(lang: Lang, mode?: 'sandbox' | 'academy'): Promise<void> {
  activeLang = lang
  if (mode) setMode(mode)
  src = SAMPLES[lang]
  savedSnapshot = src
  activePath = null
  caretAnchor = null
  document.getElementById('splash')!.style.display = 'none'
  srcEl.value = src
  if (!editor) initEditor()
  editor?.setSource(src)
  editor?.setLang(lang)
  prevSrcForUndo = src // first undo of a session must restore the sample, not wipe to ''
  applySettings()
  renderPalette()
  void render(src)
  void refreshDiags()
  markDirty()
  updateTitle()
  if (!localStorage.getItem('tour-done')) setTimeout(startTour, 600)
  recoverSession()
}

// ---- register command palette commands (module-scope, so palette works even before splash) ----
registerCommands([
  { id: 'file.save', label: 'Save', category: 'File', shortcut: 'Ctrl+S', action: () => void saveActive() },
  { id: 'file.saveAs', label: 'Save As...', category: 'File', shortcut: 'Ctrl+Shift+S', action: () => void saveActive(true) },
  { id: 'file.open', label: 'Open File...', category: 'File', shortcut: 'Ctrl+O', action: () => void (document.getElementById('open-file') as HTMLButtonElement)?.click() },
  { id: 'file.openFolder', label: 'Open Folder...', category: 'File', action: () => void (document.getElementById('open-folder') as HTMLButtonElement)?.click() },
  { id: 'file.close', label: 'Close Tab', category: 'File', shortcut: 'Ctrl+W', action: () => { if (activePath) void closeTab(activePath) } },
  { id: 'file.new', label: 'New File', category: 'File', action: () => void (document.getElementById('new-file') as HTMLButtonElement)?.click() },
  { id: 'edit.undo', label: 'Undo', category: 'Edit', shortcut: 'Ctrl+Z', action: () => document.execCommand('undo') },
  { id: 'edit.redo', label: 'Redo', category: 'Edit', shortcut: 'Ctrl+Y', action: () => document.execCommand('redo') },
  { id: 'edit.find', label: 'Find & Replace', category: 'Edit', shortcut: 'Ctrl+F', action: () => editor?.view.focus() },
    { id: 'run.start', label: 'Run Program', category: 'Run', shortcut: 'F5', action: () => void startRun() },
    { id: 'run.stop', label: 'Stop Program', category: 'Run', shortcut: 'Shift+F5', action: () => stopRun() },
    { id: 'run.check', label: 'Check Code', category: 'Run', shortcut: 'Ctrl+Shift+C', when: () => getAppMode() === 'academy', action: () => void (document.getElementById('check-btn') as HTMLButtonElement)?.click() },
    { id: 'view.theme', label: 'Toggle Theme', category: 'View', action: () => setTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark') },
    { id: 'view.shortcuts', label: 'Keyboard Shortcuts', category: 'View', shortcut: 'Ctrl+/', action: () => { const sd = document.getElementById('shortcuts-dialog') as HTMLDivElement; sd.style.display = sd.style.display === 'flex' ? 'none' : 'flex' } },
    { id: 'view.blocks', label: 'Blocks View', category: 'View', shortcut: 'Ctrl+1', action: () => setView('blocks') },
    { id: 'view.split', label: 'Split View', category: 'View', shortcut: 'Ctrl+2', action: () => setView('split') },
    { id: 'view.text', label: 'Text View', category: 'View', shortcut: 'Ctrl+3', action: () => setView('text') },
    { id: 'view.sidebar', label: 'Toggle Sidebar', category: 'View', shortcut: 'Ctrl+B', action: () => { const sb = document.getElementById('sidebar') as HTMLElement; sb.style.display = sb.style.display === 'none' ? 'flex' : 'none'; window.dispatchEvent(new Event('resize')) } },
  ])

async function beginFromRecent(entry: RecentEntry): Promise<void> {
  if (!(await confirmDiscard())) return
  workspace = entry.root
  await refreshFiles()
  try {
    await openTab(entry.rel)
  } catch {
    consoleEl.textContent = `recent file missing: ${entry.rel}`
    return
  }
  if (entry.mode) setMode(entry.mode)
  document.getElementById('splash')!.style.display = 'none'
  if (!localStorage.getItem('tour-done')) setTimeout(startTour, 600)
}

// ---- wire splash (DI pattern: pass callbacks into the extracted module) ----
void wireSplash({
  beginSession,
  beginFromRecent,
  setTheme,
  srcEl,
  recentList,
})

// Splash screen quit button — closes the entire application
document.getElementById('splash-quit')?.addEventListener('click', () => {
  getCurrentWindow().close()
})

// Toolbar window controls — minimize, maximize, close the main app window
document.getElementById('tb-minimize')?.addEventListener('click', () => {
  getCurrentWindow().minimize()
})
document.getElementById('tb-maximize')?.addEventListener('click', () => {
  getCurrentWindow().toggleMaximize()
})
document.getElementById('tb-close')?.addEventListener('click', () => {
  getCurrentWindow().close()
})

window.addEventListener('resize', debouncedSaveState)
setTimeout(() => void restoreWindowState(), 100)
initContextMenu()
initResizers()
// module-eval-complete signal for headless drivers: static splash markup
// exists BEFORE this line (top-level pixi await), so DOM presence alone
// does not mean the click handlers are wired yet
;(window as unknown as { __bootDone?: boolean }).__bootDone = true

installPerfHooks()
initExtensions()
initDialogs()

// ------------------------------------------------ drag & drop files (#12)
initFileDrop({
  confirmDiscard,
  openTab,
  asRelInWorkspace,
  consoleEl,
})

// diagnostics strip toggle
const diagListEl = document.getElementById('diag-list') as HTMLDivElement
document.getElementById('diag-toggle')?.addEventListener('click', () => {
  const showing = diagListEl.style.display !== 'none'
  diagListEl.style.display = showing ? 'none' : 'block'
  const btn = document.getElementById('diag-toggle')
  if (btn) {
    btn.textContent = showing ? 'problems ▸' : 'problems ▾'
    btn.setAttribute('aria-expanded', String(!showing))
  }
  if (!showing) renderDiagList(getLastDiags())
})

// keybindings: Ctrl+Shift+P command palette, Ctrl+Enter / F5 run, Ctrl+B sidebar toggle
initKeybindings({
  togglePalette,
  startRun,
  setView,
  palFilter,
  running: () => getRunning(),
})

