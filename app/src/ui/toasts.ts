const toastsEl = document.getElementById('toasts') as HTMLDivElement

export function toast(msg: string, kind: 'success' | 'error' | 'info' = 'info', durationMs = 3000): void {
  const el = document.createElement('div')
  el.className = `toast toast-${kind}`
  el.textContent = msg
  toastsEl.appendChild(el)

  const dismiss = (): void => {
    if (!el.isConnected) return
    el.classList.add('removing')
    // CSS animationend is the happy path; the timeout is a hard fallback
    // so a toast can never stick forever if the animation is skipped.
    window.setTimeout(() => el.remove(), 250)
  }

  window.setTimeout(dismiss, Math.max(800, durationMs))
}
