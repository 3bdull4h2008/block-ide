import { EditorView } from '@codemirror/view'
import { interpretC, type TraceStep } from './tracer'
import { esc } from './utils/pure'
import type { CadeEditor } from './editor'
import type { SourceLang } from './palette'
import type { CTreeJSON } from './blocks'

export interface TracePanelDeps {
  editor: CadeEditor | null
  src: () => string
  activeLang: () => SourceLang
  consoleEl: HTMLPreElement
  invoke: <T>(cmd: string, args?: Record<string, unknown>) => Promise<T>
}

let traceMode = false
let traceSteps: TraceStep[] = []
let traceIdx = -1
let tracePlayTimer: ReturnType<typeof setInterval> | null = null

export function getTraceMode(): boolean { return traceMode }
export function isTracePlaying(): boolean { return tracePlayTimer !== null }

export function initTracePanel(deps: TracePanelDeps): void {
  const panelEl = document.getElementById('trace-panel') as HTMLDivElement
  const stepInfo = document.getElementById('trace-step-info') as HTMLSpanElement
  const playBtn = document.getElementById('trace-play') as HTMLButtonElement
  const stepBtn = document.getElementById('trace-step') as HTMLButtonElement
  const resetBtn = document.getElementById('trace-reset') as HTMLButtonElement
  const varsEl = document.getElementById('trace-vars') as HTMLDivElement
  const outputEl = document.getElementById('trace-output') as HTMLPreElement
  const speedSlider = document.getElementById('trace-speed-slider') as HTMLInputElement
  const speedLabel = document.getElementById('trace-speed-label') as HTMLSpanElement
  const checkEl = document.getElementById('trace-check') as HTMLInputElement

  function showStep(idx: number): void {
    if (idx < 0 || idx >= traceSteps.length) return
    traceIdx = idx
    const step = traceSteps[idx]
    const total = traceSteps.length
    stepInfo.textContent = step.error
      ? `Error: ${step.error} (line ${step.line})`
      : `Step ${idx + 1}/${total} · line ${step.line} · ${step.kind}`
    stepInfo.style.color = step.error ? '#e06c75' : ''

    if (deps.editor && step.line > 0) {
      const line = deps.editor.view.state.doc.line(step.line)
      deps.editor.view.dispatch({
        selection: { anchor: line.from },
        effects: EditorView.scrollIntoView(line.from, { y: 'center' }),
      })
    }

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
    varsEl.innerHTML = varsHtml || '<div style="color:var(--fg-dim);padding:4px 0">no variables</div>'

    if (step.output) {
      outputEl.textContent = step.output
      outputEl.scrollTop = outputEl.scrollHeight
    }
  }

  function stop(): void {
    if (tracePlayTimer !== null) { clearInterval(tracePlayTimer); tracePlayTimer = null }
    playBtn.textContent = '▶'
  }

  function play(): void {
    if (tracePlayTimer !== null) { stop(); return }
    playBtn.textContent = '⏸'
    const delay = Math.max(20, 520 - Number(speedSlider.value) * 50)
    tracePlayTimer = setInterval(() => {
      if (traceIdx >= traceSteps.length - 1) { stop(); return }
      showStep(traceIdx + 1)
    }, delay)
  }

  function reset(): void {
    stop()
    traceIdx = -1
    traceSteps = []
    stepInfo.textContent = 'Ready'
    varsEl.innerHTML = ''
    outputEl.textContent = ''
  }

  playBtn.addEventListener('click', play)
  stepBtn.addEventListener('click', () => { stop(); if (traceIdx < traceSteps.length - 1) showStep(traceIdx + 1) })
  resetBtn.addEventListener('click', reset)
  speedSlider.addEventListener('input', () => {
    speedLabel.textContent = speedSlider.value
    if (tracePlayTimer !== null) { stop(); play() }
  })

  checkEl.addEventListener('change', () => {
    traceMode = checkEl.checked
    panelEl.style.display = traceMode ? 'flex' : 'none'
    window.dispatchEvent(new Event('resize'))
    if (!traceMode) reset()
  })

  async function startTraceRun(): Promise<void> {
    deps.consoleEl.textContent = 'tracing...'
    reset()
    const parsed = await deps.invoke<{ tree: CTreeJSON; has_errors: boolean }>('parse_c', { src: deps.src(), lang: deps.activeLang() })
    const result = interpretC(deps.src(), parsed.tree.root)
    traceSteps = result.steps
    if (traceSteps.length === 0) {
      stepInfo.textContent = 'No steps captured'
      deps.consoleEl.textContent = 'trace: no execution steps'
      return
    }
    deps.consoleEl.textContent = `trace: ${traceSteps.length} steps`
    showStep(0)
  }

  // Expose startTraceRun for the run button
  ;(window as unknown as { __startTraceRun?: () => Promise<void> }).__startTraceRun = startTraceRun
}
