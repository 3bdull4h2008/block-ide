// Context menu system — right-click anywhere for contextual actions

export interface ContextMenuItem {
  label: string
  shortcut?: string
  action?: () => void
  disabled?: boolean
  divider?: boolean
}

export type ContextMenuProvider = (target: HTMLElement) => ContextMenuItem[]

const providers: ContextMenuProvider[] = []

let menuEl: HTMLDivElement | null = null
let activeIndex = 0
let visibleItems: ContextMenuItem[] = []

function ensureMenu(): HTMLDivElement {
  if (menuEl) return menuEl
  menuEl = document.createElement('div')
  menuEl.id = 'context-menu'
  menuEl.style.cssText =
    'display:none;position:fixed;z-index:9999;background:#1e293b;color:#e2e8f0;border-radius:8px;' +
    'box-shadow:0 8px 24px rgba(0,0,0,0.35);padding:4px 0;min-width:180px;font:13px/1.4 "Segoe UI",system-ui,sans-serif;' +
    'pointer-events:auto;'
  document.body.appendChild(menuEl)

  menuEl.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      moveSelection(1)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      moveSelection(-1)
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const item = visibleItems[activeIndex]
      if (item && !item.disabled && !item.divider) {
        hideContextMenu()
        item.action?.()
      }
    } else if (e.key === 'Escape') {
      e.preventDefault()
      hideContextMenu()
    }
  })

  return menuEl
}

function moveSelection(delta: number): void {
  if (!menuEl) return
  const rows = Array.from(menuEl.querySelectorAll<HTMLElement>('.ctx-item'))
  if (rows.length === 0) return
  // skip disabled/divider rows
  let next = activeIndex
  do {
    next = ((next + delta) + rows.length) % rows.length
  } while (rows[next]?.dataset.disabled === 'true' && next !== activeIndex)
  if (rows[next]?.dataset.disabled === 'true') return
  activeIndex = next
  rows.forEach((r, i) => (r.style.background = i === activeIndex ? '#334155' : ''))
  rows[activeIndex]?.scrollIntoView({ block: 'nearest' })
}

export function registerContextMenuProvider(provider: ContextMenuProvider): void {
  providers.push(provider)
}

export function hideContextMenu(): void {
  if (menuEl) menuEl.style.display = 'none'
  activeIndex = 0
  visibleItems = []
}

function showContextMenu(x: number, y: number, items: ContextMenuItem[]): void {
  const menu = ensureMenu()
  menu.innerHTML = ''
  visibleItems = items
  activeIndex = 0

  for (const item of items) {
    if (item.divider) {
      const hr = document.createElement('div')
      hr.style.cssText = 'height:1px;margin:4px 8px;background:#334155;'
      menu.appendChild(hr)
      continue
    }
    const row = document.createElement('div')
    row.className = 'ctx-item'
    row.dataset.disabled = String(!!item.disabled)
    row.style.cssText =
      `padding:5px 14px;cursor:${item.disabled ? 'default' : 'pointer'};` +
      `color:${item.disabled ? '#64748b' : '#e2e8f0'};display:flex;justify-content:space-between;gap:16px;`
    const lbl = document.createElement('span')
    lbl.textContent = item.label
    row.appendChild(lbl)
    if (item.shortcut) {
      const sc = document.createElement('span')
      sc.textContent = item.shortcut
      sc.style.cssText = 'color:#94a3b8;font-size:11px;'
      row.appendChild(sc)
    }
    if (!item.disabled) {
      row.addEventListener('mouseenter', () => {
        activeIndex = Array.from(menu.querySelectorAll('.ctx-item')).indexOf(row)
        menu.querySelectorAll('.ctx-item').forEach((r, i) => ((r as HTMLElement).style.background = i === activeIndex ? '#334155' : ''))
      })
      row.addEventListener('click', () => {
        hideContextMenu()
        item.action?.()
      })
    }
    menu.appendChild(row)
  }

  if (items.length === 0) { hideContextMenu(); return }

  // measure after render
  menu.style.display = 'block'
  menu.style.left = '0'
  menu.style.top = '0'
  const mw = menu.offsetWidth
  const mh = menu.offsetHeight
  const vw = window.innerWidth
  const vh = window.innerHeight
  menu.style.left = `${x + mw > vw ? Math.max(0, x - mw) : x}px`
  menu.style.top = `${y + mh > vh ? Math.max(0, y - mh) : y}px`

  // focus for keyboard nav
  menu.tabIndex = -1
  menu.focus()
  // highlight first enabled item
  const rows = Array.from(menu.querySelectorAll<HTMLElement>('.ctx-item'))
  activeIndex = rows.findIndex((r) => r.dataset.disabled !== 'true')
  if (activeIndex >= 0) rows[activeIndex].style.background = '#334155'
}

export function initContextMenu(): void {
  document.addEventListener('contextmenu', (e) => {
    const target = e.target as HTMLElement
    // collect items from all matching providers
    let items: ContextMenuItem[] = []
    for (const provider of providers) {
      const result = provider(target)
      if (result.length > 0) {
        items = result
        break
      }
    }
    if (items.length === 0) return // let native menu show
    e.preventDefault()
    showContextMenu(e.clientX, e.clientY, items)
  })

  // close on click outside or scroll
  document.addEventListener('pointerdown', (e) => {
    if (menuEl && !menuEl.contains(e.target as Node)) hideContextMenu()
  })
  document.addEventListener('scroll', hideContextMenu, true)
}
