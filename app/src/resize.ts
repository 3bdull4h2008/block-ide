// Resizable panel dividers — drag to resize sidebar

export function initResizers(): void {
  document.addEventListener('mousedown', (e) => {
    const divider = (e.target as HTMLElement).closest('.panel-divider')
    if (!divider) return

    e.preventDefault()

    const key = (divider as HTMLElement).dataset.resize
    if (key !== 'sidebar') return // canvas divider is not implemented yet
    divider.classList.add('active')

    const start = e.clientX
    const startWidth = document.getElementById('sidebar')?.offsetWidth ?? 216

    const onMove = (ev: MouseEvent): void => {
      const delta = ev.clientX - start
      const app = document.getElementById('app')
      if (app) {
        const newW = Math.max(120, Math.min(400, startWidth + delta))
        app.style.gridTemplateColumns = `${newW}px 1fr`
      }
    }

    const onUp = (): void => {
      divider.classList.remove('active')
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
      // the grid change resized hostEl — let the Pixi renderer catch up,
      // otherwise the canvas stays stretched until the next window event
      window.dispatchEvent(new Event('resize'))
    }

    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  })
}
