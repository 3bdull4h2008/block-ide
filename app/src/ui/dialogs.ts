import { blip } from '../utils/audio'

export function initDialogs(): void {
  // about dialog
  const aboutEl = document.getElementById('about') as HTMLDivElement
  document.getElementById('brand-logo')?.addEventListener('click', () => {
    blip(660, 0.06, 'sine', 0.05)
    aboutEl.style.display = 'flex'
  })
  document.getElementById('close-about')?.addEventListener('click', () => {
    aboutEl.style.display = 'none'
  })
  aboutEl.addEventListener('click', () => {
    aboutEl.style.display = 'none'
  })

  // Keyboard shortcuts dialog
  const shortcutsDialog = document.getElementById('shortcuts-dialog') as HTMLDivElement
  document.getElementById('show-shortcuts')?.addEventListener('click', (e) => {
    e.stopPropagation()
    aboutEl.style.display = 'none'
    shortcutsDialog.style.display = 'flex'
  })
  document.getElementById('close-shortcuts')?.addEventListener('click', () => {
    shortcutsDialog.style.display = 'none'
  })
  shortcutsDialog.addEventListener('click', () => {
    shortcutsDialog.style.display = 'none'
  })

  // Debug log clear button
  document.getElementById('debug-clear')?.addEventListener('click', () => {
    const content = document.getElementById('debug-log-content')
    if (content) content.innerHTML = ''
  })
}
