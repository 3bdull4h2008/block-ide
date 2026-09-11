// Command palette — Ctrl+Shift+P fuzzy search over all editor actions
// This is a UI overlay, NOT the block palette (palette.ts)

export interface PaletteCommand {
  id: string
  label: string
  category: string
  shortcut?: string
  /** Optional mode gate — a false return hides the command from the list. */
  when?: () => boolean
  action: () => void
}

let commands: PaletteCommand[] = []
let paletteVisible = false
let selectedIndex = 0
let filteredCommands: PaletteCommand[] = []

export function registerCommands(cmds: PaletteCommand[]): void {
  commands = cmds
}

// ---- DOM setup ----
const overlay = document.createElement('div')
overlay.id = 'cmd-palette-overlay'
overlay.style.cssText =
  'display:none;position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,0.35)'

const panel = document.createElement('div')
panel.id = 'cmd-palette'
panel.style.cssText =
  'position:absolute;top:40px;left:50%;transform:translateX(-50%);width:560px;max-width:90vw;' +
  'background:#1e1e2e;border-radius:8px;box-shadow:0 12px 40px rgba(0,0,0,0.5);' +
  'display:flex;flex-direction:column;overflow:hidden;font-family:system-ui,sans-serif'

const input = document.createElement('input')
input.id = 'cmd-palette-input'
input.placeholder = 'Type a command...'
input.style.cssText =
  'width:100%;box-sizing:border-box;padding:10px 14px;font-size:14px;' +
  'background:#181825;color:#cdd6f4;border:none;border-bottom:1px solid #313244;' +
  'outline:none;font-family:inherit'
panel.appendChild(input)

const list = document.createElement('div')
list.id = 'cmd-palette-list'
list.style.cssText =
  'max-height:320px;overflow-y:auto;scrollbar-width:thin;scrollbar-color:#45475a transparent'
panel.appendChild(list)

overlay.appendChild(panel)
document.body.appendChild(overlay)

// ---- Render ----
function renderList(): void {
  const q = input.value.trim().toLowerCase()
  const available = commands.filter((c) => !c.when || c.when())
  filteredCommands = q === ''
    ? [...available]
    : available.filter((c) => c.label.toLowerCase().includes(q))

  if (selectedIndex >= filteredCommands.length) selectedIndex = Math.max(0, filteredCommands.length - 1)

  list.innerHTML = ''
  if (filteredCommands.length === 0) {
    const empty = document.createElement('div')
    empty.style.cssText = 'padding:12px 14px;color:#6c7086;font-size:13px'
    empty.textContent = 'No matching commands'
    list.appendChild(empty)
    return
  }

  // Group by category
  const grouped = new Map<string, PaletteCommand[]>()
  for (const cmd of filteredCommands) {
    const arr = grouped.get(cmd.category) ?? []
    arr.push(cmd)
    grouped.set(cmd.category, arr)
  }

  let idx = 0
  for (const [cat, cmds] of grouped) {
    const header = document.createElement('div')
    header.style.cssText =
      'padding:6px 14px 2px;font-size:11px;font-weight:600;color:#6c7086;' +
      'text-transform:uppercase;letter-spacing:0.5px;background:#11111b'
    header.textContent = cat
    list.appendChild(header)

    for (const cmd of cmds) {
      const row = document.createElement('div')
      row.className = 'cmd-palette-item'
      row.dataset.idx = String(idx)
      row.style.cssText =
        'display:flex;align-items:center;justify-content:space-between;' +
        'padding:7px 14px;cursor:pointer;font-size:13px;color:#cdd6f4;' +
        'border-left:3px solid transparent;transition:background 0.08s'

      if (idx === selectedIndex) {
        row.style.background = '#313244'
        row.style.borderLeftColor = '#89b4fa'
      }

      row.addEventListener('mouseenter', () => {
        if (idx !== selectedIndex) row.style.background = '#1e1e2e22'
      })
      row.addEventListener('mouseleave', () => {
        if (idx !== selectedIndex) row.style.background = 'transparent'
      })

      const label = document.createElement('span')
      label.textContent = cmd.label
      row.appendChild(label)

      if (cmd.shortcut) {
        const shortcut = document.createElement('span')
        shortcut.style.cssText =
          'font-size:11px;color:#6c7086;background:#181825;padding:2px 6px;' +
          'border-radius:4px;margin-left:12px;white-space:nowrap'
        shortcut.textContent = cmd.shortcut
        row.appendChild(shortcut)
      }

      const i = idx
      row.addEventListener('click', () => {
        hidePalette()
        filteredCommands[i]?.action()
      })

      list.appendChild(row)
      idx++
    }
  }
}

function scrollSelectedIntoView(): void {
  const row = list.querySelector(`[data-idx="${selectedIndex}"]`) as HTMLElement | null
  if (row) row.scrollIntoView({ block: 'nearest' })
}

// ---- Public API ----
export function showPalette(): void {
  if (paletteVisible) return
  paletteVisible = true
  selectedIndex = 0
  input.value = ''
  overlay.style.display = 'flex'
  renderList()
  input.focus()
}

export function hidePalette(): void {
  if (!paletteVisible) return
  paletteVisible = false
  overlay.style.display = 'none'
}

export function togglePalette(): void {
  if (paletteVisible) hidePalette()
  else showPalette()
}

// ---- Events ----
input.addEventListener('input', () => {
  selectedIndex = 0
  renderList()
})

input.addEventListener('keydown', (e) => {
  if (e.key === 'ArrowDown') {
    e.preventDefault()
    selectedIndex = Math.min(selectedIndex + 1, filteredCommands.length - 1)
    renderList()
    scrollSelectedIntoView()
  } else if (e.key === 'ArrowUp') {
    e.preventDefault()
    selectedIndex = Math.max(selectedIndex - 1, 0)
    renderList()
    scrollSelectedIntoView()
  } else if (e.key === 'Enter') {
    e.preventDefault()
    const cmd = filteredCommands[selectedIndex]
    if (cmd) {
      hidePalette()
      cmd.action()
    }
  } else if (e.key === 'Escape') {
    e.preventDefault()
    hidePalette()
  }
})

overlay.addEventListener('click', (e) => {
  if (e.target === overlay) hidePalette()
})

overlay.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    e.preventDefault()
    hidePalette()
  }
})
