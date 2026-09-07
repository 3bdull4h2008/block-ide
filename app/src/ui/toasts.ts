const toastsEl = document.getElementById('toasts') as HTMLDivElement

export function toast(msg: string, kind: 'success' | 'error' | 'info' = 'info', durationMs = 3000): void {
  const el = document.createElement('div')
  el.className = `toast toast-${kind}`
  el.textContent = msg
  toastsEl.appendChild(el)
  setTimeout(() => {
    el.classList.add('toast-exit')
    el.addEventListener('animationend', () => el.remove())
  }, durationMs)
}
