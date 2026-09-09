/**
 * performance-audit.ts — Lightweight runtime performance monitoring.
 *
 * Tracks frame timing, memory pressure, and render hot-spots.
 * Exposed via window.__perf for debugging. No-op in production if tree-shaken.
 */

export interface PerfMetrics {
  fps: number
  frameMs: number
  memMB: number | null
  renderCount: number
  slowRenders: number
}

let frameTimes: number[] = []
let lastFrame = 0
let renderCount = 0
let slowRenders = 0
const SLOW_FRAME_MS = 16.67 // 60fps threshold

export function markFrame(): void {
  const now = performance.now()
  if (lastFrame > 0) {
    const dt = now - lastFrame
    frameTimes.push(dt)
    if (frameTimes.length > 120) frameTimes.shift()
    if (dt > SLOW_FRAME_MS) slowRenders++
    renderCount++
  }
  lastFrame = now
}

export function getMetrics(): PerfMetrics {
  const avgFrame = frameTimes.length > 0
    ? frameTimes.reduce((a, b) => a + b, 0) / frameTimes.length
    : 0
  const fps = avgFrame > 0 ? Math.round(1000 / avgFrame) : 0
  const mem = (performance as any).memory
    ? Math.round((performance as any).memory.usedJSHeapSize / 1048576)
    : null
  return { fps, frameMs: Math.round(avgFrame * 100) / 100, memMB: mem, renderCount, slowRenders }
}

export function resetMetrics(): void {
  frameTimes = []
  lastFrame = 0
  renderCount = 0
  slowRenders = 0
}

export function installPerfHooks(): void {
  const w = window as any
  if (w.__perf) return
  w.__perf = {
    metrics: getMetrics,
    reset: resetMetrics,
    dump(): void {
      const m = getMetrics()
      console.log(`[perf] fps=${m.fps} frameMs=${m.frameMs} mem=${m.memMB ?? '?'}MB renders=${m.renderCount} slow=${m.slowRenders}`)
    }
  }
}
