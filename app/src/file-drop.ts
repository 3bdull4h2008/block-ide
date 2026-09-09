import { normSlashes } from './utils/pure'
import { getCurrentWindow } from '@tauri-apps/api/window'

export interface FileDropDeps {
  confirmDiscard: () => Promise<boolean>
  openTab: (p: string) => Promise<void>
  asRelInWorkspace: (abs: string) => string | null
  consoleEl: HTMLPreElement
}

export function initFileDrop(deps: FileDropDeps): void {
  const exts = ['c', 'cpp', 'cc', 'cxx', 'hpp', 'hh', 'py', 'js', 'mjs', 'rs']
  getCurrentWindow()
    .onDragDropEvent(async (ev) => {
      if (ev.payload.type !== 'drop') return
      if (!(await deps.confirmDiscard())) return
      let opened = 0
      for (const raw of ev.payload.paths) {
        const p = normSlashes(raw)
        const ext = p.split('.').pop()?.toLowerCase() ?? ''
        if (!exts.includes(ext)) continue
        await deps.openTab(deps.asRelInWorkspace(p) ?? p)
        opened++
      }
      if (opened > 0) deps.consoleEl.textContent = `opened ${opened} dropped file(s)`
    })
    .catch(() => {})
}
