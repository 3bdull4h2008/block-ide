import type { Application, Container } from 'pixi.js'
import type { BBlock } from './blocks'

export interface PanZoomDeps {
  app: Application
  hostEl: HTMLDivElement
  world: Container
  roots: () => BBlock[]
  screenToWorld: (sx: number, sy: number) => { x: number; y: number }
  hitTestHeader: (roots: BBlock[], x: number, y: number) => BBlock | null
}

export function initPanZoom(deps: PanZoomDeps): void {
  const { app, hostEl, world } = deps
  let panning = false
  let lastX = 0
  let lastY = 0

  app.stage.eventMode = 'static'
  app.stage.hitArea = app.screen
  app.stage.on('pointerdown', (e) => {
    if ((e as { button?: number }).button !== undefined && (e as { button?: number }).button !== 0)
      return
    const w = deps.screenToWorld(e.global.x, e.global.y)
    if (deps.hitTestHeader(deps.roots(), w.x, w.y)) return
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
  // a pointerup outside the webview never arrives — without these the
  // canvas keeps panning on the next hover-move
  window.addEventListener('pointercancel', () => (panning = false))
  window.addEventListener('blur', () => (panning = false))
  hostEl.addEventListener(
    'wheel',
    (e) => {
      e.preventDefault()
      const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1
      const mx = e.offsetX
      const my = e.offsetY
      const wx = (mx - world.x) / world.scale.x
      const wy = (my - world.y) / world.scale.y
      // clamp: unbounded zoom-out collapses hit-testing and ghost math
      const next = Math.min(3, Math.max(0.2, world.scale.x * factor))
      world.scale.set(next)
      world.x = mx - wx * next
      world.y = my - wy * next
    },
    { passive: false },
  )
}
