import { getCurrentWindow } from '@tauri-apps/api/window'
import type { SourceLang } from './palette'
import { SAMPLES } from './lang-data'
import { saveWindowState } from './window-state'

export interface ExitAlertDeps {
  src: () => string
  activePath: () => string | null
  savedSnapshot: () => string
  activeLang: () => SourceLang
}

let exitHandled = false

export function hasUnsavedChanges(deps: ExitAlertDeps): boolean {
  const src = deps.src()
  const activePath = deps.activePath()
  const savedSnapshot = deps.savedSnapshot()
  const activeLang = deps.activeLang()
  return (
    (activePath !== null && src !== savedSnapshot) ||
    (activePath === null && src.trim().length > 0 && src !== SAMPLES[activeLang])
  )
}

function showExitDialog(): Promise<boolean> {
  return new Promise((resolve) => {
    const el = document.getElementById('exit-confirm') as HTMLDivElement
    el.style.display = 'flex'
    const cancel = document.getElementById('exit-cancel') as HTMLButtonElement
    const quit = document.getElementById('exit-quit') as HTMLButtonElement
    const close = (val: boolean) => {
      el.style.display = 'none'
      cancel.removeEventListener('click', onCancel)
      quit.removeEventListener('click', onQuit)
      el.removeEventListener('click', onOverlay)
      resolve(val)
    }
    const onCancel = () => close(false)
    const onQuit = () => close(true)
    const onOverlay = (e: MouseEvent) => { if (e.target === el) close(false) }
    cancel.addEventListener('click', onCancel)
    quit.addEventListener('click', onQuit)
    el.addEventListener('click', onOverlay)
  })
}

export function initExitAlert(deps: ExitAlertDeps): void {
  getCurrentWindow().onCloseRequested(async (event) => {
    if (exitHandled) return
    if (hasUnsavedChanges(deps)) {
      event.preventDefault()
      exitHandled = true
      const shouldClose = await showExitDialog()
      if (shouldClose) {
        await saveWindowState()
        await getCurrentWindow().destroy()
      } else {
        exitHandled = false
      }
    } else {
      await saveWindowState()
    }
  })

  window.addEventListener('beforeunload', (e) => {
    if (hasUnsavedChanges(deps)) {
      e.preventDefault()
      e.returnValue = ''
    }
  })
}
