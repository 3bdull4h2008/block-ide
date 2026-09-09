import { invoke as tauriInvoke } from '@tauri-apps/api/core'

function invoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  return tauriInvoke<T>(cmd, args)
}

import { blip } from './utils/audio'
import { isTextEntryTarget, keyToCode } from './utils/pure'
import { startMemPoll, stopMemPoll, reportLeaks, setMemState, memTraceEl, memListEl } from './mem-view'
import type { ViewMode } from './types'

export interface StageRunDeps {
  consoleEl: HTMLPreElement
  consoleInputRow: HTMLDivElement
  stopBtn: HTMLButtonElement
  fpsEl: HTMLSpanElement
  stageCanvas: HTMLCanvasElement
  stageCtx: CanvasRenderingContext2D
  src: () => string
  activeLang: () => string
  viewMode: () => ViewMode
  setView: (v: ViewMode) => void
  statusEl: HTMLSpanElement
  tourHooks: { advance?: (ev: 'edit' | 'run' | 'check') => void }
}

interface StageFrameOut {
  frame: number
  w: number
  h: number
  b64: string
}

export function initStageRun(deps: StageRunDeps): {
  startRun: () => Promise<void>
  stopRun: (msg?: string) => void
  getRunning: () => boolean
  stageKeyDown: (e: KeyboardEvent) => void
  stageKeyUp: (e: KeyboardEvent) => void
} {
  let running = false
  let lastFrame = 0
  let pollTimer = 0
  let fpsFrames = 0
  let fpsT0 = 0
  const u32max = 4294967295
  const downKeys = new Set<number>()

  function stageKeyDown(e: KeyboardEvent): void {
    if (!running || isTextEntryTarget(e)) return
    const code = keyToCode(e)
    if (code !== null) {
      e.preventDefault()
      void invoke('stage_keys', { down: Array.from(downKeys.add(code)) })
    }
  }
  function stageKeyUp(e: KeyboardEvent): void {
    if (!running || isTextEntryTarget(e)) return
    const code = keyToCode(e)
    if (code !== null) {
      downKeys.delete(code)
      void invoke('stage_keys', { down: Array.from(downKeys) })
    }
  }

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
        deps.stageCtx.imageSmoothingEnabled = false
        deps.stageCtx.drawImage(off, 0, 0, deps.stageCanvas.width, deps.stageCanvas.height)
        fpsFrames++
        const now = performance.now()
        if (now - fpsT0 > 500) {
          deps.fpsEl.textContent = `${Math.round((fpsFrames * 1000) / (now - fpsT0))} fps`
          fpsFrames = 0
          fpsT0 = now
        }
      }
    } catch {
      /* child not up yet */
    }
  }

  function finishRun(r: { stdout: string; stderr: string; exit: number; timed_out: boolean }): void {
    let out = ''
    if (r.stdout) out += r.stdout
    if (r.stderr) out += (out ? '\n[stderr] ' : '[stderr] ') + r.stderr
    out += `\n[exit ${r.exit}${r.timed_out ? ', timed out' : ''}]`
    deps.consoleEl.textContent = out.trim() || '(no output)'
    if (deps.viewMode() === 'blocks') {
      deps.setView('split')
      deps.statusEl.textContent = 'run finished — that output came from THIS code →'
    }
  }

  function stopRun(msg?: string): void {
    running = false
    window.removeEventListener('keydown', stageKeyDown)
    window.removeEventListener('keyup', stageKeyUp)
    clearInterval(pollTimer)
    stopMemPoll()
    deps.stopBtn.style.display = 'none'
    deps.consoleInputRow.style.display = 'none'
    deps.fpsEl.textContent = ''
    if (msg !== undefined) deps.consoleEl.textContent = msg
  }

  async function startRun(): Promise<void> {
    deps.consoleEl.textContent = 'running…'
    deps.tourHooks.advance?.('run')
    lastFrame = u32max
    downKeys.clear()
    running = true
    window.addEventListener('keydown', stageKeyDown)
    window.addEventListener('keyup', stageKeyUp)
    deps.stopBtn.style.display = 'block'
    deps.consoleInputRow.style.display = 'flex'
    fpsT0 = performance.now()
    fpsFrames = 0
    const tracing = memTraceEl.checked
    setMemState({ boxes: [], edges: [], live: false })
    memListEl.style.display = tracing ? 'block' : 'none'
    try {
      await invoke('run_start', { src: deps.src(), traceMem: tracing, lang: deps.activeLang() })
      ;(window as unknown as { __runStarted?: boolean }).__runStarted = true
    } catch (e) {
      stopRun(`[launch] ${String(e)}`)
      blip(200, 0.1, 'square', 0.05)
      return
    }
    if (tracing) {
      void invoke<boolean>('mem_attach').then((ok) => {
        if (ok) startMemPoll()
      })
    }
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
            stopRun()
            finishRun(r as { stdout: string; stderr: string; exit: number; timed_out: boolean })
            reportLeaks()
          }
        })
        .catch((e) => {
          stopRun(`[poll] ${String(e)}`)
        })
    }, 120)
  }

  return {
    startRun,
    stopRun,
    getRunning: () => running,
    stageKeyDown,
    stageKeyUp,
  }
}
