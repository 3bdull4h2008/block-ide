import type { ViewMode } from './types'

export interface KeybindDeps {
  togglePalette: () => void
  startRun: () => Promise<void>
  setView: (v: ViewMode) => void
  palFilter: HTMLInputElement
  running: () => boolean
}

export function initKeybindings(deps: KeybindDeps): void {
  window.addEventListener('keydown', (e) => {
    // handled keys (CodeMirror, app shortcuts) must not re-trigger here
    if (e.defaultPrevented) return
    if (e.ctrlKey && e.shiftKey && e.key === 'P') {
      e.preventDefault()
      deps.togglePalette()
      return
    }
    if (e.key === 'F5' || (e.ctrlKey && e.key === 'Enter')) {
      e.preventDefault()
      if (!deps.running()) void deps.startRun()
      return
    }
    if (e.ctrlKey && e.key.toLowerCase() === 'b') {
      e.preventDefault()
      const sb = document.getElementById('sidebar') as HTMLElement
      sb.style.display = sb.style.display === 'none' ? 'flex' : 'none'
      window.dispatchEvent(new Event('resize'))
      return
    }
    if (e.ctrlKey && e.key === '1') {
      e.preventDefault()
      deps.setView('blocks')
    } else if (e.ctrlKey && e.key === '2') {
      e.preventDefault()
      deps.setView('split')
    } else if (e.ctrlKey && e.key === '3') {
      e.preventDefault()
      deps.setView('text')
    } else if (e.key === '/' && !e.ctrlKey && !e.metaKey) {
      const t = e.target as HTMLElement | null
      // CM's editable is a contenteditable DIV — '/' while typing code
      // must reach the document, not hijack focus to the palette filter
      if (t && (t.tagName === 'TEXTAREA' || t.tagName === 'INPUT' || t.isContentEditable)) return
      e.preventDefault()
      deps.palFilter.focus()
      deps.palFilter.select()
    }
  })
}
