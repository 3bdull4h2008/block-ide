import { Graphics, type Container } from 'pixi.js'
import { flatten, type BBlock } from './blocks'
import type { SourceLang } from './palette'
import { type ViewMode, type Diag } from './types'

const ROW_H = 24

export interface DiagnosticsDeps {
  roots: () => BBlock[]
  overlay: Container
  src: () => string
  srcEl: HTMLTextAreaElement
  activeLang: () => SourceLang
  setView: (v: ViewMode) => void
  invoke: <T>(cmd: string, args?: Record<string, unknown>) => Promise<T>
}

let lastDiags: Diag[] = []

export function getLastDiags(): Diag[] { return lastDiags }

export function drawDiagOverlay(deps: DiagnosticsDeps, ds: Diag[]): void {
  deps.overlay.removeChildren()
  if (ds.length === 0 || deps.roots().length === 0) return
  const all = flatten(deps.roots())
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
  deps.overlay.addChild(g)
}

export function renderDiagList(deps: DiagnosticsDeps, ds: Diag[]): void {
  lastDiags = ds
  const list = document.getElementById('diag-list') as HTMLDivElement
  const count = document.getElementById('diag-count') as HTMLSpanElement
  const errs = ds.filter((d) => d.severity.includes('error')).length
  count.textContent = ds.length === 0 ? 'no problems' : `${ds.length} (${errs} errors)`
  if (list.style.display === 'none') return
  list.innerHTML = ''
  for (const d of ds) {
    const b = document.createElement('button')
    b.className = `diag-row ${d.severity.includes('error') ? 'err' : 'warn'}`
    const sev = document.createElement('span')
    sev.className = 'diag-sev'
    sev.textContent = d.severity.includes('error') ? '✖' : '▲'
    const loc = document.createElement('span')
    loc.className = 'diag-loc'
    loc.textContent = `L${d.line}:${d.col}`
    b.append(sev, loc, document.createTextNode(d.message))
    b.addEventListener('click', () => jumpToOffset(deps, d.offset))
    list.appendChild(b)
  }
}

function jumpToOffset(deps: DiagnosticsDeps, offset: number): void {
  deps.setView('split')
  requestAnimationFrame(() => {
    deps.srcEl.focus({ preventScroll: true })
    const src = deps.src()
    const lineEnd = src.indexOf('\n', offset)
    deps.srcEl.setSelectionRange(offset, lineEnd === -1 ? Math.min(src.length, offset + 80) : lineEnd)
    const line = src.slice(0, offset).split('\n').length - 1
    const lh = parseFloat(getComputedStyle(deps.srcEl).lineHeight || '19') || 19
    deps.srcEl.scrollTop = Math.max(0, line * lh - deps.srcEl.clientHeight / 2)
  })
}

export async function refreshDiags(deps: DiagnosticsDeps): Promise<void> {
  try {
    const ds = await deps.invoke<Diag[]>('diag_c', { src: deps.src(), lang: deps.activeLang() })
    drawDiagOverlay(deps, ds)
    renderDiagList(deps, ds)
  } catch {
    /* diagnostics are best-effort */
  }
}
