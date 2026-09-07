import { invoke } from '@tauri-apps/api/core'

export function initConsole(consoleEl: HTMLPreElement, consoleInput: HTMLInputElement): void {
  async function sendConsoleLine(): Promise<void> {
    const line = consoleInput.value
    if (line.length === 0) return
    consoleInput.value = ''
    consoleEl.textContent += `\n> ${line}`
    consoleEl.scrollTop = consoleEl.scrollHeight
    try {
      await invoke('run_stdin', { line })
    } catch (e) {
      consoleEl.textContent += `\n${String(e)}`
    }
  }

  consoleInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      void sendConsoleLine()
    }
  })
  document.getElementById('console-send')?.addEventListener('click', () => {
    void sendConsoleLine()
  })
}
