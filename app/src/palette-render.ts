import { blip, blipError } from './utils/audio'
import {
  PALETTE_GROUPS,
  VARIABLES_COLOR,
  validateVarName,
  type SourceLang,
  type PaletteItem,
  varChips,
  varTypes,
  listChips,
} from './palette'
import type { ProfileOut } from './academy'

export interface PaletteRenderDeps {
  paletteEl: HTMLDivElement
  consoleEl: HTMLPreElement
  activeLang: () => SourceLang
  knownVars: string[]
  knownLists: string[]
  harvestedVars: string[]
  varTypesMap: Record<string, string>
  src: () => string
  startHtmlDrag: (e: PointerEvent, payload: {
    label: string; snippet?: string; cat?: string;
    slotValue?: string; slotKind?: 'round' | 'bool';
    toplevel?: boolean; insertTop?: boolean;
  }) => void
  openVarMenu: (e: MouseEvent, varName: string) => void
  programKinds: Set<string>
  programIncludes: Set<string>
  renderPaletteLocks: (el: HTMLDivElement, mode: 'sandbox' | 'academy', profile: ProfileOut | null) => void
  getAppMode: () => 'sandbox' | 'academy'
  getProfile: () => ProfileOut | null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  applyPalFilter: (deps?: any) => void
  kbdPaletteDeps: any
}

function makeReporterChip(
  item: PaletteItem,
  deps: PaletteRenderDeps,
): HTMLDivElement {
  const el = document.createElement('div')
  el.className = `pal pal-${item.cat} pal-reporter`
  el.dataset.cat = item.cat
  el.dataset.group = item.cat
  el.textContent = item.name
  ;(el as unknown as { __item?: PaletteItem }).__item = item
  el.addEventListener('pointerdown', (e) => {
    if (el.classList.contains('locked')) {
      e.preventDefault()
      return
    }
    e.preventDefault()
    deps.startHtmlDrag(e, {
      label: item.name,
      slotValue: item.name,
      slotKind: 'round',
      cat: 'variables',
    })
  })
  return el
}

function makeVarChip(
  item: PaletteItem,
  deps: PaletteRenderDeps,
  isList?: boolean,
): HTMLDivElement {
  const el = document.createElement('div')
  el.className = `pal pal-${item.cat}${isList ? ' pal-list' : ''}`
  el.dataset.cat = item.cat
  el.dataset.group = item.cat
  el.textContent = item.name
  ;(el as unknown as { __item?: PaletteItem }).__item = item
  el.addEventListener('pointerdown', (e) => {
    if (el.classList.contains('locked')) {
      e.preventDefault()
      return
    }
    e.preventDefault()
    if (item.reporter !== undefined) {
      deps.startHtmlDrag(e, {
        label: item.name,
        slotValue: item.name,
        slotKind: 'round',
        cat: 'variables',
      })
    } else {
      deps.startHtmlDrag(e, { label: item.name, snippet: item.snippet, cat: 'variables' })
    }
  })
  el.addEventListener('contextmenu', (e) => {
    e.preventDefault()
    const varName = (item as { varName?: string }).varName ?? item.name
    if (!deps.knownVars.includes(varName) && !deps.knownLists.includes(varName)) {
      deps.consoleEl.textContent = `"${varName}" is declared in the file — rename or delete it in the code`
      return
    }
    deps.openVarMenu(e, varName)
  })
  return el
}

export function renderPaletteFull(deps: PaletteRenderDeps): void {
  const { paletteEl, consoleEl } = deps
  const st = paletteEl.scrollTop
  paletteEl.innerHTML = ''

  // Labeled category filter — replaces the unlabeled color-dot rail.
  const rail = document.createElement('div')
  rail.id = 'pal-cats'
  rail.setAttribute('role', 'toolbar')
  rail.setAttribute('aria-label', 'Block categories')
  paletteEl.appendChild(rail)

  const catFilter = paletteEl.dataset.catFilter ?? ''
  const pills: { el: HTMLButtonElement; key: string; head: HTMLElement }[] = []

  const setActivePill = (key: string): void => {
    for (const p of pills) p.el.classList.toggle('active', p.key === key)
  }

  const addPill = (key: string, label: string, color: string, head: HTMLElement): void => {
    const btn = document.createElement('button')
    btn.type = 'button'
    btn.className = 'pal-cat-pill'
    btn.dataset.key = key
    btn.style.setProperty('--pill-c', color)
    btn.title = `Show only ${label} blocks`
    btn.innerHTML = `<span class="pal-cat-swatch" style="background:${color}"></span><span>${label}</span>`
    btn.addEventListener('click', () => {
      const next = paletteEl.dataset.catFilter === key ? '' : key
      paletteEl.dataset.catFilter = next
      setActivePill(next)
      deps.applyPalFilter(deps.kbdPaletteDeps)
      if (next) {
        paletteEl.scrollTo({ top: Math.max(0, head.offsetTop - 48), behavior: 'smooth' })
      }
    })
    rail.appendChild(btn)
    pills.push({ el: btn, key, head })
  }

  // "All" pill first
  const allBtn = document.createElement('button')
  allBtn.type = 'button'
  allBtn.className = 'pal-cat-pill active'
  allBtn.dataset.key = ''
  allBtn.textContent = 'All'
  allBtn.title = 'Show every category'
  allBtn.addEventListener('click', () => {
    paletteEl.dataset.catFilter = ''
    setActivePill('')
    deps.applyPalFilter(deps.kbdPaletteDeps)
  })
  rail.appendChild(allBtn)
  pills.push({ el: allBtn, key: '', head: paletteEl })

  const addGroupHeader = (name: string, color: string): HTMLDivElement => {
    const head = document.createElement('div')
    head.className = 'pal-group'
    head.dataset.g = name.toLowerCase()
    head.dataset.group = name.toLowerCase()
    head.textContent = name
    head.style.background = color
    if (name === 'Notes') head.style.color = '#6b4d00'
    paletteEl.appendChild(head)
    return head
  }
  const addChip = (item: PaletteItem): void => {
    if (item.langs !== undefined && !item.langs.includes(deps.activeLang())) return
    if (item.reporter !== undefined) {
      paletteEl.appendChild(makeReporterChip(item, deps))
      return
    }
    const depOk =
      item.requires === undefined ||
      ((item.requires.kind === undefined || deps.programKinds.has(item.requires.kind)) &&
        (item.requires.include === undefined ||
          [...deps.programIncludes].some((inc) => inc.includes(item.requires!.include!))))
    const el = document.createElement('div')
    el.className = `pal pal-${item.cat}${depOk ? '' : ' pal-dep'}`
    el.dataset.cat = item.cat
    el.dataset.group = item.cat
    el.textContent = item.name
    ;(el as unknown as { __item?: PaletteItem }).__item = item
    if (!depOk) {
      const need = item.requires!.kind ?? item.requires!.include!
      el.title = `Needs ${need} in the program first`
    }
    el.addEventListener('pointerdown', (e) => {
      if (el.classList.contains('locked')) {
        e.preventDefault()
        return
      }
      if (!depOk) {
        e.preventDefault()
        blipError()
        consoleEl.textContent = `"${item.name}" needs ${item.requires!.kind ?? item.requires!.include!} in the program first`
        return
      }
      e.preventDefault()
      deps.startHtmlDrag(e, {
        label: item.name,
        snippet: item.snippet,
        cat: item.cat,
        toplevel: item.toplevel,
        insertTop: item.top,
      })
    })
    paletteEl.appendChild(el)
  }

  for (const g of PALETTE_GROUPS) {
    const visibleItems = g.items.filter((i) => i.langs === undefined || i.langs.includes(deps.activeLang()))
    if (visibleItems.length === 0) continue
    const head = addGroupHeader(g.name, g.color)
    addPill(g.name.toLowerCase(), g.name, g.color, head)
    for (const item of visibleItems) addChip(item)
  }

  if (deps.activeLang() === 'c' || deps.activeLang() === 'cpp') {
    const vhead = addGroupHeader('Variables', VARIABLES_COLOR)
    addPill('variables', 'Variables', VARIABLES_COLOR, vhead)

    const mk = document.createElement('button')
    mk.id = 'make-var'
    mk.dataset.cat = 'variables'
    mk.dataset.group = 'variables'
    mk.textContent = 'Make a Variable'
    mk.addEventListener('click', () => {
      if (mk.classList.contains('locked')) return
      const raw = window.prompt('Variable name:', 'score')
      if (raw === null) return
      const name = validateVarName(raw)
      if (name === null) {
        consoleEl.textContent = `"${raw}" is not a valid C variable name`
        blipError()
        return
      }
      const types = varTypes(deps.activeLang())
      const traw = window.prompt(`Type for "${name}" (${types.join('/')}):`, deps.varTypesMap[name] ?? 'int')
      if (traw === null) return
      const type = traw.trim().toLowerCase()
      if (!types.includes(type)) {
        consoleEl.textContent = `"${type}" is not a type I know — use ${types.join('/')}`
        blipError()
        return
      }
      if (!deps.knownVars.includes(name)) deps.knownVars.push(name)
      deps.varTypesMap[name] = type
      blip(740, 0.07, 'sine', 0.06)
    })
    paletteEl.appendChild(mk)

    const allVars = [...new Set([...deps.knownVars, ...deps.harvestedVars])]
    for (const v of allVars) {
      for (const chip of varChips(v, deps.varTypesMap[v] ?? 'int')) {
        const el = makeVarChip(chip, deps)
        el.dataset.group = 'variables'
        paletteEl.appendChild(el)
      }
    }

    const mkList = document.createElement('button')
    mkList.id = 'make-list'
    mkList.dataset.cat = 'variables'
    mkList.dataset.group = 'variables'
    mkList.textContent = 'Make a List'
    mkList.addEventListener('click', () => {
      if (mkList.classList.contains('locked')) return
      const raw = window.prompt('List name (C array):', 'grid')
      if (raw === null) return
      const name = validateVarName(raw)
      if (name === null) {
        consoleEl.textContent = `"${raw}" is not a valid C array name`
        blipError()
        return
      }
      if (!deps.knownLists.includes(name)) deps.knownLists.push(name)
      blip(740, 0.07, 'sine', 0.06)
    })
    paletteEl.appendChild(mkList)

    const listVars = new Set<string>(deps.knownLists)
    for (const v of allVars) {
      if (deps.src().includes(`${v}[`)) listVars.add(v)
    }
    for (const v of listVars) {
      for (const chip of listChips(v)) {
        const el = makeVarChip(chip, deps, true)
        el.dataset.group = 'variables'
        paletteEl.appendChild(el)
      }
    }
  }

  // restore filter state
  setActivePill(catFilter)
  paletteEl.dataset.catFilter = catFilter

  deps.applyPalFilter(deps.kbdPaletteDeps)
  paletteEl.scrollTop = st
  deps.renderPaletteLocks(paletteEl, deps.getAppMode(), deps.getProfile())
}
