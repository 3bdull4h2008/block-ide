// Resizable panel dividers — drag to resize sidebar, canvas panels

export function initResizers(): void {
  document.addEventListener('mousedown', (e) => {
    const divider = (e.target as HTMLElement).closest('.panel-divider')
    if (!divider) return

    e.preventDefault()
    divider.classList.add('active')

    const key = (divider as HTMLElement).dataset.resize
    const start = e.clientX

    let startWidth: number
    if (key === 'sidebar') {
      startWidth = document.getElementById('sidebar')?.offsetWidth ?? 200
    } else if (key === 'canvas') {
      startWidth = document.getElementById('canvas-host')?.offsetWidth ?? 400
    } else return

    const onMove = (ev: MouseEvent): void => {
      const delta = ev.clientX - start
      if (key === 'sidebar') {
        const el = document.getElementById('sidebar')
        if (el) el.style.width = `${Math.max(120, Math.min(400, startWidth + delta))}px`
      } else if (key === 'canvas') {
        const el = document.getElementById('canvas-host')
        if (el) el.style.width = `${Math.max(200, Math.min(800, startWidth - delta))}px`
      }
    }

    const onUp = (): void => {
      divider.classList.remove('active')
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }

    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  })
}
