import { invoke as tauriInvoke } from '@tauri-apps/api/core'

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

export const memTraceEl = document.getElementById('mem-trace') as HTMLInputElement
export const memListEl = document.getElementById('mem-list') as HTMLDivElement
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

export function startMemPoll(): void {
  clearInterval(memTimer)
  memTimer = window.setInterval(() => {
    void tauriInvoke<MemState>('mem_state')
      .then((s) => {
        lastMemState = s
        renderMemView()
      })
      .catch(() => {})
  }, 150)
}

export function reportLeaks(): void {
  clearInterval(memTimer)
  if (!memTraceEl.checked) return
  const boxes = lastMemState?.boxes ?? []
  let bytes = 0
  for (const b of boxes) bytes += b.size
  const head =
    boxes.length === 0
      ? '[memory] heap fully freed — no leaks ✓'
      : `[memory] ${boxes.length} live allocation(s), ${bytes} B not freed`
  const consoleEl = document.getElementById('console') as HTMLPreElement
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

export function stopMemPoll(): void { clearInterval(memTimer) }

export function getMemState(): MemState | null { return lastMemState }
export function setMemState(s: MemState | null): void { lastMemState = s }
