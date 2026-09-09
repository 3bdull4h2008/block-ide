import { getCurrentWindow } from '@tauri-apps/api/window'
import { LogicalSize, LogicalPosition } from '@tauri-apps/api/dpi'

export async function saveWindowState(): Promise<void> {
  try {
    const win = getCurrentWindow()
    const size = await win.outerSize()
    const pos = await win.outerPosition()
    const isMaximized = await win.isMaximized()
    localStorage.setItem('blockide-window-state', JSON.stringify({
      x: pos.x, y: pos.y,
      w: size.width, h: size.height,
      maximized: isMaximized,
    }))
  } catch {
    /* window state is best-effort */
  }
}

export async function restoreWindowState(): Promise<void> {
  try {
    const raw = localStorage.getItem('blockide-window-state')
    if (!raw) return
    const state = JSON.parse(raw) as { x?: number; y?: number; w?: number; h?: number; maximized?: boolean }
    const win = getCurrentWindow()
    if (state.w && state.h) {
      await win.setSize(new LogicalSize(state.w, state.h))
    }
    if (state.x !== undefined && state.y !== undefined) {
      const minVisible = 100
      const scr = screen as Screen & { availLeft?: number; availTop?: number }
      const scrLeft = scr.availLeft ?? 0
      const scrTop = scr.availTop ?? 0
      const scrW = scr.availWidth
      const scrH = scr.availHeight
      const x = Math.max(scrLeft, Math.min(state.x, scrLeft + scrW - minVisible))
      const y = Math.max(scrTop, Math.min(state.y, scrTop + scrH - minVisible))
      await win.setPosition(new LogicalPosition(x, y))
    }
    if (state.maximized) {
      await win.maximize()
    }
  } catch {
    /* window state restore is best-effort */
  }
}

let stateSaveTimer = 0
export const debouncedSaveState = (): void => {
  clearTimeout(stateSaveTimer)
  stateSaveTimer = window.setTimeout(() => void saveWindowState(), 500)
}
